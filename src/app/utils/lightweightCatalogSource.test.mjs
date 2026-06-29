import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("catalog api exposes lightweight summary and filter-option endpoints", () => {
  const apiSource = source("../api/catalog.ts");

  assert.match(apiSource, /\/api\/items\/summary/);
  assert.match(apiSource, /\/api\/items\/filter-options/);
});

test("landing page uses lightweight filter options for the category strip", () => {
  const homeSource = source("../pages/Home.tsx");

  assert.match(homeSource, /loadCatalogFilterOptions/);
  assert.doesNotMatch(homeSource, /loadCatalogGameDetails\(\{\s*limit:\s*CATEGORY_STRIP_CATALOG_LIMIT/);
});

test("search page uses lightweight endpoints for grid results and filters", () => {
  const searchSource = source("../pages/Search.tsx");

  assert.match(searchSource, /loadCatalogFilterOptions/);
  assert.match(searchSource, /loadCatalogGameSummaries/);
  assert.doesNotMatch(searchSource, /loadCatalogGameDetails/);
});
