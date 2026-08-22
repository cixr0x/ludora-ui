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
  assert.match(source, /w-16[^\"]*sm:w-64 lg:w-72/);
});

test("home header wordmark is a larger link to the home page", () => {
  const source = headerSource();

  assert.match(source, /<Link[\s\S]*to="\/"[\s\S]*className="ludora-wordmark text-xl[^"]*sm:text-2xl"/);
  assert.match(source, /<span>Ludo Radar<\/span>/);
  assert.match(source, /<img[\s\S]*src="\/ludoradar-icon\.webp"[\s\S]*alt=""[\s\S]*aria-hidden="true"/);
  assert.match(source, /className="h-7 w-7[^"]*sm:h-8 sm:w-8"/);
  assert.doesNotMatch(source, /<span className="ludora-wordmark">/);
});
