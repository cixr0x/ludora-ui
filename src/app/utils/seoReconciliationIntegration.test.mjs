import assert from "node:assert/strict";
import test from "node:test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { mkdtemp, rm, readFile, writeFile, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalFile } from "../../../scripts/seo/manifest.mjs";
import { fileHash } from "../../../scripts/seo/publish.mjs";
import { productPath } from "./productRoutes.js";
import { catalogFixtures, offer, jsonScript, visibleText } from "../../../tests/seo/fixtures.mjs";

const projectRoot = fileURLToPath(new URL("../../../", import.meta.url));
const completeRecord = record => ({ families: [], designers: [], publishers: [], parent_items: [], ...record });

test("compiled publications reconcile significant changes, removals and exact sitemap dates across the complete graph", { timeout: 180000 }, async t => {
  const root = await mkdtemp(join(tmpdir(), "ludoradar-seo-reconciliation-"));
  const livePath = join(root, "dist"), stateDirectory = join(root, "state");
  let records = catalogFixtures().slice(0, 49).map(completeRecord);
  records[48].categories.push({ id: 9, name: "Temáticos" });
  records[0].related_items = [{ id: 2, canonical_name: records[1].canonical_name }];
  let failure, day = 0;
  const apiRequests = [];
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, "http://localhost");
    try {
      if (url.pathname.startsWith("/api/")) {
        apiRequests.push(url.pathname);
        let envelope;
        if (url.pathname === "/api/front-page") envelope = { data: [{ products: [records[0]] }] };
        else if (url.pathname === "/api/items/prerender") {
          const after = Number(url.searchParams.get("after_id"));
          const available = failure === "empty" ? [] : records;
          const data = after === 0 ? available.slice(0, failure === "partial" ? 20 : 200) : [];
          envelope = { data, meta: { export_version: 2, max_id: available.at(-1)?.id ?? 0, count: data.length,
            limit: 200, pagination: "keyset", after_id: after, next_after_id: data.at(-1)?.id ?? after } };
        } else throw new Error("Unexpected worker API request");
        response.writeHead(200, { "Content-Type": "application/json" }); response.end(JSON.stringify(envelope));
      } else {
        const directory = await realpath(livePath);
        const document = await readFile(join(directory, canonicalFile(url.pathname)), "utf8");
        response.writeHead(200, { "Content-Type": "text/html" }); response.end(document);
      }
    } catch { response.writeHead(404); response.end(); }
  });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  const origin = `http://127.0.0.1:${server.address().port}`;
  const env = { ...process.env, LUDORA_SEO_STATE_DIR: stateDirectory, LUDORA_SEO_LIVE_PATH: livePath,
    LUDORA_SEO_LOCK_PATH: join(root, "lock"), LUDORA_PRERENDER_API_ORIGIN: origin };
  try {
    const build = await run("scripts/build-indexable.mjs", env);
    assert.equal(build.code, 0, build.output.slice(-6000));
    let previous = await inspectPublication(livePath, origin);
    const firstDate = previous.manifest.publishedAt;
    const runtimeDirectory = previous.manifest.runtimeDirectory;
    const runtimeHash = await fileHash(join(runtimeDirectory, "release.json"));
    const runner = join(root, "refresh-seo.mjs");
    await writeFile(runner, `
      import { pathToFileURL } from 'node:url';
      const worker = await import(pathToFileURL(process.env.TEST_WORKER).href);
      await worker.refreshSeo({runtimeDirectory: process.env.TEST_RUNTIME, stateDirectory: process.env.LUDORA_SEO_STATE_DIR,
        livePath: process.env.LUDORA_SEO_LIVE_PATH, lockPath: process.env.LUDORA_SEO_LOCK_PATH,
        apiOrigin: process.env.LUDORA_PRERENDER_API_ORIGIN, now: () => process.env.TEST_TIME});
    `);
    const refresh = async () => {
      const timestamp = new Date(Date.parse(firstDate) + ++day * 86400000).toISOString();
      const execution = await run(runner, { ...env, TEST_RUNTIME: runtimeDirectory,
        TEST_WORKER: join(runtimeDirectory, "refresh-worker.mjs"), TEST_TIME: timestamp });
      return { execution, timestamp };
    };
    const successful = async (changed, unchanged = []) => {
      const { execution, timestamp } = await refresh();
      assert.equal(execution.code, 0, execution.output.slice(-6000));
      const current = await inspectPublication(livePath, origin);
      for (const path of changed) assert.equal(current.manifest.pages[path]?.lastmod, timestamp, path);
      for (const path of unchanged) {
        assert.equal(current.manifest.pages[path]?.lastmod, previous.manifest.pages[path]?.lastmod, path);
        assert.equal(current.hashes[path], previous.hashes[path], `unchanged HTML ${path}`);
      }
      assert.equal(await fileHash(join(runtimeDirectory, "release.json")), runtimeHash);
      return current;
    };
    const game1 = "/game/1/juego-01", game2 = "/game/2/juego-02", game3 = "/game/3/juego-03";
    const catalog = "/juegos-de-mesa", category = "/categoria/7/estrategia";
    assert.ok(previous.manifest.pages[`${catalog}/pagina/2`]);
    assert.ok(previous.manifest.pages[`${category}/pagina/2`]);

    // A successful source re-check alone must preserve the exact published HTML and XML.
    records = records.map(record => ({ ...record, updated_at: "2030-01-01T00:00:00Z", offers: record.offers.map(value => ({
      ...value, refreshed_date: "2030-01-01T00:00:00Z", raw_price: "$350 MXN rechecked",
    })) }));
    let current = await successful([], Object.keys(previous.manifest.pages));
    assert.equal(current.sitemap, previous.sitemap);
    previous = current;

    records[0].offers = [{ ...offer, price: 425 }];
    previous = await successful([game1, catalog, category], ["/", game3, "/categorias"]);
    assert.match(visibleText(await documentAt(origin, catalog)), /Desde \$425\.00 MXN, sin envío/);
    assert.equal(jsonScript(await documentAt(origin, game1), "product-structured-data")["@graph"][0].offers[0].price, 425);

    records[0].offers[0].availability = "out_of_stock";
    previous = await successful([game1, catalog, category], ["/", game3, "/categorias"]);
    assert.doesNotMatch(visibleText(await documentAt(origin, catalog)), /Desde \$425/);
    assert.equal(jsonScript(await documentAt(origin, game1), "product-structured-data")["@graph"][0].offers[0].availability, "https://schema.org/OutOfStock");

    const added = completeRecord(catalogFixtures()[49]); added.categories = [{ id: 7, name: "Estrategia" }, { id: 10, name: "Cooperativos" }];
    records.push(added);
    previous = await successful(["/game/50/juego-50", catalog, `${catalog}/pagina/2`, category, "/categorias", "/categoria/10/cooperativos"], [game3]);

    records[1].canonical_name = 'Juego 02: Nueva edición & "más"';
    records[1].canonical_path = productPath(2, records[1].canonical_name);
    records[0].related_items[0].canonical_name = records[1].canonical_name;
    previous = await successful([records[1].canonical_path, game1, catalog, category], [game3, "/categoria/9/tematicos"]);
    assert.equal(previous.manifest.pages[game2], undefined);
    assert.equal((await fetch(`${origin}${game2}`)).status, 404);
    assert.equal(previous.routes.games[2], records[1].canonical_path);
    assert.match(await documentAt(origin, game1), new RegExp(`href="${records[1].canonical_path}"`));
    assert.match(visibleText(await documentAt(origin, records[1].canonical_path)), /Nueva edición & "más"/);

    // Empty category removal is a valid complete export, unlike an empty catalog.
    records[48].categories = [];
    previous = await successful(["/game/49/juego-49", category, "/categorias"], [catalog, game3]);
    assert.equal(previous.manifest.pages["/categoria/9/tematicos"], undefined);
    assert.equal(previous.routes.categories[9], undefined);
    assert.equal((await fetch(`${origin}/categoria/9/tematicos`)).status, 404);

    records = records.slice(0, 48);
    previous = await successful([catalog, category, "/categorias"], [game3]);
    for (const removed of ["/game/49/juego-49", "/game/50/juego-50", `${catalog}/pagina/2`, `${category}/pagina/2`, "/categoria/10/cooperativos"]) {
      assert.equal(previous.manifest.pages[removed], undefined, removed);
      assert.equal((await fetch(`${origin}${removed}`)).status, 404, removed);
    }
    assert.equal(previous.routes.catalogPageCount, 1);
    assert.equal(previous.routes.categories[7].pageCount, 1);
    assert.equal(previous.routes.games[49], undefined);
    assert.equal(previous.routes.games[50], undefined);

    for (failure of ["partial", "empty"]) {
      const before = await realpath(livePath), manifestHash = await fileHash(join(before, "..", "manifest.json"));
      const { execution } = await refresh();
      assert.notEqual(execution.code, 0, "incomplete exports must fail");
      assert.match(execution.output, failure === "partial" ? /before its captured maximum/ : /Unexpected empty SEO export/);
      assert.equal(await realpath(livePath), before);
      assert.equal(await fileHash(join(before, "..", "manifest.json")), manifestHash);
      assert.equal(await readFile(join(before, "sitemap.xml"), "utf8"), previous.sitemap);
      assert.equal(await fileHash(join(before, canonicalFile(game1))), previous.hashes[game1]);
      assert.equal(JSON.parse(await readFile(join(stateDirectory, "status.json"), "utf8")).publicationCompleted, false);
    }
    assert.ok(apiRequests.every(path => ["/api/front-page", "/api/items/prerender"].includes(path)));
    t.diagnostic(`Validated 8 complete compiled publications and 2 rejected exports; final ${Object.keys(previous.manifest.pages).length} canonical pages.`);
  } finally {
    server.closeAllConnections(); server.close(); await once(server, "close");
    await rm(root, { recursive: true, force: true });
  }
});

