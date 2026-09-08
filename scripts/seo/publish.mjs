import { spawn } from "node:child_process";
import { randomUUID, createHash } from "node:crypto";
import { mkdir, open, readFile, writeFile, rename, symlink, lstat, realpath, unlink, readdir, rm } from "node:fs/promises";
import { dirname, join, resolve, relative, isAbsolute } from "node:path";

// Source build wrapper and the retained bundled worker share leases in this process.
const registry = Symbol.for("ludoradar.seo.active-lock-leases.v1");
const leases = globalThis[registry] ?? (globalThis[registry] = new WeakSet());
const skipped = () => ({ status: "skipped", reason: "lock-held" });

export async function withGenerationLock(lockPath, action, { platform = process.platform, spawnImpl = spawn } = {}) {
  lockPath = resolve(lockPath);
  await mkdir(dirname(lockPath), { recursive: true });
  let release;
  const lease = { lockPath, active: true };
  if (platform === "linux") {
    // Kernel-owned lock: killed workers and closed parent pipes release it automatically.
    const child = spawnImpl("flock", ["-F", "-n", "-E", "75", lockPath, process.execPath, "-e",
      "process.stdout.write('locked\\n'); process.stdin.resume();"], { stdio: ["pipe", "pipe", "pipe"] });
    child.once("exit", () => { lease.active = false; });
    child.once("error", () => { lease.active = false; });
    const acquired = await new Promise((accept, reject) => {
      child.once("error", reject);
      let output = "";
      child.stdout.on("data", chunk => {
        output += chunk.toString();
        if (output === "locked\n") accept(true);
        else if (output.includes("\n")) reject(new Error("Unexpected lock acquisition marker"));
      });
      child.once("exit", code => code === 75 ? accept(false) : reject(new Error(`flock exited before acquisition: ${code}`)));
    }).catch(error => { child.stdin.destroy(); child.kill(); throw error; });
    if (!acquired) return skipped();
    release = () => {
      if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
      return new Promise(resolve => { child.once("exit", resolve); child.stdin.end(); });
    };
  } else {
    // Windows test/development lease; never remove or steal a lock owned by another invocation.
    let handle;
    try { handle = await open(lockPath, "wx"); }
    catch (error) { if (error.code === "EEXIST") return skipped(); throw error; }
    const token = randomUUID();
    await handle.writeFile(JSON.stringify({ pid: process.pid, token }));
    release = async () => {
      await handle.close();
      const owner = JSON.parse(await readFile(lockPath, "utf8"));
      if (owner.token !== token) throw new Error("Publication lock ownership changed");
      await unlink(lockPath);
    };
  }
  leases.add(lease);
  try { return await action(lease); }
  finally { lease.active = false; leases.delete(lease); await release(); }
}

export async function pruneManagedState({ stateDirectory, currentGeneration, previousLiveDirectory, lockPath, lease }) {
  requireLease(lease, lockPath);
  const keepGenerations = new Set([resolve(currentGeneration), previousLiveDirectory ? dirname(resolve(previousLiveDirectory)) : ""]);
  const keepRuntimes = new Set();
  const removed = { generations: 0, runtimes: 0 };
  const generations = join(stateDirectory, "generations");
  const generationRoot = await realpath(generations);
  const obsolete = [];
  for (const entry of await readdir(generations, { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^[a-f0-9-]{36}$/.test(entry.name)) continue;
    const path = join(generations, entry.name);
    if (dirname(await realpath(path)) !== generationRoot || (await lstat(path)).isSymbolicLink()) throw new Error("Managed generation escaped its root");
    let manifest, validation;
    try {
      manifest = JSON.parse(await readFile(join(path, "manifest.json"), "utf8"));
      validation = JSON.parse(await readFile(join(path, "validation.json"), "utf8"));
    } catch { continue; }
    if (manifest.version !== 1 || manifest.generationId !== entry.name || validation.complete !== true) continue;
    if (keepGenerations.has(resolve(path))) {
      for (const runtime of [manifest.runtimeDirectory, manifest.previousRuntimeDirectory]) if (runtime) keepRuntimes.add(resolve(runtime));
    } else obsolete.push(path);
  }
  for (const path of obsolete) { requireLease(lease, lockPath); await rm(path, { recursive: true }); removed.generations++; }
  const runtimes = join(stateDirectory, "runtimes");
  let runtimeRoot;
  try { runtimeRoot = await realpath(runtimes); } catch (error) { if (error.code === "ENOENT") return removed; throw error; }
  for (const entry of await readdir(runtimes, { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^[a-f0-9]{12}-[a-f0-9-]{36}$/.test(entry.name)) continue;
    const path = join(runtimes, entry.name);
    if (keepRuntimes.has(resolve(path))) continue;
    if (dirname(await realpath(path)) !== runtimeRoot || (await lstat(path)).isSymbolicLink()) throw new Error("Managed runtime escaped its root");
    let release;
    try { release = JSON.parse(await readFile(join(path, "release.json"), "utf8")); } catch { continue; }
    if (release.version !== 1 || !/^[a-f0-9]{40}$/.test(release.uiSha) || !entry.name.startsWith(`${release.uiSha.slice(0, 12)}-`) ||
      ["entry-server.mjs", "refresh-worker.mjs", "template.html"].some(file => !/^[a-f0-9]{64}$/.test(release.files?.[file]))) continue;
    requireLease(lease, lockPath);
    await rm(path, { recursive: true }); removed.runtimes++;
  }
  return removed;
}

export function requireLease(lease, lockPath) {
  if (!leases.has(lease) || !lease.active || lease.lockPath !== resolve(lockPath)) throw new Error("Publication requires the active shared lock lease");
}

export async function writeJsonAtomic(path, data) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(data, null, 2));
  await rename(temporary, path);
}

