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

test("GameDetail uses a stacked mobile hero while preserving desktop row layout", () => {
  const source = gameDetailSource();

  assert.match(source, /flex flex-col md:flex-row gap-6 md:gap-8 items-stretch md:items-start/);
  assert.match(source, /px-4 sm:px-6 md:px-8 pt-6 md:pt-10 pb-8 md:pb-10/);
  assert.match(source, /self-center md:self-start/);
  assert.match(source, /flex flex-col md:flex-row md:items-start md:justify-between gap-2 md:gap-4/);
});

test("GameDetail stacks secondary content on mobile and keeps desktop side by side", () => {
  const source = gameDetailSource();

  assert.match(source, /px-4 sm:px-6 md:px-8 pb-10 flex flex-col gap-8 md:gap-10/);
  assert.match(source, /flex flex-col md:flex-row gap-8 md:gap-10 items-stretch md:items-start/);
  assert.match(source, /w-full md:w-\[260px\]/);
  assert.match(source, /aspectRatio: "260 \/ 462"/);
});

test("GameDetail image overlay expands for mobile and keeps desktop half-screen sizing", () => {
  const source = gameDetailSource();

  assert.match(source, /h-\[70vh\] w-\[calc\(100vw-2rem\)\] md:h-\[50vh\] md:w-\[50vw\]/);
});

test("GameDetail uses a lighter blur for the cover backdrop", () => {
  const source = gameDetailSource();

  assert.match(source, /filter: "blur\(24px\)"/);
  assert.doesNotMatch(source, /blur\(72px\)/);
});

test("GameDetail opens the product cover in a half-screen overlay", () => {
  const source = gameDetailSource();

  assert.match(source, /isImageOverlayOpen/);
  assert.match(source, /setIsImageOverlayOpen\(true\)/);
  assert.match(source, /role="dialog"/);
  assert.match(source, /aria-modal="true"/);
  assert.match(source, /bg-black\/75/);
  assert.match(source, /md:h-\[50vh\] md:w-\[50vw\]/);
  assert.match(source, /Escape/);
});

test("GameDetail cover button keeps the regular image transparent with a pointer cursor", () => {
  const source = gameDetailSource();
  const coverButtonMatch = source.match(/aria-label=\{`Ver imagen ampliada de \$\{detail\.name\}`\}[\s\S]*?className="([^"]+)"/);

  assert.ok(coverButtonMatch);
  const coverButtonClassName = coverButtonMatch[1];
  assert.match(coverButtonClassName, /\bcursor-pointer\b/);
  assert.doesNotMatch(coverButtonClassName, /\bcursor-zoom-in\b/);
  assert.doesNotMatch(coverButtonClassName, /\bbg-neutral-900\b/);
});
