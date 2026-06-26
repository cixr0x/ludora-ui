import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { EXPANSION_BADGE_CORNER_CLASS, isExpansionItem, parentGamePath } from "./expansionDisplay.js";

const testDir = dirname(fileURLToPath(import.meta.url));
const gameDetailSource = () => readFileSync(resolve(testDir, "../pages/GameDetail.tsx"), "utf8");

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

test("GameDetail shows expansion parent details only when a parent game exists", () => {
  const source = gameDetailSource();

  assert.match(source, /\{detail\.isExpansion && parentGame && \(/);
  assert.doesNotMatch(source, /juego base no listado/);
});

test("GameDetail expansion parent details use plain detail text styling", () => {
  const source = gameDetailSource();

  assert.doesNotMatch(source, /border-amber|bg-amber/);
  assert.match(source, /Expansi(?:o|\u00f3)n para/u);
  assert.match(source, /text-neutral-500 text-xs uppercase tracking-wider/);
});

test("GameDetail stacks product stats on narrow viewports", () => {
  const source = gameDetailSource();

  assert.match(source, /grid grid-cols-1 sm:grid-cols-2/);
  assert.match(source, /className="sm:col-span-2"/);
});

test("GameDetail uses a lighter blur for the cover backdrop", () => {
  const source = gameDetailSource();

  assert.match(source, /filter: "blur\(24px\)"/);
  assert.doesNotMatch(source, /blur\(72px\)/);
});
