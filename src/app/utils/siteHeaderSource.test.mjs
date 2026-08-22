import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), "utf8");

test("site header owns the shared logo search and category strip", () => {
  const headerSource = source("../components/SiteHeader.tsx");

  assert.match(headerSource, /interface SiteHeaderProps[\s\S]*contextBar\?: ReactNode/);
  assert.match(headerSource, /export function SiteHeader/);
  assert.match(headerSource, /<Link[\s\S]*to="\/"[\s\S]*className="ludora-wordmark text-xl[^"]*sm:text-2xl/);
  assert.match(headerSource, /placeholder="Buscar juegos/);
  assert.match(headerSource, /min-w-0 flex-1[^\"]*md:w-64 md:flex-none lg:w-72/);
  assert.match(headerSource, /loadCatalogFilterOptions/);
  assert.match(headerSource, /buildExploreTaxonomyPath\("category", category\.id\)/);
  assert.match(headerSource, /contextBar \?\?/);
});

test("site header puts explore beside search and removes the desktop nav section", () => {
  const headerSource = source("../components/SiteHeader.tsx");

  assert.match(headerSource, /import \{ ChevronLeft, ChevronRight, Compass, Search, X \} from "lucide-react";/);
  assert.match(headerSource, /<div className="flex w-full min-w-0 items-center gap-2 sm:gap-3 md:w-auto">[\s\S]*<div className="relative min-w-0 flex-1 md:flex-none">[\s\S]*<\/div>\s*<Link[\s\S]*to="\/search"[\s\S]*aria-label="Explorar catálogo"[\s\S]*>\s*<Compass className="h-4 w-4" \/>\s*<span className="hidden sm:inline">Explorar<\/span>\s*<\/Link>/);
  assert.doesNotMatch(headerSource, /Sparkles/);
  assert.doesNotMatch(headerSource, /<nav className="hidden md:flex/);
  assert.doesNotMatch(headerSource, /Novedades|Mejor Valorados|Colecciones/);
});

test("site header submits its text search to the Explore page", () => {
  const headerSource = source("../components/SiteHeader.tsx");

  assert.match(headerSource, /const handleSearchSubmit = \(event: FormEvent<HTMLFormElement>\)/);
  assert.match(headerSource, /const destination = buildExploreSearchPath\(searchValue\)/);
  assert.match(headerSource, /<form\s+onSubmit=\{handleSearchSubmit\}/);
  assert.match(headerSource, /clearSearch\(\);\s*navigate\(destination\)/);
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
  assert.match(searchSource, /const requestedTextQuery = searchParams\.get\("q"\)\?\.trim\(\) \?\? ""/);
  assert.match(searchSource, /const \[query, setQuery\] = useState\(requestedTextQuery\)/);
  assert.match(searchSource, /setQuery\(requestedTextQuery\)/);
  assert.match(searchSource, /if \(nextQuery\) nextParams\.set\("q", nextQuery\)/);
  assert.match(searchSource, /else nextParams\.delete\("q"\)/);
  assert.match(browseSource, /juego\$\{games\.length !== 1 \? "s" : ""\}/);
  assert.match(detailSource, /\{detail\.name\}/);
});
