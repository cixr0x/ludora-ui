import { spawn } from "node:child_process";
import { readFile, writeFile, rename, lstat, realpath, copyFile, symlink, unlink } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { captureBaseIdentity, directoryHash, runtimeIdentity, sameBase } from "./base.mjs";
import { checkedDirectory, uuid } from "./paths.mjs";
import { fileHash, readVerifiedRuntime, requireLease, withGenerationLock, verifyGeneration, publishGeneration, pruneManagedState, writeJsonAtomic } from "./publish.mjs";

const requiredSha = value => { if (!/^[a-f0-9]{40}$/.test(value ?? "")) throw new Error("A full commit SHA is required"); return value; };
const readJson = async path => {
  if (!(await lstat(path)).isFile()) throw new Error(`Unsafe receipt: ${path}`);
  return JSON.parse(await readFile(path, "utf8"));
};
const optionalJson = async path => {
  try { return await readJson(path); } catch (error) { if (error.code === "ENOENT") return null; throw error; }
};
const immutable = (path, data) => writeFile(path, JSON.stringify(data, null, 2), { flag: "wx", mode: 0o644 });
const paths = config => Object.fromEntries(["projectRoot", "serviceRoot", "stateDirectory", "livePath", "lockPath", "nginxPath"].map(key => [key, resolve(config[key])]));
export function run(command, args, cwd) {
  return new Promise((accept, reject) => {
    const child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "inherit"] });
    let output = "";
    child.stdout.on("data", chunk => { output += chunk; if (output.length > 1024 * 1024) output = output.slice(-1024 * 1024); });
    child.once("error", reject);
    child.once("exit", code => code === 0 ? accept(output.trim()) : reject(new Error(`${command} exited ${code}`)));
  });
}

export const gitSource = {
  async verify(config, requested) {
    for (const [root, sha] of [[config.projectRoot, requested.uiSha], [config.serviceRoot, requested.serviceSha]]) {
      await checkedDirectory(root);
      if (await run("git", ["rev-parse", "HEAD"], root) !== requiredSha(sha)) throw new Error("Source SHA changed");
      if (await run("git", ["status", "--porcelain", "--untracked-files=no"], root)) throw new Error("Tracked source changes must be preserved before deployment");
    }
  },
  async prepare(config, requested) {
    await checkedDirectory(config.projectRoot);
    if (await run("git", ["status", "--porcelain", "--untracked-files=no"], config.projectRoot)) throw new Error("Tracked source changes must be preserved before deployment");
    await run("git", ["fetch", "origin"], config.projectRoot);
    await run("git", ["checkout", "--detach", requiredSha(requested.uiSha)], config.projectRoot);
    await this.verify(config, requested);
    await run(process.platform === "win32" ? "npm.cmd" : "npm", ["ci", "--no-audit", "--no-fund"], config.projectRoot);
  }
};

async function pending(config, id, create = false) {
  return checkedDirectory(config.stateDirectory, ["pending-deployments", uuid(id)], { create });
}
async function preparedRecord(config, id, deps, check) {
  const directory = await pending(config, id);
  const receipt = await readJson(join(directory, "prepared.json"));
  if (receipt.version !== 1 || receipt.id !== id || !sameBase(receipt.paths, paths(config))) throw new Error("Preparation receipt does not match deployment paths");
  requiredSha(receipt.uiSha); requiredSha(receipt.serviceSha);
  await (deps.source ?? gitSource).verify(config, receipt); check();
  const runtime = await checkedDirectory(directory, ["runtime"]);
  const release = await readVerifiedRuntime(runtime); check();
  if (release.uiSha !== receipt.uiSha || await directoryHash(runtime, check) !== receipt.runtimeHash) throw new Error("Prepared runtime integrity changed");
  if (await fileHash(join(directory, "nginx.conf")) !== receipt.nginxHash) throw new Error("Prepared Nginx integrity changed");
  return { directory, receipt, runtime, preparedHash: await fileHash(join(directory, "prepared.json")) };
}

