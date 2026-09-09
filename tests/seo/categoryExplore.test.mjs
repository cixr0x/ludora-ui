import assert from "node:assert/strict";
import test from "node:test";
import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { startFixtureServer } from "./fixture-server.mjs";

const origin = "http://127.0.0.1:5175";
const category = "/categoria/7/estrategia";

test("visible homepage category navigation enters the canonical landing before filter edits enter Search", { timeout: 60000 }, async t => {
  const server = await startFixtureServer({ catalog: true });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    for (const [name, width, height] of [["desktop", 1280, 900], ["mobile", 390, 844]]) {
      await t.test(name, async () => {
        const page = await browser.newPage({ viewport: { width, height } }), errors = [];
        page.on("pageerror", error => errors.push(error.message));
        page.on("console", message => { if (["warning", "error"].includes(message.type())) errors.push(message.text()); });
        try {
          await page.route("**/api/items/filter-options", route => route.fulfill({ json: { data: {
            categories: [{ id: 7, name: "Estrategia" }], mechanics: [],
          } } }));
          await page.goto(origin); await page.waitForLoadState("networkidle");
          const link = page.getByRole("banner").getByRole("link", { name: "Estrategia", exact: true });
          assert.equal(await link.isVisible(), true);
          t.diagnostic(`${name} visible category href: ${await link.getAttribute("href")}`);
          await link.click(); await page.waitForLoadState("networkidle");
          assert.equal(new URL(page.url()).pathname, category);
          assert.equal(new URL(page.url()).search, "");
          assert.equal(await page.locator("h1").textContent(), "Juegos de mesa de Estrategia");
          assert.equal(await page.locator("h1").isVisible(), false);
          assert.equal(await page.getByPlaceholder("Nombre, temática, mecánica…").count(), 1);
          assert.equal(await page.getByRole("button", { name: "Estrategia, desactivar filtro", exact: true }).count(), 1);
          assert.equal(await page.locator('[aria-label="Resultados de juegos"] > a').count(), 49);
          assert.equal(await page.locator('link[rel="canonical"]').getAttribute("href"), `https://www.ludoradar.mx${category}`);
          assert.equal(await page.locator('meta[name="robots"]').getAttribute("content"), "index, follow");
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
          await mkdir("output/playwright/header-category-entry", { recursive: true });
          await page.screenshot({ path: `output/playwright/header-category-entry/${name}.png` });
          await page.locator("aside").getByRole("button", { name: "3", exact: true }).first().click();
          await page.waitForURL(url => url.pathname === "/search");
          assert.deepEqual(Object.fromEntries(new URL(page.url()).searchParams), { category_ids: "7", players: "3" });
          await page.waitForFunction(() => document.querySelector('meta[name="robots"]').content === "noindex, follow");
          await page.reload(); await page.waitForLoadState("networkidle");
          assert.deepEqual(Object.fromEntries(new URL(page.url()).searchParams), { category_ids: "7", players: "3" });
          assert.deepEqual(errors, []);
        } finally { await page.close(); }
      });
    }
  } finally { await browser.close(); await server.close(); }
});

