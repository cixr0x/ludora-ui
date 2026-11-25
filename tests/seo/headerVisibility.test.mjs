import assert from "node:assert/strict";
import test from "node:test";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { startFixtureServer } from "./fixture-server.mjs";

const sentence = "Descubre juegos de mesa, compara precios y encuentra ofertas disponibles en tiendas de México.";
const heading = "Compara precios de juegos de mesa en México";
const title = "Comparador de precios de juegos de mesa en México | Ludo Radar";

test("the homepage exposes its comparison heading, catalog link and published counts before and after hydration", { timeout: 60000 }, async () => {
  const server = await startFixtureServer({ catalog: true, homepageStats: { catalogProductCount: 50, trackedStoreCount: 13 } });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const assertHomepageContent = async page => {
      const nav = page.locator('header nav[aria-label="Catálogo y categorías"]');
      const section = page.locator('section[aria-labelledby="homepage-title"]');
      assert.equal(await nav.evaluate(element => element.hidden), true);
      assert.equal(await nav.isVisible(), false);
      assert.equal(await page.getByRole("navigation", { name: "Catálogo y categorías" }).count(), 0);
      assert.equal(await page.getByRole("heading", { name: heading, level: 1, exact: true }).isVisible(), true);
      assert.equal(await page.getByRole("heading", { name: "Juegos destacados", exact: true }).count(), 0);
      assert.deepEqual(await nav.locator("a").evaluateAll(links => links.map(link => link.getAttribute("href"))), ["/juegos-de-mesa", "/categorias"]);
      assert.deepEqual(await section.locator("nav a").evaluateAll(links => links.map(link => link.getAttribute("href"))), ["/juegos-de-mesa", "/categorias"]);
      const catalog = section.getByRole("link", { name: "Ver catálogo", exact: true });
      assert.equal(await catalog.isVisible(), true);
      assert.equal(await catalog.getAttribute("href"), "/juegos-de-mesa");
      assert.equal(await section.locator('ul a[href^="/game/"]').count(), 8);
      assert.equal(await section.getByText("50 productos en el catálogo", { exact: true }).isVisible(), true);
      assert.equal(await section.getByText("13 tiendas monitoreadas", { exact: true }).isVisible(), true);
      assert.equal(await page.locator("header").getByText(sentence, { exact: true }).isVisible(), true);
      assert.equal(await page.title(), title);
      assert.equal(await page.locator('meta[property="og:title"]').getAttribute("content"), title);
      assert.equal(await page.locator('meta[name="twitter:title"]').getAttribute("content"), title);
      assert.equal(await page.locator('meta[name="robots"]').getAttribute("content"), "index, follow");
      assert.equal(await page.locator('link[rel="canonical"]').getAttribute("href"), "https://www.ludoradar.mx/");
    };
    const noJs = await browser.newContext({ javaScriptEnabled: false });
    const page = await noJs.newPage();
    await page.goto("http://127.0.0.1:5175/");
    await assertHomepageContent(page);
    await mkdir(new URL("../../output/playwright/header-visibility/", import.meta.url), { recursive: true });
    for (const [name, width, height] of [["desktop", 1280, 900], ["small-desktop", 1024, 900], ["wide-tablet", 900, 900], ["tablet", 768, 900], ["below-md", 767, 900], ["mobile", 390, 844], ["small-mobile", 320, 800]]) {
      await page.setViewportSize({ width, height });
      const logo = await page.locator("header .ludora-wordmark").boundingBox();
      const description = await page.locator("header").getByText(sentence, { exact: true }).boundingBox();
      const input = await page.getByPlaceholder("Buscar juegos...").boundingBox();
      assert.ok(logo && description && input);
      assert.ok(description.x >= logo.x + logo.width - 1, `${name}: sentence stays next to logo`);
      assert.ok(input.width >= 100, `${name}: search remains usable`);
      if (width >= 768) {
        const row = await page.locator("header > div").first().boundingBox();
        assert.ok(Math.abs((logo.y + logo.height / 2) - (input.y + input.height / 2)) <= 1, `${name}: logo and search share the md desktop row`);
        assert.equal(row.height, 64, `${name}: md row retains its 64px height`);
        assert.equal(input.width, width >= 1024 ? 288 : Math.min(256, Math.max(128, width - 640)), `${name}: search scales within its desktop width bounds`);
        assert.ok(description.y >= row.y && description.y + description.height <= row.y + row.height, `${name}: whole sentence fits inside the desktop row ${JSON.stringify({ row, logo, description, input })}`);
        assert.ok(input.x >= description.x + description.width, `${name}: sentence does not overlap search`);
      } else {
        assert.ok(input.y >= Math.max(logo.y + logo.height, description.y + description.height), `${name}: search remains on the second mobile row`);
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${name}: no horizontal overflow`);
      assert.equal(await page.getByRole("link", { name: "Explorar catálogo", exact: true }).isVisible(), true);
      if (name === "desktop" || name === "mobile" || name === "tablet") await page.screenshot({ path: fileURLToPath(new URL(`../../output/playwright/header-visibility/${name}.png`, import.meta.url)), fullPage: false });
    }
    await noJs.close();

    const hydrated = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    hydrated.on("pageerror", error => errors.push(error.message));
    hydrated.on("console", message => { if (/hydration|did not match|server HTML/i.test(message.text())) errors.push(message.text()); });
    let releaseClient;
    const clientGate = new Promise(resolve => { releaseClient = resolve; });
    await hydrated.route("**/src/main.tsx", async route => { await clientGate; await route.continue(); });
    await hydrated.route("**/api/front-page", route => route.fulfill({
      json: { data: [], meta: { catalog_product_count: 9876, tracked_store_count: 21 } },
    }));
    await hydrated.goto("http://127.0.0.1:5175/", { waitUntil: "commit" });
    await hydrated.locator('section[aria-labelledby="homepage-title"]').waitFor({ state: "attached" });
    await hydrated.evaluate(() => { window.originalHomeRoot = document.getElementById("root").firstChild; });
    releaseClient(); await hydrated.waitForLoadState("networkidle");
    await assertHomepageContent(hydrated);
    assert.equal(await hydrated.evaluate(() => window.originalHomeRoot === document.getElementById("root").firstChild), true);
    await hydrated.getByRole("link", { name: "Ver catálogo", exact: true }).click();
    await hydrated.waitForURL("**/juegos-de-mesa");
    await hydrated.locator('header a[href="/"]').click();
    await hydrated.getByRole("heading", { name: heading, level: 1, exact: true }).waitFor();
    await hydrated.getByPlaceholder("Buscar juegos...").fill("Dixit");
    await hydrated.getByPlaceholder("Buscar juegos...").press("Enter");
    await hydrated.waitForURL("**/search?q=Dixit");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); await server.close(); }
});

test("a homepage reached from another document loads available aggregate counts from the existing feed", { timeout: 60000 }, async () => {
  const server = await startFixtureServer({ catalog: true });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage();
    await page.route("**/api/front-page", route => route.fulfill({
      json: { data: [], meta: { catalog_product_count: 9876, tracked_store_count: 0 } },
    }));
    await page.goto("http://127.0.0.1:5175/search");
    await page.locator('header a[href="/"]').click();
    await page.waitForURL("http://127.0.0.1:5175/");
    await page.getByText("9,876 productos en el catálogo", { exact: true }).waitFor();
    assert.equal(await page.getByText("0 tiendas monitoreadas", { exact: true }).isVisible(), true);
    assert.equal(await page.locator("#ludo-radar-prerender-data").count(), 0);

    await page.unroute("**/api/front-page");
    await page.route("**/api/front-page", route => route.fulfill({
      json: { data: [], meta: { catalog_product_count: 9876, tracked_store_count: "unknown" } },
    }));
    await page.goto("http://127.0.0.1:5175/search");
    await page.locator('header a[href="/"]').click();
    await page.getByText("9,876 productos en el catálogo", { exact: true }).waitFor();
    assert.equal(await page.getByText(/tiendas monitoreadas/).count(), 0);
  } finally { await browser.close(); await server.close(); }
});
