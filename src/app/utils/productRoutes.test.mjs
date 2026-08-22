import assert from "node:assert/strict";
import test from "node:test";

import { productPath, productSlug } from "./productRoutes.js";

test("productPath builds localized lowercase ASCII product URLs", () => {
  assert.equal(productPath(851, "Díxit: Edición México"), "/game/851/dixit-edicion-mexico");
  assert.equal(productPath("871", "Catan"), "/game/871/catan");
});

test("productSlug provides a stable fallback for names without ASCII words", () => {
  assert.equal(productSlug("将棋"), "juego-de-mesa");
});

test("productPath rejects invalid ids", () => {
  assert.throws(() => productPath(0, "Dixit"), /positive integer/);
});
