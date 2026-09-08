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

test("formatStorePrice preserves the uncached formatter for currencies, rounding and fallbacks", () => {
  function original(value, currency = "MXN") {
    const numericPrice = Number(value);
    if (!Number.isFinite(numericPrice) || numericPrice === 0) return "Consultar";
    if (typeof currency !== "string" || !currency.trim()) return "Consultar";
    const normalizedCurrency = currency.trim().toUpperCase();
    try {
      return new Intl.NumberFormat("es-MX", { currency: normalizedCurrency, style: "currency" }).format(numericPrice);
    } catch { return `${normalizedCurrency} ${numericPrice.toFixed(2)}`; }
  }
  const currencies = [...Intl.supportedValuesOf("currency"), " mxn ", "usd", "XXX", "ABC", "US", "INVALID", "12!", "", " ", null, undefined, 42];
  const values = [370, 1234.567, 0.004, 0.005, 1.005, -19.999, 1e25, "350.00", "bad", "", null, undefined, NaN, Infinity, -Infinity, 0, -0];
  for (const currency of currencies) for (const value of values) {
    assert.equal(formatStorePrice(value, currency), original(value, currency), `${String(value)} / ${String(currency)}`);
  }
});

test("formatStorePrice reuses a formatter across prices and normalized currency aliases", async t => {
  const NativeNumberFormat = Intl.NumberFormat;
  let constructions = 0;
  t.mock.method(Intl, "NumberFormat", function (...args) {
    constructions++;
    return new NativeNumberFormat(...args);
  });
  const { formatStorePrice: fresh } = await import("./priceFormat.js?reuse-test");
  for (let value = 1; value <= 50; value++) fresh(value, value % 2 ? "MXN" : " mxn ");
  fresh(2, "USD");
  fresh(3, " usd ");
  assert.equal(constructions, 2);
});

test("formatStorePrice bounds successful formatter retention to 16 currencies", async t => {
  const NativeNumberFormat = Intl.NumberFormat;
  let constructions = 0;
  t.mock.method(Intl, "NumberFormat", function (...args) {
    constructions++;
    return new NativeNumberFormat(...args);
  });
  const { formatStorePrice: fresh } = await import("./priceFormat.js?bounded-test");
  for (let code = 65; code < 82; code++) fresh(350, `AA${String.fromCharCode(code)}`);
  assert.equal(constructions, 17);
  fresh(351, "AAQ");
  assert.equal(constructions, 17, "most recent currency is retained");
  fresh(350, "AAA");
  assert.equal(constructions, 18, "the oldest currency was evicted");
  for (let index = 0; index < 30; index++) assert.equal(fresh(12.345, `INVALID${index}`), `INVALID${index} 12.35`);
  const afterInvalid = constructions;
  fresh(351, "AAA");
  assert.equal(constructions, afterInvalid, "invalid currencies cannot evict successful formatters");
});

test("catalog offers format the numeric price instead of store-provided raw text", () => {
  const catalogSource = readFileSync(new URL("../data/catalog.ts", import.meta.url), "utf8");

  assert.match(catalogSource, /price: formatStorePrice\(priceValue, currency\)/);
  assert.doesNotMatch(catalogSource, /formatStorePrice\([^)]*raw_price/);
});
