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

test("catalog api exposes minimal related items for game detail recommendations", () => {
  const apiSource = source("../api/catalog.ts");
  const catalogSource = source("../data/catalog.ts");

  assert.match(apiSource, /export\s+type\s+ApiRelatedItem\s*=\s*Pick<[\s\S]*"id"[\s\S]*"canonical_name"[\s\S]*"canonical_name_es"[\s\S]*"image_url"[\s\S]*"image_url_es"[\s\S]*>;/);
  assert.match(apiSource, /export\s+async\s+function\s+fetchRelatedItems\b/);
  assert.match(apiSource, /\/api\/items\/\$\{id\}\/related\$\{suffix\}/);
  assert.match(catalogSource, /import\s*\{[\s\S]*\bfetchRelatedItems\b[\s\S]*\}\s+from\s+"..\/api\/catalog"/);
  assert.match(catalogSource, /export\s+async\s+function\s+loadRelatedGames\(id: number, limit = 18\)/);
  assert.match(catalogSource, /fetchRelatedItems\(id,\s*limit\)/);
});

test("front page row titles prefer explicit display titles", () => {
  const apiSource = source("../api/catalog.ts");
  const catalogSource = source("../data/catalog.ts");

  assert.match(apiSource, /title_display\??:/);
  assert.match(catalogSource, /row\.title_display/);
});

test("front page products use only minimal display fields", () => {
  const apiSource = source("../api/catalog.ts");

  assert.match(apiSource, /export\s+type\s+ApiFrontPageItem\s*=\s*Pick<[\s\S]*"id"[\s\S]*"canonical_name"[\s\S]*"canonical_name_es"[\s\S]*"image_url"[\s\S]*"image_url_es"[\s\S]*>;/);
  assert.match(apiSource, /products:\s*ApiFrontPageItem\[\]/);
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

test("search page keeps semantic results when text query changes and filters them locally", () => {
  const searchSource = source("../pages/Search.tsx");
  const handleTextQueryChange = searchSource.match(
    /const handleTextQueryChange = \(value: string\) => \{[\s\S]*?\n  \};/,
  )?.[0];

  assert.ok(handleTextQueryChange, "handleTextQueryChange should be present");
  assert.match(handleTextQueryChange, /setQuery\(value\)/);
  assert.doesNotMatch(handleTextQueryChange, /setSemanticGames\(\s*null\s*\)/);
  assert.match(
    searchSource,
    /semanticGames\s*\?\s*filterSemanticSearchResults\(\s*semanticGames,\s*searchRequest\s*\)\s*:\s*games/,
  );
});

test("site header autocomplete uses minimal search results", () => {
  const headerSource = source("../components/SiteHeader.tsx");

  assert.match(headerSource, /loadCatalogSearchResults/);
  assert.doesNotMatch(headerSource, /loadCatalogGameSummaries\(\{\s*query:\s*activeSearchQuery/);
});
