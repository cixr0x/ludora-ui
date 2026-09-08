import assert from "node:assert/strict";
import test from "node:test";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, mkdir, readFile, writeFile, rm, access } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { build } from "vite";
import { fileHash, withGenerationLock } from "../../../scripts/seo/publish.mjs";
import { prepareDeployment, gitSource } from "../../../scripts/seo/deployment.mjs";

const root = resolve(".");
function execute(command, args, options = {}) {
  return new Promise((accept, reject) => {
    const child = spawn(command, args, { cwd: root, ...options });
    let stdout = "", stderr = "";
    child.stdout.on("data", value => { stdout += value; }); child.stderr.on("data", value => { stderr += value; });
    child.once("error", reject); child.once("exit", code => accept({ code, stdout, stderr, pid: child.pid }));
  });
}

test("bundled launcher starts a fresh capped heap, acquires its own lease and loads only the retained stage worker", async t => {
  const temporary = await mkdtemp(join(tmpdir(), "ludoradar-stage-process-"));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const projectRoot = join(temporary, "source"), stateDirectory = join(temporary, "state"), livePath = join(temporary, "dist");
  await mkdir(projectRoot); await mkdir(join(projectRoot, "ops/nginx"), { recursive: true });
  await writeFile(join(projectRoot, "ops/nginx/ludora-app.conf"), "fixture nginx");
  for (const args of [["init"], ["add", "."], ["-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-m", "fixture"]]) {
    const result = await execute("git", args, { cwd: projectRoot }); assert.equal(result.code, 0, result.stderr);
  }
  const sha = (await execute("git", ["rev-parse", "HEAD"], { cwd: projectRoot })).stdout.trim();
  const nginxPath = join(temporary, "nginx.conf"); await writeFile(nginxPath, "old config");
  const toolsDirectory = join(temporary, "tools");
  const bundled = await execute(process.execPath, ["ops/seo/build-launcher.mjs", toolsDirectory]);
  assert.equal(bundled.code, 0, bundled.stderr);
  let requests = 0;
  const item = { id: 1, canonical_name: "Game", canonical_path: "/game/1/game", categories: [], mechanics: [], families: [], designers: [], publishers: [], parent_items: [], related_items: [], expansion_items: [], offers: [] };
  const server = createServer((request, response) => {
    requests++;
    const after = Number(new URL(request.url, "http://fixture").searchParams.get("after_id"));
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify(request.url.startsWith("/api/front-page") ? { data: [{ products: [item] }] } : {
      data: after ? [] : [item], meta: { export_version: 2, max_id: 1, count: after ? 0 : 1, limit: 200, pagination: "keyset", after_id: after, next_after_id: 1 }
    }));
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const config = { projectRoot, serviceRoot: projectRoot, stateDirectory, livePath, nginxPath,
    lockPath: join(temporary, "lock"), apiOrigin: `http://127.0.0.1:${server.address().port}` };
  const id = "11111111-1111-4111-8111-111111111111", stageId = "22222222-2222-4222-8222-222222222222";
  await prepareDeployment(config, { id, uiSha: sha, serviceSha: sha }, {
    source: { prepare: async () => {}, verify: gitSource.verify },
    compile: async ({ outputDirectory }) => {
      await mkdir(join(outputDirectory, "static"), { recursive: true });
      const template = '<meta name="robots" content="index, follow" /><link rel="canonical" href="https://www.ludoradar.mx/" /><div id="root"></div>';
      await writeFile(join(outputDirectory, "template.html"), template);
      await writeFile(join(outputDirectory, "static/index.html"), template);
      await writeFile(join(outputDirectory, "entry-server.mjs"), `
        const html=(template,path,body)=>template.replace('href="https://www.ludoradar.mx/"','href="https://www.ludoradar.mx'+path+'"').replace('<div id="root"></div>','<div id="root">'+body+'</div>');
        export function renderHomepageDocument({template}) {return html(template,'/','<a href="/juegos-de-mesa">catalog</a><a href="/categorias">categories</a>')}
        export function renderCatalogDocument({template,model}) {return {canonicalPath:model.canonicalPath,document:html(template,model.canonicalPath,'<a href="/game/1/game">Game</a>')}}
        export function renderProductDocument({template,item}) {return {canonicalPath:item.canonical_path,document:html(template,item.canonical_path,'Game')}}
      `);
      await build({ root, configFile: false, logLevel: "error", ssr: { noExternal: true }, build: {
        ssr: join(root, "scripts/refresh-seo.mjs"), target: "node18", outDir: outputDirectory, emptyOutDir: false, copyPublicDir: false,
        rollupOptions: { output: { entryFileNames: "refresh-worker.mjs", inlineDynamicImports: true } }
      } });
      const files = {};
      for (const name of ["entry-server.mjs", "refresh-worker.mjs", "template.html"]) files[name] = await fileHash(join(outputDirectory, name));
      await writeFile(join(outputDirectory, "release.json"), JSON.stringify({ version: 1, uiSha: sha, siteUrl: "https://www.ludoradar.mx", indexingEnabled: true, files }));
    }
  });
  assert.equal(requests, 0);
  const args = ["--max-old-space-size=256", join(toolsDirectory, "seo-launcher.mjs"), "stage", id, stageId];
  const env = { ...process.env, LUDORA_UI_ROOT: projectRoot, LUDORA_SERVICE_ROOT: projectRoot, LUDORA_SEO_STATE_DIR: stateDirectory,
    LUDORA_SEO_LIVE_PATH: livePath, LUDORA_SEO_LOCK_PATH: config.lockPath, LUDORA_SEO_NGINX_PATH: nginxPath, LUDORA_PRERENDER_API_ORIGIN: config.apiOrigin };
  const busy = await withGenerationLock(config.lockPath, () => execute(process.execPath, args, { env }));
  assert.equal(busy.code, 75); assert.equal(requests, 0);
  const staged = await execute(process.execPath, args, { env });
  assert.equal(staged.code, 0, staged.stderr); assert.equal(staged.stderr, "");
  const receipt = JSON.parse(await readFile(join(stateDirectory, "pending-deployments", id, "stages", stageId, "generated.json"), "utf8"));
  assert.equal(receipt.process.pid, staged.pid); assert.notEqual(receipt.process.pid, process.pid);
  assert.deepEqual(receipt.process.execArgv, ["--max-old-space-size=256"]);
  const uncapped = await execute(process.execPath, ["-p", "require('node:v8').getHeapStatistics().heap_size_limit"]);
  assert.ok(receipt.process.heapLimitBytes < Number(uncapped.stdout));
  // V8's young-generation allowance differs on local Node 24/Windows. Production is Node 18.
  if (process.versions.node.startsWith("18.")) assert.ok(receipt.process.heapLimitBytes < 320 * 1024 * 1024);
  if (process.platform === "linux") { assert.ok(receipt.process.holderPid > 0); assert.equal(receipt.process.cgroup, receipt.process.holderCgroup); }
  assert.equal(receipt.rendered, 4); assert.equal(receipt.reused, 0); assert.equal(requests, 3);
  await assert.rejects(access(livePath), { code: "ENOENT" });
  // A bare deployment checkout has no compiler or node_modules; the fresh process succeeded anyway.
  await assert.rejects(access(join(projectRoot, "scripts/seo/compile.mjs")), { code: "ENOENT" });
});
