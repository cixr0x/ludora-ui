import assert from "node:assert/strict";
import test from "node:test";
import { chromium, expect } from "@playwright/test";
import { startFixtureServer } from "./fixture-server.mjs";

const origin = "http://127.0.0.1:5175";

test("Brújula recommends against the four chosen answers and edits the same answers after reload", { timeout: 40000 }, async () => {
  const server = await startFixtureServer({ catalog: true });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.route("**/api/items/discovery/guide?**", route => {
      const q = Object.fromEntries(new URL(route.request().url()).searchParams);
      assert.deepEqual(q, { players: "4", minutes: "45", complexity: "light", style: "cooperative" });
      return route.fulfill({ json: { data: [{ id: 25, canonical_name: "Hanabi", min_players: 2, max_players: 5, max_minutes: 25, complexity: 1.7 }] } });
    });
    await page.goto(origin + "/search?tab=radar");
    await page.getByRole("link", { name: /Brújula de mesa/ }).click();
    await page.getByLabel("¿Cuántas personas van a jugar?").fill("04");
    await page.getByLabel("¿Cuánto tiempo tienen?").selectOption("45");
    await page.getByLabel("¿Qué complejidad prefieren?").selectOption("light");
    await page.getByLabel("¿Cómo quieren jugar?").selectOption("cooperative");
    await page.getByRole("button", { name: "Encontrar juegos" }).click();
    await expect(page.getByRole("link", { name: "Hanabi" })).toBeVisible();
    await expect(page.getByText(/25 min/)).toBeVisible();
    await page.goBack();
    await expect(page.getByLabel("¿Cuántas personas van a jugar?")).toHaveValue("4");
    await expect(page.getByLabel("¿Cómo quieren jugar?")).toHaveValue("cooperative");
    await page.goForward();
    await page.reload();
    await page.getByRole("link", { name: "Cambiar respuestas" }).click();
    await expect(page.getByLabel("¿Cuántas personas van a jugar?")).toHaveValue("4");
    await expect(page.getByLabel("¿Cómo quieren jugar?")).toHaveValue("cooperative");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  } finally { await browser.close(); await server.close(); }
});

test("a game shortcut starts similar discovery and carries its seed into an editable, shareable mix", { timeout: 60000 }, async () => {
  const server = await startFixtureServer({ catalog: true });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage();
    const games = [
      { id: 1, canonical_name: "Juego 01" }, { id: 52, canonical_name: "Azul" }, { id: 53, canonical_name: "Agrícola" },
    ];
    await page.route("**/api/items/search-results?**", route => {
      const q = new URL(route.request().url()).searchParams.get("q");
      return route.fulfill({ json: { data: games.filter(game => game.canonical_name === q) } });
    });
    await page.route("**/api/items/discovery?**", route => {
      const ids = new URL(route.request().url()).searchParams.get("ids").split(",").map(Number);
      return route.fulfill({ json: { data: { seeds: ids.map(id=>games.find(game=>game.id===id)), results: [{
        id: 852, canonical_name: "Juego relacionado", sources: ids.slice(0,2).map((seed_id,index) => ({
          seed_id, traits: [{ kind: "mechanic", name: index === 0 ? "Narración" : "Patrones" }],
        })),
      }] } } });
    });
    await page.goto(origin + "/game/1/juego-01");
    await page.getByRole("link", { name: "Ver más como Juego 01" }).click();
    await expect(page.getByRole("heading", { name: /Si te gustó Juego 01/ })).toBeVisible();
    await expect(page.getByText("Narración", { exact: false }).first()).toBeVisible();
    await page.getByRole("link", { name: "Mezclar con otro juego" }).click();
    await expect(page.getByRole("button", { name: "Quitar Juego 01" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Encontrar la mezcla" })).toBeDisabled();
    for (const name of ["Azul", "Agrícola"]) {
      await page.getByLabel("Buscar un juego por nombre").fill(name);
      await page.getByRole("button", { name: "Elegir " + name }).click();
      await expect(page.getByRole("button", { name: "Quitar " + name })).toBeVisible();
    }
    await page.getByRole("button", { name: "Encontrar la mezcla" }).click();
    await expect(page.getByText("Combina 2 de 3 juegos")).toBeVisible();
    const resultsUrl = page.url();
    await page.goto(resultsUrl);
    await expect(page.getByText("Patrones", { exact: false }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Juego relacionado/ })).toHaveAttribute("href", "/game/852/juego-relacionado");
    await page.getByRole("link", { name: "Editar mezcla" }).click();
    await page.getByRole("button", { name: "Quitar Agrícola" }).click();
    await page.getByRole("button", { name: "Encontrar la mezcla" }).click();
    await expect(page.getByText("Combina 2 de 2 juegos")).toBeVisible();
  } finally {
    await browser.close();
    await server.close();
  }
});

test("home opens the discovery hub and its free-text results can return to the ordinary catalog", { timeout: 60000 }, async () => {
  const server = await startFixtureServer({ catalog: true });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const prompts = [];
    await page.route("**/api/items/ludoscopio", route => {
      prompts.push(route.request().postDataJSON().prompt);
      return route.fulfill({ json: { data: [], meta: { filters: {
        players: null, playtimes: [], durationMin: null, durationMax: null,
        complexityMin: null, complexityMax: null, categoryIds: [], mechanicIds: [],
        theme: null, exactTitle: null, query: null,
      } } } });
    });
    await page.goto(origin);
    await page.getByRole("button", { name: "Ludo Radar", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Ludo Radar", exact: true })).toBeVisible();
    await page.getByRole("link", { name: /En tus palabras/ }).click();
    await page.getByLabel("Describe la experiencia").fill("Cooperativo para dos");
    await page.getByRole("button", { name: "Buscar juegos", exact: true }).click();
    await expect(page.getByText("Resultados para “Cooperativo para dos”")).toBeVisible();
    await page.goBack();
    await expect(page.getByLabel("Describe la experiencia")).toHaveValue("Cooperativo para dos");
    await page.goForward();
    const sections = page.getByRole("navigation", { name: "Secciones de Explorar" });
    await expect(sections.getByRole("link", { name: "Ludo Radar" })).toHaveAttribute("aria-current", "page");
    assert.deepEqual(prompts, ["Cooperativo para dos"]);
    await sections.getByRole("link", { name: "Catálogo" }).click();
    await expect(sections.getByRole("link", { name: "Catálogo" })).toHaveAttribute("aria-current", "page");
    await expect(page.locator('[aria-label="Resultados de juegos"] > a').first()).toBeVisible();
    await expect(page.getByText("Resultados para “Cooperativo para dos”")).toHaveCount(0);
    await expect(page).toHaveURL(origin + "/search");
  } finally {
    await browser.close();
    await server.close();
  }
});
