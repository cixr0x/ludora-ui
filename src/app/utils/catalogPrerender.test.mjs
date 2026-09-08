import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createServer } from "vite";
import { buildCatalogIndex, catalogPageDescriptors, catalogPageModel } from "./catalogSeo.js";
import { item, publishedAt, jsonScript, visibleText } from "../../../tests/seo/fixtures.mjs";

test("actual static catalog graph reaches all games through 48-card pages including uncategorized games", async () => {
  const vite = await createServer({ root: fileURLToPath(new URL("../../../", import.meta.url)), server: { middlewareMode: true, hmr: false }, appType: "custom" });
  const original = console.error;
  console.error = (message, ...args) => { if (!String(message).startsWith("Warning: useLayoutEffect does nothing on the server")) original(message, ...args); };
  try {
    const renderer = await vite.ssrLoadModule("/src/entry-server.tsx");
    assert.equal(typeof renderer.renderCatalogDocument, "function", "catalog SSR entry point must exist");
    const template = (await readFile(new URL("../../../index.html", import.meta.url), "utf8")).replace("noindex, nofollow", "index, follow");
    const games = Array.from({ length: 49 }, (_, n) => ({ id: n + 1, name: `Juego ${String(n + 1).padStart(2, "0")}`,
      canonicalPath: `/game/${n + 1}/juego-${String(n + 1).padStart(2, "0")}`, image: "", minimumPrice: n === 0 ? 350 : null,
      categories: n < 48 ? [{ id: 7, name: "Estrategía" }] : [] }));
    const index = buildCatalogIndex(games);
    const documents = new Map([["/", renderer.renderHomepageDocument({ featuredGames: [{ id: 1, name: "Juego 01" }], template })]]);
    for (const descriptor of catalogPageDescriptors(index)) {
      const model = { ...catalogPageModel(index, descriptor), indexingEnabled: true };
      const rendered = renderer.renderCatalogDocument({ model, template });
      assert.equal(rendered.canonicalPath, model.canonicalPath);
      assert.match(rendered.document, new RegExp(`rel="canonical" href="https://www.ludoradar.mx${model.canonicalPath}"`));
      assert.equal(jsonScript(rendered.document, "ludo-radar-prerender-data").catalogPage.canonicalPath, model.canonicalPath);
      documents.set(model.canonicalPath, rendered.document);
    }
    for (const game of games) documents.set(game.canonicalPath, renderer.renderProductDocument({ item: {
      ...item, id: game.id, canonical_name: game.name, canonical_path: game.canonicalPath, categories: game.categories,
      related_items: [], expansion_items: [], mechanics: [{ id: 4, name: "Drafting" }],
    }, template, publishedAt }).document);
    const first = documents.get("/juegos-de-mesa");
    const second = documents.get("/juegos-de-mesa/pagina/2");
    assert.equal(jsonScript(first, "ludo-radar-prerender-data").catalogPage.items.length, 48);
    assert.equal(jsonScript(second, "ludo-radar-prerender-data").catalogPage.items.length, 1);
    assert.match(visibleText(first), /Desde \$350\.00 MXN, sin envío/);
    assert.doesNotMatch(first, /<img[^>]*src=""/, "known missing covers must not render broken no-JS images");
    assert.match(visibleText(second), /Sin precio disponible confirmado en MXN/);
    assert.match(first, /href="\/juegos-de-mesa\/pagina\/2"/);
    assert.match(second, /href="\/juegos-de-mesa"/);
    assert.match(documents.get("/game/1/juego-01"), /href="\/categoria\/7\/estrategia"/);
    assert.match(documents.get("/game/1/juego-01"), /href="\/search\?mechanic_ids=4"/);
    const reached = new Set(), queue = ["/"];
    while (queue.length) {
      const path = queue.shift(); if (reached.has(path)) continue;
      reached.add(path);
      for (const match of documents.get(path).matchAll(/<a\b[^>]*href="(\/[^"?#]*)"/g)) if (documents.has(match[1])) queue.push(match[1]);
    }
    for (const game of games) assert.ok(reached.has(game.canonicalPath), `unreachable game ${game.id}`);
  } finally { console.error = original; await vite.close(); }
});