test("sequential keyboard input keeps the full query, focus and caret across the category handoff", { timeout: 60000 }, async t => {
  const server = await startFixtureServer({ catalog: true });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage(), errors = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (["warning", "error"].includes(message.type())) errors.push(message.text()); });
    for (const path of [category, `${category}/pagina/2`, "/search?category_ids=7"]) {
      await t.test(`typing from ${path}`, async () => {
        await page.goto(`${origin}${path}`); await page.waitForLoadState("networkidle");
        const input = page.getByPlaceholder("Nombre, temática, mecánica…");
        await input.click(); await page.keyboard.type("azul", { delay: 100 });
        const snapshot = await input.evaluate(element => ({ value: element.value, focused: document.activeElement === element,
          start: element.selectionStart, end: element.selectionEnd, url: location.pathname + location.search }));
        t.diagnostic(JSON.stringify({ path, ...snapshot }));
        assert.equal(snapshot.value, "azul");
        assert.equal(snapshot.focused, true);
        assert.equal(snapshot.start, 4); assert.equal(snapshot.end, 4);
        assert.equal(new URL(page.url()).pathname, "/search");
        assert.equal(new URL(page.url()).searchParams.get("q"), "azul");
        await page.keyboard.press("ArrowLeft"); await page.keyboard.press("ArrowLeft");
        await page.keyboard.type("X", { delay: 100 });
        assert.equal(await input.inputValue(), "azXul");
        assert.deepEqual(await input.evaluate(element => [document.activeElement === element, element.selectionStart, element.selectionEnd]), [true, 3, 3]);
        assert.equal(new URL(page.url()).searchParams.get("q"), "azXul");
        assert.equal(await page.locator('meta[name="robots"]').getAttribute("content"), "noindex, follow");
        await page.reload(); await page.waitForLoadState("networkidle");
        assert.equal(await input.inputValue(), "azXul");
      });
    }
    for (const path of [category, `${category}/pagina/2`]) {
      await t.test(`composition from ${path}`, async () => {
        await page.goto(`${origin}${path}`); await page.waitForLoadState("networkidle");
        const input = page.getByPlaceholder("Nombre, temática, mecánica…");
        await input.click();
        await input.dispatchEvent("compositionstart", { data: "" });
        await page.keyboard.type("azul", { delay: 100 });
        assert.equal(new URL(page.url()).pathname, path, "do not unmount the composing input");
        await page.keyboard.press("ArrowLeft");
        await input.dispatchEvent("compositionend", { data: "azul" });
        await page.waitForURL(url => url.pathname === "/search");
        assert.equal(new URL(page.url()).searchParams.get("q"), "azul");
        assert.equal(await input.inputValue(), "azul");
        assert.deepEqual(await input.evaluate(element => [document.activeElement === element, element.selectionStart, element.selectionEnd]), [true, 3, 3]);
        await page.keyboard.type("X"); assert.equal(await input.inputValue(), "azuXl");
      });
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); await server.close(); }
});

test("LudoRadar submission from a category enters Search and consumes its prompt once", { timeout: 30000 }, async () => {
  const server = await startFixtureServer({ catalog: true });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage(), prompts = [];
    await page.route("**/api/items/semantic-search?*", route => {
      prompts.push(new URL(route.request().url()).searchParams.get("q"));
      return route.fulfill({ json: { data: [] } });
    });
    await page.goto(`${origin}${category}`);
    await page.getByRole("button", { name: "LudoRadar", exact: true }).click();
    await page.getByLabel("Describe la experiencia").fill("juegos cooperativos");
    await page.getByRole("button", { name: "Buscar con LudoRadar", exact: true }).click();
    await page.waitForURL(url => url.pathname === "/search");
    await page.getByText("Resultados para “juegos cooperativos”", { exact: true }).waitFor();
    await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(error => {
      assert.fail(`Search did not settle after ${prompts.length} semantic requests: ${error.message}`);
    });
    assert.deepEqual(prompts, ["juegos cooperativos"]);
    assert.equal(new URL(page.url()).search, "");
    assert.equal(await page.locator('meta[name="robots"]').getAttribute("content"), "noindex, follow");
  } finally { await browser.close(); await server.close(); }
});

