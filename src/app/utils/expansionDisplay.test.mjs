import assert from "node:assert/strict";
import test from "node:test";

import { EXPANSION_BADGE_CORNER_CLASS, isExpansionItem, parentGamePath } from "./expansionDisplay.js";

test("isExpansionItem recognizes expansion flags from API payloads", () => {
  assert.equal(isExpansionItem({ is_expansion: true }), true);
  assert.equal(isExpansionItem({ is_expansion: "true" }), true);
  assert.equal(isExpansionItem({ item_type: "expansion" }), true);
  assert.equal(isExpansionItem({ is_expansion: false, item_type: "base_game" }), false);
});

test("parentGamePath builds links only for positive parent ids", () => {
  assert.equal(parentGamePath(28720), "/game/28720");
  assert.equal(parentGamePath("28720"), "/game/28720");
  assert.equal(parentGamePath(null), undefined);
  assert.equal(parentGamePath(0), undefined);
});

test("EXPANSION_BADGE_CORNER_CLASS pins the badge to the cover corner", () => {
  assert.match(EXPANSION_BADGE_CORNER_CLASS, /\bleft-0\b/);
  assert.match(EXPANSION_BADGE_CORNER_CLASS, /\btop-0\b/);
  assert.doesNotMatch(EXPANSION_BADGE_CORNER_CLASS, /\bleft-2\b|\btop-2\b/);
});
