import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";
import { startFixtureServer } from "./fixture-server.mjs";
import { item } from "./fixtures.mjs";

const origin = "http://127.0.0.1:5175", category = "/categoria/7/estrategia";
const rows = Array.from({ length: 125 }, (_, i) => ({ id: i + 1,
  canonical_name: `Game ${String(i + 1).padStart(3, "0")}`,
  canonical_name_es: `Juego ${String(i + 1).padStart(3, "0")}`, image_url: "", image_url_es: "",
  is_expansion: i % 7 === 0, categories: [{ id: 7, name: "Estrategia" }], families: [], mechanics: [] }));

async function configure(page, categoryOption = { id: 7, name: "Estrategia" }) {
  const requests = [], errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (["warning", "error"].includes(message.type())) errors.push(message.text()); });
  await page.route("**/api/items/filter-options", route => route.fulfill({ json: { data: {
    categories: [categoryOption], mechanics: [],
  } } }));
  await page.route("**/api/items/search-results?*", route => {
    const query = new URL(route.request().url()).searchParams;
    requests.push(Object.fromEntries(query));
    const offset = Number(query.get("offset") ?? 0), limit = Number(query.get("limit"));
    return route.fulfill({ json: { data: rows.slice(offset, offset + limit).map(row => ({ ...row, categories: [categoryOption] })) } });
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

const savedSession = { prompt: "sesión semántica guardada", results: [{
  id: 1, name: "Juego 01", altTitle: "Resultado guardado", image: "", isExpansion: false,
  genres: ["Estrategia abstracta"], categories: [{ id: 33, name: "Estrategia abstracta" }], mechanics: [],
  categoryNames: ["Estrategia abstracta"], mechanicNames: [], minPlayers: 1, maxPlayers: 4,
  minMinutes: 30, maxMinutes: 60, complexity: 2,
}] };
async function seedSession(page) {
  await page.addInitScript(session => {
    if (sessionStorage.getItem("ludora:ludoscopio:session:v2") === null) {
      sessionStorage.setItem("ludora:ludoscopio:session:v2", JSON.stringify(session));
    }
  }, savedSession);
}

test("unfiltered Search restores its saved session and explicit Ludoscopio prompts still replace it", { timeout: 40000 }, async () => {
  const server = await startFixtureServer({ catalog: true, category: { id: 33, name: "Estrategia abstracta" } });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage();
    const { requests, errors } = await configure(page, { id: 33, name: "Estrategia abstracta" });
    await seedSession(page);
    await page.goto(origin + "/search"); await page.waitForLoadState("networkidle");
    assert.equal(await page.getByText(`Resultados para “${savedSession.prompt}”`, { exact: true }).count(), 1);
    assert.equal(await page.locator('[aria-label="Resultados de juegos"] > a').count(), 1);
    assert.equal(await page.getByText("Resultado guardado", { exact: true }).count(), 1);
    assert.deepEqual(requests, [], "restoring unfiltered semantic results does not start ordinary Search");
    await page.locator('[aria-label="Resultados de juegos"] > a').click();
    await page.waitForURL("**/game/1/juego-01"); await page.locator("#store-offers").waitFor();
    await page.goBack(); await page.waitForLoadState("networkidle");
    await expect(page.getByText(`Resultados para “${savedSession.prompt}”`, { exact: true })).toBeVisible();
    const prompts = [];
    await page.route("**/api/items/semantic-search?*", route => {
      prompts.push(new URL(route.request().url()).searchParams.get("q"));
      return route.fulfill({ json: { data: [{ ...item, id: 2, canonical_name: "Nueva coincidencia", categories: [] }] } });
    });
    for (const key of ["ludoscopio", "ludoscopioPrompt"]) {
      const prompt = `nueva búsqueda ${key}`;
      await page.goto(`${origin}/search?${new URLSearchParams({ category_ids: "33", [key]: prompt })}`);
      await page.getByText(`Resultados para “${prompt}”`, { exact: true }).waitFor();
      await page.waitForLoadState("networkidle");
      assert.equal(await page.getByText("Nueva coincidencia", { exact: true }).count(), 1);
      assert.equal(new URL(page.url()).search, "");
      assert.equal(await page.evaluate(() => JSON.parse(sessionStorage.getItem("ludora:ludoscopio:session:v2")).prompt), prompt);
      assert.equal(await page.locator('meta[name="robots"]').getAttribute("content"), "noindex, follow");
    }
    assert.deepEqual(prompts, ["nueva búsqueda ludoscopio", "nueva búsqueda ludoscopioPrompt"]);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); await server.close(); }
});

