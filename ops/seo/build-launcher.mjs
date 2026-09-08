import { build } from "vite";
import { builtinModules } from "node:module";
import { mkdir, copyFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fileHash } from "../../scripts/seo/publish.mjs";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const out = resolve(process.argv[2] ?? join(root, ".seo/tools"));
await mkdir(out, { recursive: true });
const result = await build({ root, configFile: false, ssr: { noExternal: true }, build: {
  ssr: join(root, "scripts/seo-launcher.mjs"), target: "node18", outDir: out, emptyOutDir: false, copyPublicDir: false,
  rollupOptions: { output: { entryFileNames: "seo-launcher.mjs", inlineDynamicImports: true } }
} });
for (const output of (Array.isArray(result) ? result : [result])) for (const chunk of output.output ?? []) {
  if (chunk.type !== "chunk") continue;
  for (const name of [...chunk.imports, ...chunk.dynamicImports]) if (!name.startsWith("node:") && !builtinModules.includes(name)) throw new Error(`Launcher has external import ${name}`);
  if (Object.keys(chunk.modules).some(name => /node_modules|[/\\]compile\.mjs$/.test(name))) throw new Error("Compiler or dependency code entered the stable launch graph");
}
const files = {};
for (const name of ["seo-launcher.mjs", "measure.sh", "ludoradar-seo-refresh.service", "ludoradar-seo-stage@.service", "ludoradar-seo-refresh.timer"]) {
  if (name !== "seo-launcher.mjs") await copyFile(join(root, "ops/seo", name), join(out, name));
  files[name] = await fileHash(join(out, name));
}
await writeFile(join(out, "tools.json"), JSON.stringify({ version: 1, files }, null, 2));
process.stdout.write(`${JSON.stringify({ toolsDirectory: out, manifestHash: await fileHash(join(out, "tools.json")) })}\n`);
