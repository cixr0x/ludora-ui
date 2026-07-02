import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("game detail does not render a BoardGameGeek logo link", () => {
  const source = readFileSync(new URL("../pages/GameDetail.tsx", import.meta.url), "utf8");

  assert.doesNotMatch(source, /BoardGameGeek|BGG_LOGO_URL|bggUrl/);
});

test("catalog detail mapping extracts TikTok tutorial metadata", () => {
  const source = readFileSync(new URL("../data/catalog.ts", import.meta.url), "utf8");

  assert.match(source, /tiktokTutorialFromUrl/);
  assert.match(source, /tiktokId:\s*tiktokTutorial\?\.id/);
  assert.match(source, /tiktokUser:\s*tiktokTutorial\?\.user/);
});

test("game detail uses the TikTok player iframe without the share card embed", () => {
  const source = readFileSync(new URL("../pages/GameDetail.tsx", import.meta.url), "utf8");

  assert.match(source, /https:\/\/www\.tiktok\.com\/player\/v1\/\$\{tiktokId\}/);
  assert.match(source, /description=0/);
  assert.match(source, /music_info=0/);
  assert.doesNotMatch(source, /className="tiktok-embed"/);
  assert.doesNotMatch(source, /https:\/\/www\.tiktok\.com\/embed\.js/);
  assert.doesNotMatch(source, /tiktok\.com\/embed\/v2/);
});

test("game detail hides the TikTok player when no linked tutorial exists", () => {
  const source = readFileSync(new URL("../pages/GameDetail.tsx", import.meta.url), "utf8");

  assert.match(source, /\{detail\.tiktokId && \(/);
  assert.doesNotMatch(source, /tiktokPlayerUrl \? \(/);
  assert.doesNotMatch(source, /\bDices\b/);
  assert.doesNotMatch(source, /@ludora/);
});

test("game detail thanks and links to the TikTok tutorial creator", () => {
  const source = readFileSync(new URL("../pages/GameDetail.tsx", import.meta.url), "utf8");

  assert.match(source, /Gracias a/);
  assert.match(source, /No olviden/);
  assert.match(source, /seguirlos/);
  assert.match(source, /para m(?:a|\u00e1)s contenido!/u);
  assert.match(source, /className="text-sm leading-snug text-neutral-500"/);
  assert.match(source, /https:\/\/www\.tiktok\.com\/@\$\{tiktokUser\}/);
  assert.equal(source.match(/href=\{tiktokProfileUrl\}/g)?.length, 2);
});

test("game detail highlights the enabled buy-now button while keeping disabled state neutral", () => {
  const source = readFileSync(new URL("../pages/GameDetail.tsx", import.meta.url), "utf8");

  assert.match(source, /bg-fuchsia-500/);
  assert.match(source, /hover:bg-fuchsia-400/);
  assert.match(source, /shadow-\[0_0_18px_rgba\(217,70,239,0\.25\)\]/);
  assert.match(source, /bg-neutral-900 border border-neutral-800 text-neutral-600 text-sm py-2 rounded-lg cursor-not-allowed/);
});