test("ordinary and semantic filter navigation retain their result mode through reload and Back", { timeout: 60000 }, async () => {
  const categoryOption = { id: 33, name: "Estrategia abstracta" };
  const server = await startFixtureServer({ catalog: true, category: categoryOption });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    for (const path of ["/search?category_ids=33", "/categoria/33/estrategia-abstracta", "/categoria/33/estrategia-abstracta/pagina/2"]) {
      const page = await browser.newPage(), { errors } = await configure(page, categoryOption);
      await seedSession(page);
      await page.goto(origin + path); await page.waitForLoadState("networkidle");
      await page.getByRole("button", { name: "Estrategia abstracta, desactivar filtro", exact: true }).click();
      await page.waitForURL(origin + "/search"); await page.waitForLoadState("networkidle");
      await expect(page.locator('[aria-label="Resultados de juegos"] > a')).toHaveCount(60);
      assert.deepEqual(await page.evaluate(() => JSON.parse(sessionStorage.getItem("ludora:ludoscopio:session:v2"))), savedSession);
      await page.reload(); await page.waitForLoadState("networkidle");
      assert.equal(await page.getByText(`Resultados para “${savedSession.prompt}”`, { exact: true }).count(), 0, "reloading an ordinary filter edit does not restore an unrelated session");
      await page.locator('[aria-label="Resultados de juegos"] > a').first().click();
      await page.waitForURL("**/game/1/juego-01"); await page.locator("#store-offers").waitFor();
      await page.goBack(); await page.waitForLoadState("networkidle");
      await expect(page.locator('[aria-label="Resultados de juegos"] > a')).toHaveCount(60);
      await page.getByRole("banner").getByRole("link", { name: "Explorar catálogo", exact: true }).click();
      await page.getByText(`Resultados para “${savedSession.prompt}”`, { exact: true }).waitFor();
      await page.waitForLoadState("networkidle");
      await page.getByRole("button", { name: "Expandir categorías", exact: true }).click();
      await page.getByRole("button", { name: "Estrategia abstracta", exact: true }).click();
      await page.waitForURL("**/search?category_ids=33"); await page.waitForLoadState("networkidle");
      for (const step of ["filter", "reload", "product/Back"]) {
        if (step === "reload") { await page.reload(); await page.waitForLoadState("networkidle"); }
        if (step === "product/Back") {
          await page.locator('[aria-label="Resultados de juegos"] > a').click();
          await page.waitForURL("**/game/1/juego-01"); await page.locator("#store-offers").waitFor();
          await page.goBack(); await page.waitForLoadState("networkidle");
        }
        await expect(page.getByText(`Resultados para “${savedSession.prompt}”`, { exact: true }), `${step} keeps the explicitly filtered semantic result`).toBeVisible();
        assert.equal(await page.locator('[aria-label="Resultados de juegos"] > a').count(), 1);
        assert.equal(new URL(page.url()).searchParams.get("category_ids"), "33");
      }
      assert.deepEqual(errors, []); await page.close();
    }
  } finally { await browser.close(); await server.close(); }
});

test("an explicit semantic search still works when session storage cannot be written", { timeout: 20000 }, async () => {
  const server = await startFixtureServer({ catalog: true }), browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage(), { errors } = await configure(page);
    await page.addInitScript(() => { Storage.prototype.setItem = () => { throw new Error("storage unavailable"); }; });
    await page.route("**/api/items/semantic-search?*", route => route.fulfill({ json: { data: [{ ...item, id: 2, canonical_name: "Nueva coincidencia", categories: [] }] } }));
    await page.goto(`${origin}/search?ludoscopio=consulta`);
    await expect(page.getByText("Resultados para “consulta”", { exact: true })).toBeVisible();
    assert.equal(await page.getByText("Nueva coincidencia", { exact: true }).count(), 1);
    await page.getByPlaceholder("Nombre, temática, mecánica…").fill("Nueva");
    await page.waitForURL("**/search?q=Nueva");
    await expect(page.getByText("Nueva coincidencia", { exact: true })).toBeVisible();
    assert.equal(await page.getByText("Resultados para “consulta”", { exact: true }).count(), 1);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); await server.close(); }
});

