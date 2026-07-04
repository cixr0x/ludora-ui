import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("catalog api exposes minimal search results plus summary and filter-option endpoints", () => {
  const apiSource = source("../api/catalog.ts");
  const catalogSource = source("../data/catalog.ts");

  assert.match(apiSource, /\/api\/items\/search-results/);
  assert.match(apiSource, /\/api\/items\/summary/);
  assert.match(apiSource, /\/api\/items\/filter-options/);
  assert.match(apiSource, /export\s+async\s+function\s+fetchSearchResults\b/);
  assert.match(catalogSource, /import\s*\{[\s\S]*\bfetchSearchResults\b[\s\S]*\}\s+from\s+"..\/api\/catalog"/);
  assert.match(catalogSource, /loadCatalogSearchResults/);
  assert.match(catalogSource, /fetchSearchResults\(\s*query\s*\?\?\s*\{\s*limit:\s*200\s*\}\s*\)/);
});

test("front page row titles prefer explicit display titles", () => {
  const apiSource = source("../api/catalog.ts");
  const catalogSource = source("../data/catalog.ts");

  assert.match(apiSource, /title_display\??:/);
  assert.match(catalogSource, /row\.title_display/);
});

test("landing page uses lightweight filter options for the category strip", () => {
  const headerSource = source("../components/SiteHeader.tsx");

  assert.match(headerSource, /loadCatalogFilterOptions/);
  assert.doesNotMatch(headerSource, /loadCatalogGameDetails\(\{\s*limit:\s*CATEGORY_STRIP_CATALOG_LIMIT/);
});

test("search page uses minimal search results for grid results and lightweight filter options", () => {
  const searchSource = source("../pages/Search.tsx");

  assert.match(searchSource, /loadCatalogFilterOptions/);
  assert.match(searchSource, /loadCatalogSearchResults/);
  assert.doesNotMatch(searchSource, /loadCatalogGameSummaries/);
  assert.doesNotMatch(searchSource, /loadCatalogGameDetails/);
});

test("site header autocomplete uses minimal search results", () => {
  const headerSource = source("../components/SiteHeader.tsx");

  assert.match(headerSource, /loadCatalogSearchResults/);
  assert.doesNotMatch(headerSource, /loadCatalogGameSummaries\(\{\s*query:\s*activeSearchQuery/);
});
