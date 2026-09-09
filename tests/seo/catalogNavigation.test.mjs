import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "@playwright/test";
import { startFixtureServer } from "./fixture-server.mjs";
import { catalogFixtures, offer } from "./fixtures.mjs";

test("catalog hydration and bidirectional SPA navigation keep URLs, metadata and inert payloads aligned", { timeout: 60000 }, async () => {
  const server = await startFixtureServer({ catalog: true });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage(); const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (/hydration|did not match|server HTML/i.test(message.text())) errors.push(message.text()); });
    let release;
    const client = new Promise(resolve => { release = resolve; });
    await page.route("**/src/main.tsx", async route => { await client; await route.continue(); });
    await page.goto("http://127.0.0.1:5175/juegos-de-mesa", { waitUntil: "commit" });
    await page.locator('ul[aria-label="Juegos del catálogo"]').waitFor();
    assert.equal(await page.locator('ul[aria-label="Juegos del catálogo"] > li').count(), 48);
    await page.evaluate(() => { window.originalCatalogRoot = document.querySelector("#root").firstChild; });
    release(); await page.waitForLoadState("networkidle");
    assert.equal(await page.evaluate(() => window.originalCatalogRoot === document.querySelector("#root").firstChild), true);
    const checkPage = async (path, count) => {
      await page.waitForURL(`http://127.0.0.1:5175${path}`);
      await page.waitForFunction(expected => document.querySelector('link[rel="canonical"]')?.href === `https://www.ludoradar.mx${expected}`, path);
      if (count !== undefined) {
        const selector = path.startsWith("/categoria/") ? '[aria-label="Resultados de juegos"] > a' : 'ul[aria-label="Juegos del catálogo"] > li';
        await page.waitForFunction(({ selector, count }) => document.querySelectorAll(selector).length === count, { selector, count });
      }
      assert.equal(await page.locator("#product-structured-data").count(), 0);
    };
    await page.getByRole("link", { name: "Siguiente", exact: true }).first().click();
    await checkPage("/juegos-de-mesa/pagina/2", 2);
    assert.match(await page.title(), /página 2/);
    await page.locator('ul[aria-label="Juegos del catálogo"] a').first().click();
    await page.waitForURL("**/game/49/juego-49"); await page.locator("#store-offers").waitFor();
    await page.locator('a[href="/categoria/7/estrategia"]').click();
    await checkPage("/categoria/7/estrategia", 49);
    const nextPath = await page.locator('[aria-label="Paginación del catálogo"] a').last().getAttribute("href");
    assert.equal(nextPath, "/categoria/7/estrategia/pagina/2");
    assert.equal(await page.locator('[aria-label="Paginación del catálogo"]').isVisible(), false);
    await page.evaluate(path => { history.pushState({ idx: 5 }, "", path); window.dispatchEvent(new PopStateEvent("popstate")); }, nextPath);
    await checkPage("/categoria/7/estrategia/pagina/2", 49);
    // These routes remain available for SPA entry; their SEO-only header links
    // are intentionally hidden from the interactive navigation.
    await page.evaluate(() => { history.pushState({ idx: 6 }, "", "/categorias"); window.dispatchEvent(new PopStateEvent("popstate")); });
    await checkPage("/categorias"); assert.equal(await page.title(), "Categorías de juegos de mesa | Ludo Radar");
    await page.locator('a[href="/"]').first().click(); await checkPage("/");
    await page.getByRole("link", { name: "Explorar catálogo", exact: true }).click();
    await page.waitForURL("**/search");
    await page.waitForFunction(() => document.querySelector('meta[name="robots"]').content === "noindex, follow");
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute("href"), "https://www.ludoradar.mx/");
    await page.evaluate(() => { history.pushState({ idx: 9 }, "", "/juegos-de-mesa"); window.dispatchEvent(new PopStateEvent("popstate")); });
    await checkPage("/juegos-de-mesa", 48);
    assert.equal(await page.locator('meta[name="robots"]').getAttribute("content"), "index, follow");
    await page.evaluate(() => { history.pushState({ idx: 10 }, "", "/categoria/7/antigua/pagina/2"); window.dispatchEvent(new PopStateEvent("popstate")); });
    await checkPage("/categoria/7/estrategia/pagina/2", 49);
    assert.match(await page.title(), /Estrategia.*página 2/);
    assert.equal(await page.evaluate(() => window.fetchedHtmlExecutions), 1, "fetched document scripts must never execute");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); await server.close(); }
});

test("published product paths survive newer live names and resolve SPA aliases and missing targets", { timeout: 60000 }, async () => {
  const server = await startFixtureServer({ catalog: true });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage(), errors = [], headRequests = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (/hydration|did not match|server HTML/i.test(message.text())) errors.push(message.text()); });
    page.on("request", request => { if (request.method() === "HEAD") headRequests.push(new URL(request.url()).pathname); });
    const renamed = { ...catalogFixtures()[48], canonical_name: "Juego renombrado en la API", offers: [{ ...offer, price: 425 }] };
    await page.route(url => /^\/api\/items\/(49|999)$/.test(url.pathname), route => route.fulfill({ json: {
      data: { ...renamed, id: Number(new URL(route.request().url()).pathname.split("/").at(-1)) },
    } }));
    const assertPublished = async () => {
      await page.waitForFunction(() => document.querySelector("#store-offers")?.textContent.includes("$425.00"));
      assert.equal(new URL(page.url()).pathname, "/game/49/juego-49");
      assert.match(await page.title(), /^Juego renombrado en la API:/);
      assert.equal(await page.locator('link[rel="canonical"]').getAttribute("href"), "https://www.ludoradar.mx/game/49/juego-49");
      const graph = await page.locator("#product-structured-data").evaluate(element => JSON.parse(element.textContent)["@graph"]);
      assert.equal(graph[0].url, "https://www.ludoradar.mx/game/49/juego-49");
      assert.equal(graph[0]["@id"], "https://www.ludoradar.mx/game/49/juego-49#product");
      assert.equal(graph[1].itemListElement[1].item, graph[0].url);
      assert.equal(graph[0].offers[0].price, 425);
    };
    await page.goto("http://127.0.0.1:5175/game/49/future-name");
    await assertPublished();
    assert.equal(headRequests.length, 0, "matching SSR snapshot already proves its published route");
    await page.goto("http://127.0.0.1:5175/juegos-de-mesa");
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => { history.pushState({ idx: 1 }, "", "/game/49/future-name"); window.dispatchEvent(new PopStateEvent("popstate")); });
    await assertPublished();
    assert.ok(headRequests.includes("/game/49/future-name"));
    await page.evaluate(() => { history.pushState({ idx: 2 }, "", "/game/999/ghost"); window.dispatchEvent(new PopStateEvent("popstate")); });
    await page.getByText("Juego no encontrado.", { exact: true }).waitFor();
    assert.equal(new URL(page.url()).pathname, "/game/999/ghost");
    assert.equal(await page.locator("#product-structured-data").count(), 0);
    assert.match(await page.locator('meta[name="robots"]').getAttribute("content"), /^noindex/);
    assert.equal(headRequests.filter(path => path === "/game/999/ghost").length, 1, "missing route must not retry or redirect itself");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); await server.close(); }
});
