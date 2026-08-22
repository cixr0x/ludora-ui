import assert from "node:assert/strict";
import test from "node:test";

import { productSeoMetadata } from "./productSeo.js";

const detail = {
  id: 851,
  name: "Dixit",
  image: "https://cdn.example/dixit.jpg",
  categories: ["Party Game"],
  description: ["Un juego de imaginación y pistas."],
  players: "3-6",
  playTime: "30 mins",
  complexity: 1,
};

test("productSeoMetadata describes one canonical Mexican product page", () => {
  const metadata = productSeoMetadata(detail, "https://example.mx");

  assert.equal(metadata.canonicalUrl, "https://example.mx/game/851/dixit");
  assert.match(metadata.title, /^Dixit:/);
  assert.match(metadata.description, /3-6 jugadores/);
  assert.equal(metadata.structuredData["@graph"][0]["@type"], "Product");
  assert.equal(metadata.structuredData["@graph"][1]["@type"], "BreadcrumbList");
  assert.equal(metadata.structuredData["@graph"][0].offers, undefined);
});

test("productSeoMetadata uses the future Ludo Radar domain by default", () => {
  const metadata = productSeoMetadata(detail);

  assert.equal(metadata.canonicalUrl, "https://ludoradar.mx/game/851/dixit");
});
