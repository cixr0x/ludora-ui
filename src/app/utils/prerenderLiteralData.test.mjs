import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { createServer as createViteServer } from "vite";

const projectRoot = fileURLToPath(new URL("../../../", import.meta.url));
const template = readFileSync(new URL("../../../index.html", import.meta.url), "utf8");
const fixtures = [
  { id: 1, name: "Money $$", path: "/game/1/money" },
  { id: 2, name: "A $& B", path: "/game/2/a-b" },
  { id: 3, name: "A $' B", path: "/game/3/a-b" },
  { id: 4, name: "A $` B", path: "/game/4/a-b" },
  { id: 5, name: "</script><script>alert(1)</script>", path: "/game/5/script-script-alert-1-script" },
];

test("prerendered catalog text is inserted literally into HTML and embedded data", async (t) => {
  const vite = await createViteServer({ root: projectRoot, server: { middlewareMode: true }, appType: "custom" });
  const originalConsoleError = console.error;

  try {
    console.error = (message, ...args) => {
      if (typeof message === "string" && message.startsWith("Warning: useLayoutEffect does nothing on the server")) return;
      originalConsoleError(message, ...args);
    };
    const { renderHomepageDocument, renderProductDocument } = await vite.ssrLoadModule("/src/entry-server.tsx");

    for (const { id, name, path } of fixtures) {
      await t.test(`homepage round-trips ${JSON.stringify(name)}`, () => {
        const featuredGames = [{ id, name }];
        const document = renderHomepageDocument({ featuredGames, template });

        assertSingleRoot(document);
        assert.deepEqual(readJsonScript(document, "ludo-radar-prerender-data"), { homepage: { featuredGames } });
        const links = [...document.matchAll(/<a\b[^>]*href="(\/game\/[^"]+)"[^>]*>([^<]*)<\/a>/g)];
        assert.deepEqual(links.map(([, href, text]) => ({ href, text: decodeHtml(text) })), [{ href: path, text: name }]);
        assert.equal(readCanonical(document), "https://www.ludoradar.mx/");
        assert.ok(!document.includes("<script>alert(1)</script>"));
      });

      for (const pageTemplate of [template, '<html><head><title>Default</title></head><body><div id="root"></div></body></html>']) {
        await t.test(`product round-trips ${JSON.stringify(name)} with ${pageTemplate === template ? "existing" : "absent"} metadata`, () => {
          const imageUrl = "https://images.example.com/cover-$$.webp?version=$&";
          const { canonicalPath, document } = renderProductDocument({
            item: { id, canonical_name: name, image_url: imageUrl, description: name, min_players: 2, max_players: 4 },
            template: pageTemplate,
          });

          assertSingleRoot(document);
          const product = readJsonScript(document, "ludo-radar-prerender-data").product;
          assert.equal(product.name, name);
          assert.deepEqual(product.description, [name]);
          assert.equal(product.image, imageUrl);
          assert.equal(canonicalPath, path);
          assert.equal(readCanonical(document), `https://www.ludoradar.mx${path}`);

          const title = `${name}: información y precios en México | Ludo Radar`;
          const description = `${name}: información para 2-4 jugadores, duración Sin registrar, complejidad, descripción y disponibilidad en tiendas de México.`;
          assert.equal(decodeHtml(document.match(/<title>([^<]*)<\/title>/)?.[1] ?? ""), title);
          assert.equal(readMeta(document, "description"), description);
          assert.equal(readMeta(document, "og:title"), title);
          assert.equal(readMeta(document, "og:description"), description);
          assert.equal(readMeta(document, "twitter:title"), title);
          assert.equal(readMeta(document, "twitter:description"), description);
          assert.equal(readMeta(document, "og:image"), imageUrl);
          assert.equal(readMeta(document, "twitter:image"), imageUrl);

          const structuredData = readJsonScript(document, "product-structured-data");
          const structuredProduct = structuredData["@graph"].find((entry) => entry["@type"] === "Product");
          assert.equal(structuredProduct.name, name);
          assert.equal(structuredProduct.description, name);
          assert.equal(structuredProduct.image, imageUrl);
          assert.equal(structuredProduct.url, `https://www.ludoradar.mx${path}`);
          assert.ok(!document.includes("<script>alert(1)</script>"));
        });
      }
    }
  } finally {
    console.error = originalConsoleError;
    await vite.close();
  }
});

function assertSingleRoot(document) {
  assert.equal([...document.matchAll(/<div id="root">/g)].length, 1);
}

function readJsonScript(document, id) {
  const matches = [...document.matchAll(new RegExp(`<script id="${id}"[^>]*>([\\s\\S]*?)<\\/script>`, "g"))];
  assert.equal(matches.length, 1, `Expected one ${id} script`);
  return JSON.parse(matches[0][1]);
}

function readCanonical(document) {
  const matches = [...document.matchAll(/<link rel="canonical" href="([^"]*)"\s*\/>/g)];
  assert.equal(matches.length, 1);
  return decodeHtml(matches[0][1]);
}

function readMeta(document, key) {
  const matches = [...document.matchAll(new RegExp(`<meta (?:name|property)="${key}" content="([^"]*)"\\s*\\/>`, "g"))];
  assert.equal(matches.length, 1, `Expected one ${key} meta tag`);
  return decodeHtml(matches[0][1]);
}

function decodeHtml(value) {
  const entities = { "&quot;": '"', "&#x27;": "'", "&#39;": "'", "&lt;": "<", "&gt;": ">", "&amp;": "&" };
  return value.replace(/&quot;|&#x27;|&#39;|&lt;|&gt;|&amp;/g, (entity) => entities[entity]);
}
