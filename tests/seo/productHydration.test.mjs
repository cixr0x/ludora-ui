import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "@playwright/test";
import { startFixtureServer } from "./fixture-server.mjs";
import { item, offer } from "./fixtures.mjs";

test("real browser hydration retains SSR offers and relationships then refreshes price and JSON-LD together", { timeout: 60000 }, async () => {
  const server = await startFixtureServer();
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (/hydration|did not match|server HTML/i.test(message.text())) errors.push(message.text()); });
    let releaseClient, releaseApi, apiStarted;
    const clientGate = new Promise(resolve => { releaseClient = resolve; });
    const apiGate = new Promise(resolve => { releaseApi = resolve; });
    const requestStarted = new Promise(resolve => { apiStarted = resolve; });
    await page.route("**/src/main.tsx", async route => { await clientGate; await route.continue(); });
    await page.route(url => url.pathname.startsWith("/api/"), async route => {
      const url = new URL(route.request().url());
      apiStarted(); await apiGate;
      const data = url.pathname === "/api/items/851" ? { ...item, offers: [{ ...offer, price: 425 }] }
        : url.pathname.endsWith("/related") ? [{ id: 854, canonical_name: "Nuevo relacionado" }]
        : url.pathname.endsWith("/expansions") ? [{ id: 855, canonical_name: "Nueva expansión" }] : [];
      await route.fulfill({ json: { data } });
    });
    await page.goto("http://127.0.0.1:5175/game/851/dixit", { waitUntil: "commit" });
    await page.locator("#store-offers").waitFor();
    const snapshot = () => page.evaluate(() => ({
      text: document.querySelector("#store-offers").textContent,
      links: [...document.querySelectorAll('a[href^="/game/"]')].map(a => a.getAttribute("href")),
      offers: JSON.parse(document.getElementById("product-structured-data").textContent)["@graph"][0].offers,
    }));
    const before = await snapshot();
    assert.match(before.text, /\$350\.00/);
    assert.equal(before.offers[0].price, 350);
    assert.ok(before.links.includes("/game/852/juego-relacionado"));
    assert.ok(before.links.includes("/game/853/expansion-de-dixit"));
    await page.evaluate(() => { window.originalRoot = document.getElementById("root").firstChild; });
    releaseClient(); await requestStarted;
    assert.deepEqual(await snapshot(), before, "hydration must preserve the exact initial offer/relationship model");
    assert.equal(await page.evaluate(() => window.originalRoot === document.getElementById("root").firstChild), true);
    releaseApi();
    await page.waitForFunction(() => document.querySelector("#store-offers").textContent.includes("$425.00") &&
      JSON.parse(document.getElementById("product-structured-data").textContent)["@graph"][0].offers?.[0]?.price === 425)
      .catch(async error => { throw new Error(`${error.message}\n${JSON.stringify({ snapshot: await snapshot(), errors })}`); });
    const after = await snapshot();
    assert.doesNotMatch(after.text, /\$350\.00/);
    await page.locator('a[href="/game/854/nuevo-relacionado"]').waitFor();
    await page.locator('a[href="/game/855/nueva-expansion"]').waitFor();
    assert.deepEqual(errors, []);

    for (const path of ["/search", "/privacidad", "/terminos"]) {
      await page.goto(`http://127.0.0.1:5175${path}`);
      await page.waitForFunction(() => document.querySelector("#store-offers") === null);
      assert.equal(new URL(page.url()).pathname, path);
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); await server.close(); }
});
