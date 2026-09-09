import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createServer } from "vite";
import { item, offer, publishedAt, jsonScript, visibleText } from "../../../tests/seo/fixtures.mjs";

test("actual product SSR keeps comparison facts, embedded data and individual offers consistent", async t => {
  const vite = await createServer({ root: fileURLToPath(new URL("../../../", import.meta.url)), server: { middlewareMode: true }, appType: "custom" });
  const template = await readFile(new URL("../../../index.html", import.meta.url), "utf8");
  const originalError = console.error;
  console.error = (message, ...args) => {
    if (String(message).startsWith("Warning: useLayoutEffect does nothing on the server")) return;
    originalError(message, ...args);
  };
  try {
    const { renderProductDocument } = await vite.ssrLoadModule("/src/entry-server.tsx");
    const render = offers => renderProductDocument({ item: { ...item, offers }, template, publishedAt }).document;
    await t.test("approved 350 MXN offer and exported relationships are present before JavaScript", () => {
      const html = render([offer]);
      const text = visibleText(html);
      assert.match(text, /Precios de “Dixit” en tiendas de México/);
      assert.match(text, /Tienda Mesa/);
      assert.match(text, /\$350\.00 MXN/);
      assert.doesNotMatch(text, /Desde \$350\.00 MXN, sin envío/);
      assert.match(html, /href="https:\/\/tienda.example\/dixit"/);
      assert.match(html, /href="\/game\/852\/juego-relacionado"/);
      assert.match(html, /href="\/game\/853\/expansion-de-dixit"/);
      assert.match(text, /Comparación publicada:/);
      assert.match(html, /<time dateTime="2026-09-08T06:00:00.000Z">/);
      assert.match(
        text,
        /La versión, edición o idioma disponible puede variar según la tienda\.\s*Comparación publicada:[\s\S]*Los precios y la disponibilidad pueden cambiar\. Confírmalos en la tienda\./,
      );
      assert.match(html, /class="[^"]*rounded[^"]*border-green-500[^"]*bg-green-500[^"]*text-green-300[^"]*">Disponible<\/span>/);
      assert.match(html, /class="[^"]*rounded[^"]*">ES<\/span>/);
      assert.doesNotMatch(html, /class="[^"]*rounded-full[^"]*">ES<\/span>/);
      assert.doesNotMatch(text, /Idioma: Español|Idioma por confirmar/);
      assert.doesNotMatch(text, /Última comprobación|Precio verificado/);
      const embedded = jsonScript(html, "ludo-radar-prerender-data").product;
      assert.equal(embedded.stores[0].priceValue, 350);
      assert.equal(embedded.relatedGames[0].id, 852);
      assert.equal(embedded.expansionGames[0].id, 853);
      assert.equal(embedded.comparisonPublishedAt, publishedAt);
      const product = jsonScript(html, "product-structured-data")["@graph"][0];
      assert.deepEqual(product.offers, [{ "@type": "Offer", price: 350, priceCurrency: "MXN", url: offer.source_url,
        seller: { "@type": "Organization", name: "Tienda Mesa" }, availability: "https://schema.org/InStock" }]);
      assert.equal(product.aggregateRating, undefined);
    });

    const cases = [
      { name: "zero offers", offers: [], text: /No hay ofertas registradas para este juego/, badge: null, schema: [] },
      { name: "inactive store", change: { store_active: false }, text: /No disponible/, badge: /class="[^"]*border-red-500[^"]*bg-red-500[^"]*text-red-300[^"]*">No disponible<\/span>/, schema: [] },
      { name: "out of stock", change: { availability: "out_of_stock" }, text: /Agotado/, badge: /class="[^"]*border-yellow-500[^"]*bg-yellow-500[^"]*text-yellow-300[^"]*">Agotado<\/span>/, schema: ["OutOfStock"] },
      { name: "unknown availability and language", change: { availability: "unknown", language: null }, text: /Disponibilidad por confirmar/, schema: [null] },
      { name: "zero price", change: { price: 0 }, text: /Consultar/, schema: [] },
      { name: "negative price", change: { price: -10 }, text: /Consultar/, schema: [] },
      { name: "invalid price", change: { price: "not a price" }, text: /Consultar/, schema: [] },
      { name: "missing currency", change: { currency: null }, text: /Consultar/, schema: [] },
      { name: "non MXN", change: { currency: "USD", price: 20 }, text: /USD/, schema: [] },
      { name: "bundle", change: { is_bundle: true, price: 1 }, text: /Paquetes/, schema: [] },
      { name: "unconfirmed identity", change: { listing_status: "PENDING" }, text: /No hay ofertas registradas/, schema: [] },
      { name: "no public listing", change: { source_url: "javascript:alert(1)" }, text: /Tienda Mesa/, schema: [] },
    ];
    for (const fixture of cases) await t.test(fixture.name, () => {
      const html = render(fixture.offers ?? [{ ...offer, ...fixture.change }]);
      const text = visibleText(html);
      assert.match(text, fixture.text);
      if (fixture.badge) assert.match(html, fixture.badge);
      if (fixture.name === "unknown availability and language") {
        assert.doesNotMatch(text, /Idioma por confirmar|\bES\b|\bEN\b/);
      }
      assert.doesNotMatch(text, /Desde \$/);
      const offers = jsonScript(html, "product-structured-data")["@graph"][0].offers ?? [];
      assert.deepEqual(offers.map(entry => entry.availability?.replace("https://schema.org/", "") ?? null), fixture.schema);
      if (fixture.name === "inactive store") assert.doesNotMatch(text, /\$350/);
      if (fixture.name === "negative price") assert.doesNotMatch(text, /-\$10/);
    });

    await t.test("zero eligible offers do not override an indexable template", () => {
      const html = renderProductDocument({ item: { ...item, offers: [] },
        template: template.replace("noindex, nofollow", "index, follow"), publishedAt }).document;
      assert.match(html, /content="index, follow"/);
      assert.equal(jsonScript(html, "product-structured-data")["@graph"][0].offers, undefined);
    });

    await t.test("different listing editions stay individual and literal hostile text remains text", () => {
      const title = `Edición $$ $& $' $\` <script>alert(1)</script>`;
      const html = render([offer, { ...offer, id: 11, game_title: title, language: "en", price: 450,
        store_name: "Mesa <&> $$", source_url: "https://other.example/dixit?x=$&" }]);
      const product = jsonScript(html, "product-structured-data")["@graph"][0];
      assert.ok(Array.isArray(product.offers), "individual offers must exist");
      assert.equal(product.offers.length, 2);
      assert.deepEqual(product.offers.map(entry => entry["@type"]), ["Offer", "Offer"]);
      assert.deepEqual(product.offers.map(entry => entry.price), [350, 450]);
      assert.equal(product.offers[1].seller.name, "Mesa <&> $$");
      assert.equal(product.offers[1].itemOffered, undefined);
      assert.ok(visibleText(html).includes(title));
      assert.ok(!html.includes("<script>alert(1)</script>"));
      assert.match(visibleText(html), /La versión, edición o idioma disponible puede variar/);
      assert.match(html, /class="[^"]*rounded[^"]*">EN<\/span>/);
      assert.doesNotMatch(visibleText(html), /Idioma: Inglés/);
    });
  } finally { console.error = originalError; await vite.close(); }
});
