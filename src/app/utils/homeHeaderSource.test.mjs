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