for (const [name, width, height] of [["desktop", 1280, 900], ["mobile", 390, 844]]) {
  test(`${name}: Explore restores the same session after category query, slug and page-two navigation`, { timeout: 60000 }, async t => {
    const categoryOption = { id: 33, name: "Estrategia abstracta" };
    const server = await startFixtureServer({ catalog: true, category: categoryOption });
    const browser = await chromium.launch({ channel: "chrome", headless: true });
    try {
      const outcomes = [];
      for (const path of ["/search?category_ids=33", "/categoria/33/estrategia-abstracta", "/categoria/33/estrategia-abstracta/pagina/2"]) {
        const page = await browser.newPage({ viewport: { width, height } });
        const { errors } = await configure(page, categoryOption);
        await seedSession(page);
        await page.goto(origin + path); await page.waitForLoadState("networkidle");
        assert.equal(await page.locator('[aria-label="Resultados de juegos"] > a').count(), 60);
        await page.getByRole("banner").getByRole("link", { name: "Explorar catálogo", exact: true }).click();
        await page.waitForURL(origin + "/search"); await page.waitForLoadState("networkidle");
        const states = [];
        for (const step of ["Explore", "product/Back", "reload"]) {
          if (step === "product/Back") {
            await page.locator('[aria-label="Resultados de juegos"] > a').first().click();
            await page.waitForURL("**/game/1/juego-01"); await page.locator("#store-offers").waitFor();
            await page.goBack(); await page.waitForLoadState("networkidle");
            await expect(page.getByText(`Resultados para “${savedSession.prompt}”`, { exact: true })).toBeVisible();
          } else if (step === "reload") {
            await page.reload(); await page.waitForLoadState("networkidle");
          }
          // Neutralize hover and restored scroll before comparing complete visible UI geometry.
          await page.mouse.move(0, 0); await page.evaluate(() => window.scrollTo(0, 0));
          await page.evaluate(() => Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => {}))));
          const state = { step, prompt: await page.getByText(`Resultados para “${savedSession.prompt}”`, { exact: true }).count(),
            cards: await page.locator('[aria-label="Resultados de juegos"] > a').count(), ui: await visibleUi(page) };
          t.diagnostic(JSON.stringify({ path, step, prompt: state.prompt, cards: state.cards }));
          states.push(state);
          assert.equal(new URL(page.url()).pathname + new URL(page.url()).search, "/search");
          assert.equal(await page.locator('meta[name="robots"]').getAttribute("content"), "noindex, follow");
        }
        assert.deepEqual(await page.evaluate(() => JSON.parse(sessionStorage.getItem("ludora:ludoscopio:session:v2"))), savedSession);
        assert.deepEqual(errors, []);
        outcomes.push(states);
        await page.close();
      }
      for (const states of outcomes) for (const state of states) {
        assert.equal(state.prompt, 1, `${state.step} restores the saved prompt regardless of mount history`);
        assert.equal(state.cards, 1);
        assert.deepEqual(state.ui, outcomes[0][1].ui);
      }
    } finally { await browser.close(); await server.close(); }
  });

  test(`${name}: explicit category URLs ignore a seeded semantic session and retain result parity`, { timeout: 40000 }, async t => {
    const categoryOption = { id: 33, name: "Estrategia abstracta" };
    const server = await startFixtureServer({ catalog: true, category: categoryOption });
    const browser = await chromium.launch({ channel: "chrome", headless: true });
    try {
      const snapshots = [], results = [], requestSequences = [];
      for (const path of ["/categoria/33/estrategia-abstracta", "/search?category_ids=33"]) {
        const page = await browser.newPage({ viewport: { width, height } });
        const { requests, errors } = await configure(page, categoryOption);
        await seedSession(page);
        await page.goto(origin + path); await page.waitForLoadState("networkidle");
        t.diagnostic(JSON.stringify({ path, cachedPromptCount: await page.getByText(`Resultados para “${savedSession.prompt}”`, { exact: true }).count(),
          cards: await page.locator('[aria-label="Resultados de juegos"] > a').count() }));
        assert.equal(await page.getByText(`Resultados para “${savedSession.prompt}”`, { exact: true }).count(), 0);
        assert.equal(await page.locator('[aria-label="Resultados de juegos"] > a').count(), 60);
        snapshots.push(await visibleUi(page));
        for (const count of [120, 125]) {
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          await expect(page.locator('[aria-label="Resultados de juegos"] > a')).toHaveCount(count, { timeout: 3000 });
          await page.waitForLoadState("networkidle");
        }
        results.push(await page.locator('[aria-label="Resultados de juegos"] > a').evaluateAll(links => links.map(link => link.getAttribute("href"))));
        requestSequences.push(requests);
        assert.equal(new URL(page.url()).pathname, path.split("?")[0]);
        assert.deepEqual(await page.evaluate(() => JSON.parse(sessionStorage.getItem("ludora:ludoscopio:session:v2"))), savedSession, "ordinary category navigation ignores, but does not erase, the saved unfiltered session");
        assert.deepEqual(errors, []);
        await page.close();
      }
      assert.deepEqual(snapshots[1], snapshots[0]);
      assert.deepEqual(results[1], results[0]);
      assert.deepEqual(requestSequences[1], requestSequences[0]);
    } finally { await browser.close(); await server.close(); }
  });

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