test("category publications hydrate crawlable initial slices before adopting ordinary Search results", { timeout: 60000 }, async () => {
  const server = await startFixtureServer({ catalog: true });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const noJs = await browser.newContext({ javaScriptEnabled: false });
    const staticPage = await noJs.newPage();
    assert.equal((await staticPage.goto(`${origin}${category}`)).status(), 200);
    assert.equal(await staticPage.getByPlaceholder("Nombre, temática, mecánica…").count(), 1, "published category must use Explore's search control");
    assert.equal(await staticPage.getByText("Cargando catálogo...", { exact: true }).count(), 1);
    assert.equal(await staticPage.locator('main [hidden] a[href^="/game/"]').count(), 48);
    assert.equal(await staticPage.locator('ul[aria-label="Juegos del catálogo"]').count(), 0, "separate category catalog presentation is removed");
    assert.equal(await staticPage.locator("h1").textContent(), "Juegos de mesa de Estrategia");
    assert.equal(await staticPage.locator("h1").isVisible(), false);
    assert.match(await staticPage.locator("main").textContent(), /Explora 49 juegos de mesa de Estrategia/);
    assert.doesNotMatch(await staticPage.locator('main [hidden]').textContent(), /Desde \$|Sin precio disponible|MXN, sin envío/, "hidden category SEO content does not add catalog price lines");
    const nextPath = await staticPage.locator('[aria-label="Paginación del catálogo"] a').last().getAttribute("href");
    assert.equal(await staticPage.locator('[aria-label="Paginación del catálogo"]').isVisible(), false);
    await staticPage.goto(origin + nextPath);
    assert.equal(new URL(staticPage.url()).pathname, `${category}/pagina/2`);
    assert.equal(await staticPage.locator('main [hidden] a[href^="/game/"]').count(), 1);
    assert.equal(await staticPage.locator('main [hidden] a[href^="/game/"]').first().getAttribute("href"), "/game/49/juego-49");
    assert.equal(await staticPage.locator('link[rel="canonical"]').getAttribute("href"), `https://www.ludoradar.mx${category}/pagina/2`);
    assert.equal(await staticPage.locator('meta[name="robots"]').getAttribute("content"), "index, follow");
    await noJs.close();

    const page = await browser.newPage(), errors = [], requests = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (/hydration|did not match|server HTML/i.test(message.text())) errors.push(message.text()); });
    page.on("request", request => { if (new URL(request.url()).pathname.includes("search-results")) requests.push(request.url()); });
    await page.addInitScript(() => sessionStorage.setItem("ludora:ludoscopio:session:v2", JSON.stringify({ prompt: "cached unrelated search", results: [] })));
    let release; const gate = new Promise(resolve => { release = resolve; });
    await page.route("**/src/main.tsx", async route => { await gate; await route.continue(); });
    await page.goto(`${origin}${category}`, { waitUntil: "commit" });
    await page.locator('main [hidden] a[href^="/game/"]').first().waitFor({ state: "attached" });
    await page.evaluate(() => { window.categoryRoot = document.querySelector("#root").firstChild; });
    release(); await page.waitForLoadState("networkidle");
    assert.equal(await page.evaluate(() => window.categoryRoot === document.querySelector("#root").firstChild), true);
    assert.equal(await page.locator('[aria-label="Resultados de juegos"] > a').count(), 49);
    assert.ok(requests.length > 0, "hydrated categories use ordinary live Search results");
    assert.equal(requests.every(url => new URL(url).searchParams.get("category_ids") === "7" && new URL(url).searchParams.get("limit") === "60"), true);
    assert.equal(await page.getByText("cached unrelated search", { exact: false }).count(), 0);
    await mkdir("output/playwright/category-explore", { recursive: true });
    for (const [name, width, height] of [["desktop", 1280, 900], ["mobile", 390, 844]]) {
      await page.setViewportSize({ width, height });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${name}: no horizontal overflow`);
      const contextText = page.getByText("Encuentra tu próximo juego", { exact: true });
      const textBox = await contextText.boundingBox(), rowBox = await contextText.locator("..").boundingBox();
      assert.ok(textBox.y >= rowBox.y && textBox.y + textBox.height <= rowBox.y + rowBox.height, `${name}: context text fits its wrapping row`);
      await page.screenshot({ path: `output/playwright/category-explore/${name}.png` });
    }
    await page.goto(`${origin}${category}/pagina/2`);
    await page.waitForURL(`${origin}${category}/pagina/2`);
    await page.waitForFunction(() => document.querySelectorAll('[aria-label="Resultados de juegos"] > a').length === 49);
    assert.match(await page.title(), /Estrategia.*página 2/);
    assert.equal(await page.locator('meta[name="robots"]').getAttribute("content"), "index, follow");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); await server.close(); }
});

test("editing category landing filters transitions to persistent noindex Search URLs", { timeout: 90000 }, async () => {
  const server = await startFixtureServer({ catalog: true });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage(), errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/api/items/filter-options", route => route.fulfill({ json: { data: {
      categories: [{ id: 7, name: "Estrategia" }, { id: 9, name: "Temáticos" }], mechanics: [{ id: 4, name: "Drafting" }],
    } } }));
    const scenarios = [
      { params: {}, act: () => page.getByRole("button", { name: "Estrategia, desactivar filtro", exact: true }).click() },
      { params: { category_ids: "7,9" }, act: async () => { await page.getByRole("button", { name: "Expandir categorías", exact: true }).click(); await page.getByRole("button", { name: "Temáticos", exact: true }).click(); } },
      { params: { category_ids: "7", mechanic_ids: "4" }, act: async () => { await page.getByRole("button", { name: "Expandir mecánicas", exact: true }).click(); await page.locator("#mechanic-filter-options button").first().click(); } },
      { params: { category_ids: "7", players: "3" }, act: () => page.locator("aside").getByRole("button", { name: "3", exact: true }).first().click() },
      { params: { category_ids: "7", playtimes: "short" }, act: () => page.getByRole("button", { name: "Corta · <45m", exact: true }).click() },
      { params: { category_ids: "7", complexity_min: "3", complexity_max: "3" }, act: () => page.locator("aside").getByRole("button", { name: "3", exact: true }).last().click() },
      { params: { category_ids: "7", q: "azul" }, act: () => page.getByPlaceholder("Nombre, temática, mecánica…").fill("azul") },
      { params: {}, act: () => page.getByRole("button", { name: /^Borrar todo \(/ }).click() },
    ];
    for (const scenario of scenarios) {
      await page.goto(`${origin}${category}/pagina/2`); await page.waitForLoadState("networkidle");
      assert.equal(await page.getByPlaceholder("Nombre, temática, mecánica…").count(), 1);
      await page.evaluate(() => sessionStorage.setItem("ludora:ludoscopio:session:v2", JSON.stringify({ prompt: "cached unrelated search", results: [] })));
      await scenario.act();
      await page.waitForURL(url => url.pathname === "/search");
      assert.deepEqual(Object.fromEntries(new URL(page.url()).searchParams), scenario.params);
      await page.waitForFunction(() => document.querySelector('meta[name="robots"]').content === "noindex, follow");
      assert.equal(await page.locator("#product-structured-data").count(), 0);
      assert.doesNotMatch(await page.title(), /^Estrategia:/);
      assert.equal(await page.getByText("cached unrelated search", { exact: false }).count(), 0, "landing filter edits start a catalog search rather than restore unrelated semantic results");
      await page.reload(); await page.waitForLoadState("networkidle");
      assert.deepEqual(Object.fromEntries(new URL(page.url()).searchParams), scenario.params);
      if (scenario.params.players) assert.match(await page.locator("aside").getByRole("button", { name: "3", exact: true }).first().getAttribute("class"), /bg-fuchsia/);
      if (scenario.params.playtimes) assert.match(await page.getByRole("button", { name: "Corta · <45m", exact: true }).getAttribute("class"), /bg-fuchsia/);
      if (scenario.params.complexity_min) assert.match(await page.locator("aside").textContent(), /3 – 3/);
      if (scenario.params.q) assert.equal(await page.getByPlaceholder("Nombre, temática, mecánica…").inputValue(), "azul");
    }
    await page.goto(`${origin}${category}?players=3`);
    await page.waitForURL(url => url.pathname === "/search");
    assert.deepEqual(Object.fromEntries(new URL(page.url()).searchParams), { category_ids: "7", players: "3" });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); await server.close(); }
});
