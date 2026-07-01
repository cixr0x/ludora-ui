import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), "utf8");

test("home loading state shows the powered by BGG logo next to the loading message", () => {
  const homeSource = source("../pages/Home.tsx");

  assert.match(homeSource, /Cargando cat(?:a|\u00e1)logo\.\.\./u);
  assert.match(homeSource, /BGG_FOOTER_LOGO_URL/);
  assert.match(homeSource, /alt="Powered by BGG"/);
});

test("game detail loading state shows the powered by BGG logo next to the loading message", () => {
  const detailSource = source("../pages/GameDetail.tsx");

  assert.match(detailSource, /Cargando juego\.\.\./);
  assert.match(detailSource, /BGG_FOOTER_LOGO_URL/);
  assert.match(detailSource, /alt="Powered by BGG"/);
});
