import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCatalogSearchParams,
  buildExploreTaxonomyPath,
  parsePositiveIntegerSetParam,
  shouldShowFilterRemoveIcon,
  sortTaxonomyOptionsByActive,
  taxonomyOptionsFromItems,
} from "./catalogSearch.js";

test("buildCatalogSearchParams sends search filters using taxonomy ids", () => {
  const params = buildCatalogSearchParams({
    categoryIds: [5, 7],
    complexity: [2, 4],
    limit: 80,
    mechanicIds: [8, 9],
    players: 4,
    playtimeRanges: [
      [30, 44],
      [45, 90],
    ],
    query: " coffee ",
  });

  assert.equal(
    params.toString(),
    "q=coffee&players=4&duration_min=30&duration_max=90&complexity_min=2&complexity_max=4&category_ids=5%2C7&mechanic_ids=8%2C9&limit=80",
  );
});

test("buildCatalogSearchParams omits inactive filters", () => {
  const params = buildCatalogSearchParams({
    categoryIds: [],
    complexity: [1, 5],
    limit: 80,
    mechanicIds: [],
    players: null,
    playtimeRanges: [],
    query: " ",
  });

  assert.equal(params.toString(), "limit=80");
});

test("buildExploreTaxonomyPath links taxonomy ids to explore filters", () => {
  assert.equal(buildExploreTaxonomyPath("category", 42), "/search?category_ids=42");
  assert.equal(buildExploreTaxonomyPath("mechanic", 8), "/search?mechanic_ids=8");
  assert.equal(buildExploreTaxonomyPath("family", 12), "/search");
});

test("parsePositiveIntegerSetParam reads comma-separated URL filter ids", () => {
  assert.deepEqual(Array.from(parsePositiveIntegerSetParam("5,no,7,5,0,-1")), [5, 7]);
  assert.deepEqual(Array.from(parsePositiveIntegerSetParam(null)), []);
});

test("sortTaxonomyOptionsByActive groups active filters first", () => {
  const options = [
    { id: 1, name: "Strategy" },
    { id: 2, name: "Animals" },
    { id: 3, name: "Economic" },
    { id: 4, name: "Adventure" },
  ];

  const sorted = sortTaxonomyOptionsByActive(options, new Set([3, 1]));

  assert.deepEqual(sorted.map((option) => option.name), ["Economic", "Strategy", "Adventure", "Animals"]);
  assert.deepEqual(options.map((option) => option.name), ["Strategy", "Animals", "Economic", "Adventure"]);
});

test("taxonomyOptionsFromItems builds unique sorted taxonomy options", () => {
  const items = [
    {
      categories: [
        { id: 5, name: "Estrategia" },
        { id: 2, name: "Aventura" },
      ],
    },
    {
      categories: [
        { id: 5, name: "Estrategia duplicada" },
        { id: 9, name: "Ciencia Ficcion" },
        { id: 0, name: "Sin id" },
        { id: 10, name: "" },
      ],
    },
  ];

  const options = taxonomyOptionsFromItems(items, "categories");

  assert.deepEqual(options, [
    { id: 2, name: "Aventura" },
    { id: 9, name: "Ciencia Ficcion" },
    { id: 5, name: "Estrategia" },
  ]);
});

test("shouldShowFilterRemoveIcon only marks active removable filters", () => {
  assert.equal(shouldShowFilterRemoveIcon({ active: true, removable: true }), true);
  assert.equal(shouldShowFilterRemoveIcon({ active: false, removable: true }), false);
  assert.equal(shouldShowFilterRemoveIcon({ active: true, removable: false }), false);
});
