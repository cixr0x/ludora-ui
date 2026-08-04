import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const searchSource = () => readFileSync(new URL("../pages/Search.tsx", import.meta.url), "utf8");

test("search taxonomy filter sections collapse while keeping selected filters above results", () => {
  const source = searchSource();

  assert.match(source, /const \[categoriesCollapsed, setCategoriesCollapsed\] = useState\(true\)/);
  assert.match(source, /const \[mechanicsCollapsed, setMechanicsCollapsed\] = useState\(true\)/);
  assert.match(source, /const activeCategoryOptions = useMemo\([\s\S]*?allCategories\.filter\(\(category\) => activeCategories\.has\(category\.id\)\)/);
  assert.match(source, /const activeMechanicOptions = useMemo\([\s\S]*?allMechanics\.filter\(\(mechanic\) => activeMechanics\.has\(mechanic\.id\)\)/);
  assert.match(source, /aria-expanded=\{!categoriesCollapsed\}/);
  assert.match(source, /aria-label=\{categoriesCollapsed \? "Expandir categorías" : "Colapsar categorías"\}/);
  assert.match(source, /aria-controls="category-filter-options"/);
  assert.match(source, /rounded-lg border border-neutral-800 bg-neutral-900\/60 px-3 py-2/);
  assert.match(source, /categoriesCollapsed \? "Expandir" : "Colapsar"/);
  assert.match(source, /categoriesCollapsed \? \(\s*<ChevronRight[\s\S]*?\) : \(\s*<ChevronDown/);
  assert.match(source, /!categoriesCollapsed && \([\s\S]*?id="category-filter-options"[\s\S]*?allCategories\.map/);
  assert.match(source, /aria-expanded=\{!mechanicsCollapsed\}/);
  assert.match(source, /aria-label=\{mechanicsCollapsed \? "Expandir mecánicas" : "Colapsar mecánicas"\}/);
  assert.match(source, /aria-controls="mechanic-filter-options"/);
  assert.match(source, /mechanicsCollapsed \? "Expandir" : "Colapsar"/);
  assert.match(source, /mechanicsCollapsed \? \(\s*<ChevronRight[\s\S]*?\) : \(\s*<ChevronDown/);
  assert.match(source, /!mechanicsCollapsed && \([\s\S]*?id="mechanic-filter-options"[\s\S]*?allMechanics\.map/);
  assert.match(
    source,
    /<section className="min-w-0">[\s\S]*?activeCategoryOptions\.length > 0 \|\| activeMechanicOptions\.length > 0/,
  );
  assert.match(source, /Filtros activos/);
  assert.match(source, /activeCategoryOptions\.map\(\(category\) =>/);
  assert.match(source, /activeMechanicOptions\.map\(\(mechanic\) =>/);
});

test("search taxonomy pill changes stay synchronized with the Explore URL", () => {
  const source = searchSource();

  assert.match(source, /setPositiveIntegerSetParam/);
  assert.match(
    source,
    /setSearchParams\(\s*\(currentParams\) => setPositiveIntegerSetParam\(currentParams, paramName, nextIds\)/,
  );
  assert.match(
    source,
    /toggleTaxonomy\(activeCategories, category\.id, setActiveCategories, "category_ids"\)/,
  );
  assert.match(
    source,
    /toggleTaxonomy\(activeMechanics, mechanic\.id, setActiveMechanics, "mechanic_ids"\)/,
  );
  assert.match(
    source,
    /handleTextQueryChange[\s\S]*?setSearchParams\(\(currentParams\) => \{[\s\S]*?new URLSearchParams\(currentParams\)/,
  );
});
