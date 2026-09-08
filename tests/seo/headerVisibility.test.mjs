import assert from "node:assert/strict";
import test from "node:test";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { startFixtureServer } from "./fixture-server.mjs";

const sentence = "Descubre juegos de mesa, compara precios y encuentra ofertas disponibles en tiendas de México.";

test("home SEO anchors remain in SSR and hydrated HTML while hidden from visual and accessibility UI", { timeout: 60000 }, async () => {
  const server = await startFixtureServer({ catalog: true });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const assertHiddenContent = async page => {
      const nav = page.locator('header nav[aria-label="Catálogo y categorías"]');
      const section = page.locator('section[aria-labelledby="homepage-title"]');
      assert.equal(await nav.evaluate(element => element.hidden), true);
      assert.equal(await section.evaluate(element => element.hidden), true);
      assert.equal(await nav.isVisible(), false);
      assert.equal(await section.isVisible(), false);
      assert.equal(await page.getByRole("navigation", { name: "Catálogo y categorías" }).count(), 0);
      assert.equal(await page.getByRole("heading", { name: "Juegos de mesa en México", exact: true }).count(), 0);
      assert.equal(await page.getByRole("heading", { name: "Juegos destacados", exact: true }).count(), 0);
      assert.deepEqual(await nav.locator("a").evaluateAll(links => links.map(link => link.getAttribute("href"))), ["/juegos-de-mesa", "/categorias"]);
      assert.deepEqual(await section.locator("nav a").evaluateAll(links => links.map(link => link.getAttribute("href"))), ["/juegos-de-mesa", "/categorias"]);
      assert.equal(await section.locator('h1#homepage-title').textContent(), "Juegos de mesa en México");
      assert.equal(await section.locator('ul a[href^="/game/"]').count(), 8);
      assert.equal(await section.locator("p").textContent(), sentence);
      assert.equal(await page.locator("header").getByText(sentence, { exact: true }).isVisible(), true);
      assert.equal(await page.locator('meta[name="robots"]').getAttribute("content"), "index, follow");
      assert.equal(await page.locator('link[rel="canonical"]').getAttribute("href"), "https://www.ludoradar.mx/");
    };
    const noJs = await browser.newContext({ javaScriptEnabled: false });
    const page = await noJs.newPage();
    await page.goto("http://127.0.0.1:5175/");
    await assertHiddenContent(page);
    await mkdir(new URL("../../output/playwright/header-visibility/", import.meta.url), { recursive: true });
    for (const [name, width, height] of [["desktop", 1280, 900], ["tablet", 768, 900], ["mobile", 390, 844], ["small-mobile", 320, 800]]) {
      await page.setViewportSize({ width, height });
      const logo = await page.locator("header .ludora-wordmark").boundingBox();
      const description = await page.locator("header").getByText(sentence, { exact: true }).boundingBox();
      const input = await page.getByPlaceholder("Buscar juegos...").boundingBox();
      assert.ok(logo && description && input);
      assert.ok(description.x >= logo.x + logo.width - 1, `${name}: sentence stays next to logo`);
      assert.ok(input.width >= 100, `${name}: search remains usable`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${name}: no horizontal overflow`);
      assert.equal(await page.getByRole("link", { name: "Explorar catálogo", exact: true }).isVisible(), true);
      if (name === "desktop" || name === "mobile") await page.screenshot({ path: fileURLToPath(new URL(`../../output/playwright/header-visibility/${name}.png`, import.meta.url)), fullPage: false });
    }
    await noJs.close();

    const hydrated = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    hydrated.on("pageerror", error => errors.push(error.message));
    hydrated.on("console", message => { if (/hydration|did not match|server HTML/i.test(message.text())) errors.push(message.text()); });
    let releaseClient;
    const clientGate = new Promise(resolve => { releaseClient = resolve; });
    await hydrated.route("**/src/main.tsx", async route => { await clientGate; await route.continue(); });
    await hydrated.goto("http://127.0.0.1:5175/", { waitUntil: "commit" });
    await hydrated.locator('section[aria-labelledby="homepage-title"]').waitFor({ state: "attached" });
    await hydrated.evaluate(() => { window.originalHomeRoot = document.getElementById("root").firstChild; });
    releaseClient(); await hydrated.waitForLoadState("networkidle");
    await assertHiddenContent(hydrated);
    assert.equal(await hydrated.evaluate(() => window.originalHomeRoot === document.getElementById("root").firstChild), true);
    await hydrated.getByPlaceholder("Buscar juegos...").fill("Dixit");
    await hydrated.getByPlaceholder("Buscar juegos...").press("Enter");
    await hydrated.waitForURL("**/search?q=Dixit");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); await server.close(); }
});
