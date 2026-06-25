import assert from "node:assert/strict";
import test from "node:test";

import { buildCatalogSearchParams } from "./catalogSearch.js";

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
