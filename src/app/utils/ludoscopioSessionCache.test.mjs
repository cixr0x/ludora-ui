import assert from "node:assert/strict";
import test from "node:test";

import {
  clearLudoscopioSessionCache,
  readLudoscopioSessionCache,
  writeLudoscopioSessionCache,
} from "./ludoscopioSessionCache.js";
import { readLudoscopioControlParams, writeLudoscopioControlParams } from "./ludoscopioFilters.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, String(value)),
  };
}

const validResult = {
  id: 7,
  name: "Cascadia",
  altTitle: "Cascadia EN",
  image: "cascadia.webp",
  isExpansion: false,
  genres: ["Animals"],
  categories: [{ id: 1, name: "Animals" }],
  mechanics: [{ id: 2, name: "Tile Placement" }],
  categoryNames: ["Animals"],
  mechanicNames: ["Tile Placement"],
  minPlayers: 1,
  maxPlayers: 4,
  minMinutes: 30,
  maxMinutes: 45,
  complexity: 2,
};

const legacyFilters = {
  players: 7, playtimes: [], durationMin: null, durationMax: 35,
  complexityMin: 1, complexityMax: 2.5, categoryIds: [4], mechanicIds: [],
  theme: "piratas", exactTitle: null, query: null,
};

const filters = {
  ...legacyFilters,
  suggestedCategoryIds: [4, 21],
  suggestedMechanicIds: [8],
};

test("ludoscopio session cache stores and restores the active filters with their results", () => {
  const storage = memoryStorage();

  writeLudoscopioSessionCache(" juegos familiares con animales ", filters, [validResult], storage);

  assert.deepEqual(readLudoscopioSessionCache(storage), {
    prompt: "juegos familiares con animales",
    filters,
    results: [validResult],
  });
});

test("ludoscopio session cache normalizes string ids returned by the API", () => {
  const storage = memoryStorage();
  storage.setItem(
    "ludora:ludoscopio:session:v2",
    JSON.stringify({ prompt: "party games", results: [{ ...validResult, id: "7" }] }),
  );

  assert.deepEqual(readLudoscopioSessionCache(storage), {
    prompt: "party games",
    results: [validResult],
  });
});

test("ludoscopio session cache restores v3 sessions created before suggestions", () => {
  const storage = memoryStorage();
  storage.setItem(
    "ludora:ludoscopio:session:v3",
    JSON.stringify({ prompt: "party games", results: [validResult], filters: legacyFilters }),
  );

  assert.deepEqual(readLudoscopioSessionCache(storage), {
    prompt: "party games",
    filters: { ...legacyFilters, suggestedCategoryIds: [], suggestedMechanicIds: [] },
    results: [validResult],
  });
});

test("ludoscopio navigation keeps suggestions when optional traits become required", () => {
  const initialRoute = writeLudoscopioControlParams(new URLSearchParams(), filters);
  const promotedRoute = new URLSearchParams(initialRoute);
  promotedRoute.set("category_ids", "4,21");
  promotedRoute.set("mechanic_ids", "8");
  const restored = readLudoscopioControlParams(promotedRoute, filters.theme, null);

  assert.deepEqual(restored, { ...filters, categoryIds: [4, 21], mechanicIds: [8] });
  const replaced = writeLudoscopioControlParams(promotedRoute, legacyFilters);
  assert.deepEqual(readLudoscopioControlParams(replaced, legacyFilters.theme, null), {
    ...legacyFilters, suggestedCategoryIds: [], suggestedMechanicIds: [],
  });
});

test("ludoscopio session cache ignores malformed payloads", () => {
  const storage = memoryStorage();
  storage.setItem("ludora:ludoscopio:session:v2", JSON.stringify({ prompt: "", results: [{ id: "bad" }] }));

  assert.equal(readLudoscopioSessionCache(storage), null);
});

test("ludoscopio session cache ignores previous cache versions", () => {
  const storage = memoryStorage();
  storage.setItem("ludora:ludoscopio:session:v1", JSON.stringify({ prompt: "azul", results: [validResult] }));

  assert.equal(readLudoscopioSessionCache(storage), null);
});

test("ludoscopio session cache can be cleared", () => {
  const storage = memoryStorage();
  storage.setItem("ludora:ludoscopio:session:v2", JSON.stringify({ prompt: "azul", results: [validResult] }));
  writeLudoscopioSessionCache("party games", filters, [validResult], storage);

  clearLudoscopioSessionCache(storage);

  assert.equal(readLudoscopioSessionCache(storage), null);
});
