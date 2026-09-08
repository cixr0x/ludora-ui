import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, writeFile, readFile, rm, realpath, cp, rename, access, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as worker from "../../../scripts/refresh-seo.mjs";
import { withGenerationLock, fileHash } from "../../../scripts/seo/publish.mjs";
import * as deployment from "../../../scripts/seo/deployment.mjs";

const sha = "a".repeat(40);
const item = { id: 1, canonical_name: "Game", canonical_path: "/game/1/game", categories: [], mechanics: [],
  families: [], designers: [], publishers: [], parent_items: [], related_items: [], expansion_items: [], offers: [] };

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "ludoradar-deploy-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const stateDirectory = join(root, "state"), runtimeDirectory = join(root, "runtime"), livePath = join(root, "dist");
  await mkdir(join(runtimeDirectory, "static", "assets"), { recursive: true });
  await writeFile(join(runtimeDirectory, "static", "assets", "app.js"), "immutable asset");
  await writeFile(join(runtimeDirectory, "template.html"), '<meta name="robots" content="index, follow" /><link rel="canonical" href="https://www.ludoradar.mx/" /><div id="root"></div>');
  await writeFile(join(runtimeDirectory, "entry-server.mjs"), `
    const html = (template,path,body) => template.replace('href="https://www.ludoradar.mx/"','href="https://www.ludoradar.mx'+path+'"').replace('<div id="root"></div>','<div id="root">'+body+'</div>');
    export function renderHomepageDocument({template}) { return html(template,'/','<a href="/juegos-de-mesa">catalog</a><a href="/categorias">categories</a>'); }
    export function renderCatalogDocument({template,model}) { return {canonicalPath:model.canonicalPath,document:html(template,model.canonicalPath,(model.items??[]).map(item=>'<a href="'+item.canonicalPath+'">game</a>').join(''))}; }
    export function renderProductDocument({template,item,publishedAt}) { return {canonicalPath:item.canonical_path,document:html(template,item.canonical_path,publishedAt)}; }
  `);
  await writeFile(join(runtimeDirectory, "refresh-worker.mjs"), "fixture worker");
  const files = {};
  for (const name of ["entry-server.mjs", "refresh-worker.mjs", "template.html"]) files[name] = await fileHash(join(runtimeDirectory, name));
  await writeFile(join(runtimeDirectory, "release.json"), JSON.stringify({ version: 1, uiSha: sha, siteUrl: "https://www.ludoradar.mx", indexingEnabled: true, files }));
  let requests = 0;
  const fetchImpl = async value => {
    requests++;
    const url = new URL(value), after = Number(url.searchParams.get("after_id"));
    return new Response(JSON.stringify(url.pathname === "/api/front-page" ? { data: [{ products: [item] }] } : {
      data: after === 0 ? [item] : [], meta: { export_version: 2, max_id: 1, count: after === 0 ? 1 : 0, limit: 200,
        pagination: "keyset", after_id: after, next_after_id: 1 },
    }));
  };
  return { root, runtimeDirectory, stateDirectory, livePath, lockPath: join(root, "lock"), apiOrigin: "https://api.example", fetchImpl,
    log: () => {}, requests: () => requests };
}

test("a cold stage requires a genuine lease, generates every page and never publishes or prunes", async t => {
  const config = await fixture(t);
  await worker.refreshSeo({ ...config, now: () => "2026-09-01T00:00:00.000Z" });
  const previous = await realpath(config.livePath);
  const stageDirectory = join(config.stateDirectory, "pending-deployments", "11111111-1111-4111-8111-111111111111", "stage", "generation");
  const staged = { ...config, stageDirectory, reusePages: false, statusPath: join(config.root, "stage-status.json"), now: () => "2026-09-02T00:00:00.000Z" };
  await assert.rejects(() => worker.generateSeoStage({ ...staged, lease: { active: true, lockPath: config.lockPath } }), /active shared lock/);
  const result = await withGenerationLock(config.lockPath, lease => worker.generateSeoStage({ ...staged, lease }));
  assert.equal(result.status, "generated");
  assert.equal(result.rendered, 4);
  assert.equal(result.reused, 0);
  assert.equal(await realpath(config.livePath), previous);
  assert.equal(await readFile(join(stageDirectory, "public/game/1/game.html"), "utf8"), await readFile(join(previous, "game/1/game.html"), "utf8"), "cold rendering preserves significant publication time");
  assert.equal(JSON.parse(await readFile(join(stageDirectory, "validation.json"), "utf8")).complete, true);
  assert.equal(result.baseIdentity.publicDirectory, previous);
  assert.equal(result.publicationCompleted, false);
  assert.equal(config.requests(), 6, "one complete export per generation");
});

