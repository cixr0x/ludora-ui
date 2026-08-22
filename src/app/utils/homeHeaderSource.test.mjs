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
  assert.match(source, /min-w-0 flex-1[^\"]*md:w-64 md:flex-none lg:w-72/);
});

test("home header uses two mobile rows and restores its desktop row at md", () => {
  const source = headerSource();

  assert.match(
    source,
    /flex flex-col gap-2 px-3 py-3[^\"]*md:h-16 md:flex-row md:items-center md:justify-between md:gap-4 md:px-8 md:py-0/,
  );
  assert.match(source, /flex w-full flex-none items-center md:w-auto/);
  assert.match(source, /flex w-full min-w-0 items-center gap-2 sm:gap-3 md:w-auto/);
  assert.match(source, /relative min-w-0 flex-1 md:flex-none/);
});

test("home header wordmark is a larger link to the home page", () => {
  const source = headerSource();

  assert.match(source, /<Link[\s\S]*to="\/"[\s\S]*className="ludora-wordmark text-xl[^"]*sm:text-2xl"/);
  assert.match(source, /className="ludora-wordmark-accent">L<\/span>udo\{" "\}/);
  assert.match(source, /className="ludora-wordmark-accent">R<\/span>adar/);
  assert.match(source, /<img[\s\S]*src="\/ludoradar-icon\.webp"[\s\S]*alt=""[\s\S]*aria-hidden="true"/);
  assert.match(source, /className="h-7 w-7[^"]*sm:h-8 sm:w-8"/);
  assert.doesNotMatch(source, /<span className="ludora-wordmark">/);
});
