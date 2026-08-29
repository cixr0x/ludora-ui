import assert from "node:assert/strict";
import test from "node:test";

const homePrerender = await import("./homePrerender.js").catch(() => ({}));

test("selectFeaturedGames preserves feed order while deduplicating and limiting canonical products", () => {
  assert.equal(typeof homePrerender.selectFeaturedGames, "function");
  if (typeof homePrerender.selectFeaturedGames !== "function") return;

  const featuredGames = homePrerender.selectFeaturedGames([
    {
      products: [
        { id: 4, canonical_name: "Fourth" },
        { id: 2, canonical_name_es: "Segundo", canonical_name: "Second" },
        { id: 4, canonical_name_es: "Duplicado" },
      ],
    },
    {
      products: [
        { id: 3, canonical_name: "Third" },
        { id: 5, canonical_name: "Fifth" },
        { id: 6, canonical_name: "Sixth" },
        { id: 7, canonical_name: "Seventh" },
        { id: 8, canonical_name: "Eighth" },
        { id: 9, canonical_name: "Ninth" },
        { id: 10, canonical_name: "Tenth" },
        { id: 11, canonical_name: "Eleventh" },
      ],
    },
  ]);

  assert.deepEqual(featuredGames, [
    { id: 4, name: "Fourth" },
    { id: 2, name: "Segundo" },
    { id: 3, name: "Third" },
    { id: 5, name: "Fifth" },
    { id: 6, name: "Sixth" },
    { id: 7, name: "Seventh" },
    { id: 8, name: "Eighth" },
    { id: 9, name: "Ninth" },
  ]);
});
