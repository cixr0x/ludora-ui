import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "vite";
import { productOfferSchema } from "./offerSeo.js";

test("API offer mapping preserves eligibility, unknown availability and source timestamps", async () => {
  const vite = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true }, appType: "custom" });
  try {
    const { mapApiItemToDetail } = await vite.ssrLoadModule("/src/app/data/catalog.ts");
    const game = mapApiItemToDetail({ id: 77, canonical_name: "Sushi Go Party!", offers: [{
      id: 1, store_id: 7, store_name: "Example store", store_website_url: "https://store.example/",
      game_title: "Sushi Go Party!", price: "350", availability: "unknown", currency: null,
      store_active: true, listing_status: "LISTED", is_bundle: false, language: null,
      last_updated: "2026-09-03T00:00:00Z", last_seen_at: "2026-09-02T00:00:00Z", refreshed_date: "2026-09-01T00:00:00Z"
    }] });
    assert.equal(game.stores[0].storeId, 7);
    assert.equal(game.stores[0].storeActive, true);
    assert.equal(game.stores[0].listingStatus, "LISTED");
    assert.equal(game.stores[0].availabilityStatus, "unknown");
    assert.equal(game.stores[0].inStock, false);
    assert.equal(game.stores[0].stockLevel, "unknown");
    assert.equal(game.stores[0].currency, "");
    assert.equal(game.stores[0].price, "Consultar");
    assert.equal(game.stores[0].language, null);
    assert.equal(game.stores[0].refreshedDate, "2026-09-01T00:00:00Z");
    assert.equal(game.stores[0].lastSeenAt, "2026-09-02T00:00:00Z");
    assert.equal(game.stores[0].lastUpdated, "2026-09-03T00:00:00Z");
    assert.equal(game.stores[0].listingUrl, null);
    assert.equal(Object.hasOwn(game.stores[0], "listingUrl"), true);
    const unknownListing = { ...game.stores[0], currency: "MXN" };
    assert.deepEqual(productOfferSchema(JSON.parse(JSON.stringify([unknownListing]))), []);
    const unknownBundle = mapApiItemToDetail({ id: 77, canonical_name: "Game", offers: [{
      id: 2, store_id: 7, store_name: "Example", game_title: "Game", store_active: true,
      listing_status: "LISTED", availability: "available", price: 350, currency: "MXN", source_url: "https://store.example/game"
    }] }).stores[0];
    assert.equal(unknownBundle.isBundle, undefined);
    assert.deepEqual(productOfferSchema([unknownBundle]), []);
  } finally { await vite.close(); }
});
