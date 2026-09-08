import { createHash } from "node:crypto";
import { readdir, readFile, realpath } from "node:fs/promises";
import { join } from "node:path";
import { fileHash } from "./publish.mjs";

export async function captureBaseIdentity(livePath, check = () => {}) {
  check();
  let publicDirectory;
  try { publicDirectory = await realpath(livePath); }
  catch (error) { if (error.code === "ENOENT") return { kind: "absent" }; throw error; }
  const path = join(publicDirectory, "..", "manifest.json");
  try {
    const text = await readFile(path, "utf8"), manifest = JSON.parse(text);
    if (manifest.version !== 1 || !manifest.generationId || !manifest.uiSha || !manifest.runtimeDirectory) throw new Error("Invalid selected generation identity");
    return { kind: "managed", publicDirectory, generationId: manifest.generationId, uiSha: manifest.uiSha,
      runtimeDirectory: manifest.runtimeDirectory, manifestHash: createHash("sha256").update(text).digest("hex") };
  } catch (error) { if (error.code !== "ENOENT") throw error; }
  return { kind: "legacy", publicDirectory, treeHash: await directoryHash(publicDirectory, check) };
}

export async function directoryHash(publicDirectory, check = () => {}) {
  const hash = createHash("sha256");
  const walk = async (directory, prefix = "") => {
    for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      check();
      const relative = `${prefix}${entry.name}`, path = join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error("Legacy output contains a symbolic link");
      if (entry.isDirectory()) await walk(path, `${relative}/`);
      else if (entry.isFile()) hash.update(`${relative}\0${await fileHash(path)}\n`);
      else throw new Error("Unsupported legacy output entry");
    }
  };
  await walk(publicDirectory);
  return hash.digest("hex");
}

export function sameBase(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
export function runtimeIdentity(base) {
  return base.kind === "managed" ? { kind: base.kind, uiSha: base.uiSha, runtimeDirectory: base.runtimeDirectory } : base;
}