export async function prepareDeployment(config, requested, deps = {}) {
  uuid(requested.id); requiredSha(requested.uiSha); requiredSha(requested.serviceSha);
  return withGenerationLock(config.lockPath, async lease => {
    const check = () => requireLease(lease, config.lockPath);
    const directory = await pending(config, requested.id, true);
    // A preparation ID is single-use, including failed compilations.
    await immutable(join(directory, "request.json"), { version: 1, ...requested, paths: paths(config) });
    try {
      const source = deps.source ?? gitSource;
      await source.prepare(config, requested); check();
      const base = await captureBaseIdentity(config.livePath, check);
      const compile = deps.compile ?? (await import(/* @vite-ignore */ pathToFileURL(join(config.projectRoot, "scripts/seo/compile.mjs")).href)).compileRuntime;
      const runtime = join(directory, "runtime");
      await compile({ projectRoot: config.projectRoot, outputDirectory: runtime, expectedUiSha: requested.uiSha,
        siteUrl: config.siteUrl ?? "https://www.ludoradar.mx", indexingEnabled: true, lockPath: config.lockPath, lease });
      check(); await source.verify(config, requested);
      const release = await readVerifiedRuntime(runtime);
      if (release.uiSha !== requested.uiSha || !release.indexingEnabled) throw new Error("Compiled release identity mismatch");
      await copyFile(join(config.serviceRoot, "ops/nginx/ludora-app.conf"), join(directory, "nginx.conf"));
      const receipt = { version: 1, ...requested, paths: paths(config), preparedAt: new Date().toISOString(),
        preparedRuntime: runtimeIdentity(base), runtimeHash: await directoryHash(runtime, check),
        nginxHash: await fileHash(join(directory, "nginx.conf")), previousNginxHash: await fileHash(config.nginxPath) };
      check(); await immutable(join(directory, "prepared.json"), receipt);
      return { status: "prepared", pendingDirectory: directory, ...receipt };
    } catch (error) {
      await writeJsonAtomic(join(directory, "prepare-status.json"), { status: "failed", error: error.message, publicationCompleted: false });
      throw error;
    }
  });
}

export async function stageDeployment(config, { id, stageId }, deps = {}) {
  uuid(id); uuid(stageId);
  return withGenerationLock(config.lockPath, async lease => {
    const started = performance.now(), check = () => requireLease(lease, config.lockPath);
    const prepared = await preparedRecord(config, id, deps, check);
    if (!sameBase(runtimeIdentity(await captureBaseIdentity(config.livePath, check)), prepared.receipt.preparedRuntime)) return { status: "superseded", reason: "selected-runtime-changed" };
    const attemptDirectory = await checkedDirectory(prepared.directory, ["stages", stageId], { create: true });
    await immutable(join(attemptDirectory, "request.json"), { version: 1, id, stageId, preparedHash: prepared.preparedHash });
    try {
      const runtimeWorker = await (deps.loadWorker ?? (directory => import(/* @vite-ignore */ pathToFileURL(join(directory, "refresh-worker.mjs")).href)))(prepared.runtime);
      check();
      const result = await runtimeWorker.generateSeoStage({ ...config, runtimeDirectory: prepared.runtime,
        stageDirectory: join(attemptDirectory, "generation"), statusPath: join(attemptDirectory, "status.json"),
        reusePages: false, lease, deadlineMs: 590000 - (performance.now() - started) });
      check(); await (deps.source ?? gitSource).verify(config, prepared.receipt);
      if (performance.now() - started >= 590000) throw new Error("Stage deadline exceeded");
      const processInfo = deps.processEvidence ? deps.processEvidence() : result.process;
      const generated = { ...result, version: 1, id, stageId, preparedHash: prepared.preparedHash,
        validationHash: await fileHash(join(result.stageDirectory, "validation.json")), process: processInfo };
      await immutable(join(attemptDirectory, "generated.json"), generated);
      return { ...generated, attemptDirectory };
      } catch (error) {
      await writeJsonAtomic(join(attemptDirectory, "status.json"), { status: "failed", phase: "stage", error: error.message, publicationCompleted: false });
      throw error;
    }
  });
}

