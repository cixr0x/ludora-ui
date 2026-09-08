import assert from "node:assert/strict";
import test from "node:test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { mkdtemp, rm, readFile, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { fileHash } from "../../../scripts/seo/publish.mjs";

const projectRoot = fileURLToPath(new URL("../../../", import.meta.url));

test("a retained self-contained renderer refreshes real HTML without recompiling its assets", { timeout: 120000 }, async t => {
  const root = await mkdtemp(join(tmpdir(), "ludoradar-seo-build-"));
  let description = "Before refresh";
  const requests = [];
  const server = createServer((request, response) => {
    const url = new URL(request.url, "http://localhost"); requests.push(url.pathname);
    const item = { id: 1, canonical_name: "Fixture Game", canonical_path: "/game/1/fixture-game", description,
      categories: [], mechanics: [], families: [], designers: [], publishers: [], parent_items: [], offers: [], related_items: [], expansion_items: [] };
    let envelope;
    if (url.pathname === "/api/front-page") envelope = { data: [{ products: [item] }] };
    else if (url.pathname === "/api/items/prerender") {
      const after = Number(url.searchParams.get("after_id"));
      const data = after === 0 ? [item] : [];
      envelope = { data, meta: { export_version: 2, max_id: 1, count: data.length, limit: 200,
        pagination: "keyset", after_id: after, next_after_id: 1 } };
    } else { response.writeHead(500); response.end(); return; }
    response.writeHead(200, { "Content-Type": "application/json" }); response.end(JSON.stringify(envelope));
  });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  const env = { ...process.env, LUDORA_UI_ROOT: projectRoot, LUDORA_SEO_STATE_DIR: join(root, "state"),
    LUDORA_SEO_LIVE_PATH: join(root, "dist"), LUDORA_SEO_LOCK_PATH: join(root, "lock"), LUDORA_INDEXING_ENABLED: "false",
    LUDORA_PRERENDER_API_ORIGIN: `http://127.0.0.1:${server.address().port}` };
  try {
    const initial = await run("scripts/build.mjs", env);
    assert.equal(initial.code, 0, initial.output.slice(-6000));
    const initialPublic = await realpath(env.LUDORA_SEO_LIVE_PATH);
    const manifest = JSON.parse(await readFile(join(initialPublic, "..", "manifest.json"), "utf8"));
    const releasePath = join(manifest.runtimeDirectory, "release.json");
    const releaseHash = await fileHash(releasePath);
    const workerHash = await fileHash(join(manifest.runtimeDirectory, "refresh-worker.mjs"));
    assert.match(await readFile(join(initialPublic, "game/1/fixture-game.html"), "utf8"), /Before refresh/);
    description = "After refresh";
    const refreshed = await run("scripts/refresh-seo.mjs", env);
    assert.equal(refreshed.code, 0, refreshed.output.slice(-6000));
    const nextPublic = await realpath(env.LUDORA_SEO_LIVE_PATH);
    assert.notEqual(nextPublic, initialPublic);
    const document = await readFile(join(nextPublic, "game/1/fixture-game.html"), "utf8");
    assert.match(document, /After refresh/);
    assert.match(document, /noindex, nofollow/);
    assert.equal(await fileHash(releasePath), releaseHash);
    assert.equal(await fileHash(join(manifest.runtimeDirectory, "refresh-worker.mjs")), workerHash);
    assert.equal(requests.every(path => ["/api/front-page", "/api/items/prerender"].includes(path)), true);
    const completed = JSON.parse(refreshed.output.trim().split("\n").at(-1));
    assert.equal(completed.rendered, 1);
    assert.equal(completed.reused, 1);
    assert.ok(completed.fetchMs >= 0 && completed.renderMs > 0);
    t.diagnostic(JSON.stringify({ fetchMs: completed.fetchMs, renderMs: completed.renderMs, peakRssBytes: completed.peakRssBytes, rendered: completed.rendered, reused: completed.reused }));
  } finally {
    server.close(); await once(server, "close");
    await rm(root, { recursive: true, force: true });
  }
});

async function run(script, env) {
  const args = script.endsWith("refresh-seo.mjs") ? ["--max-old-space-size=256", script] : [script];
  const child = spawn(process.execPath, args, { cwd: projectRoot, env, stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  child.stdout.on("data", chunk => { output += chunk; });
  child.stderr.on("data", chunk => { output += chunk; });
  const [code] = await once(child, "close");
  return { code, output };
}
