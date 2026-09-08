import { mkdir, lstat, realpath } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

export function uuid(value) {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value ?? "")) throw new Error("Invalid deployment identifier");
  return value;
}

// Inspect each ancestor before descending or creating its child.
export async function checkedDirectory(root, segments = [], { create = false } = {}) {
  let path = resolve(root);
  if (create) {
    try { await lstat(path); }
    catch (error) {
      if (error.code !== "ENOENT") throw error;
      await checkedDirectory(dirname(path), [], { create: true });
      try { await mkdir(path, { mode: 0o755 }); } catch (failure) { if (failure.code !== "EEXIST") throw failure; }
    }
  }
  const inspect = async () => {
    const info = await lstat(path);
    if (!info.isDirectory() || info.isSymbolicLink() || await realpath(path) !== path) throw new Error(`Unsafe deployment directory: ${path}`);
  };
  await inspect();
  for (const segment of segments) {
    if (!/^[a-zA-Z0-9_.-]+$/.test(segment) || segment === "." || segment === "..") throw new Error("Unsafe deployment path segment");
    path = join(path, segment);
    if (create) { try { await mkdir(path, { mode: 0o755 }); } catch (error) { if (error.code !== "EEXIST") throw error; } }
    await inspect();
  }
  return path;
}
