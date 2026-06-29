import assert from "node:assert/strict";
import test from "node:test";

import {
  areBufferedImagesSettled,
  getBufferedRowImageIds,
  getPendingVisibleImageIds,
  getRowScrollState,
  getUnloadedBufferedImageIds,
  getVisibleRowImageIds,
} from "./imageBatch.js";

test("getBufferedRowImageIds includes visible cards plus one horizontal click", () => {
  const items = Array.from({ length: 10 }, (_, index) => ({
    id: String(index),
    left: index * 184,
    right: index * 184 + 168,
  }));

  assert.deepEqual(getBufferedRowImageIds(items, 0, 368, 720), ["0", "1", "2", "3", "4", "5"]);
  assert.deepEqual(getBufferedRowImageIds(items, 920, 368, 720), ["1", "2", "3", "4", "5", "6", "7", "8", "9"]);
});

test("areBufferedImagesSettled waits for mounted images to settle in the DOM", () => {
  const bufferedIds = ["cover-1", "cover-2"];
  const preloadedIds = new Set(["cover-1", "cover-2"]);

  assert.equal(areBufferedImagesSettled(bufferedIds, preloadedIds, new Set(["cover-1"])), false);
  assert.equal(areBufferedImagesSettled(bufferedIds, new Set(["cover-1"]), new Set(bufferedIds)), false);
  assert.equal(areBufferedImagesSettled(bufferedIds, preloadedIds, new Set(bufferedIds)), true);
});

test("getUnloadedBufferedImageIds returns only buffered images without mounted DOM images", () => {
  const bufferedIds = ["cover-1", "cover-2", "cover-3"];
  const mountedIds = new Set(["cover-1", "cover-3"]);

  assert.deepEqual(getUnloadedBufferedImageIds(bufferedIds, mountedIds), ["cover-2"]);
});

test("getVisibleRowImageIds excludes preloaded cards outside the viewport", () => {
  const items = Array.from({ length: 6 }, (_, index) => ({
    id: String(index),
    left: index * 184,
    right: index * 184 + 168,
  }));

  assert.deepEqual(getVisibleRowImageIds(items, 0, 368), ["0", "1"]);
  assert.deepEqual(getVisibleRowImageIds(items, 200, 368), ["1", "2", "3"]);
});

test("getPendingVisibleImageIds excludes visible images that have settled", () => {
  const visibleIds = ["cover-1", "cover-2", "cover-3"];
  const settledIds = new Set(["cover-2"]);

  assert.deepEqual(getPendingVisibleImageIds(visibleIds, settledIds), ["cover-1", "cover-3"]);
});

test("getRowScrollState updates when row content expands after loading", () => {
  assert.deepEqual(getRowScrollState({ scrollLeft: 0, scrollWidth: 1265, clientWidth: 1265 }), {
    canScrollLeft: false,
    canScrollRight: false,
  });

  assert.deepEqual(getRowScrollState({ scrollLeft: 0, scrollWidth: 5984, clientWidth: 1265 }), {
    canScrollLeft: false,
    canScrollRight: true,
  });

  assert.deepEqual(getRowScrollState({ scrollLeft: 4719, scrollWidth: 5984, clientWidth: 1265 }), {
    canScrollLeft: true,
    canScrollRight: false,
  });
});