const id = "11111111-1111-4111-8111-111111111111", stageId = "22222222-2222-4222-8222-222222222222";
async function preparedFixture(t) {
  const config = await fixture(t);
  await worker.refreshSeo(config);
  config.projectRoot = config.root;
  config.serviceRoot = config.root;
  config.nginxPath = join(config.root, "nginx.conf");
  await writeFile(config.nginxPath, "old nginx");
  await mkdir(join(config.root, "ops/nginx"), { recursive: true });
  await writeFile(join(config.root, "ops/nginx/ludora-app.conf"), "new nginx");
  let compilations = 0, sourceSha = sha, installs = 0;
  const deps = {
    source: { prepare: async () => {}, verify: async (_, requested) => { if (requested.uiSha !== sourceSha) throw new Error("Source SHA changed"); } },
    compile: async ({ outputDirectory }) => { compilations++; await cp(config.runtimeDirectory, outputDirectory, { recursive: true }); },
    loadWorker: async () => worker,
    serviceGate: async () => {},
    processEvidence: () => ({ pid: 123, holderPid: 124, parentPid: 122, execArgv: ["--max-old-space-size=256"], heapLimitBytes: 304087040, nice: 10,
      cgroup: "/system.slice/ludoradar-seo-stage@fixture.service", holderCgroup: "/system.slice/ludoradar-seo-stage@fixture.service" }),
    nginx: { install: async (candidate) => { installs++; await cp(candidate, config.nginxPath); }, validate: async () => {}, reload: async () => {} },
  };
  const before = config.requests();
  const prepared = await deployment.prepareDeployment(config, { id, uiSha: sha, serviceSha: sha }, deps);
  assert.equal(prepared.status, "prepared");
  assert.equal(config.requests(), before, "preparation makes no export requests");
  assert.equal(compilations, 1);
  return { config, deps, prepared, source: value => { sourceSha = value; }, compilations: () => compilations, installs: () => installs };
}
async function stageFixture(value, nextId = stageId, deploymentId = id) {
  const result = await deployment.stageDeployment(value.config, { id: deploymentId, stageId: nextId }, value.deps);
  assert.equal(result.status, "generated");
  await writeFile(join(result.attemptDirectory, "cgroup.metrics"), "version=1\ncgroup=/system.slice/ludoradar-seo-stage@fixture.service\nworker_pid=123\nworker_exit=0\nremaining_children=0\nwall_seconds=20\nmemory_peak=100000000\nmemory_high=335544320\nmemory_max=402653184\ncpu_max=50000 100000\nmemory_event_oom=0\nmemory_event_oom_kill=0\nmemory_event_max=0\ncpu_usage_usec=1000000\n");
  return result;
}

test("prepare, cold stage and finalize publish once without another export and retain the previous release", async t => {
  const value = await preparedFixture(t), { config, deps } = value;
  const previous = await realpath(config.livePath), stage = await stageFixture(value), requests = config.requests();
  assert.equal(await realpath(config.livePath), previous);
  const result = await deployment.finalizeDeployment(config, { id, stageId }, deps);
  assert.equal(result.status, "published");
  assert.equal(config.requests(), requests);
  assert.equal(await readFile(config.nginxPath, "utf8"), "new nginx");
  assert.equal(await realpath(config.livePath), join(config.stateDirectory, "generations", stage.generationId, "public"));
  await access(previous);
  assert.equal(JSON.parse(await readFile(join(result.generationDirectory, "manifest.json"), "utf8")).runtimeDirectory, result.runtimeDirectory);
});

