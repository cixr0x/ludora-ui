import assert from "node:assert/strict";
import test from "node:test";

import {
  filterSemanticSearchResults,
  parseRangeText,
  rangesOverlap,
} from "./searchResultFiltering.js";

const baseRequest = {
  categoryIds: [],
  complexity: [1, 5],
  mechanicIds: [],
  players: null,
  playtimeRanges: [],
  query: "",
};

const game = (overrides) => ({
  id: 1,
  name: "Base game",
  altTitle: undefined,
  image: "base.jpg",
  genres: [],
  categories: [],
  mechanics: [],
  categoryNames: [],
  mechanicNames: [],
  minPlayers: 1,
  maxPlayers: 4,
  minMinutes: 30,
  maxMinutes: 60,
  complexity: 3,
  ...overrides,
});

test("playtime range filtering uses overlap with selected buckets", () => {
  const gameRange = [30, 60];
  const sourceGames = [game({ id: 1, minMinutes: gameRange[0], maxMinutes: gameRange[1] })];

  assert.equal(rangesOverlap(gameRange, [0, 44]), true);
  assert.equal(rangesOverlap(gameRange, [45, 90]), true);
  assert.equal(rangesOverlap(gameRange, [91, 999]), false);
  assert.deepEqual(
    filterSemanticSearchResults(sourceGames, { ...baseRequest, playtimeRanges: [[0, 44]] }).map((result) => result.id),
    [1],
  );
  assert.deepEqual(
    filterSemanticSearchResults(sourceGames, { ...baseRequest, playtimeRanges: [[45, 90]] }).map((result) => result.id),
    [1],
  );
  assert.deepEqual(
    filterSemanticSearchResults(sourceGames, { ...baseRequest, playtimeRanges: [[91, 999]] }).map((result) => result.id),
    [],
  );
});

test("parseRangeText extracts display ranges and falls back to zeroes", () => {
  assert.deepEqual(parseRangeText("30-60 mins"), [30, 60]);
  assert.deepEqual(parseRangeText("1 jugador"), [1, 1]);
  assert.deepEqual(parseRangeText("Sin registrar"), [0, 0]);
});

test("filterSemanticSearchResults respects category and mechanic ids", () => {
  const matching = game({
    id: 1,
    name: "Cascadia",
    categories: [{ id: 10, name: "Animals" }],
    mechanics: [{ id: 20, name: "Tile Placement" }],
  });
  const wrongCategory = game({
    id: 2,
    name: "Calico",
    categories: [{ id: 99, name: "Abstract" }],
    mechanics: [{ id: 20, name: "Tile Placement" }],
  });
  const wrongMechanic = game({
    id: 3,
    name: "Azul",
    categories: [{ id: 10, name: "Animals" }],
    mechanics: [{ id: 88, name: "Drafting" }],
  });

  const results = filterSemanticSearchResults([matching, wrongCategory, wrongMechanic], {
    ...baseRequest,
    categoryIds: [10],
    mechanicIds: [20],
  });

  assert.deepEqual(results.map((result) => result.id), [1]);
});

test("filterSemanticSearchResults respects player and complexity filters", () => {
  const matching = game({
    id: 1,
    name: "Balanced strategy",
    minPlayers: 2,
    maxPlayers: 4,
    complexity: 3,
  });
  const wrongPlayers = game({
    id: 2,
    name: "Two-player duel",
    minPlayers: 2,
    maxPlayers: 2,
    complexity: 3,
  });
  const wrongComplexity = game({
    id: 3,
    name: "Heavy euro",
    minPlayers: 2,
    maxPlayers: 4,
    complexity: 5,
  });

  const results = filterSemanticSearchResults([matching, wrongPlayers, wrongComplexity], {
    ...baseRequest,
    complexity: [2, 4],
    players: 4,
  });

  assert.deepEqual(results.map((result) => result.id), [1]);
});
