import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { startFixtureServer } from "./fixture-server.mjs";

const sentence = "Descubre juegos de mesa, compara precios y encuentra ofertas disponibles en tiendas de México.";
const title = "Comparador de precios de juegos de mesa en México | Ludo Radar";

async function startHomepageFixture(t, homepageStats) {
  const cacheDir = await mkdtemp(join(tmpdir(), "ludoradar-home-browser-"));
  let server;
  t.after(async () => {
    await server?.close();
    await rm(cacheDir, { recursive: true, force: true });
  });
  server = await startFixtureServer({ catalog: true, homepageStats, port: 0, cacheDir });
  return server.origin;
}

test("the compact homepage intro and published counts fit the header before and after hydration", { timeout: 60000 }, async t => {
  const origin = await startHomepageFixture(t, { catalogProductCount: 10582, trackedStoreCount: 79 });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const assertHomepageContent = async page => {
      const header = page.getByRole("banner");
      const nav = header.locator('nav[aria-label="Catálogo y categorías"]');
      assert.equal(await nav.evaluate(element => element.hidden), true);
      assert.equal(await nav.isVisible(), false);
      assert.equal(await page.getByRole("navigation", { name: "Catálogo y categorías" }).count(), 0);
      assert.equal(await header.getByRole("heading", { name: sentence, level: 1, exact: true }).isVisible(), true);
      assert.equal(await page.getByRole("heading", { name: "Juegos destacados", exact: true }).count(), 0);
      assert.deepEqual(await nav.locator("a").evaluateAll(links => links.map(link => link.getAttribute("href"))), ["/juegos-de-mesa", "/categorias"]);
      assert.equal(await page.getByRole("link", { name: "Ver catálogo", exact: true }).count(), 0);
      assert.equal(await page.getByRole("link", { name: "Explorar categorías", exact: true }).count(), 0);
      assert.equal(await page.locator('main [hidden] ul a[href^="/game/"]').count(), 8);
      const counts = header.getByRole("list", { name: "Cifras del catálogo" });
      assert.equal(await counts.getByText("10,582 productos en el catálogo", { exact: true }).isVisible(), true);
      assert.equal(await counts.getByText("79 tiendas activas", { exact: true }).isVisible(), true);
      assert.equal(await header.getByText(sentence, { exact: true }).count(), 1);
      assert.equal(await page.title(), title);
      assert.equal(await page.locator('meta[property="og:title"]').getAttribute("content"), title);
      assert.equal(await page.locator('meta[name="twitter:title"]').getAttribute("content"), title);
      assert.equal(await page.locator('meta[name="robots"]').getAttribute("content"), "index, follow");
      assert.equal(await page.locator('link[rel="canonical"]').getAttribute("href"), "https://www.ludoradar.mx/");
    };
    const noJs = await browser.newContext({ javaScriptEnabled: false });
    const page = await noJs.newPage();
    await page.goto(origin);
    await assertHomepageContent(page);
    await mkdir(new URL("../../output/playwright/header-visibility/", import.meta.url), { recursive: true });
    for (const [name, width, height] of [["desktop", 1280, 900], ["small-desktop", 1024, 900], ["wide-tablet", 900, 900], ["tablet", 768, 900], ["below-md", 767, 900], ["mobile", 390, 844], ["small-mobile", 320, 800]]) {
      await page.setViewportSize({ width, height });
      const logo = await page.locator("header .ludora-wordmark").boundingBox();
      const homeHeading = page.getByRole("banner").getByRole("heading", { name: sentence, level: 1, exact: true });
      const description = await homeHeading.locator("..").boundingBox();
      const intro = await homeHeading.boundingBox();
      const counts = await page.getByRole("list", { name: "Cifras del catálogo" }).boundingBox();
      const input = await page.getByPlaceholder("Buscar juegos...").boundingBox();
      assert.ok(logo && description && intro && counts && input);
      assert.ok(description.x >= logo.x + logo.width - 1, `${name}: heading and counts stay next to logo`);
      assert.ok(counts.y >= intro.y + intro.height, `${name}: counts sit below the full intro`);
      const fontSize = await homeHeading.evaluate(element => parseFloat(getComputedStyle(element).fontSize));
      assert.equal(fontSize, width >= 1024 || (width >= 640 && width < 768) ? 14 : 12, `${name}: heading uses the intro text scale`);
      if (width >= 1024) {
        const countParts = await page.getByRole("list", { name: "Cifras del catálogo" }).locator("li").evaluateAll(elements =>
          elements.map(element => element.getBoundingClientRect().y));
        assert.equal(countParts[0], countParts[1], `${name}: both counts share a line`);
      }
      assert.ok(input.width >= 100, `${name}: search remains usable`);
      if (width >= 768) {
        const row = await page.locator("header > div").first().boundingBox();
        assert.ok(Math.abs((logo.y + logo.height / 2) - (input.y + input.height / 2)) <= 1, `${name}: logo and search share the md desktop row`);
        assert.ok(row.height >= 64, `${name}: md row retains its compact minimum height`);
        if (width === 1280) assert.equal(row.height, 64, `${name}: wide desktop retains its 64px height`);
        assert.equal(input.width, width >= 1024 ? 288 : Math.min(256, Math.max(128, width - 640)), `${name}: search scales within its desktop width bounds`);
        assert.ok(description.y >= row.y && description.y + description.height <= row.y + row.height, `${name}: heading and counts fit inside the desktop row ${JSON.stringify({ row, logo, description, input })}`);
        assert.ok(input.x >= description.x + description.width, `${name}: heading and counts do not overlap search`);
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
    await hydrated.goto(origin, { waitUntil: "commit" });
    await hydrated.locator("header #homepage-title").waitFor({ state: "attached" });
    await hydrated.evaluate(() => { window.originalHomeRoot = document.getElementById("root").firstChild; });
    releaseClient(); await hydrated.waitForLoadState("networkidle");
    await assertHomepageContent(hydrated);
    assert.equal(await hydrated.evaluate(() => window.originalHomeRoot === document.getElementById("root").firstChild), true);
    await hydrated.getByPlaceholder("Buscar juegos...").fill("Dixit");
    await hydrated.getByPlaceholder("Buscar juegos...").press("Enter");
    await hydrated.waitForURL("**/search?q=Dixit");
    const otherHeader = hydrated.getByRole("banner");
    await otherHeader.getByText(sentence, { exact: true }).and(otherHeader.locator("p")).waitFor();
    assert.equal(await otherHeader.getByRole("heading", { name: sentence, level: 1, exact: true }).count(), 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("a homepage reached from another document loads available aggregate counts from the existing feed", { timeout: 60000 }, async t => {
  const origin = await startHomepageFixture(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage();
    await page.route("**/api/front-page", route => route.fulfill({
      json: { data: [], meta: { catalog_product_count: 9876, tracked_store_count: 0 } },
    }));
    await page.goto(`${origin}/search`);
    await page.getByRole("banner").getByText(sentence, { exact: true }).waitFor();
    await page.locator('header a[href="/"]').click();
    await page.waitForURL(`${origin}/`);
    await page.getByText("9,876 productos en el catálogo", { exact: true }).waitFor();
    assert.equal(await page.getByText("0 tiendas activas", { exact: true }).isVisible(), true);
    assert.equal(await page.locator("#ludo-radar-prerender-data").count(), 0);

    await page.unroute("**/api/front-page");
    await page.route("**/api/front-page", route => route.fulfill({
      json: { data: [], meta: { catalog_product_count: 9876, tracked_store_count: "unknown" } },
    }));
    await page.goto(`${origin}/search`);
    await page.locator('header a[href="/"]').click();
    await page.getByText("9,876 productos en el catálogo", { exact: true }).waitFor();
    assert.equal(await page.getByText(/tiendas activas/).count(), 0);
  } finally { await browser.close(); }
});

test("the homepage retries a missing aggregate count without replacing loaded catalog rows", { timeout: 60000 }, async t => {
  const origin = await startHomepageFixture(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  let releaseRetry;
  const retryGate = new Promise(resolve => { releaseRetry = resolve; });
  try {
    const page = await browser.newPage();
    let requests = 0;
    await page.route("**/api/front-page", async route => {
      if (++requests === 1) return route.fulfill({ json: {
        data: [{ id: 1, category_type: "category", category_id: 7, category_name: "Estrategia",
          title: "Selección inicial", order: 1, products: [{ id: 1, canonical_name: "Juego inicial" }] }],
        meta: { catalog_product_count: 9876 },
      } });
      await retryGate;
      return route.fulfill({ json: { data: [], meta: { catalog_product_count: 10000, tracked_store_count: 79 } } });
    });
    await page.goto(origin);
    const rowHeading = page.getByRole("heading", { name: "Selección inicial", exact: true });
    await rowHeading.waitFor({ timeout: 5000 });
    assert.equal(await page.getByText("9,876 productos en el catálogo", { exact: true }).isVisible(), true);
    assert.equal(await page.getByText(/tiendas activas/).count(), 0);
    releaseRetry();
    await page.getByText("79 tiendas activas", { exact: true }).waitFor({ timeout: 5000 });
    assert.equal(await rowHeading.isVisible(), true);
    assert.equal(await page.getByText("9,876 productos en el catálogo", { exact: true }).isVisible(), true);
    await page.waitForLoadState("networkidle");
    assert.equal(requests, 2);
  } finally {
    releaseRetry();
    await browser.close();
  }
});
