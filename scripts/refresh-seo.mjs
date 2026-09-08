import { mkdir, readFile, writeFile, copyFile, cp, readdir, rm, lstat } from "node:fs/promises";
import { dirname, join, resolve, relative, isAbsolute, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import { fetchSeoExport } from "./seo/export.mjs";
import { canonicalFile, contentFingerprint, reconcilePages } from "./seo/manifest.mjs";
import { fileHash, publishGeneration, pruneManagedState, readLiveGeneration, readVerifiedRuntime, requireLease, withGenerationLock, writeJsonAtomic } from "./seo/publish.mjs";
import { robotsDocument, sitemapDocument } from "./seo-output.mjs";
import { selectFeaturedGames } from "../src/app/utils/homePrerender.js";
import { buildCatalogIndex, catalogPageDescriptors, catalogPageModel, categoryPath, CATALOG_PAGE_SIZE } from "../src/app/utils/catalogSeo.js";
import { captureBaseIdentity } from "./seo/base.mjs";
import { checkedDirectory } from "./seo/paths.mjs";
import { processEvidence } from "./seo/process.mjs";
import { refreshCurrentGeneration } from "./seo/current.mjs";
export { refreshCurrentGeneration } from "./seo/current.mjs";

export async function refreshSeo(config) {
  if (!config.lease) return withGenerationLock(config.lockPath, lease => refreshSeo({ ...config, lease }));
  return executeGeneration({ ...config, publish: true });
}

export async function generateSeoStage(config) {
  requireLease(config.lease, config.lockPath);
  const pending = join(resolve(config.stateDirectory), "pending-deployments");
  const stageDirectory = resolve(config.stageDirectory);
  const within = relative(pending, stageDirectory);
  if (!within || within.startsWith("..") || isAbsolute(within)) throw new Error("Stage must stay within pending deployments");
  await checkedDirectory(config.stateDirectory, ["pending-deployments", ...within.split(sep).slice(0, -1)], { create: true });
  try { await lstat(stageDirectory); throw new Error("Stage already exists"); } catch (error) { if (error.code !== "ENOENT") throw error; }
  return executeGeneration({ ...config, stageDirectory, publish: false });
}

async function executeGeneration(config) {
  const { runtimeDirectory, stateDirectory, livePath, lockPath, lease, apiOrigin, fetchImpl = fetch,
    now = () => new Date().toISOString(), log = value => process.stdout.write(`${JSON.stringify(value)}\n`), deadlineMs = 590000,
    publish, reusePages = true } = config;
  requireLease(lease, lockPath);
  const started = performance.now();
  const startedCpu = process.cpuUsage();
  const controller = new AbortController();
  const abort = () => controller.abort(new Error("SEO refresh interrupted"));
  const timer = setTimeout(() => controller.abort(new Error("SEO refresh deadline exceeded")), deadlineMs);
  timer.unref();
  process.once("SIGTERM", abort);
  process.once("SIGINT", abort);
  const checkDeadline = () => { requireLease(lease, lockPath); controller.signal.throwIfAborted(); if (performance.now() - started >= deadlineMs) throw new Error("SEO refresh deadline exceeded"); };
  let exported, stageDirectory, published = false, result, primaryError;
  const generationId = config.generationId ?? randomUUID();
  const statusPath = config.statusPath ?? join(stateDirectory, "status.json");
  const status = async entry => { const value = { generationId, ...entry }; log(value); await writeJsonAtomic(statusPath, value); };
  const phase = (name, event, details = {}) => {
    const cpu = process.cpuUsage(startedCpu);
    // Diagnostic output must not interrupt generation or its cleanup guarantees.
    try { log({ status: "phase", generationId, phase: name, event,
      elapsedMs: Math.round(performance.now() - started), cpuMs: Math.round((cpu.user + cpu.system) / 1000), ...details }); } catch {}
  };
  try {
    await mkdir(join(stateDirectory, "generations"), { recursive: true });
    const release = await readVerifiedRuntime(runtimeDirectory);
    await status({ status: "started", startedAt: now(), uiSha: release.uiSha });
    const template = await readFile(join(runtimeDirectory, "template.html"), "utf8");
    const renderer = await import(/* @vite-ignore */ pathToFileURL(join(runtimeDirectory, "entry-server.mjs")).href);
    const previous = await readLiveGeneration(livePath);
    const baseIdentity = publish ? undefined : await captureBaseIdentity(livePath, checkDeadline);
    const sourceStart = performance.now();
    phase("fetch", "started");
    const homepageResponse = await fetchImpl(`${apiOrigin.replace(/\/+$/, "")}/api/front-page`, { signal: controller.signal });
    if (!homepageResponse.ok) throw new Error(`Homepage prerender request failed with ${homepageResponse.status}`);
    const homepageEnvelope = await homepageResponse.json();
    const featuredGames = selectFeaturedGames(homepageEnvelope?.data);
    exported = await fetchSeoExport({ apiOrigin, fetchImpl, spoolParent: join(stateDirectory, "work"), signal: controller.signal,
      onProgress: counts => { checkDeadline(); log({ status: "fetching", generationId, ...counts }); } });
    const fetchMs = Math.round(performance.now() - sourceStart);
    phase("fetch", "complete", { fetchMs, ...exported.stats });
    const ids = new Set(exported.items.map(item => item.id));
    for (const featured of featuredGames) if (!ids.has(featured.id)) throw new Error(`Homepage references missing export item ${featured.id}`);
    checkDeadline();
    const renderStart = performance.now();
    phase("render", "started");
    const catalogIndex = buildCatalogIndex(exported.items);
    const catalogMs = Math.round(performance.now() - renderStart);
    const publishedAt = now();
    const candidates = [{ canonicalPath: "/", fingerprint: contentFingerprint({ featuredGames, siteUrl: release.siteUrl, indexingEnabled: release.indexingEnabled }) }];
    for (const summary of exported.items) {
      checkDeadline();
      const item = await exported.readItem(summary.id);
      candidates.push({ canonicalPath: item.canonical_path, itemId: summary.id,
        fingerprint: contentFingerprint({ item, siteUrl: release.siteUrl, indexingEnabled: release.indexingEnabled }) });
    }
    for (const descriptor of catalogPageDescriptors(catalogIndex)) {
      checkDeadline();
      const model = { ...catalogPageModel(catalogIndex, descriptor), indexingEnabled: release.indexingEnabled };
      candidates.push({ canonicalPath: model.canonicalPath, descriptor,
        fingerprint: contentFingerprint({ model, siteUrl: release.siteUrl }) });
    }
    const prepareMs = Math.round(performance.now() - renderStart);
    phase("render", "prepared", { catalogMs, prepareMs, totalPages: candidates.length });
    const reconciliation = reconcilePages({ previous: previous?.manifest, candidates, publishedAt, uiSha: release.uiSha });
    const { manifest, removedPaths } = reconciliation;
    const changedPaths = reusePages ? reconciliation.changedPaths : candidates.map(page => page.canonicalPath);
    manifest.generationId = generationId;
    manifest.runtimeDirectory = resolve(runtimeDirectory);
    manifest.previousRuntimeDirectory = previous?.manifest?.runtimeDirectory !== resolve(runtimeDirectory)
      ? previous?.manifest?.runtimeDirectory ?? null : previous?.manifest?.previousRuntimeDirectory ?? null;
    manifest.source = { ...exported.stats, maxId: exported.maxId };
    stageDirectory = config.stageDirectory ?? join(stateDirectory, "generations", generationId);
    const publicDirectory = join(stageDirectory, "public");
    await cp(join(runtimeDirectory, "static"), publicDirectory, { recursive: true });
    const previousAssets = manifest.previousRuntimeDirectory ? join(manifest.previousRuntimeDirectory, "static", "assets")
      : previous?.publicDirectory ? join(previous.publicDirectory, "assets") : null;
    if (previousAssets) {
      try { await cp(previousAssets, join(publicDirectory, "assets"), { recursive: true, force: false, errorOnExist: false }); }
      catch (error) { if (error.code !== "ENOENT") throw error; }
    }
    const changed = new Set(changedPaths);
    const assetReferences = new Set();
    let completedPages = 0, documentValidationMs = 0;
    for (const candidate of candidates) {
      checkDeadline();
      const file = canonicalFile(candidate.canonicalPath);
      const output = join(publicDirectory, file);
      await mkdir(dirname(output), { recursive: true });
      if (!changed.has(candidate.canonicalPath) && previous?.publicDirectory) {
        await copyFile(join(previous.publicDirectory, file), output);
      } else {
        let document;
        const pagePublishedAt = manifest.pages[candidate.canonicalPath].lastmod;
        if (candidate.canonicalPath === "/") document = renderer.renderHomepageDocument({ featuredGames, template, publishedAt: pagePublishedAt });
        else if (candidate.descriptor) {
          const model = { ...catalogPageModel(catalogIndex, candidate.descriptor), indexingEnabled: release.indexingEnabled };
          const rendered = renderer.renderCatalogDocument({ model, template, siteUrl: release.siteUrl });
          if (rendered.canonicalPath !== candidate.canonicalPath) throw new Error("Catalog renderer changed canonical path");
          document = rendered.document;
        } else {
          const item = await exported.readItem(candidate.itemId);
          const rendered = renderer.renderProductDocument({ item, template, siteUrl: release.siteUrl, publishedAt: pagePublishedAt });
          if (rendered.canonicalPath !== candidate.canonicalPath) throw new Error("Renderer changed the export canonical path");
          document = rendered.document;
        }
        await writeFile(output, document);
      }
      const validationStarted = performance.now();
      await validateDocument(output, candidate.canonicalPath, release, assetReferences);
      documentValidationMs += performance.now() - validationStarted;
      completedPages++;
      if (completedPages % 500 === 0 && completedPages < candidates.length) {
        phase("render", "progress", { completedPages, totalPages: candidates.length, documentValidationMs: Math.round(documentValidationMs) });
      }
    }
    phase("render", "complete", { completedPages, totalPages: candidates.length, documentValidationMs: Math.round(documentValidationMs) });
    phase("validation", "started");
    await writeFile(join(publicDirectory, "robots.txt"), robotsDocument({ indexingEnabled: release.indexingEnabled, siteUrl: release.siteUrl }));
    await writeFile(join(publicDirectory, "sitemap.xml"), sitemapDocument({
      pages: release.indexingEnabled ? Object.values(manifest.pages) : [], siteUrl: release.siteUrl,
    }));
    const routes = { version: 1, generationId,
      games: Object.fromEntries(exported.items.map(item => [item.id, item.canonicalPath])),
      catalogPageCount: Math.max(1, Math.ceil(exported.items.length / CATALOG_PAGE_SIZE)),
      categories: Object.fromEntries([...catalogIndex.categories.values()].map(category => [category.id,
        { canonicalPath: categoryPath(category), pageCount: Math.ceil(category.items.length / CATALOG_PAGE_SIZE) }])) };
    await writeJsonAtomic(join(stageDirectory, "routes.json"), routes);
    const graphStart = performance.now();
    await validateGeneratedGraph(publicDirectory, candidates.map(page => page.canonicalPath), checkDeadline);
    const graphMs = Math.round(performance.now() - graphStart);
    phase("validation", "graph-complete", { graphMs });
    await writeJsonAtomic(join(stageDirectory, "manifest.json"), manifest);
    const files = {};
    for (const file of await listFiles(publicDirectory)) { checkDeadline(); files[file] = await fileHash(join(publicDirectory, file)); }
    for (const file of assetReferences) if (!Object.hasOwn(files, file)) throw new Error(`Rendered document references a missing asset: ${file}`);
    await writeJsonAtomic(join(stageDirectory, "validation.json"), { version: 1, complete: exported.complete,
      manifestHash: await fileHash(join(stageDirectory, "manifest.json")), routesHash: await fileHash(join(stageDirectory, "routes.json")), files });
    checkDeadline();
    phase("validation", "complete", { files: Object.keys(files).length });
    let publication, pruned;
    if (publish) {
      publication = await publishGeneration({ stageDirectory, livePath, lockPath, lease, checkDeadline });
      published = true;
      pruned = await pruneManagedState({ stateDirectory, currentGeneration: stageDirectory,
        previousLiveDirectory: publication.previousLiveDirectory, lockPath, lease });
    }
    result = { status: publish ? "complete" : "generated", publicationCompleted: published,
      uiSha: release.uiSha, publishedAt, generationId, stageDirectory, baseIdentity, source: exported.stats,
      rendered: changedPaths.length, reused: candidates.length - changedPaths.length, removed: removedPaths.length,
      fetchMs, catalogMs, prepareMs, graphMs, renderMs: Math.round(performance.now() - renderStart), durationMs: Math.round(performance.now() - started),
      peakRssBytes: process.resourceUsage().maxRSS * 1024, process: await processEvidence(lease), pruned, previousLiveDirectory: publication?.previousLiveDirectory };
  } catch (error) {
    primaryError = error;
  }
  const cleanupErrors = [...(primaryError?.cleanupErrors ?? [])];
  const cleanupStarted = performance.now();
  const clean = async (phase, action) => {
    try { await action(); }
    catch (error) { cleanupErrors.push({ phase, error: error.message, code: error.code }); }
  };
  try {
    phase("cleanup", "started");
    // Cleanup phases are independent: spool failure cannot skip failed-stage removal.
    if (exported) await clean("export-spool", () => exported.cleanup());
    if (stageDirectory && !published && (publish || primaryError || cleanupErrors.length)) await clean("failed-stage", () => rm(stageDirectory, { recursive: true, force: true }));
    phase("cleanup", "complete", { cleanupMs: Math.round(performance.now() - cleanupStarted), cleanupErrors: cleanupErrors.length });
    if (!primaryError && controller.signal.aborted) primaryError = controller.signal.reason;
    if (primaryError || cleanupErrors.length) {
      const failure = primaryError ?? new Error(`SEO cleanup failed: ${cleanupErrors.map(entry => entry.error).join("; ")}`);
      await status({ status: "failed", phase: cleanupErrors.length ? "cleanup" : "refresh", error: failure.message,
        cleanupErrors, publicationCompleted: published, durationMs: Math.round(performance.now() - started) }).catch(() => {});
      throw failure;
    }
    result.cleanupMs = Math.round(performance.now() - cleanupStarted);
    result.durationMs = Math.round(performance.now() - started);
    await status(result);
    return result;
  } finally {
    clearTimeout(timer); process.removeListener("SIGTERM", abort); process.removeListener("SIGINT", abort);
  }
}

export async function validateGeneratedGraph(publicDirectory, canonicalPaths, checkDeadline = () => {}) {
  const paths = new Set(canonicalPaths), reached = new Set(), scheduled = new Set(["/"]), queue = ["/"];
  for (let cursor = 0; cursor < queue.length; cursor++) {
    checkDeadline();
    const path = queue[cursor];
    if (reached.has(path)) continue;
    reached.add(path);
    const document = await readFile(join(publicDirectory, canonicalFile(path)), "utf8");
    for (const [, target] of document.matchAll(/<a\b[^>]*href="(\/[^"?#]*)/g)) {
      if (paths.has(target)) { if (!scheduled.has(target)) { scheduled.add(target); queue.push(target); } }
      else if (/^\/(?:game|categoria|categorias|juegos-de-mesa)(?:\/|$)/.test(target)) throw new Error(`Missing generated link target ${target} from ${path}`);
    }
  }
  for (const path of paths) if (!reached.has(path)) throw new Error(`Unreachable generated page ${path}`);
}

async function validateDocument(file, canonicalPath, release, assetReferences) {
  const document = await readFile(file, "utf8");
  const canonical = new URL(canonicalPath, release.siteUrl).href;
  if (!document.includes(`rel="canonical" href="${canonical}"`) || !document.includes('<div id="root">')) throw new Error(`Invalid rendered canonical/root: ${canonicalPath}`);
  const policy = release.indexingEnabled ? "index, follow" : "noindex, nofollow";
  if (!document.includes(`<meta name="robots" content="${policy}"`)) throw new Error(`Invalid indexing policy: ${canonicalPath}`);
  for (const match of document.matchAll(/<script[^>]+type="application\/(?:ld\+)?json"[^>]*>([\s\S]*?)<\/script>/g)) JSON.parse(match[1]);
  for (const match of document.matchAll(/(?:src|href)="\/(assets\/[^"?#]+)(?:[?#][^"]*)?"/g)) assetReferences.add(decodeURIComponent(match[1]));
}

async function listFiles(directory, prefix = "") {
  const files = [];
  for (const entry of await readdir(join(directory, prefix), { withFileTypes: true })) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) throw new Error("Generation contains a symbolic link");
    if (entry.isDirectory()) files.push(...await listFiles(directory, path));
    else files.push(path);
  }
  return files;
}

export async function refreshCli() {
  const projectRoot = process.env.LUDORA_UI_ROOT ?? resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const stateDirectory = process.env.LUDORA_SEO_STATE_DIR ?? join(projectRoot, ".seo");
  const livePath = process.env.LUDORA_SEO_LIVE_PATH ?? join(projectRoot, "dist");
  const lockPath = process.env.LUDORA_SEO_LOCK_PATH ?? join(stateDirectory, "refresh.lock");
  const result = await refreshCurrentGeneration({ stateDirectory, livePath, lockPath,
    apiOrigin: process.env.LUDORA_PRERENDER_API_ORIGIN ?? "http://127.0.0.1:4000" });
  if (result.status === "skipped") process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  refreshCli().catch(error => { process.stderr.write(`${error.stack ?? error}\n`); process.exitCode = 1; });
}
