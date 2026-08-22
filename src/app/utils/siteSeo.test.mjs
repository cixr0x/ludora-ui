import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  DEFAULT_SITE_URL,
  HOME_DESCRIPTION,
  HOME_TITLE,
  SITE_NAME,
  siteRootUrl,
} from "./siteSeo.js";

const indexSource = readFileSync(new URL("../../../index.html", import.meta.url), "utf8");

test("landing SEO signals describe Ludo Radar on its Mexican domain", () => {
  assert.equal(SITE_NAME, "Ludo Radar");
  assert.equal(DEFAULT_SITE_URL, "https://ludoradar.mx");
  assert.equal(HOME_TITLE, "Juegos de mesa en México: Descubre y compara precios | Ludo Radar");
  assert.equal(
    HOME_DESCRIPTION,
    "Ludo Radar: La referencia de juegos de mesa en México. Descubre, conoce y encuentra la mejor oferta.",
  );
  assert.equal(siteRootUrl(), "https://ludoradar.mx/");
  assert.match(indexSource, /<link rel="canonical" href="https:\/\/ludoradar\.mx\/" \/>/);
  assert.match(indexSource, /"@type":"WebSite","name":"Ludo Radar","url":"https:\/\/ludoradar\.mx\/"/);
});

test("landing SEO remains explicitly unavailable for indexing", () => {
  assert.match(indexSource, /<meta name="robots" content="noindex, nofollow" \/>/);
});