export async function readResourceGate(path, generated) {
  const text = await readFile(path, "utf8"), metrics = {};
  for (const line of text.trim().split("\n")) {
    const split = line.indexOf("=");
    if (split < 1 || Object.hasOwn(metrics, line.slice(0, split))) throw new Error("Invalid cgroup metrics");
    metrics[line.slice(0, split)] = line.slice(split + 1);
  }
  const number = key => { if (!/^\d+$/.test(metrics[key] ?? "")) throw new Error(`Missing cgroup metric: ${key}`); return Number(metrics[key]); };
  if (number("version") !== 1 || number("worker_exit") !== 0 || number("worker_pid") !== generated.process.pid ||
      number("remaining_children") !== 0 || number("wall_seconds") >= 600 || number("memory_peak") > 402653184 ||
      number("memory_high") !== 335544320 || number("memory_max") !== 402653184 || metrics.cpu_max !== "50000 100000" ||
      number("memory_event_oom") !== 0 || number("memory_event_oom_kill") !== 0 || number("memory_event_max") !== 0 ||
      !generated.process.execArgv.includes("--max-old-space-size=256") || !(generated.process.heapLimitBytes > 0 && generated.process.heapLimitBytes <= 320 * 1024 * 1024) || generated.process.nice !== 10 ||
      !Number.isInteger(generated.process.holderPid) || generated.process.cgroup !== metrics.cgroup || generated.process.holderCgroup !== metrics.cgroup ||
      !/^\/system.slice\/ludoradar-seo-/.test(metrics.cgroup ?? "")) {
    throw new Error("Cold stage did not pass the configured resource gate");
  }
  number("cpu_usage_usec");
  return metrics;
}

export async function verifyServiceExit(unit) {
  const output = await run("systemctl", ["show", unit, "-p", "Result", "-p", "ExecMainStatus", "-p", "ActiveState"]);
  const values = Object.fromEntries(output.split("\n").map(line => line.split("=")));
  if (values.Result !== "success" || values.ExecMainStatus !== "0" || values.ActiveState !== "inactive") throw new Error(`The measured service has not completed successfully: ${unit}`);
}

function nginxOperations(config) {
  return {
    install: file => run("sudo", ["-n", "install", "-o", "root", "-g", "root", "-m", "0644", file, config.nginxPath]),
    validate: () => run("sudo", ["-n", "nginx", "-t"]),
    reload: () => run("sudo", ["-n", "systemctl", "reload", "nginx"]),
  };
}

