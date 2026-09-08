import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { builtinModules } from "node:module";
import { randomUUID } from "node:crypto";
import { build } from "vite";
import { applyIndexingPolicy, parseIndexingEnabled } from "./seo-output.mjs";
import { DEFAULT_SITE_URL } from "../src/app/utils/siteSeo.js";
import { fileHash, withGenerationLock, writeJsonAtomic } from "./seo/publish.mjs";
import { refreshSeo } from "./refresh-seo.mjs";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const stateDirectory = process.env.LUDORA_SEO_STATE_DIR ?? join(projectRoot, ".seo");
const livePath = process.env.LUDORA_SEO_LIVE_PATH ?? join(projectRoot, "dist");
const lockPath = process.env.LUDORA_SEO_LOCK_PATH ?? join(stateDirectory, "refresh.lock");
const siteUrl = process.env.LUDORA_SITE_URL ?? DEFAULT_SITE_URL;
const indexingEnabled = parseIndexingEnabled(process.env.LUDORA_INDEXING_ENABLED);
const apiOrigin = process.env.LUDORA_PRERENDER_API_ORIGIN ?? "http://127.0.0.1:4000";

const result = await withGenerationLock(lockPath, async lease => {
  const uiSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: projectRoot, encoding: "utf8" }).trim();
  const runtimeDirectory = join(stateDirectory, "runtimes", `${uiSha.slice(0, 12)}-${randomUUID()}`);
  await mkdir(runtimeDirectory, { recursive: true });
  await build({ root: projectRoot, build: { outDir: join(runtimeDirectory, "static"), emptyOutDir: true } });
  const template = applyIndexingPolicy(await readFile(join(runtimeDirectory, "static", "index.html"), "utf8"), indexingEnabled);
  await writeFile(join(runtimeDirectory, "template.html"), template);
  const renderer = await build({ root: projectRoot, define: { "process.env.NODE_ENV": JSON.stringify("production") }, ssr: { noExternal: true }, build: {
    ssr: resolve(projectRoot, "src/entry-server.tsx"), target: "node18", outDir: runtimeDirectory,
    emptyOutDir: false, copyPublicDir: false,
    rollupOptions: { output: { entryFileNames: "entry-server.mjs", inlineDynamicImports: true } }
  } });
  const worker = await build({ root: projectRoot, configFile: false, ssr: { noExternal: true }, build: {
    ssr: resolve(projectRoot, "scripts/refresh-seo.mjs"), target: "node18", outDir: runtimeDirectory,
    emptyOutDir: false, copyPublicDir: false,
    rollupOptions: { output: { entryFileNames: "refresh-worker.mjs", inlineDynamicImports: true } }
  } });
  for (const result of [renderer, worker]) {
    for (const output of (Array.isArray(result) ? result : [result])) {
      for (const chunk of output.output ?? []) {
        if (chunk.type !== "chunk") continue;
        for (const specifier of [...chunk.imports, ...chunk.dynamicImports]) {
          if (!specifier.startsWith("node:") && !builtinModules.includes(specifier)) throw new Error(`Retained runtime has an external dependency: ${specifier}`);
        }
      }
    }
  }
  const files = {};
  for (const file of ["entry-server.mjs", "refresh-worker.mjs", "template.html"]) files[file] = await fileHash(join(runtimeDirectory, file));
  await writeJsonAtomic(join(runtimeDirectory, "release.json"), { version: 1, uiSha, siteUrl, indexingEnabled, files });
  return refreshSeo({ runtimeDirectory, stateDirectory, livePath, lockPath, lease, apiOrigin });
});
if (result.status === "skipped") process.stdout.write(`${JSON.stringify(result)}\n`);