export async function fileHash(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

export async function readVerifiedRuntime(runtimeDirectory) {
  const release = JSON.parse(await readFile(join(runtimeDirectory, "release.json"), "utf8"));
  if (release.version !== 1 || !release.uiSha || typeof release.indexingEnabled !== "boolean" || !/^https?:\/\//.test(release.siteUrl)) throw new Error("Invalid retained runtime release");
  const required = ["entry-server.mjs", "refresh-worker.mjs", "template.html"];
  if (!release.files || Object.keys(release.files).length !== required.length || required.some(file => !/^[a-f0-9]{64}$/.test(release.files[file]))) {
    throw new Error("Retained runtime integrity hashes are incomplete");
  }
  for (const file of required) if (await fileHash(join(runtimeDirectory, file)) !== release.files[file]) throw new Error(`Retained runtime integrity check failed: ${file}`);
  return release;
}

export async function readLiveGeneration(livePath) {
  try {
    const publicDirectory = await realpath(livePath);
    const manifestPath = join(publicDirectory, "..", "manifest.json");
    try { return { publicDirectory, manifest: JSON.parse(await readFile(manifestPath, "utf8")) }; }
    catch (error) { if (error.code === "ENOENT") return { publicDirectory, manifest: null }; throw error; }
  } catch (error) { if (error.code === "ENOENT") return null; throw error; }
}

async function verifyGeneration(stageDirectory, checkAccess) {
  checkAccess();
  let validation;
  try { validation = JSON.parse(await readFile(join(stageDirectory, "validation.json"), "utf8")); }
  catch { throw new Error("Generation has no complete validation record"); }
  checkAccess();
  if (validation.version !== 1 || validation.complete !== true || !validation.files || !Object.keys(validation.files).length) {
    throw new Error("Generation is not validated and complete");
  }
  const manifestHash = await fileHash(join(stageDirectory, "manifest.json"));
  checkAccess();
  if (validation.manifestHash !== manifestHash) throw new Error("Validated manifest changed");
  const routesHash = await fileHash(join(stageDirectory, "routes.json"));
  checkAccess();
  if (validation.routesHash !== routesHash) throw new Error("Validated routes changed");
  for (const [file, expected] of Object.entries(validation.files)) {
    checkAccess();
    const path = resolve(stageDirectory, "public", file);
    const within = relative(resolve(stageDirectory, "public"), path);
    if (!within || within.startsWith("..") || isAbsolute(within) || (await lstat(path)).isSymbolicLink()) throw new Error("Unsafe validation path");
    checkAccess();
    const actual = await fileHash(path);
    checkAccess();
    if (actual !== expected) throw new Error(`Validated generation file changed: ${file}`);
  }
}

export async function publishGeneration({ stageDirectory, livePath, lockPath, lease, checkDeadline = () => {} }) {
  if (!lease) return withGenerationLock(lockPath, active => publishGeneration({ stageDirectory, livePath, lockPath, lease: active, checkDeadline }));
  const checkAccess = () => { requireLease(lease, lockPath); checkDeadline(); };
  checkAccess();
  await verifyGeneration(stageDirectory, checkAccess);
  checkAccess();
  const publicDirectory = resolve(stageDirectory, "public");
  await mkdir(dirname(livePath), { recursive: true });
  const link = `${livePath}.next-${randomUUID()}`;
  await symlink(publicDirectory, link, process.platform === "win32" ? "junction" : "dir");
  let old;
  try { old = await lstat(livePath); } catch (error) { if (error.code !== "ENOENT") throw error; }
  let previousLiveDirectory = old ? await realpath(livePath) : null;
  let backup;
  let switched = false;
  try {
    // Linux replaces an existing symlink atomically. Bootstrap real directories and
    // Windows junction replacement require a preserved backup and rollback on failure.
    if (old && (!old.isSymbolicLink() || process.platform === "win32")) {
      backup = `${livePath}.previous-${randomUUID()}`;
      checkAccess();
      await rename(livePath, backup);
      if (!old.isSymbolicLink()) previousLiveDirectory = backup;
    }
    try { checkAccess(); await rename(link, livePath); switched = true; }
    catch (error) { if (backup) await rename(backup, livePath); throw error; }
    let cleanupWarning;
    if (backup && old.isSymbolicLink()) {
      try { await unlink(backup); } catch (error) { cleanupWarning = error.message; }
    }
    return { status: "published", publicDirectory, previousLiveDirectory, cleanupWarning };
  } finally { try { await unlink(link); } catch (error) { if (!switched && error.code !== "ENOENT") throw error; } }
}
