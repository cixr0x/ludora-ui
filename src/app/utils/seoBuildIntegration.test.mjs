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
import { offer, jsonScript, visibleText } from "../../../tests/seo/fixtures.mjs";

const projectRoot = fileURLToPath(new URL("../../../", import.meta.url));

test("a retained self-contained renderer refreshes real HTML without recompiling its assets", { timeout: 120000 }, async t => {
  const root = await mkdtemp(join(tmpdir(), "ludoradar-seo-build-"));
  let description = "Before refresh";
  let price = 350;
  let homepageResponses = [
    { meta: { catalog_product_count: 999 } },
    { data: [], meta: { tracked_store_count: 12 } },
  ];
  const requests = [];
  const server = createServer((request, response) => {
    const url = new URL(request.url, "http://localhost"); requests.push(url.pathname);
    const item = { id: 1, canonical_name: "Fixture Game", canonical_path: "/game/1/fixture-game", description,
      categories: [], mechanics: [], families: [], designers: [], publishers: [], parent_items: [],
      offers: [{ ...offer, price }], related_items: [], expansion_items: [] };
    let envelope;
    if (url.pathname === "/api/front-page") {
      const fixture = homepageResponses.shift();
      if (fixture === "slow") {
        const reply = setTimeout(() => response.end(JSON.stringify({ meta: { tracked_store_count: 999 } })), 3500);
        response.once("close", () => clearTimeout(reply));
        return;
      }
      envelope = { data: [{ products: [item] }], ...fixture };
    }
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
    const initialHomepage = await readFile(join(initialPublic, "index.html"), "utf8");
    assert.match(visibleText(initialHomepage), /1 producto en el catálogo/);
    assert.match(visibleText(initialHomepage), /12 tiendas monitoreadas/);
    assert.doesNotMatch(visibleText(initialHomepage), /999 productos en el catálogo/);
    assert.deepEqual(jsonScript(initialHomepage, "ludo-radar-prerender-data").homepage.stats,
      { catalogProductCount: 1, trackedStoreCount: 12 });
    assert.equal(jsonScript(initialHomepage, "ludo-radar-prerender-data").homepage.featuredGames[0].id, 1);
    assert.equal(requests.filter(path => path === "/api/front-page").length, 2);
    assert.match(await readFile(join(initialPublic, "juegos-de-mesa.html"), "utf8"), /Fixture Game/);
    assert.match(await readFile(join(initialPublic, "categorias.html"), "utf8"), /Categorías de juegos de mesa/);
    const manifest = JSON.parse(await readFile(join(initialPublic, "..", "manifest.json"), "utf8"));
    assert.equal(manifest.source.trackedStoreCount, 12);
    const releasePath = join(manifest.runtimeDirectory, "release.json");
    const releaseHash = await fileHash(releasePath);
    const workerHash = await fileHash(join(manifest.runtimeDirectory, "refresh-worker.mjs"));
    const initialHtml = await readFile(join(initialPublic, "game/1/fixture-game.html"), "utf8");
    assert.match(initialHtml, /Before refresh/);
    assert.match(visibleText(initialHtml), /Precios de “Fixture Game” en tiendas de México/);
    assert.match(visibleText(initialHtml), /\$350\.00 MXN/);
    assert.doesNotMatch(visibleText(initialHtml), /Desde \$350\.00 MXN, sin envío/);
    assert.equal(jsonScript(initialHtml, "product-structured-data")["@graph"][0].offers[0].price, 350);
    description = "After refresh";
    price = 425;
    homepageResponses = [{ meta: { tracked_store_count: 13 } }];
    const refreshed = await run("scripts/refresh-seo.mjs", env);
    assert.equal(refreshed.code, 0, refreshed.output.slice(-6000));
    const nextPublic = await realpath(env.LUDORA_SEO_LIVE_PATH);
    assert.notEqual(nextPublic, initialPublic);
    const nextHomepage = await readFile(join(nextPublic, "index.html"), "utf8");
    assert.match(visibleText(nextHomepage), /13 tiendas monitoreadas/);
    const document = await readFile(join(nextPublic, "game/1/fixture-game.html"), "utf8");
    assert.match(document, /After refresh/);
    assert.match(visibleText(document), /\$425\.00 MXN/);
    assert.doesNotMatch(visibleText(document), /Desde \$425\.00 MXN, sin envío/);
    assert.equal(jsonScript(document, "product-structured-data")["@graph"][0].offers[0].price, 425);
    assert.match(document, /noindex, nofollow/);
    assert.doesNotMatch(await readFile(join(nextPublic, "sitemap.xml"), "utf8"), /<url>/, "blocked builds have no indexable sitemap entries");
    assert.equal(await fileHash(releasePath), releaseHash);
    assert.equal(await fileHash(join(manifest.runtimeDirectory, "refresh-worker.mjs")), workerHash);
    assert.equal(requests.every(path => ["/api/front-page", "/api/items/prerender"].includes(path)), true);
    const completed = JSON.parse(refreshed.output.trim().split("\n").at(-1));
    assert.equal(completed.rendered, 3);
    assert.equal(completed.reused, 1);
    assert.ok(completed.fetchMs >= 0 && completed.renderMs > 0 && completed.catalogMs >= 0 && completed.prepareMs >= 0 && completed.graphMs >= 0);

    const homepageRequestCount = requests.filter(path => path === "/api/front-page").length;
    homepageResponses = [{}, "slow"];
    const retained = await run("scripts/refresh-seo.mjs", env);
    assert.equal(retained.code, 0, retained.output.slice(-6000));
    assert.equal(requests.filter(path => path === "/api/front-page").length, homepageRequestCount + 2);
    const retainedPublic = await realpath(env.LUDORA_SEO_LIVE_PATH);
    assert.equal(await readFile(join(retainedPublic, "index.html"), "utf8"), nextHomepage);
    const retainedManifest = JSON.parse(await readFile(join(retainedPublic, "..", "manifest.json"), "utf8"));
    assert.equal(retainedManifest.source.trackedStoreCount, 13);

    homepageResponses = [{ meta: { tracked_store_count: 0 } }];
    const zero = await run("scripts/refresh-seo.mjs", env);
    assert.equal(zero.code, 0, zero.output.slice(-6000));
    const zeroPublic = await realpath(env.LUDORA_SEO_LIVE_PATH);
    assert.match(visibleText(await readFile(join(zeroPublic, "index.html"), "utf8")), /0 tiendas monitoreadas/);
    const zeroManifest = JSON.parse(await readFile(join(zeroPublic, "..", "manifest.json"), "utf8"));
    assert.equal(zeroManifest.source.trackedStoreCount, 0);
    t.diagnostic(JSON.stringify({ fetchMs: completed.fetchMs, catalogMs: completed.catalogMs, prepareMs: completed.prepareMs,
      graphMs: completed.graphMs, renderMs: completed.renderMs, peakRssBytes: completed.peakRssBytes, rendered: completed.rendered, reused: completed.reused }));
  } finally {
    server.closeAllConnections();
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
