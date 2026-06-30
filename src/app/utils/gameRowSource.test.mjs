import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const gameRowSource = () => readFileSync(new URL("../components/GameRow.tsx", import.meta.url), "utf8");
const homeSource = () => readFileSync(new URL("../pages/Home.tsx", import.meta.url), "utf8");

test("landing row cover images round the actual image for non-square artwork", () => {
  const source = gameRowSource();

  assert.match(
    source,
    /className="[^"]*max-w-full[^"]*max-h-full[^"]*rounded-md[^"]*object-contain[^"]*"/,
  );
  assert.match(source, /className="relative flex items-center justify-center rounded-md overflow-hidden mb-1\.5"/);
  assert.doesNotMatch(source, /<img[\s\S]*className="w-full h-full object-contain"/);
});

test("landing search thumbnails round the actual image for non-square artwork", () => {
  const source = homeSource();

  assert.match(source, /className="flex-none w-9 h-9 rounded-md overflow-hidden flex items-center justify-center"/);
  assert.match(
    source,
    /className="[^"]*max-w-full[^"]*max-h-full[^"]*rounded-md[^"]*object-contain[^"]*"/,
  );
});
