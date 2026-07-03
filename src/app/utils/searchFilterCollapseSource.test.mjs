import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const searchSource = () => readFileSync(new URL("../pages/Search.tsx", import.meta.url), "utf8");

test("search taxonomy filter sections collapse while keeping selected filters visible", () => {
  const source = searchSource();

  assert.match(source, /const \[categoriesCollapsed, setCategoriesCollapsed\] = useState\(false\)/);
  assert.match(source, /const \[mechanicsCollapsed, setMechanicsCollapsed\] = useState\(false\)/);
  assert.match(source, /const activeCategoryOptions = useMemo\([\s\S]*?allCategories\.filter\(\(category\) => activeCategories\.has\(category\.id\)\)/);
  assert.match(source, /const activeMechanicOptions = useMemo\([\s\S]*?allMechanics\.filter\(\(mechanic\) => activeMechanics\.has\(mechanic\.id\)\)/);
  assert.match(source, /const visibleCategories = categoriesCollapsed \? activeCategoryOptions : allCategories/);
  assert.match(source, /const visibleMechanics = mechanicsCollapsed \? activeMechanicOptions : allMechanics/);
  assert.match(source, /aria-expanded=\{!categoriesCollapsed\}/);
  assert.match(source, /aria-controls="category-filter-options"/);
  assert.match(source, /id="category-filter-options"[\s\S]*?visibleCategories\.map/);
  assert.match(source, /aria-expanded=\{!mechanicsCollapsed\}/);
  assert.match(source, /aria-controls="mechanic-filter-options"/);
  assert.match(source, /id="mechanic-filter-options"[\s\S]*?visibleMechanics\.map/);
});
