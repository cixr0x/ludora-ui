import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), "utf8");

test("site header owns the shared logo search and category strip", () => {
  const headerSource = source("../components/SiteHeader.tsx");

  assert.match(headerSource, /interface SiteHeaderProps[\s\S]*contextBar\?: ReactNode/);
  assert.match(headerSource, /export function SiteHeader/);
  assert.match(headerSource, /<Link[\s\S]*to="\/"[\s\S]*className="ludora-wordmark text-2xl/);
  assert.match(headerSource, /placeholder="Buscar juegos/);
  assert.match(headerSource, /w-40 sm:w-64 lg:w-72/);
  assert.match(headerSource, /loadCatalogFilterOptions/);
  assert.match(headerSource, /buildExploreTaxonomyPath\("category", category\.id\)/);
  assert.match(headerSource, /contextBar \?\?/);
});

test("public pages use SiteHeader for consistent top navigation", () => {
  const homeSource = source("../pages/Home.tsx");
  const searchSource = source("../pages/Search.tsx");
  const browseSource = source("../pages/Browse.tsx");
  const detailSource = source("../pages/GameDetail.tsx");

  assert.match(homeSource, /import \{ SiteHeader \} from "\.\.\/components\/SiteHeader"/);
  assert.match(homeSource, /<SiteHeader \/>/);
  assert.doesNotMatch(homeSource, /<header className="sticky top-0/);

  for (const pageSource of [searchSource, browseSource, detailSource]) {
    assert.match(pageSource, /import \{ SiteHeader \} from "\.\.\/components\/SiteHeader"/);
    assert.match(pageSource, /<SiteHeader\s+contextBar=\{/);
    assert.doesNotMatch(pageSource, /<div className="sticky top-0 z-40/);
  }

  assert.match(searchSource, /Encuentra tu pr(?:o|\u00f3)ximo juego/u);
  assert.match(browseSource, /juego\$\{games\.length !== 1 \? "s" : ""\}/);
  assert.match(detailSource, /\{detail\.name\}/);
});
