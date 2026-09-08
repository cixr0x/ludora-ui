import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), "utf8");

test("public routes expose canonical slug products while retaining the legacy route", () => {
  const routesSource = source("../routes.ts");

  assert.match(routesSource, /path: "game\/:id\/:slug"/);
  assert.match(routesSource, /path: "game\/:id"/);
});

test("the browser hydrates generated product markup with embedded product data", () => {
  const mainSource = source("../../main.tsx");

  assert.match(mainSource, /hydrateRoot\(root, app\)/);
  assert.match(mainSource, /ludo-radar-prerender-data/);
  assert.match(mainSource, /prerenderData\?\.product/);
  assert.match(mainSource, /root\.hasChildNodes\(\)/);
});

test("the build creates product documents from the read-only prerender feed", () => {
  const serverSource = source("../../entry-server.tsx");

  assert.match(serverSource, /renderToString\(<App prerenderData=\{prerenderData\} router=\{router\} \/>\)/);
  assert.match(serverSource, /offers: \[\]/);
  assert.match(serverSource, /product-structured-data/);
  assert.match(serverSource, /rel="canonical"/);
});
