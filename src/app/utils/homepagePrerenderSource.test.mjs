import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), "utf8");

test("the homepage renderer embeds safe minimal data in the existing HTML template", () => {
  const serverSource = source("../../entry-server.tsx");

  assert.match(serverSource, /export function renderHomepageDocument/);
  assert.match(serverSource, /createMemoryRouter\(routeDefinitions, \{ initialEntries: \["\/"\] \}\)/);
  assert.match(serverSource, /serializeJsonForHtml\(prerenderData\)/);
});

test("the build fetches and validates the homepage feed before writing the homepage document", () => {
  const buildSource = source("../../../scripts/build.mjs");

  assert.match(buildSource, /fetchHomepageRows\(\)/);
  assert.match(buildSource, /\/api\/front-page/);
  assert.match(buildSource, /Homepage prerender response did not contain a data array/);
  assert.match(buildSource, /renderHomepageDocument/);
});

test("the homepage renders durable SEO content and hydrates homepage prerender data", () => {
  const homeSource = source("../pages/Home.tsx");
  const mainSource = source("../../main.tsx");

  assert.match(homeSource, /<h1[^>]*>\s*Juegos de mesa en México\s*<\/h1>/);
  assert.match(
    homeSource,
    /Descubre juegos de mesa, compara precios y encuentra ofertas disponibles en tiendas de México\./,
  );
  assert.match(homeSource, /Juegos destacados/);
  assert.match(homeSource, /usePrerenderedFeaturedGames/);
  assert.match(mainSource, /prerenderData\?\.homepage/);
  assert.match(mainSource, /hydrateRoot\(root, app\)/);
});

test("the homepage starts with a deterministic callout state for hydration", () => {
  const homeSource = source("../pages/Home.tsx");

  assert.match(homeSource, /useState\(false\)/);
  assert.match(homeSource, /setIsLudoscopioCalloutVisible\(!isHomeLudoscopioCalloutDismissed\(\)\)/);
});
