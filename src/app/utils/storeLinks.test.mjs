import assert from "node:assert/strict";
import test from "node:test";

import { storeOfferUrl } from "./storeLinks.js";

test("storeOfferUrl prefers the product URL over listing and store URLs", () => {
  assert.equal(
    storeOfferUrl({
      source_listing_url: "https://store.example/collections/board-games",
      source_url: "https://store.example/products/azul",
      store_website_url: "https://store.example",
    }),
    "https://store.example/products/azul",
  );
});

test("storeOfferUrl falls back through source listing URL and store website", () => {
  assert.equal(
    storeOfferUrl({
      source_listing_url: "https://store.example/collections/board-games",
      store_website_url: "https://store.example",
    }),
    "https://store.example/collections/board-games",
  );

  assert.equal(
    storeOfferUrl({
      source_listing_url: " ",
      store_website_url: "https://store.example",
    }),
    "https://store.example/",
  );
});

test("storeOfferUrl omits missing or blank URLs", () => {
  assert.equal(storeOfferUrl({}), undefined);
  assert.equal(storeOfferUrl({ source_listing_url: " ", source_url: "" }), undefined);
});