async function documentAt(origin, path) {
  const response = await fetch(`${origin}${path}`);
  assert.equal(response.status, 200, path);
  return response.text();
}

async function inspectPublication(livePath, origin) {
  const directory = await realpath(livePath);
  const manifest = JSON.parse(await readFile(join(directory, "..", "manifest.json"), "utf8"));
  const routes = JSON.parse(await readFile(join(directory, "..", "routes.json"), "utf8"));
  const sitemap = await readFile(join(directory, "sitemap.xml"), "utf8");
  const entries = [...sitemap.matchAll(/<url><loc>([^<]+)<\/loc><lastmod>([^<]+)<\/lastmod><\/url>/g)];
  const sitemapPaths = entries.map(([, url]) => new URL(url).pathname);
  assert.deepEqual(new Set(sitemapPaths), new Set(Object.keys(manifest.pages)), "sitemap and generated canonical page sets must match");
  assert.equal(sitemapPaths.length, Object.keys(manifest.pages).length);
  for (const [, url, lastmod] of entries) assert.equal(lastmod, manifest.pages[new URL(url).pathname].lastmod);
  assert.doesNotMatch(sitemap, /priority|changefreq/);
  const hashes = {}, reached = new Set(), queue = ["/"];
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const path = queue[cursor]; if (reached.has(path)) continue;
    reached.add(path);
    const document = await documentAt(origin, path);
    assert.match(document, /<meta name="robots" content="index, follow"/);
    assert.ok(document.includes(`rel="canonical" href="https://www.ludoradar.mx${path}"`), path);
    hashes[path] = await fileHash(join(directory, canonicalFile(path)));
    for (const [, target] of document.matchAll(/<a\b[^>]*href="(\/[^"?#]*)/g)) {
      if (/^\/(?:game|categoria|categorias|juegos-de-mesa)(?:\/|$)/.test(target)) assert.ok(manifest.pages[target], `missing target ${target}`);
      if (manifest.pages[target] && !reached.has(target)) queue.push(target);
    }
  }
  assert.deepEqual(reached, new Set(Object.keys(manifest.pages)), "every generated page is reachable without JS");
  return { manifest, routes, sitemap, hashes };
}

async function run(script, env) {
  const child = spawn(process.execPath, script.endsWith("refresh-seo.mjs") ? ["--max-old-space-size=256", script] : [script],
    { cwd: projectRoot, env, stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  child.stdout.on("data", chunk => { output += chunk; }); child.stderr.on("data", chunk => { output += chunk; });
  const [code] = await once(child, "close");
  return { code, output };
}
