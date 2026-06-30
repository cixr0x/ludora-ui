import assert from "node:assert/strict";
import test from "node:test";

import { containedImageSize } from "./imageSizing.js";

test("containedImageSize fits landscape images inside a square box without making the element square", () => {
  assert.deepEqual(containedImageSize(706, 535, 168), { width: 168, height: 127 });
});

test("containedImageSize fits portrait images inside a square box without making the element square", () => {
  assert.deepEqual(containedImageSize(578, 816, 168), { width: 119, height: 168 });
});

test("containedImageSize keeps square images square", () => {
  assert.deepEqual(containedImageSize(700, 700, 168), { width: 168, height: 168 });
});

test("containedImageSize ignores invalid dimensions", () => {
  assert.equal(containedImageSize(0, 700, 168), undefined);
  assert.equal(containedImageSize(700, 700, 0), undefined);
});
