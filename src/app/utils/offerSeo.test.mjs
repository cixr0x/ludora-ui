import assert from "node:assert/strict";
import test from "node:test";
import { apiMinimumPrice, pricingOffers, productOfferSchema } from "./offerSeo.js";

const base = {
  id: 1, storeId: 7, name: "Example store",
  gameTitle: "Sushi Go Party!", url: "https://store.example/game",
  priceValue: 350, currency: "MXN", isBundle: false,
  storeActive: true, listingStatus: "LISTED",
  availabilityStatus: "available", inStock: true
};

test("bundles, invalid prices and unavailable records do not set a minimum", () => {
  const stores = [base,
    { ...base, id: 2, priceValue: 1, isBundle: true },
    { ...base, id: 3, priceValue: 0 },
    { ...base, id: 4, priceValue: 10, availabilityStatus: "out_of_stock", inStock: false },
    { ...base, id: 5, priceValue: 20, storeActive: false }
  ];
  assert.deepEqual(pricingOffers(stores).map(x => x.id), [1]);
  assert.deepEqual(productOfferSchema([base]), [{
    "@type": "Offer", price: 350, priceCurrency: "MXN", url: base.url,
    seller: { "@type": "Organization", name: "Example store" },
    availability: "https://schema.org/InStock"
  }]);
});

test("unconfirmed, ambiguous, missing-currency and invalid-price offers are excluded", () => {
  const invalid = [
    { listingStatus: "PENDING" }, { listingStatus: undefined }, { storeActive: undefined },
    { isBundle: undefined }, { isBundle: true }, { currency: "" }, { currency: "USD" },
    { priceValue: NaN }, { priceValue: Infinity }, { priceValue: -1 }, { priceValue: "350" }
  ].map((changes) => ({ ...base, ...changes }));
  assert.deepEqual(pricingOffers(invalid), []);
  assert.deepEqual(productOfferSchema(invalid), []);
});

test("only public listing URLs enter price claims", () => {
  const urls = [undefined, "javascript:alert(1)", "ftp://store.example/game", "https://localhost/game",
    "http://127.0.0.1/game", "http://192.168.1.1/game", "http://[::1]/game", "https://user:pass@store.example/game"];
  for (const url of urls) assert.deepEqual(productOfferSchema([{ ...base, url }]), []);
  assert.deepEqual(productOfferSchema([{ ...base, listingUrl: undefined, url: "https://store.example/" }]), []);
});

test("out-of-stock and unknown states remain distinct without invented editions", () => {
  const stores = [
    { ...base, id: 2, availabilityStatus: "out_of_stock", inStock: false },
    { ...base, id: 3, availabilityStatus: "unknown", inStock: false, language: null },
    { ...base, id: 4, availabilityStatus: "unavailable", inStock: false }
  ];
  assert.deepEqual(pricingOffers(stores), []);
  const schema = productOfferSchema(stores);
  assert.equal(schema.length, 3);
  assert.equal(schema[0].availability, "https://schema.org/OutOfStock");
  assert.equal(schema[1].availability, undefined);
  assert.equal(schema[2].availability, undefined);
  for (const offer of schema) {
    assert.equal(offer["@type"], "Offer");
    assert.equal(offer.itemOffered, undefined);
  }
});

test("a store-homepage fallback never becomes a product listing in schema", () => {
  assert.deepEqual(productOfferSchema([{ ...base, listingUrl: undefined }]), []);
  assert.equal(productOfferSchema([{ ...base, listingUrl: base.url }]).length, 1);
});

test("compact raw API summaries apply the same price and eligibility policy", () => {
  const offer = { store_name: "Shop", source_url: "https://shop.example/game", price: "350", currency: "MXN",
    listing_status: "LISTED", store_active: true, is_bundle: false, availability: "available" };
  const excluded = [{ is_bundle: true }, { availability: "unknown" }, { availability: "out_of_stock" },
    { store_active: false }, { currency: "USD" }, { currency: null }, { listing_status: "PENDING" },
    { source_url: null, store_website_url: "https://shop.example/" }, { price: true }, { price: -1 }];
  assert.equal(apiMinimumPrice(excluded.map(change => ({ ...offer, price: 1, ...change }))), null);
  assert.equal(apiMinimumPrice([offer, ...excluded.map(change => ({ ...offer, price: 1, ...change }))]), 350);
});
