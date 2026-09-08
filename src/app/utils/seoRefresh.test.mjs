import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, readFile, writeFile, rm, realpath, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import filesystem from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { fetchSeoExport } from "../../../scripts/seo/export.mjs";
import { contentFingerprint, reconcilePages } from "../../../scripts/seo/manifest.mjs";
import { withGenerationLock, publishGeneration, requireLease, fileHash } from "../../../scripts/seo/publish.mjs";
import { refreshSeo, refreshCurrentGeneration, validateGeneratedGraph } from "../../../scripts/refresh-seo.mjs";

const item = (id = 1, price = 350) => ({ id, canonical_name: `Game ${id}`, canonical_path: `/game/${id}/game-${id}`,
  categories: [], mechanics: [], families: [], designers: [], publishers: [], parent_items: [], related_items: [], expansion_items: [],
  offers: [{ id: 20 + id, store_id: 7, store_name: "Store", price, currency: "MXN", availability: "available",
    store_active: true, listing_status: "LISTED", is_bundle: false, source_url: "https://store.example/game" }] });

test("generation graph validation rejects missing targets and disconnected exported pages", async t => {
  const root = await mkdtemp(join(tmpdir(), "ludoradar-seo-graph-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, "index.html"), '<a href="/juegos-de-mesa">catalog</a>');
  await writeFile(join(root, "juegos-de-mesa.html"), '<a href="/game/1/gone">missing game</a>');
  await assert.rejects(validateGeneratedGraph(root, ["/", "/juegos-de-mesa"]), /Missing generated link target/);
  await writeFile(join(root, "index.html"), '<a href="/search">search is not a catalog connection</a>');
  await assert.rejects(validateGeneratedGraph(root, ["/", "/juegos-de-mesa"]), /Unreachable generated page/);
  await writeFile(join(root, "index.html"), '<a href="/juegos-de-mesa">catalog</a>');
  await writeFile(join(root, "juegos-de-mesa.html"), '<a href="/">home</a>');
  await validateGeneratedGraph(root, ["/", "/juegos-de-mesa"]);
});

function feed(items, mutate = value => value) {
  const calls = [];
  const fetchImpl = async value => {
    const url = new URL(value); calls.push(url);
    if (url.pathname === "/api/front-page") return new Response(JSON.stringify({ data: [{ products: items }] }));
    const after = Number(url.searchParams.get("after_id"));
    const data = items.filter(i => i.id > after);
    return new Response(JSON.stringify(mutate({ data, meta: { export_version: 2, max_id: Math.max(...items.map(i => i.id), 0),
      count: data.length, limit: 200, pagination: "keyset", after_id: after, next_after_id: data.at(-1)?.id ?? after } })));
  };
  return { fetchImpl, calls };
}

test("identical significant content preserves lastmod and only changed pages reconcile", () => {
  const original = { version: 1, uiSha: "sha-a", generationId: "first", publishedAt: "2026-09-07T12:00:00Z", pages: {
    "/game/708/sushi-go-party": { canonicalPath: "/game/708/sushi-go-party", fingerprint: "same", lastmod: "2026-09-07T12:00:00Z" }
  } };
  const next = reconcilePages({ previous: original, candidates: [{ canonicalPath: "/game/708/sushi-go-party", fingerprint: "same" }],
    publishedAt: "2026-09-07T12:15:00Z", uiSha: "sha-a" });
  assert.equal(next.manifest.pages["/game/708/sushi-go-party"].lastmod, "2026-09-07T12:00:00Z");
  assert.deepEqual(next.changedPaths, []);
  assert.deepEqual(next.removedPaths, []);
  assert.equal(contentFingerprint({ name: "Game", offers: [{ price: 350, refreshed_date: "today" }] }),
    contentFingerprint({ offers: [{ refreshed_date: "tomorrow", price: 350 }], name: "Game" }));
  assert.notEqual(contentFingerprint(item()), contentFingerprint(item(1, 400)));
  assert.deepEqual(reconcilePages({ previous: original, candidates: [], publishedAt: "2026-09-08T12:00:00Z", uiSha: "sha-a" }).removedPaths,
    ["/game/708/sushi-go-party"]);
});

test("export freezes maxId, consumes a terminal page, and retains one disk record per game", async () => {
  const fixture = feed([item(1), item(3)]);
  const result = await fetchSeoExport({ apiOrigin: "https://api.example", fetchImpl: fixture.fetchImpl });
  try {
    assert.equal(result.complete, true);
    assert.equal(result.items.length, 2);
    assert.equal(result.items[0].offers, undefined);
    assert.equal(result.items[0].minimumPrice, 350);
    assert.equal(result.items[0].name, "Game 1");
    assert.equal((await result.readItem(1)).offers[0].price, 350);
    assert.equal(fixture.calls.length, 2);
    assert.equal(fixture.calls[1].searchParams.get("maxId"), "3");
    assert.equal(fixture.calls[1].searchParams.get("after_id"), "3");
  } finally { await result.cleanup(); }
});

test("export rejects missing/v1 envelopes, unexpected empty feeds, changing caps and nonadvancing cursors", async () => {
  for (const mutate of [() => ({}), e => ({ ...e, meta: { ...e.meta, export_version: 1 } }),
    e => ({ ...e, meta: { ...e.meta, next_after_id: 0 } }), e => ({ ...e, data: [e.data[0], e.data[0]] })]) {
    await assert.rejects(fetchSeoExport({ apiOrigin: "https://api.example", fetchImpl: feed([item()], mutate).fetchImpl }));
  }
  await assert.rejects(fetchSeoExport({ apiOrigin: "https://api.example", fetchImpl: feed([]).fetchImpl }), /empty/i);
  let page = 0;
  await assert.rejects(fetchSeoExport({ apiOrigin: "https://api.example", fetchImpl: feed([item()], e => {
    if (page++ > 0) e.meta.max_id = 99; return e;
  }).fetchImpl }), /maximum|max_id/i);
});

async function environment(t) {
  const root = await mkdtemp(join(tmpdir(), "ludoradar-seo-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const runtimeDirectory = join(root, "runtime");
  await mkdir(join(runtimeDirectory, "static", "assets"), { recursive: true });
  await writeFile(join(runtimeDirectory, "static", "assets", "fixture.js"), "immutable client asset");
  await writeFile(join(runtimeDirectory, "template.html"), '<html><head><meta name="robots" content="index, follow" /><link rel="canonical" href="https://www.ludoradar.mx/" /></head><body><div id="root"></div></body></html>');
  await writeFile(join(runtimeDirectory, "entry-server.mjs"), `
    export function renderHomepageDocument({template}) { return template.replace('<div id="root"></div>', '<div id="root">home<a href="/juegos-de-mesa">catalog</a><a href="/categorias">categories</a></div>'); }
    export function renderCatalogDocument({model,template}) { return { canonicalPath: model.canonicalPath,
      document: template.replace('href="https://www.ludoradar.mx/"','href="https://www.ludoradar.mx'+model.canonicalPath+'"')
        .replace('<div id="root"></div>', '<div id="root">'+(model.items ?? []).map(item => '<a href="'+item.canonicalPath+'">game</a>').join('')+'</div>') }; }
    export function renderProductDocument({item,template}) { return { canonicalPath: item.canonical_path,
      document: template.replace('href="https://www.ludoradar.mx/"','href="https://www.ludoradar.mx'+item.canonical_path+'"')
        .replace('<div id="root"></div>', '<div id="root">price '+item.offers[0].price+'</div>') }; }
  `);
  await writeFile(join(runtimeDirectory, "refresh-worker.mjs"), "export const fixture = true;");
  const files = {};
  for (const file of ["entry-server.mjs", "refresh-worker.mjs", "template.html"]) files[file] = await fileHash(join(runtimeDirectory, file));
  await writeFile(join(runtimeDirectory, "release.json"), JSON.stringify({ version: 1, uiSha: "sha-a", siteUrl: "https://www.ludoradar.mx", indexingEnabled: true, files }));
  return { root, runtimeDirectory, stateDirectory: join(root, "state"), livePath: join(root, "dist"), lockPath: join(root, "refresh.lock"), apiOrigin: "https://api.example", log: () => {} };
}

test("a held shared lock prevents concurrent work and unvalidated publication", async t => {
  const config = await environment(t);
  let entered = false;
  await withGenerationLock(config.lockPath, async () => {
    const result = await withGenerationLock(config.lockPath, async () => { entered = true; });
    assert.equal(result.status, "skipped");
    const publish = await publishGeneration({ ...config, stageDirectory: join(config.root, "missing") });
    assert.equal(publish.status, "skipped");
  });
  assert.equal(entered, false);
  await assert.rejects(publishGeneration({ ...config, stageDirectory: config.runtimeDirectory }), /validat/i);
});

test("changed data publishes new HTML without compilation and preserves unchanged lastmod and old assets", async t => {
  const config = await environment(t);
  const first = await refreshSeo({ ...config, fetchImpl: feed([item(1), item(2)]).fetchImpl, now: () => "2026-09-07T12:00:00Z" });
  const firstLive = await realpath(config.livePath);
  const second = await refreshSeo({ ...config, fetchImpl: feed([item(1, 400), item(2)]).fetchImpl, now: () => "2026-09-08T12:00:00Z" });
  assert.equal(first.status, "complete");
  assert.equal(second.rendered, 2);
  assert.equal(second.reused, 3);
  assert.match(await readFile(join(config.livePath, "game/1/game-1.html"), "utf8"), /price 400/);
  assert.match(await readFile(join(firstLive, "game/1/game-1.html"), "utf8"), /price 350/);
  assert.equal(await readFile(join(config.livePath, "assets/fixture.js"), "utf8"), "immutable client asset");
  const manifest = JSON.parse(await readFile(join(await realpath(config.livePath), "..", "manifest.json"), "utf8"));
  assert.equal(manifest.pages["/game/2/game-2"].lastmod, "2026-09-07T12:00:00Z");
  assert.equal(manifest.pages["/game/1/game-1"].lastmod, "2026-09-08T12:00:00Z");
  assert.ok(second.fetchMs >= 0 && second.renderMs >= 0);
});

test("failed export or renderer leaves live generation untouched and records failure", async t => {
  const config = await environment(t);
  await refreshSeo({ ...config, fetchImpl: feed([item()]).fetchImpl });
  const original = await realpath(config.livePath);
  await assert.rejects(refreshSeo({ ...config, fetchImpl: async () => { throw new Error("API offline"); } }), /API offline/);
  assert.equal(await realpath(config.livePath), original);
  assert.equal(JSON.parse(await readFile(join(config.stateDirectory, "status.json"), "utf8")).status, "failed");
  await assert.rejects(refreshSeo({ ...config, fetchImpl: feed([]).fetchImpl }));
  assert.equal(await realpath(config.livePath), original);
  const broken = await environment(t);
  const brokenFile = join(broken.runtimeDirectory, "entry-server.mjs");
  await writeFile(brokenFile, 'export function renderHomepageDocument(){throw new Error("render failed")}');
  const releasePath = join(broken.runtimeDirectory, "release.json");
  const release = JSON.parse(await readFile(releasePath, "utf8"));
  release.uiSha = "sha-b";
  release.files["entry-server.mjs"] = await fileHash(brokenFile);
  await writeFile(releasePath, JSON.stringify(release));
  await assert.rejects(refreshSeo({ ...config, runtimeDirectory: broken.runtimeDirectory, fetchImpl: feed([item()]).fetchImpl }), /render failed/);
  assert.equal(await realpath(config.livePath), original);
});

test("bootstrap preserves a previous real dist directory and complete exports alone reconcile removals", async t => {
  const config = await environment(t);
  await mkdir(config.livePath);
  await writeFile(join(config.livePath, "previous-release.txt"), "previous release");
  const first = await refreshSeo({ ...config, fetchImpl: feed([item(1), item(2)]).fetchImpl });
  assert.equal(await readFile(join(first.previousLiveDirectory, "previous-release.txt"), "utf8"), "previous release");
  const second = await refreshSeo({ ...config, fetchImpl: feed([item(1)]).fetchImpl });
  assert.equal(second.removed, 1);
  await assert.rejects(readFile(join(config.livePath, "game/2/game-2.html")), { code: "ENOENT" });
});

test("incomplete runtime hashes cannot bypass integrity checks", async t => {
  const config = await environment(t);
  const path = join(config.runtimeDirectory, "release.json");
  const release = JSON.parse(await readFile(path, "utf8"));
  delete release.files;
  await writeFile(path, JSON.stringify(release));
  await assert.rejects(refreshSeo({ ...config, fetchImpl: feed([item()]).fetchImpl }), /integrity|hash/i);
});

test("Linux lock-holder loss invalidates publication ownership and release does not wait for a past exit", { timeout: 3000 }, async t => {
  const config = await environment(t);
  let holder;
  await withGenerationLock(config.lockPath, async lease => {
    // Await the actual child event: loaded CI hosts need not schedule a child
    // timer before an arbitrary delay in the parent expires.
    if (holder.exitCode === null && holder.signalCode === null) await once(holder, "exit");
    assert.throws(() => requireLease(lease, config.lockPath), /active shared lock/);
  }, { platform: "linux", spawnImpl: () => (holder = spawn(process.execPath, ["-e", "process.stdout.write('locked\\n'); setTimeout(()=>process.exit(0), 25)"], { stdio: ["pipe", "pipe", "pipe"] })) });
  await assert.rejects(withGenerationLock(config.lockPath, async () => assert.fail("must not acquire"), {
    platform: "linux", spawnImpl: () => spawn(process.execPath, ["-e", "process.exit(0)"], { stdio: ["pipe", "pipe", "pipe"] })
  }), /before acquisition/);
});

test("post-validation file corruption prevents publication of that generation", async t => {
  const config = await environment(t);
  await refreshSeo({ ...config, fetchImpl: feed([item()]).fetchImpl });
  const target = await realpath(config.livePath);
  await writeFile(join(target, "game/1/game-1.html"), "corrupted");
  await assert.rejects(publishGeneration({ ...config, stageDirectory: join(target, ".."), livePath: join(config.root, "another-live") }), /changed/);
});

test("private published route changes invalidate generation integrity", async t => {
  const config = await environment(t);
  await refreshSeo({ ...config, fetchImpl: feed([item()]).fetchImpl });
  const target = await realpath(config.livePath);
  await writeFile(join(target, "..", "routes.json"), '{"version":1,"games":{}}');
  await assert.rejects(publishGeneration({ ...config, stageDirectory: join(target, ".."), livePath: join(config.root, "another-live") }), /route.*changed/i);
});

test("successful publication retains two managed generations and preserves unrelated state", async t => {
  const config = await environment(t);
  await refreshSeo({ ...config, fetchImpl: feed([item(1)]).fetchImpl });
  const first = await realpath(config.livePath);
  const unrelated = join(config.stateDirectory, "generations", "user-notes");
  await mkdir(unrelated);
  await writeFile(join(unrelated, "keep.txt"), "keep");
  await refreshSeo({ ...config, fetchImpl: feed([item(1, 400)]).fetchImpl });
  await refreshSeo({ ...config, fetchImpl: feed([item(1, 450)]).fetchImpl });
  await assert.rejects(readFile(join(first, "index.html")), { code: "ENOENT" });
  const remaining = await readdir(join(config.stateDirectory, "generations"));
  assert.equal(remaining.filter(name => /^[a-f0-9-]{36}$/.test(name)).length, 2);
  assert.equal(await readFile(join(unrelated, "keep.txt"), "utf8"), "keep");
});

test("runtime selection and worker import hold the same deployment lock", async t => {
  const config = await environment(t);
  await refreshSeo({ ...config, fetchImpl: feed([item()]).fetchImpl });
  const result = await refreshCurrentGeneration({ ...config, loadWorker: async runtime => {
    assert.equal(runtime, config.runtimeDirectory);
    const deployment = await withGenerationLock(config.lockPath, async () => assert.fail("deployment cannot publish during runtime selection"));
    assert.equal(deployment.status, "skipped");
    return { refreshSeo: async options => { requireLease(options.lease, config.lockPath); return { status: "complete" }; } };
  } });
  assert.equal(result.status, "complete");
});

test("the worker deadline aborts source requests and releases its lock without publishing", async t => {
  const config = await environment(t);
  await refreshSeo({ ...config, fetchImpl: feed([item()]).fetchImpl });
  const original = await realpath(config.livePath);
  await assert.rejects(refreshSeo({ ...config, deadlineMs: 20, fetchImpl: (_url, { signal }) => {
    signal.throwIfAborted();
    return new Promise((_accept, reject) => { signal.addEventListener("abort", () => reject(signal.reason), { once: true }); });
  } }), /deadline/);
  assert.equal(await realpath(config.livePath), original);
  assert.equal((await withGenerationLock(config.lockPath, async () => ({ status: "acquired" }))).status, "acquired");
});

test("runtime-selection integrity failure records status before importing worker code", async t => {
  const config = await environment(t);
  await refreshSeo({ ...config, fetchImpl: feed([item()]).fetchImpl });
  await writeFile(join(config.runtimeDirectory, "refresh-worker.mjs"), "corrupted worker");
  let loaded = false;
  await assert.rejects(refreshCurrentGeneration({ ...config, loadWorker: async () => { loaded = true; } }), /integrity/);
  assert.equal(loaded, false);
  const status = JSON.parse(await readFile(join(config.stateDirectory, "status.json"), "utf8"));
  assert.equal(status.status, "failed");
  assert.equal(status.phase, "runtime-selection");
});

test("expiry during final publication verification preserves the prior live generation", async t => {
  const config = await environment(t);
  await refreshSeo({ ...config, fetchImpl: feed([item()]).fetchImpl });
  const previous = await realpath(config.livePath);
  let delayed = false;
  const originalRead = filesystem.readFile;
  await withFilesystemOverride("readFile", async (path, ...args) => {
    if (!delayed && String(path).endsWith("validation.json")) {
      delayed = true;
      await new Promise(resolve => setTimeout(resolve, 1100));
    }
    return originalRead(path, ...args);
  }, async () => {
    await assert.rejects(refreshSeo({ ...config, deadlineMs: 1000, fetchImpl: feed([item(1, 400)]).fetchImpl }), /deadline/);
  });
  assert.equal(delayed, true, "The deadline must expire during final generation verification");
  assert.equal(await realpath(config.livePath), previous);
  const status = JSON.parse(await readFile(join(config.stateDirectory, "status.json"), "utf8"));
  assert.equal(status.status, "failed");
  assert.equal(status.publicationCompleted, false);
});

test("spool cleanup failure after publication rejects with an explicit cleanup status and preserves published HTML", async t => {
  const config = await environment(t);
  await refreshSeo({ ...config, fetchImpl: feed([item()]).fetchImpl });
  const previous = await realpath(config.livePath);
  const originalRemove = filesystem.rm;
  await withFilesystemOverride("rm", async (path, ...args) => {
    if (String(path).replaceAll("\\", "/").includes("/work/export-")) {
      throw Object.assign(new Error("Injected spool cleanup failure"), { code: "EACCES" });
    }
    return originalRemove(path, ...args);
  }, async () => {
    await assert.rejects(refreshSeo({ ...config, fetchImpl: feed([item(1, 400)]).fetchImpl }), /Injected spool cleanup failure/);
  });
  assert.notEqual(await realpath(config.livePath), previous);
  assert.match(await readFile(join(config.livePath, "game/1/game-1.html"), "utf8"), /price 400/);
  const status = JSON.parse(await readFile(join(config.stateDirectory, "status.json"), "utf8"));
  assert.equal(status.status, "failed");
  assert.equal(status.phase, "cleanup");
  assert.equal(status.publicationCompleted, true);
  assert.match(status.cleanupErrors[0].error, /Injected spool cleanup failure/);
});

test("spool cleanup failure preserves the original renderer failure and still removes its failed stage", async t => {
  const config = await environment(t);
  await refreshSeo({ ...config, fetchImpl: feed([item()]).fetchImpl });
  const previous = await realpath(config.livePath);
  const broken = await environment(t);
  const brokenFile = join(broken.runtimeDirectory, "entry-server.mjs");
  await writeFile(brokenFile, 'export function renderHomepageDocument(){throw new Error("Original renderer failure")}');
  const releasePath = join(broken.runtimeDirectory, "release.json");
  const release = JSON.parse(await readFile(releasePath, "utf8"));
  release.uiSha = "sha-b";
  release.files["entry-server.mjs"] = await fileHash(brokenFile);
  await writeFile(releasePath, JSON.stringify(release));
  const originalRemove = filesystem.rm;
  await withFilesystemOverride("rm", async (path, ...args) => {
    if (String(path).replaceAll("\\", "/").includes("/work/export-")) throw new Error("Injected spool cleanup failure");
    return originalRemove(path, ...args);
  }, async () => {
    await assert.rejects(refreshSeo({ ...config, runtimeDirectory: broken.runtimeDirectory, fetchImpl: feed([item()]).fetchImpl }), /^Error: Original renderer failure$/);
  });
  assert.equal(await realpath(config.livePath), previous);
  assert.equal((await readdir(join(config.stateDirectory, "generations"))).length, 1);
  const status = JSON.parse(await readFile(join(config.stateDirectory, "status.json"), "utf8"));
  assert.equal(status.phase, "cleanup");
  assert.equal(status.error, "Original renderer failure");
  assert.equal(status.publicationCompleted, false);
  assert.match(status.cleanupErrors[0].error, /Injected spool cleanup failure/);
});

test("an incomplete export preserves its original error when its own spool cleanup also fails", async t => {
  const config = await environment(t);
  await refreshSeo({ ...config, fetchImpl: feed([item()]).fetchImpl });
  const previous = await realpath(config.livePath);
  const originalRemove = filesystem.rm;
  await withFilesystemOverride("rm", async (path, ...args) => {
    if (String(path).replaceAll("\\", "/").includes("/work/export-")) throw new Error("Injected failed-export cleanup error");
    return originalRemove(path, ...args);
  }, async () => {
    await assert.rejects(refreshSeo({ ...config, fetchImpl: feed([item()], e => ({ ...e, meta: { ...e.meta, export_version: 1 } })).fetchImpl }),
      /Malformed SEO export v2 envelope/);
  });
  assert.equal(await realpath(config.livePath), previous);
  const status = JSON.parse(await readFile(join(config.stateDirectory, "status.json"), "utf8"));
  assert.equal(status.phase, "cleanup");
  assert.equal(status.error, "Malformed SEO export v2 envelope");
  assert.match(status.cleanupErrors[0].error, /Injected failed-export cleanup error/);
});

test("cancellation after bootstrap backup restores the original directory before returning failure", async t => {
  const config = await environment(t);
  await refreshSeo({ ...config, fetchImpl: feed([item()]).fetchImpl });
  const stageDirectory = join(await realpath(config.livePath), "..");
  const legacy = join(config.root, "legacy-dist");
  await mkdir(legacy);
  await writeFile(join(legacy, "index.html"), "original legacy release");
  let aborted = false;
  const originalRename = filesystem.rename;
  await withFilesystemOverride("rename", async (from, ...args) => {
    const result = await originalRename(from, ...args);
    if (String(from) === legacy) aborted = true;
    return result;
  }, async () => {
    await assert.rejects(publishGeneration({ ...config, livePath: legacy, stageDirectory,
      checkDeadline: () => { if (aborted) throw new Error("Cancelled before live switch"); } }), /Cancelled before live switch/);
  });
  assert.equal(aborted, true);
  assert.equal(await readFile(join(legacy, "index.html"), "utf8"), "original legacy release");
  assert.equal(await realpath(legacy), legacy);
});

async function withFilesystemOverride(name, replacement, action) {
  const original = filesystem[name];
  filesystem[name] = replacement;
  syncBuiltinESMExports();
  try { return await action(); }
  finally { filesystem[name] = original; syncBuiltinESMExports(); }
}
