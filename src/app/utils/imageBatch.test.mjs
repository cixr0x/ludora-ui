import assert from "node:assert/strict";
import test from "node:test";

import { getBufferedRowImageIds, preloadImageBatch, preloadImageRow } from "./imageBatch.js";

test("preloadImageBatch resolves after every unique source settles", async () => {
  const events = [];
  const resolvers = new Map();

  const preload = (src) =>
    new Promise((resolve, reject) => {
      events.push(`start:${src}`);
      resolvers.set(src, src === "bad.png" ? reject : resolve);
    });

  let resolved = false;
  const batch = preloadImageBatch(
    ["a.png", "b.png", "a.png", "", undefined, "bad.png"],
    preload,
  ).then(() => {
    resolved = true;
    events.push("batch:done");
  });

  await Promise.resolve();
  assert.deepEqual(events, ["start:a.png", "start:b.png", "start:bad.png"]);

  resolvers.get("a.png")();
  await Promise.resolve();
  assert.equal(resolved, false);

  resolvers.get("bad.png")(new Error("broken image"));
  await Promise.resolve();
  assert.equal(resolved, false);

  resolvers.get("b.png")();
  await batch;

  assert.equal(resolved, true);
  assert.deepEqual(events, ["start:a.png", "start:b.png", "start:bad.png", "batch:done"]);
});

test("preloadImageRow waits for the full row before resolving", async () => {
  const resolvers = new Map();
  const preload = (src) =>
    new Promise((resolve, reject) => {
      resolvers.set(src, src === "broken.png" ? reject : resolve);
    });

  let rowVisible = false;
  const row = preloadImageRow(["cover-1.png", "cover-2.png", "broken.png"], preload).then(() => {
    rowVisible = true;
  });

  await Promise.resolve();
  resolvers.get("cover-1.png")();
  await Promise.resolve();
  assert.equal(rowVisible, false);

  resolvers.get("broken.png")(new Error("failed image"));
  await Promise.resolve();
  assert.equal(rowVisible, false);

  resolvers.get("cover-2.png")();
  await row;
  assert.equal(rowVisible, true);
});

test("getBufferedRowImageIds includes visible cards plus one horizontal click", () => {
  const items = Array.from({ length: 10 }, (_, index) => ({
    id: String(index),
    left: index * 184,
    right: index * 184 + 168,
  }));

  assert.deepEqual(getBufferedRowImageIds(items, 0, 368, 720), ["0", "1", "2", "3", "4", "5"]);
  assert.deepEqual(getBufferedRowImageIds(items, 920, 368, 720), ["1", "2", "3", "4", "5", "6", "7", "8", "9"]);
});