async function retryPublishedStage(config, { id, stageId, directory, attempt, check }) {
  const proof = await optionalJson(join(attempt, "publication.json"));
  const previous = await optionalJson(join(attempt, "finalize-status.json"));
  if (!proof && previous?.publicationCompleted !== true) return null;
  // Publication provenance is immutable. A retry records its own outcome without
  // destroying the original completion/cleanup result or bootstrap backup path.
  const history = proof ?? previous;
  let result = { ...previous, ...history, publicationCompleted: true, retry: true, currentlySelected: false };
  try {
    const prepared = await readJson(join(directory, "prepared.json"));
    const generated = await readJson(join(attempt, "generated.json"));
    if (prepared.version !== 1 || prepared.id !== id || !sameBase(prepared.paths, paths(config)) ||
        generated.version !== 1 || generated.id !== id || generated.stageId !== stageId || generated.uiSha !== prepared.uiSha ||
        generated.preparedHash !== await fileHash(join(directory, "prepared.json"))) throw new Error("Published stage receipt bindings changed");
    requiredSha(prepared.uiSha); requiredSha(prepared.serviceSha); uuid(generated.generationId);
    const runtimeName = `${prepared.uiSha.slice(0, 12)}-${id}`;
    const runtimeDirectory = join(resolve(config.stateDirectory), "runtimes", runtimeName);
    const generationDirectory = join(resolve(config.stateDirectory), "generations", generated.generationId);
    if (history.runtimeDirectory !== runtimeDirectory || history.generationDirectory !== generationDirectory ||
        (proof && (proof.version !== 1 || proof.id !== id || proof.stageId !== stageId || proof.uiSha !== prepared.uiSha ||
          proof.serviceSha !== prepared.serviceSha || proof.generationId !== generated.generationId || proof.preparedHash !== generated.preparedHash))) throw new Error("Published stage provenance changed");
    result = { ...result, uiSha: prepared.uiSha, serviceSha: prepared.serviceSha, generationId: generated.generationId };
    const selected = await captureBaseIdentity(config.livePath, check);
    result.currentlySelected = selected.kind === "managed" && selected.publicDirectory === join(generationDirectory, "public") &&
      selected.generationId === generated.generationId && selected.uiSha === prepared.uiSha && selected.runtimeDirectory === runtimeDirectory;
    if (!result.currentlySelected) {
      result = { ...result, status: "superseded", reason: "selected-generation-changed", selected };
    } else {
      await checkedDirectory(config.stateDirectory, ["runtimes", runtimeName]);
      await checkedDirectory(config.stateDirectory, ["generations", generated.generationId]);
      const release = await readVerifiedRuntime(runtimeDirectory); check();
      if (release.uiSha !== prepared.uiSha || await directoryHash(runtimeDirectory, check) !== prepared.runtimeHash ||
          (proof && (selected.manifestHash !== proof.manifestHash || await fileHash(join(generationDirectory, "validation.json")) !== proof.validationHash))) throw new Error("Published generation integrity changed");
      await verifyGeneration(generationDirectory, check);
      // Publication alone does not erase a failed or interrupted cleanup phase.
      result.status = previous?.publicationCompleted === true && previous.status === "published" ? "published" : "failed";
      if (result.status === "failed") result.error = previous?.error ?? "Publication completed without a successful finalization record";
    }
  } catch (error) {
    result = { ...result, status: "failed", error: `Publication retry verification failed: ${error.message}` };
  }
  check(); await writeJsonAtomic(join(attempt, "finalize-retry-status.json"), result);
  return result;
}

