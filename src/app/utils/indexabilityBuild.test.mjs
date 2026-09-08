import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  applyIndexingPolicy,
  parseIndexingEnabled,
  robotsDocument,
  sitemapDocument,
} from "../../../scripts/seo-output.mjs";

const blockedTemplate = '<head><meta name="robots" content="noindex, nofollow" /></head>';
const packageJson = JSON.parse(readFileSync(new URL("../../../package.json", import.meta.url), "utf8"));
const indexableBuildSource = readFileSync(new URL("../../../scripts/build-indexable.mjs", import.meta.url), "utf8");

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
  const robots = robotsDocument({ indexingEnabled: true, siteUrl: "https://www.ludoradar.mx" });
  assert.match(robots, /^User-agent: \*\n/);
  assert.match(robots, /\nSitemap: https:\/\/www\.ludoradar\.mx\/sitemap\.xml\n$/);
});

const renderingRequests = [
  "/api/front-page",
  "/api/items/filter-options",
  "/api/items/1",
  "/api/items/20",
  "/api/items/301",
  "/api/items/456",
  "/api/items/5000",
  "/api/items/678",
  "/api/items/708",
  "/api/items/851",
  "/api/items/9999",
  "/api/items/708/related",
  "/api/items/708/related?limit=18",
  "/api/items/708/related?limit=12",
  "/api/items/708/expansions",
  "/api/items/708/expansions?limit=18",
  "/api/items/708/expansions?limit=100",
];

const unrelatedApiRequests = [
  "/api/items",
  "/api/items?limit=200&offset=0",
  "/api/items/prerender?limit=200&after_id=0",
  "/api/items/summary?limit=200",
  "/api/items/search-results?q=catan",
  "/api/items/semantic-search?q=catan&limit=20",
  "/api/items/filter-options/private",
  "/api/items/filter-options?unexpected=true",
  "/api/front-page/private",
  "/api/front-page?unexpected=true",
  "/api/contact",
  "/api/store-items/708/clicks",
  "/api/health",
];

test("indexable robots allow homepage and product rendering reads while blocking unrelated APIs", () => {
  const robots = robotsDocument({ indexingEnabled: true, siteUrl: "https://www.ludoradar.mx" });

  for (const path of ["/", "/game/851/dixit", ...renderingRequests]) {
    assert.equal(crawlAllowed(robots, path), true, `Expected crawl access to ${path}`);
  }
  for (const path of unrelatedApiRequests) {
    assert.equal(crawlAllowed(robots, path), false, `Expected crawl block for ${path}`);
  }
});

test("blocked robots keep pages and rendering reads inaccessible without the indexable switch", () => {
  const robots = robotsDocument({ indexingEnabled: false, siteUrl: "https://www.ludoradar.mx" });

  for (const path of ["/", "/game/851/dixit", ...renderingRequests, ...unrelatedApiRequests]) {
    assert.equal(crawlAllowed(robots, path), false, `Expected crawl block for ${path}`);
  }
});

test("the indexable production command pins the launch switch and canonical host", () => {
  assert.equal(packageJson.scripts["build:indexable"], "node scripts/build-indexable.mjs");
  assert.match(indexableBuildSource, /LUDORA_INDEXING_ENABLED = "true"/);
  assert.match(indexableBuildSource, /LUDORA_SITE_URL = "https:\/\/www\.ludoradar\.mx"/);
  assert.match(indexableBuildSource, /await import\("\.\/build\.mjs"\)/);
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

test("production sitemap records preserve each page's significant lastmod and exact page set", () => {
  const pages = [
    { canonicalPath: "/", lastmod: "2026-09-07T06:00:00.000Z" },
    { canonicalPath: "/juegos-de-mesa/pagina/2", lastmod: "2026-09-08T06:00:00.000Z" },
  ];
  const sitemap = sitemapDocument({ pages, siteUrl: "https://www.ludoradar.mx" });
  assert.match(sitemap, /<loc>https:\/\/www\.ludoradar\.mx\/<\/loc><lastmod>2026-09-07T06:00:00.000Z<\/lastmod>/);
  assert.match(sitemap, /\/juegos-de-mesa\/pagina\/2<\/loc><lastmod>2026-09-08T06:00:00.000Z<\/lastmod>/);
  assert.doesNotMatch(sitemap, /priority|changefreq/);
  assert.doesNotMatch(sitemapDocument({ pages: [], siteUrl: "https://www.ludoradar.mx" }), /<url>/);
  for (const lastmod of [undefined, "invalid", "2026-02-30", "2026-09-08T25:00:00Z"]) {
    assert.throws(() => sitemapDocument({ pages: [{ canonicalPath: "/", lastmod }], siteUrl: "https://www.ludoradar.mx" }), /lastmod/i);
  }
  assert.throws(() => sitemapDocument({ pages: [...pages, { ...pages[0], lastmod: pages[1].lastmod }], siteUrl: "https://www.ludoradar.mx" }), /duplicate/i);
  const escaped = sitemapDocument({ canonicalPaths: ["/example?first=1&second=2"], siteUrl: "https://www.ludoradar.mx" });
  assert.match(escaped, /first=1&amp;second=2/);
});

// The generated file has one wildcard user-agent group. Evaluate its rules against
// the complete path + query: Google supports * and $, with the longest rule winning
// and Allow winning ties. Other regex characters (including ? and []) are literal.
function crawlAllowed(robots, path) {
  const matches = robots.split("\n").flatMap((line) => {
    const rule = line.match(/^(Allow|Disallow):\s*(\S+)$/i);
    if (!rule) return [];
    const [, directive, pattern] = rule;
    const anchored = pattern.endsWith("$");
    const body = anchored ? pattern.slice(0, -1) : pattern;
    const expression = body.split("*").map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*");
    if (!new RegExp(`^${expression}${anchored ? "$" : ""}`).test(path)) return [];
    return [{ allowed: directive.toLowerCase() === "allow", specificity: pattern.length }];
  });
  matches.sort((left, right) => right.specificity - left.specificity || Number(right.allowed) - Number(left.allowed));
  return matches[0]?.allowed ?? true;
}
