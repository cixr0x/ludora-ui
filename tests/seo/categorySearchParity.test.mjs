import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";
import { startFixtureServer } from "./fixture-server.mjs";

const origin = "http://127.0.0.1:5175", category = "/categoria/7/estrategia";
const rows = Array.from({ length: 125 }, (_, i) => ({ id: i + 1,
  canonical_name: `Game ${String(i + 1).padStart(3, "0")}`,
  canonical_name_es: `Juego ${String(i + 1).padStart(3, "0")}`, image_url: "", image_url_es: "",
  is_expansion: i % 7 === 0, categories: [{ id: 7, name: "Estrategia" }], families: [], mechanics: [] }));

async function configure(page) {
  const requests = [], errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (["warning", "error"].includes(message.type())) errors.push(message.text()); });
  await page.route("**/api/items/filter-options", route => route.fulfill({ json: { data: {
    categories: [{ id: 7, name: "Estrategia" }], mechanics: [],
  } } }));
  await page.route("**/api/items/search-results?*", route => {
    const query = new URL(route.request().url()).searchParams;
    requests.push(Object.fromEntries(query));
    const offset = Number(query.get("offset") ?? 0), limit = Number(query.get("limit"));
    return route.fulfill({ json: { data: rows.slice(offset, offset + limit) } });
  });
  return { requests, errors };
}

async function visibleUi(page) {
  return page.evaluate(() => {
    function visit(node) {
      if (node.nodeType === Node.TEXT_NODE) return node.textContent.trim() || null;
      if (!(node instanceof HTMLElement || node instanceof SVGElement) || ["SCRIPT", "STYLE"].includes(node.tagName)) return null;
      const css = getComputedStyle(node);
      if (css.display === "none" || css.visibility === "hidden") return null;
      const rect = node.getBoundingClientRect();
      return { tag: node.tagName, attributes: Object.fromEntries(["class", "role", "href", "aria-label", "aria-expanded", "placeholder", "type"].flatMap(key => node.hasAttribute(key) ? [[key, node.getAttribute(key)]] : [])),
        style: [css.background, css.color, css.display, css.fontFamily, css.fontSize, css.fontWeight, css.lineHeight, css.gridTemplateColumns],
        value: node instanceof HTMLInputElement ? node.value : undefined,
        layout: [rect.x, rect.y, rect.width, rect.height],
        children: [...node.childNodes].map(visit).filter(value => value !== null) };
    }
    return visit(document.querySelector("#root"));
  });
}

