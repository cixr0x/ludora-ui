import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), "utf8");

test("home loading state centers the loading message above a larger powered by BGG logo", () => {
  const homeSource = source("../pages/Home.tsx");

  assert.match(homeSource, /Cargando cat(?:a|\u00e1)logo\.\.\./u);
  assert.match(homeSource, /BGG_FOOTER_LOGO_URL/);
  assert.match(homeSource, /alt="Powered by BGG"/);
  assert.match(homeSource, /items-center justify-center/);
  assert.match(homeSource, /flex-col items-center justify-center/);
  assert.match(homeSource, /className="h-10 w-auto opacity-80"/);
});

test("game detail loading state centers the loading message above a larger powered by BGG logo", () => {
  const detailSource = source("../pages/GameDetail.tsx");

  assert.match(detailSource, /Cargando juego\.\.\./);
  assert.match(detailSource, /BGG_FOOTER_LOGO_URL/);
  assert.match(detailSource, /alt="Powered by BGG"/);
  assert.match(detailSource, /items-center justify-center/);
  assert.match(detailSource, /flex-col items-center justify-center/);
  assert.match(detailSource, /className="h-10 w-auto opacity-80"/);
});
