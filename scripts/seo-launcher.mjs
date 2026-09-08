import { copyFile, readFile, rename, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import { prepareDeployment, stageDeployment, finalizeDeployment, rollbackLegacy, readResourceGate, verifyServiceExit, run } from "./seo/deployment.mjs";
import { refreshCurrentGeneration } from "./seo/current.mjs";
import { captureBaseIdentity } from "./seo/base.mjs";
import { checkedDirectory, uuid } from "./seo/paths.mjs";
import { fileHash, requireLease, withGenerationLock, writeJsonAtomic, publishGeneration, readVerifiedRuntime } from "./seo/publish.mjs";

export const productionConfig = () => ({
  projectRoot: process.env.LUDORA_UI_ROOT ?? "/opt/ludora/ludora-ui",
  serviceRoot: process.env.LUDORA_SERVICE_ROOT ?? "/opt/ludora/ludora-service",
  stateDirectory: process.env.LUDORA_SEO_STATE_DIR ?? "/var/lib/ludoradar-seo",
  livePath: process.env.LUDORA_SEO_LIVE_PATH ?? "/opt/ludora/ludora-ui/dist",
  lockPath: process.env.LUDORA_SEO_LOCK_PATH ?? "/run/lock/ludoradar-seo-refresh.lock",
  nginxPath: process.env.LUDORA_SEO_NGINX_PATH ?? "/etc/nginx/snippets/ludora-app.conf",
  apiOrigin: process.env.LUDORA_PRERENDER_API_ORIGIN ?? "http://127.0.0.1:4000",
});

export async function installTools(config, directory, expectedManifestHash) {
  await checkedDirectory(directory);
  if (!/^[a-f0-9]{64}$/.test(expectedManifestHash ?? "") || await fileHash(join(directory, "tools.json")) !== expectedManifestHash) throw new Error("Tool manifest integrity failed");
  const manifest = JSON.parse(await readFile(join(directory, "tools.json"), "utf8"));
  const names = ["seo-launcher.mjs", "measure.sh", "ludoradar-seo-refresh.service", "ludoradar-seo-stage@.service", "ludoradar-seo-refresh.timer"];
  if (manifest.version !== 1 || Object.keys(manifest.files ?? {}).length !== names.length) throw new Error("Invalid stable tool manifest");
  for (const name of names) if (await fileHash(join(directory, name)) !== manifest.files[name]) throw new Error(`Tool integrity failed: ${name}`);
  return withGenerationLock(config.lockPath, async lease => {
    const bin = await checkedDirectory(config.stateDirectory, ["bin"], { create: true });
    for (const name of names) {
      requireLease(lease, config.lockPath);
      const temporary = join(bin, `${name}.${randomUUID()}.tmp`);
      await copyFile(join(directory, name), temporary);
      await rename(temporary, join(bin, name));
    }
    return { status: "tools-installed", bin, manifestHash: expectedManifestHash };
  });
}

export async function launcher(args, config = productionConfig()) {
  const [command, first, second, third] = args;
  if (command === "prepare") return prepareDeployment(config, { id: first, uiSha: second, serviceSha: third });
  if (command === "stage") return stageDeployment(config, { id: first, stageId: second });
  if (command === "finalize") return finalizeDeployment(config, { id: first, stageId: second });
  if (command === "rollback-legacy") return rollbackLegacy(config, { id: first, stageId: second });
  if (command === "install-tools") return installTools(config, resolve(first), second);
  if (command === "install-units") return withGenerationLock(config.lockPath, async lease => {
    const bin = await checkedDirectory(config.stateDirectory, ["bin"]);
    for (const name of ["ludoradar-seo-refresh.service", "ludoradar-seo-stage@.service", "ludoradar-seo-refresh.timer"]) {
      requireLease(lease, config.lockPath);
      await run("sudo", ["-n", "install", "-o", "root", "-g", "root", "-m", "0644", join(bin, name), `/etc/systemd/system/${name}`]);
    }
    await run("sudo", ["-n", "systemctl", "daemon-reload"]);
    return { status: "units-installed", timerChanged: false };
  });
  if (command === "refresh") {
    const directory = await checkedDirectory(config.stateDirectory, ["daily-runs", uuid(first)], { create: true });
    // Measured daily receipts are per invocation; shared status.json cannot prove which service ran.
    await writeFile(join(directory, "request.json"), JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }), { flag: "wx" });
    try {
      const result = await refreshCurrentGeneration(config);
      await writeJsonAtomic(join(directory, "result.json"), { ...result, pid: process.pid });
      return result;
    } catch (error) {
      await writeJsonAtomic(join(directory, "result.json"), { status: "failed", pid: process.pid, error: error.message });
      throw error;
    }
  }
  if (command === "status") return { status: "status", selected: await captureBaseIdentity(config.livePath),
    worker: await readFile(join(config.stateDirectory, "status.json"), "utf8").then(JSON.parse).catch(() => null) };
  if (command === "rollback") return withGenerationLock(config.lockPath, async lease => {
    const generation = await checkedDirectory(config.stateDirectory, ["generations", uuid(first)]);
    const manifest = JSON.parse(await readFile(join(generation, "manifest.json"), "utf8"));
    await readVerifiedRuntime(manifest.runtimeDirectory);
    const result = await publishGeneration({ stageDirectory: generation, livePath: config.livePath, lockPath: config.lockPath, lease });
    return { ...result, selected: await captureBaseIdentity(config.livePath) };
  });
  if (command === "enable-timer") return withGenerationLock(config.lockPath, async lease => {
    const directory = await checkedDirectory(config.stateDirectory, ["daily-runs", uuid(first)]);
    const result = JSON.parse(await readFile(join(directory, "result.json"), "utf8"));
    const selected = await captureBaseIdentity(config.livePath);
    if (result.status !== "complete" || result.publicationCompleted !== true || selected.uiSha !== second || result.uiSha !== second || selected.generationId !== result.generationId) throw new Error("The exact daily service must successfully refresh the selected UI before timer enablement");
    const metrics = await readResourceGate(join(directory, "cgroup.metrics"), result);
    if (metrics.unit !== "ludoradar-seo-refresh.service") throw new Error("Missing successful exact-service measurement");
    await verifyServiceExit("ludoradar-seo-refresh.service");
    requireLease(lease, config.lockPath);
    await run("sudo", ["-n", "systemctl", "enable", "--now", "ludoradar-seo-refresh.timer"]);
    return { status: "timer-enabled", selected, dailyRun: first };
  });
  throw new Error("Usage: seo-launcher.mjs prepare ID UI_SHA SERVICE_SHA | stage ID STAGE_ID | finalize ID STAGE_ID | refresh RUN_ID | status | rollback GENERATION_ID | rollback-legacy ID STAGE_ID | enable-timer RUN_ID UI_SHA | install-tools DIRECTORY MANIFEST_SHA256 | install-units");
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  launcher(process.argv.slice(2)).then(result => {
    process.stdout.write(`${JSON.stringify(result)}\n`);
    process.exitCode = result.status === "skipped" ? 75 : result.status === "superseded" ? 76 : result.status === "failed" ? 1 : 0;
  }).catch(error => { process.stderr.write(`${error.stack ?? error}\n`); process.exitCode = 1; });
}
