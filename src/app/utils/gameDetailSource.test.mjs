import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("game detail does not render a BoardGameGeek logo link", () => {
  const source = readFileSync(new URL("../pages/GameDetail.tsx", import.meta.url), "utf8");

  assert.doesNotMatch(source, /BoardGameGeek|BGG_LOGO_URL|bggUrl/);
});
