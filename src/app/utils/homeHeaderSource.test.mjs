import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const homeSource = () => readFileSync(new URL("../pages/Home.tsx", import.meta.url), "utf8");

test("home header keeps search expanded and removes notification and user icons", () => {
  const source = homeSource();

  assert.doesNotMatch(source, /\bBell\b/);
  assert.doesNotMatch(source, /\bUser\b/);
  assert.doesNotMatch(source, /searchOpen/);
  assert.match(source, /placeholder="Buscar juegos/);
  assert.match(source, /w-56 sm:w-64 lg:w-72/);
});

test("home header wordmark is a larger link to the home page", () => {
  const source = homeSource();

  assert.match(source, /<Link[\s\S]*to="\/"[\s\S]*className="ludora-wordmark text-2xl[^"]*"[\s\S]*>\s*Ludora\s*<\/Link>/);
  assert.doesNotMatch(source, /<span className="ludora-wordmark">/);
});
