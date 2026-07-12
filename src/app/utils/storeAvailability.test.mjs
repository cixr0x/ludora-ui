import assert from "node:assert/strict";
import test from "node:test";

import { storeAvailabilityLabel, storeAvailabilityState } from "./storeAvailability.js";

test("inactive store items are shown as no longer available", () => {
  assert.equal(storeAvailabilityState("available", false), "unavailable");
  assert.equal(storeAvailabilityLabel("unavailable"), "No disponible");
});

test("active out-of-stock values are normalized for the store listing", () => {
  for (const value of ["out_of_stock", "OutOfStock", "sold-out", "agotado", "sin stock", "unavailable", "no disponible"]) {
    assert.equal(storeAvailabilityState(value, true), "out_of_stock");
  }
  assert.equal(storeAvailabilityLabel("out_of_stock"), "Agotado");
});

test("unknown and available values remain available while the listing is active", () => {
  assert.equal(storeAvailabilityState("available", true), "available");
  assert.equal(storeAvailabilityState("unknown", true), "available");
  assert.equal(storeAvailabilityState(undefined, undefined), "available");
  assert.equal(storeAvailabilityLabel("available"), "");
});
