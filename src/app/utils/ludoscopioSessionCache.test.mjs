import assert from "node:assert/strict";
import test from "node:test";

import {
  clearLudoscopioSessionCache,
  readLudoscopioSessionCache,
  writeLudoscopioSessionCache,
} from "./ludoscopioSessionCache.js";

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

const filters = {
  players: 7, playtimes: [], durationMin: null, durationMax: 35,
  complexityMin: 1, complexityMax: 2.5, categoryIds: [4], mechanicIds: [],
  theme: "piratas", exactTitle: null, query: null,
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
