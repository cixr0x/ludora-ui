import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { formatStorePrice } from "./priceFormat.js";

test("formatStorePrice presents whole MXN prices consistently", () => {
  assert.equal(formatStorePrice(370, "MXN"), "$370.00");
  assert.equal(formatStorePrice(390, "MXN"), "$390.00");
});

test("formatStorePrice applies locale grouping and currency precision", () => {
  assert.equal(formatStorePrice(1234.5, "MXN"), "$1,234.50");
  assert.equal(formatStorePrice(0, "MXN"), "Consultar");
});

test("catalog offers format the numeric price instead of store-provided raw text", () => {
  const catalogSource = readFileSync(new URL("../data/catalog.ts", import.meta.url), "utf8");

  assert.match(catalogSource, /price: formatStorePrice\(priceValue, currency\)/);
  assert.doesNotMatch(catalogSource, /formatStorePrice\([^)]*raw_price/);
});