for (const [name, width, height] of [["desktop", 1280, 900], ["mobile", 390, 844]]) {
  test(`${name}: category server HTML keeps SEO links hidden and matches Search's initial loading UI`, { timeout: 30000 }, async () => {
    const server = await startFixtureServer({ catalog: true }), browser = await chromium.launch({ channel: "chrome", headless: true });
    let release;
    try {
      const search = await browser.newPage({ viewport: { width, height } });
      const gate = new Promise(resolve => { release = resolve; });
      await search.route("**/api/items/**", async route => { await gate; await route.fulfill({ json: { data: [] } }); });
      await search.goto(origin + "/search?category_ids=7");
      await search.getByText("Cargando catálogo...", { exact: true }).waitFor();
      const expected = await visibleUi(search);
      const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width, height } });
      const page = await context.newPage();
      for (const [path, count, first] of [[category, 48, "/game/1/juego-01"], [`${category}/pagina/2`, 1, "/game/49/juego-49"]]) {
        assert.equal((await page.goto(origin + path)).status(), 200);
        assert.equal(await page.getByText("Cargando catálogo...", { exact: true }).count(), 1);
        const anchors = page.locator('main [hidden] a[href^="/game/"]');
        assert.equal(await anchors.count(), count);
        assert.equal(await anchors.first().getAttribute("href"), first);
        assert.equal(await anchors.first().isVisible(), false);
        assert.equal(await page.getByRole("heading", { level: 1 }).count(), 0);
        assert.equal(await page.getByRole("navigation", { name: "Paginación del catálogo" }).count(), 0);
        assert.ok(await page.locator('main [hidden] a[href^="/categoria/"]').count() > 0);
        assert.equal(await page.locator('link[rel="canonical"]').getAttribute("href"), `https://www.ludoradar.mx${path}`);
        assert.equal(await page.locator('meta[name="robots"]').getAttribute("content"), "index, follow");
        assert.deepEqual(await visibleUi(page), expected);
      }
      await context.close();
      release(); await search.waitForLoadState("networkidle");
    } finally { release?.(); await browser.close(); await server.close(); }
  });

  test(`${name}: category and Search have identical visible DOM after ordinary results load`, { timeout: 30000 }, async () => {
    const server = await startFixtureServer({ catalog: true }), browser = await chromium.launch({ channel: "chrome", headless: true });
    try {
      const page = await browser.newPage({ viewport: { width, height } });
      const { errors } = await configure(page), snapshots = [];
      for (const path of ["/search?category_ids=7", category, `${category}/pagina/2`]) {
        await page.goto(origin + path); await page.waitForLoadState("networkidle");
        assert.equal(await page.getByRole("heading", { level: 1 }).count(), 0, "category-only heading is absent from visible/accessibility UI");
        assert.equal(await page.getByRole("navigation", { name: "Paginación del catálogo" }).count(), 0);
        assert.equal(await page.locator('[aria-label="Resultados de juegos"] > a').count(), 60);
        const firstCard = page.locator('[aria-label="Resultados de juegos"] > a').first();
        assert.deepEqual(await firstCard.locator("p").allTextContents(), ["Juego 001", "Game 001"]);
        assert.equal(await firstCard.getByText("Expansión", { exact: true }).count(), 1);
        assert.equal(new URL(page.url()).pathname, path.split("?")[0], "loading preserves the entry route");
        snapshots.push(await visibleUi(page));
      }
      await mkdir("output/playwright/category-search-parity", { recursive: true });
      await writeFile(`output/playwright/category-search-parity/${name}-visible-dom.json`, JSON.stringify(snapshots));
      const hashes = snapshots.map(value => createHash("sha256").update(JSON.stringify(value)).digest("hex"));
      assert.equal(hashes[1], hashes[0], "category/Search visible DOM and geometry must match; see retained JSON");
      assert.equal(hashes[2], hashes[0], "page-two category/Search visible DOM and geometry must match");
      await page.screenshot({ path: `output/playwright/category-search-parity/${name}.png` });
      assert.deepEqual(errors, []);
    } finally { await browser.close(); await server.close(); }
  });

  test(`${name}: category and Search append the same infinite pages without changing category URLs`, { timeout: 40000 }, async () => {
    const server = await startFixtureServer({ catalog: true }), browser = await chromium.launch({ channel: "chrome", headless: true });
    try {
      const outcomes = [], requestSequences = [];
      for (const path of ["/search?category_ids=7", category, `${category}/pagina/2`]) {
        const page = await browser.newPage({ viewport: { width, height } }), { requests, errors } = await configure(page);
        await page.goto(origin + path); await page.waitForLoadState("networkidle");
        for (const count of [120, 125]) {
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          await expect(page.locator('[aria-label="Resultados de juegos"] > a')).toHaveCount(count, { timeout: 3000 });
          await page.waitForLoadState("networkidle");
        }
        assert.equal(await page.getByText("No hay más resultados.", { exact: true }).count(), 1);
        assert.equal(new URL(page.url()).pathname, path.split("?")[0]);
        assert.equal(await page.locator('meta[name="robots"]').getAttribute("content"), path.startsWith("/search") ? "noindex, follow" : "index, follow");
        if (path.startsWith("/categoria")) assert.equal(await page.locator('link[rel="canonical"]').getAttribute("href"), `https://www.ludoradar.mx${path}`);
        const offsets = requests.map(query => Number(query.offset ?? 0));
        assert.deepEqual([...new Set(offsets)], [0, 60, 120]);
        assert.equal(requests.every(query => query.category_ids === "7" && query.limit === "60"), true);
        requestSequences.push(requests);
        outcomes.push(await page.locator('[aria-label="Resultados de juegos"] > a').evaluateAll(links => links.map(link => ({ href: link.getAttribute("href"), text: link.innerText }))));
        assert.deepEqual(errors, []);
        await page.close();
      }
      assert.deepEqual(outcomes[1], outcomes[0]); assert.deepEqual(outcomes[2], outcomes[0]);
      assert.deepEqual(requestSequences[1], requestSequences[0]); assert.deepEqual(requestSequences[2], requestSequences[0]);
    } finally { await browser.close(); await server.close(); }
  });
}
