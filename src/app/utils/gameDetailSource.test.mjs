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

test("game detail uses TikTok official embed markup", () => {
  const source = readFileSync(new URL("../pages/GameDetail.tsx", import.meta.url), "utf8");

  assert.match(source, /className="tiktok-embed"/);
  assert.match(source, /data-video-id/);
  assert.match(source, /https:\/\/www\.tiktok\.com\/embed\.js/);
  assert.doesNotMatch(source, /tiktok\.com\/embed\/v2/);
});
