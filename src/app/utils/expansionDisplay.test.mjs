import assert from "node:assert/strict";
import test from "node:test";

import { isExpansionItem, parentGamePath } from "./expansionDisplay.js";

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
