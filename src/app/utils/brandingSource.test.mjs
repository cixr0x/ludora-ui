import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), "utf8");

test("customer-facing surfaces consistently use the Ludo Radar product name", () => {
  const customerFacingSources = [
    ["index.html", source("../../../index.html")],
    ["SiteHeader", source("../components/SiteHeader.tsx")],
    ["ContactFormDialog", source("../components/ContactFormDialog.tsx")],
    ["PrivacyPolicy", source("../pages/PrivacyPolicy.tsx")],
    ["TermsOfService", source("../pages/TermsOfService.tsx")],
    ["catalog display fallback", source("../data/catalog.ts")],
  ];

  for (const [name, customerFacingSource] of customerFacingSources) {
    assert.doesNotMatch(customerFacingSource, /\bLudora\b/, `${name} exposes the internal codename`);
  }

  const indexSource = customerFacingSources[0][1];
  assert.match(indexSource, /<title>Ludo Radar<\/title>/);
  assert.match(indexSource, /<meta name="application-name" content="Ludo Radar" \/>/);
  assert.match(indexSource, /<meta property="og:site_name" content="Ludo Radar" \/>/);
  assert.match(indexSource, /<meta name="twitter:title" content="Ludo Radar" \/>/);
  assert.match(customerFacingSources[1][1], />\s*Ludo Radar\s*<\/Link>/);
  assert.match(customerFacingSources[2][1], /necesitas de Ludo Radar/);
  assert.match(customerFacingSources[3][1], /Ludo Radar no solicita datos personales/);
  assert.match(customerFacingSources[4][1], /Qué es Ludo Radar/);
  assert.match(customerFacingSources[5][1], /rowGenre \|\| "Ludo Radar"/);
});

test("the Ludora codename remains in compatibility-sensitive internal identifiers", () => {
  assert.match(source("../../../package.json"), /"name": "ludora-ui"/);
  assert.match(source("../api/catalog.ts"), /VITE_LUDORA_API_URL/);
  assert.match(source("../../styles/theme.css"), /\.ludora-wordmark/);
  assert.match(source("./ludoscopioSessionCache.js"), /"ludora:ludoscopio:session:v2"/);
});
