import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const headerSource = () => readFileSync(new URL("../components/SiteHeader.tsx", import.meta.url), "utf8");

test("home header keeps search expanded and removes notification and user icons", () => {
  const source = headerSource();

  assert.doesNotMatch(source, /\bBell\b/);
  assert.doesNotMatch(source, /\bUser\b/);
  assert.doesNotMatch(source, /searchOpen/);
  assert.match(source, /placeholder="Buscar juegos/);
  assert.match(source, /w-20 sm:w-64 lg:w-72/);
});

test("home header wordmark is a larger link to the home page", () => {
  const source = headerSource();

  assert.match(source, /<Link[\s\S]*to="\/"[\s\S]*className="ludora-wordmark text-2xl[^"]*"[\s\S]*>\s*Ludora\s*<\/Link>/);
  assert.doesNotMatch(source, /<span className="ludora-wordmark">/);
});