export async function finalizeDeployment(config, { id, stageId }, deps = {}) {
  uuid(id); uuid(stageId);
  return withGenerationLock(config.lockPath, async lease => {
    const check = () => requireLease(lease, config.lockPath), directory = await pending(config, id);
    const attempt = await checkedDirectory(directory, ["stages", stageId]);
    const retry = await retryPublishedStage(config, { id, stageId, directory, attempt, check });
    if (retry) return retry;
    let runtimeDirectory = join(directory, "runtime"), generationDirectory = join(attempt, "generation");
    let publicationCompleted = false, nginxTouched = false, oldManifest, oldValidation, finalRuntime, finalGeneration, publication;
    const nginx = deps.nginx ?? nginxOperations(config), move = deps.rename ?? rename;
    const rollbackErrors = [];
    try {
      const prepared = await preparedRecord(config, id, deps, check);
      const generated = await readJson(join(attempt, "generated.json"));
      if (generated.version !== 1 || generated.id !== id || generated.stageId !== stageId || generated.status !== "generated" ||
          generated.publicationCompleted !== false || generated.uiSha !== prepared.receipt.uiSha || generated.preparedHash !== prepared.preparedHash ||
          generated.stageDirectory !== generationDirectory || await fileHash(join(generationDirectory, "validation.json")) !== generated.validationHash) throw new Error("Generated receipt integrity mismatch");
      uuid(generated.generationId);
      const resource = await readResourceGate(join(attempt, "cgroup.metrics"), generated);
      await (deps.serviceGate ?? verifyServiceExit)(`ludoradar-seo-stage@${id}.${stageId}.service`); check();
      if (!sameBase(await captureBaseIdentity(config.livePath, check), generated.baseIdentity)) {
        const result = { status: "superseded", reason: "selected-generation-changed", publicationCompleted, runtimeDirectory, generationDirectory };
        await writeJsonAtomic(join(attempt, "finalize-status.json"), result); return result;
      }
      await checkedDirectory(attempt, ["generation"]);
      await verifyGeneration(generationDirectory, check);
      if (await fileHash(config.nginxPath) !== prepared.receipt.previousNginxHash) throw new Error("Nginx configuration changed since preparation");
      finalRuntime = join(await checkedDirectory(config.stateDirectory, ["runtimes"], { create: true }), `${prepared.receipt.uiSha.slice(0, 12)}-${id}`);
      finalGeneration = join(await checkedDirectory(config.stateDirectory, ["generations"], { create: true }), generated.generationId);
      for (const target of [finalRuntime, finalGeneration]) {
        try { await lstat(target); throw new Error(`Promotion target already exists: ${target}`); } catch (error) { if (error.code !== "ENOENT") throw error; }
      }
      await copyFile(config.nginxPath, join(attempt, "nginx.previous.conf"));
      nginxTouched = true; check();
      await nginx.install(join(directory, "nginx.conf")); check();
      await nginx.validate(); check(); await nginx.reload(); check();
      oldManifest = await readFile(join(generationDirectory, "manifest.json"), "utf8");
      oldValidation = await readFile(join(generationDirectory, "validation.json"), "utf8");
      const manifest = JSON.parse(oldManifest), validation = JSON.parse(oldValidation);
      if (manifest.uiSha !== prepared.receipt.uiSha || manifest.generationId !== generated.generationId || manifest.runtimeDirectory !== runtimeDirectory) throw new Error("Unexpected manifest retargeting source");
      manifest.runtimeDirectory = finalRuntime;
      await writeJsonAtomic(join(generationDirectory, "manifest.json"), manifest);
      validation.manifestHash = await fileHash(join(generationDirectory, "manifest.json"));
      await writeJsonAtomic(join(generationDirectory, "validation.json"), validation);
      await verifyGeneration(generationDirectory, check);
      check(); await move(runtimeDirectory, finalRuntime); runtimeDirectory = finalRuntime;
      check(); await move(generationDirectory, finalGeneration); generationDirectory = finalGeneration;
      publication = await (deps.publish ?? publishGeneration)({ stageDirectory: generationDirectory, livePath: config.livePath, lockPath: config.lockPath, lease });
      publicationCompleted = true;
      await immutable(join(attempt, "publication.json"), { version: 1, id, stageId, publicationCompleted,
        preparedHash: prepared.preparedHash, uiSha: prepared.receipt.uiSha, serviceSha: prepared.receipt.serviceSha,
        generationId: generated.generationId, runtimeDirectory, generationDirectory, previousLiveDirectory: publication.previousLiveDirectory,
        manifestHash: await fileHash(join(generationDirectory, "manifest.json")), validationHash: await fileHash(join(generationDirectory, "validation.json")) });
      const selected = await captureBaseIdentity(config.livePath, check);
      if (selected.uiSha !== prepared.receipt.uiSha || selected.generationId !== generated.generationId || selected.runtimeDirectory !== runtimeDirectory || selected.publicDirectory !== join(generationDirectory, "public")) throw new Error("Published generation identity mismatch");
      const pruned = await (deps.prune ?? pruneManagedState)({ stateDirectory: config.stateDirectory, currentGeneration: generationDirectory, previousLiveDirectory: publication.previousLiveDirectory, lockPath: config.lockPath, lease });
      if (publication.cleanupWarning) throw new Error(`Publication cleanup failed: ${publication.cleanupWarning}`);
      const result = { status: "published", publicationCompleted, uiSha: prepared.receipt.uiSha, serviceSha: prepared.receipt.serviceSha,
        generationId: generated.generationId, runtimeDirectory, generationDirectory, previousLiveDirectory: publication.previousLiveDirectory, resource, pruned };
      await writeJsonAtomic(join(attempt, "finalize-status.json"), result);
      return result;
    } catch (error) {
      const restore = async (phase, action) => { try { check(); await action(); } catch (failure) { rollbackErrors.push({ phase, error: failure.message }); } };
      // A switched public path is authoritative even if a publisher reports a later error.
      try { if (await realpath(config.livePath) === join(generationDirectory, "public")) publicationCompleted = true; } catch {}
      if (!publicationCompleted) {
        if (generationDirectory === finalGeneration) await restore("generation", async () => { await move(generationDirectory, join(attempt, "generation")); generationDirectory = join(attempt, "generation"); });
        if (runtimeDirectory === finalRuntime) await restore("runtime", async () => { await move(runtimeDirectory, join(directory, "runtime")); runtimeDirectory = join(directory, "runtime"); });
        if (oldManifest) await restore("manifest", async () => { await writeFile(join(generationDirectory, "manifest.json"), oldManifest); await writeFile(join(generationDirectory, "validation.json"), oldValidation); });
        if (nginxTouched) await restore("nginx", async () => { await nginx.install(join(attempt, "nginx.previous.conf")); await nginx.validate(); await nginx.reload(); });
      }
      const result = { status: "failed", publicationCompleted, error: error.message, rollbackErrors, runtimeDirectory, generationDirectory,
        previousLiveDirectory: publication?.previousLiveDirectory };
      await writeJsonAtomic(join(attempt, "finalize-status.json"), result);
      return result;
    }
  });
}

