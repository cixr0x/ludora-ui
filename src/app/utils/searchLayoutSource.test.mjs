import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const searchSource = () => readFileSync(new URL("../pages/Search.tsx", import.meta.url), "utf8");

test("search page uses full-width explore layout instead of a centered section", () => {
  const source = searchSource();

  assert.match(source, /className="w-full px-4 py-8 sm:px-6 lg:px-8 grid gap-8 lg:grid-cols-\[320px_minmax\(0,1fr\)\]"/);
  assert.match(source, /<section className="min-w-0">/);
  assert.doesNotMatch(source, /max-w-6xl mx-auto/);
});
