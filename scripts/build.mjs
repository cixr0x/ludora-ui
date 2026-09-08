import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { parseIndexingEnabled } from "./seo-output.mjs";
import { DEFAULT_SITE_URL } from "../src/app/utils/siteSeo.js";
import { withGenerationLock } from "./seo/publish.mjs";
import { compileRuntime } from "./seo/compile.mjs";
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
  await compileRuntime({ projectRoot, outputDirectory: runtimeDirectory, expectedUiSha: uiSha, siteUrl, indexingEnabled, lockPath, lease });
  return refreshSeo({ runtimeDirectory, stateDirectory, livePath, lockPath, lease, apiOrigin });
});
if (result.status === "skipped") process.stdout.write(`${JSON.stringify(result)}\n`);
