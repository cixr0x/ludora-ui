import assert from "node:assert/strict";
import test from "node:test";

import {
  applyIndexingPolicy,
  parseIndexingEnabled,
  robotsDocument,
  sitemapDocument,
} from "../../../scripts/seo-output.mjs";

const blockedTemplate = '<head><meta name="robots" content="noindex, nofollow" /></head>';

test("indexing remains disabled unless explicitly enabled", () => {
  assert.equal(parseIndexingEnabled(undefined), false);
  assert.equal(parseIndexingEnabled(""), false);
  assert.equal(parseIndexingEnabled("false"), false);
  assert.equal(parseIndexingEnabled("true"), true);
  assert.throws(() => parseIndexingEnabled("yes"), /LUDORA_INDEXING_ENABLED/);
});

test("build output keeps the robots meta blocked by default", () => {
  assert.equal(applyIndexingPolicy(blockedTemplate, false), blockedTemplate);
  assert.match(
    robotsDocument({ indexingEnabled: false, siteUrl: "https://www.ludoradar.mx" }),
    /^User-agent: \*\nDisallow: \/\nSitemap: https:\/\/www\.ludoradar\.mx\/sitemap\.xml\n$/,
  );
});

test("the explicit launch switch enables indexable page output", () => {
  assert.equal(
    applyIndexingPolicy(blockedTemplate, true),
    '<head><meta name="robots" content="index, follow" /></head>',
  );
  assert.match(
    robotsDocument({ indexingEnabled: true, siteUrl: "https://www.ludoradar.mx" }),
    /^User-agent: \*\nDisallow: \/api\/\nSitemap: https:\/\/www\.ludoradar\.mx\/sitemap\.xml\n$/,
  );
});

test("the sitemap contains only unique absolute canonical URLs", () => {
  const sitemap = sitemapDocument({
    canonicalPaths: ["/game/851/dixit", "/game/851/dixit", "/game/12/catan"],
    siteUrl: "https://www.ludoradar.mx",
  });

  assert.match(sitemap, /<loc>https:\/\/www\.ludoradar\.mx\/<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/www\.ludoradar\.mx\/game\/851\/dixit<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/www\.ludoradar\.mx\/game\/12\/catan<\/loc>/);
  assert.equal((sitemap.match(/game\/851\/dixit/g) ?? []).length, 1);
  assert.throws(
    () => sitemapDocument({ canonicalPaths: ["https://example.com/game/1/test"], siteUrl: "https://www.ludoradar.mx" }),
    /root-relative/,
  );
});