test("busy and superseded finalization preserve pending artifacts; a fresh stage reuses compilation", async t => {
  const value = await preparedFixture(t), { config, deps } = value;
  const staged = await stageFixture(value);
  const busy = await withGenerationLock(config.lockPath, () => deployment.finalizeDeployment(config, { id, stageId }, deps));
  assert.equal(busy.status, "skipped");
  await worker.refreshSeo(config);
  await access(join(value.prepared.pendingDirectory, "runtime/release.json"));
  const current = await realpath(config.livePath);
  const superseded = await deployment.finalizeDeployment(config, { id, stageId }, deps);
  assert.equal(superseded.status, "superseded");
  assert.equal(await realpath(config.livePath), current);
  await access(staged.stageDirectory);
  const freshId = "33333333-3333-4333-8333-333333333333";
  await stageFixture(value, freshId);
  assert.equal((await deployment.finalizeDeployment(config, { id, stageId: freshId }, deps)).status, "published");
  assert.equal(value.compilations(), 1);
});

for (const problem of ["source", "runtime", "nginx", "rename", "publication", "metrics", "service-exit", "unexpected-output"]) {
  test(`finalization fails closed on ${problem} and retains truthful candidate locations`, async t => {
    const value = await preparedFixture(t), { config, deps } = value;
    const stage = await stageFixture(value), previous = await realpath(config.livePath);
    if (problem === "source") value.source("b".repeat(40));
    if (problem === "runtime") await writeFile(join(value.prepared.pendingDirectory, "runtime/entry-server.mjs"), "corrupted");
    if (problem === "nginx") deps.nginx.validate = async () => { throw new Error("fixture nginx failure"); };
    if (problem === "rename") deps.rename = async (from, to) => { if (from === stage.stageDirectory) throw new Error("fixture rename failure"); return rename(from, to); };
    if (problem === "publication") deps.publish = async () => { throw new Error("fixture publish failure"); };
    if (problem === "metrics") await writeFile(join(stage.attemptDirectory, "cgroup.metrics"), "worker_exit=0\n");
    if (problem === "service-exit") deps.serviceGate = async () => { throw new Error("service has not completed successfully"); };
    if (problem === "unexpected-output") await writeFile(join(stage.stageDirectory, "public/unvalidated.html"), "unexpected output");
    const result = await deployment.finalizeDeployment(config, { id, stageId }, deps);
    assert.equal(result.status, "failed");
    assert.equal(result.publicationCompleted, false);
    assert.equal(await realpath(config.livePath), previous);
    assert.equal(await readFile(config.nginxPath, "utf8"), "old nginx");
    await access(result.runtimeDirectory);
    await access(result.generationDirectory);
  });
}

test("post-publication cleanup failure reports failure without rolling back the selected site or Nginx", async t => {
  const value = await preparedFixture(t), { config, deps } = value;
  const stage = await stageFixture(value);
  deps.prune = async () => { throw new Error("fixture cleanup failure"); };
  const result = await deployment.finalizeDeployment(config, { id, stageId }, deps);
  assert.equal(result.status, "failed"); assert.equal(result.publicationCompleted, true);
  assert.match(result.error, /cleanup failure/);
  assert.equal(await realpath(config.livePath), join(result.generationDirectory, "public"));
  assert.equal(await readFile(config.nginxPath, "utf8"), "new nginx");
  await access(result.runtimeDirectory);
  assert.equal(JSON.parse(await readFile(join(stage.attemptDirectory, "finalize-status.json"), "utf8")).publicationCompleted, true);
});

test("Linux bootstrap rollback verifies the preserved legacy tree and restores its Nginx config", { skip: process.platform !== "linux" }, async t => {
  const value = await preparedFixture(t), { config, deps } = value;
  const previous = await realpath(config.livePath);
  await unlink(config.livePath); await cp(previous, config.livePath, { recursive: true });
  // Create a new preparation after deliberately switching this isolated fixture to legacy output.
  const nextId = "44444444-4444-4444-8444-444444444444";
  await deployment.prepareDeployment(config, { id: nextId, uiSha: sha, serviceSha: sha }, deps);
  await stageFixture(value, stageId, nextId);
  const published = await deployment.finalizeDeployment(config, { id: nextId, stageId }, deps);
  assert.equal(published.status, "published");
  const rolledBack = await deployment.rollbackLegacy(config, { id: nextId, stageId }, deps);
  assert.equal(rolledBack.status, "rolled-back");
  assert.equal(await realpath(config.livePath), published.previousLiveDirectory);
  assert.equal(await readFile(config.nginxPath, "utf8"), "old nginx");
});
