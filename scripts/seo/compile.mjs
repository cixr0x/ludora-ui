import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { builtinModules } from "node:module";
import { build } from "vite";
import { applyIndexingPolicy } from "../seo-output.mjs";
import { fileHash, requireLease, writeJsonAtomic } from "./publish.mjs";

// Deployment imports this compiler only after acquiring the preparation lease.
export async function compileRuntime({ projectRoot, outputDirectory, expectedUiSha, siteUrl, indexingEnabled, lockPath, lease }) {
  const check = () => {
    requireLease(lease, lockPath);
    if (execFileSync("git", ["rev-parse", "HEAD"], { cwd: projectRoot, encoding: "utf8" }).trim() !== expectedUiSha) throw new Error("Compiler source SHA changed");
  };
  check();
  await mkdir(outputDirectory, { recursive: true });
  await build({ root: projectRoot, build: { outDir: join(outputDirectory, "static"), emptyOutDir: true } });
  check();
  await writeFile(join(outputDirectory, "template.html"), applyIndexingPolicy(await readFile(join(outputDirectory, "static", "index.html"), "utf8"), indexingEnabled));
  const renderer = await build({ root: projectRoot, define: { "process.env.NODE_ENV": JSON.stringify("production") }, ssr: { noExternal: true }, build: {
    ssr: resolve(projectRoot, "src/entry-server.tsx"), target: "node18", outDir: outputDirectory,
    emptyOutDir: false, copyPublicDir: false, rollupOptions: { output: { entryFileNames: "entry-server.mjs", inlineDynamicImports: true } }
  } });
  check();
  const worker = await build({ root: projectRoot, configFile: false, ssr: { noExternal: true }, build: {
    ssr: resolve(projectRoot, "scripts/refresh-seo.mjs"), target: "node18", outDir: outputDirectory,
    emptyOutDir: false, copyPublicDir: false, rollupOptions: { output: { entryFileNames: "refresh-worker.mjs", inlineDynamicImports: true } }
  } });
  check();
  for (const result of [renderer, worker]) for (const output of (Array.isArray(result) ? result : [result])) {
    for (const chunk of output.output ?? []) if (chunk.type === "chunk") {
      for (const specifier of [...chunk.imports, ...chunk.dynamicImports]) {
        if (!specifier.startsWith("node:") && !builtinModules.includes(specifier)) throw new Error(`Retained runtime has an external dependency: ${specifier}`);
      }
    }
  }
  const files = {};
  for (const file of ["entry-server.mjs", "refresh-worker.mjs", "template.html"]) files[file] = await fileHash(join(outputDirectory, file));
  check();
  await writeJsonAtomic(join(outputDirectory, "release.json"), { version: 1, uiSha: expectedUiSha, siteUrl, indexingEnabled, files });
  return outputDirectory;
}
