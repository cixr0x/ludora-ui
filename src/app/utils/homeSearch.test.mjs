import assert from "node:assert/strict";
import test from "node:test";
import { HOME_SEARCH_LIMIT, homeSearchQuery } from "./homeSearch.js";

test("homeSearchQuery trims input and requires at least two characters", () => {
  assert.equal(homeSearchQuery(" s "), "");
  assert.equal(homeSearchQuery(" se "), "se");
  assert.equal(homeSearchQuery("  call zombie  "), "call zombie");
});

test("HOME_SEARCH_LIMIT keeps landing search suggestions compact", () => {
  assert.equal(HOME_SEARCH_LIMIT, 8);
});