export async function rollbackLegacy(config, { id, stageId }, deps = {}) {
  if (process.platform !== "linux") throw new Error("Legacy rollback is a Linux deployment operation");
  return withGenerationLock(config.lockPath, async lease => {
    const check = () => requireLease(lease, config.lockPath), directory = await pending(config, id);
    const attempt = await checkedDirectory(directory, ["stages", uuid(stageId)]);
    const prepared = await readJson(join(directory, "prepared.json")), generated = await readJson(join(attempt, "generated.json"));
    const published = await optionalJson(join(attempt, "publication.json")) ?? await readJson(join(attempt, "finalize-status.json"));
    if (!sameBase(prepared.paths, paths(config)) || !published.publicationCompleted || generated.baseIdentity.kind !== "legacy") throw new Error("This deployment has no verified bootstrap backup");
    const backup = published.previousLiveDirectory;
    const prefix = `${resolve(config.livePath)}.previous-`;
    if (typeof backup !== "string" || !backup.startsWith(prefix)) throw new Error("Unexpected bootstrap backup target");
    uuid(backup.slice(prefix.length));
    await checkedDirectory(backup);
    if (await directoryHash(backup, check) !== generated.baseIdentity.treeHash) throw new Error("Bootstrap backup contents changed");
    if (!(await lstat(config.livePath)).isSymbolicLink()) throw new Error("Expected a managed live symlink before rollback");
    if (await fileHash(config.nginxPath) !== prepared.nginxHash || await fileHash(join(attempt, "nginx.previous.conf")) !== prepared.previousNginxHash) throw new Error("Rollback Nginx integrity mismatch");
    const nginx = deps.nginx ?? nginxOperations(config), link = `${config.livePath}.rollback-${randomUUID()}`;
    await checkedDirectory(dirname(config.livePath));
    let switched = false;
    try {
      await nginx.install(join(attempt, "nginx.previous.conf")); check(); await nginx.validate(); await nginx.reload(); check();
      await symlink(backup, link); check(); await rename(link, config.livePath); switched = true;
      return { status: "rolled-back", publicDirectory: backup, selected: await captureBaseIdentity(config.livePath, check) };
    } catch (error) {
      if (!switched) { check(); await nginx.install(join(directory, "nginx.conf")); await nginx.validate(); await nginx.reload(); }
      throw error;
    } finally { await unlink(link).catch(error => { if (error.code !== "ENOENT") throw error; }); }
  });
}
