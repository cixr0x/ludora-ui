# Price Comparison SEO Implementation Plan

> For agentic workers: REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task by task. Reuse one implementer and one reviewer as required by this workspace; do not substitute a fresh agent topology.

Goal: Deliver current comparison HTML, truthful pricing markup, crawlable catalog/category navigation, and automatically maintained sitemaps for all eligible games.

Architecture: Retain the Vite/React static UI and Express API. Add a versioned HTML renderer and a single incremental refresh worker on the public VM, with staged generation and atomic publication.

Tech Stack: Existing Node.js, TypeScript, Vite, React, Express, PostgreSQL read queries, Nginx, systemd, Node test runner, Vitest, and browser validation tools.

Spec: ../specs/2026-09-07-price-comparison-seo-design.md

## Global constraints

- Customer-facing brand: Ludo Radar.
- Canonical origin: https://www.ludoradar.mx.
- Existing canonical game routes remain /game/:id/:slug.
- Public service port: 4000. Local public UI port: 5175.
- Preserve the default non-indexable build and the explicit build:indexable production entry point.
- Keep arbitrary search/filter combinations and legacy /browse routes noindex.
- JSON API responses remain noindex; rendering-required API reads stay crawlable.
- No database DDL or DML is planned. Verify existing live columns read-only before relying on new response fields.
- If a database change becomes necessary, write a focused patch under ludora-admin/database/patches and obtain approval for the exact SQL before execution.
- No changes to discovery scheduling, item matching, admin operations, or store data.
- Use one implementer and one reviewer, both inheriting the parent model and reasoning effort, in isolated implementation worktrees. Report each agent's name, role, model/effort, context mode, and exact initial task message before dispatch.
- Do not replace genuine unknown values with fabricated prices, ratings, stock, language, shipping information, or edition identifiers.

## Execution boundaries

The controller owns integration, documentation ledger, git pushes, production deployment, and Google verification. The implementer owns code and tests in paired UI/service worktrees. The reviewer reads each completed change and its evidence independently. Review fixes return to the same implementer.

Read both documents before implementation. Record the actual UI/service baselines at start, because the documentation commit changes UI HEAD after the audited fc3e8d1 baseline. Preserve unrelated work.

Each milestone runs a failing behavioral test, the implementation, its relevant tests, and reviewer approval before integration. A failed review blocks dependent milestones, not independent investigation. No unresolved correctness finding passes to deployment.

## Shared interfaces

Names below are the planned interfaces; implement them consistently or update this plan and all consumers together.

~~~ts
// Additive fields on existing API records.
type SeoOfferFields = {
  language?: string;
  last_updated?: string;
  refreshed_date?: string;
};

// Extended prerender feed remains { data, meta }.
type SeoExportMeta = {
  schemaVersion: 2;
  pagination: "keyset";
  limit: number;
  afterId: number;
  maxId: number;
  nextAfterId: number | null;
};

type SeoPageRecord = {
  canonicalPath: string;
  fingerprint: string;
  lastmod: string;
};

type SeoManifest = {
  version: 1;
  uiSha: string;
  generationId: string;
  publishedAt: string;
  pages: Record<string, SeoPageRecord>;
};
~~~

The initial export captures maxId; later requests send that same maxId. Reject changing bounds and repeated/non-advancing cursors. A schemaVersion mismatch is an error for the new refresh worker; do not silently downgrade to the offer-free feed. Existing consumers can ignore additive fields.

## Task 1: Export complete comparison data and establish one offer policy

Files:

- Modify service: src/routes/catalog.ts, src/app.test.ts.
- Create service: src/catalog/seoExport.ts, src/catalog/seoExport.test.ts.
- Modify UI: src/app/api/catalog.ts, src/app/data/catalog.ts, src/app/data/games.ts.
- Create UI: src/app/utils/offerSeo.js, src/app/utils/offerSeo.test.mjs.

Interfaces:

- Existing GET /api/items/prerender accepts optional maxId and exports offers, existing timestamps, language, and related/expansion references in bounded batches.
- Existing GET /api/items/:id returns the same additive offer fields.
- offerSeo.js exports pricingOffers(stores) and productOfferSchema(stores).
- pricingOffers returns only the eligible available MXN non-bundle offers used by visible lowest-price/count summaries.
- productOfferSchema returns individual Offer records for eligible confirmed listings. It does not infer editions or produce an AggregateOffer across unknown variants.

- [ ] Verify existing live source columns with read-only access. Confirm the successful-refresh timestamp meaning in updater code. Do not run SQL migrations.
- [ ] Add API tests with mocked database results for new fields, frozen maxId, end-of-feed, malformed cursor, and backward-compatible response fields.
- [ ] Add offer tests using these concrete fixtures:

~~~js
import assert from "node:assert/strict";
import test from "node:test";
import { pricingOffers, productOfferSchema } from "./offerSeo.js";

const base = {
  id: 1, storeId: 7, name: "Example store",
  gameTitle: "Sushi Go Party!", url: "https://store.example/game",
  priceValue: 350, currency: "MXN", isBundle: false,
  storeActive: true, listingStatus: "LISTED",
  availabilityStatus: "available", inStock: true
};

test("bundles, invalid prices and unavailable records do not set a minimum", () => {
  const stores = [
    base,
    { ...base, id: 2, priceValue: 1, isBundle: true },
    { ...base, id: 3, priceValue: 0 },
    { ...base, id: 4, priceValue: 10, availabilityStatus: "out_of_stock", inStock: false },
    { ...base, id: 5, priceValue: 20, storeActive: false }
  ];
  assert.deepEqual(pricingOffers(stores).map(x => x.id), [1]);
  const offers = productOfferSchema([base]);
  assert.equal(offers[0]["@type"], "Offer");
  assert.equal(Number(offers[0].price), 350);
  assert.equal(offers[0].priceCurrency, "MXN");
  assert.equal(offers[0].url, base.url);
});
~~~

- [ ] Run the new tests and confirm failure before production edits.
- [ ] Extend the export using batched queries and existing approval/relationship semantics. Preserve unknown availability rather than converting it to available. Extend the StoreEntry model with storeId, storeActive, listingStatus, language, and source timestamps.
- [ ] Run service npm test and npm run build, and UI npm test. Measure one read-only full export; record counts, runtime, peak memory, and failures. Confirm there is no per-product HTTP fan-out.
- [ ] Commit the service and UI milestone; send both diffs and evidence to the reviewer.

## Task 2: Separate compilation from generation and implement safe refresh

Files:

- Modify UI: scripts/build.mjs, package.json.
- Create UI: scripts/seo/export.mjs, scripts/seo/manifest.mjs, scripts/seo/publish.mjs, scripts/refresh-seo.mjs.
- Create UI tests: src/app/utils/seoRefresh.test.mjs.
- Create UI ops: ops/seo/ludoradar-seo-refresh.service, ops/seo/ludoradar-seo-refresh.timer, ops/seo/refresh.sh.

Interfaces:

- fetchSeoExport({apiOrigin, fetchImpl}) returns a complete validated export or throws.
- contentFingerprint(value) returns a deterministic SHA-256 of significant normalized content.
- reconcilePages({previous, candidates, publishedAt, uiSha}) returns the next manifest and changed/removed path lists.
- publishGeneration({stageDirectory, livePath, lockPath}) promotes only an already validated complete generation.
- npm run seo:refresh executes the compiled renderer against the current API without invoking Vite compilation.
- The initial npm run build:indexable calls the same generator after compilation.

- [ ] Add filesystem integration tests in disposable temporary directories: identical data preserves lastmod; price change modifies only affected pages; failed export leaves live files untouched; additions/removals reconcile only after a complete export; a held lock prevents concurrent publication.
- [ ] Include this manifest contract test:

~~~js
const original = {
  version: 1, uiSha: "sha-a", generationId: "first",
  publishedAt: "2026-09-07T12:00:00Z",
  pages: {
    "/game/708/sushi-go-party": {
      canonicalPath: "/game/708/sushi-go-party",
      fingerprint: "same",
      lastmod: "2026-09-07T12:00:00Z"
    }
  }
};
const next = reconcilePages({
  previous: original,
  candidates: [{canonicalPath: "/game/708/sushi-go-party", fingerprint: "same"}],
  publishedAt: "2026-09-07T12:15:00Z",
  uiSha: "sha-a"
});
assert.equal(next.manifest.pages["/game/708/sushi-go-party"].lastmod,
  "2026-09-07T12:00:00Z");
assert.deepEqual(next.changedPaths, []);
~~~

- [ ] Run RED, implement compilation/generation separation, and retain the renderer/template/dependencies outside the public root with a matching UI SHA.
- [ ] Implement a complete staging directory and atomic live-generation switch. On Linux, use same-filesystem rename/symlink publication; test Windows behavior in a disposable workspace without composing destructive operations across shells.
- [ ] Use a shared refresh/deployment lock. Default timer is 15 minutes; worker timeout is 10 minutes. Record failures and completion details in journal and a local status file. Do not enable the production timer yet.
- [ ] Run GREEN and the UI suite; prove a changed fixture updates HTML without recompiling assets. Record source-fetch and rendering costs.
- [ ] Commit and obtain reviewer approval for failure handling, lock ownership, and publication boundaries.

## Task 3: Render game offers, accurate schema, and comparison wording

Files:

- Modify UI: src/entry-server.tsx, src/app/PrerenderData.tsx, src/main.tsx.
- Modify UI: src/app/pages/GameDetail.tsx, src/app/components/ProductMetadata.tsx.
- Modify UI: src/app/utils/productSeo.js, src/app/utils/siteSeo.js, index.html.
- Modify UI tests: productSeo.test.mjs, prerenderLiteralData.test.mjs, prerenderBootstrap.test.mjs.
- Create UI test: src/app/utils/productOfferPrerender.test.mjs.

Interfaces:

- renderProductDocument retains item.offers and accepts exported related/expansion references.
- PrerenderData embeds the exact product and relationship model used for SSR.
- productSeoMetadata consumes the same offer model as the comparison component.
- ProductMetadata recalculates JSON-LD whenever refreshed visible data changes.

- [ ] Extend the existing actual Vite SSR test harness with an approved 350 MXN offer. Assert the HTML contains the store name, price, listing link, comparison heading, and matching parsed Product.offers.
- [ ] Add fixtures for zero offers, unavailable stores, invalid prices, bundles, non-MXN records, unknown availability/language, different listing editions, literal dollar sequences, and HTML-sensitive text. Check rendered facts and schema agree.
- [ ] Add an actual first-render hydration check: initial offers and relationships match; a subsequent mocked API response updates both displayed price and JSON-LD. Preserve direct /search and legal-route bootstrap behavior.
- [ ] Run RED, implement the shared-policy rendering and the exact Spanish copy from the spec, and expose a clearly labelled comparison publication time.
- [ ] Add real anchor links for exported related games and expansions without removing the live refresh.
- [ ] Run GREEN and npm test. Verify generated HTML with JavaScript disabled in a browser.
- [ ] Commit and obtain reviewer approval; do not deploy offer snapshots without Task 2's refresh path.

## Task 4: Add indexable catalog/category pages and full link coverage

Files:

- Create UI: src/app/pages/Catalog.tsx, src/app/pages/Categories.tsx, src/app/pages/Category.tsx.
- Create UI: src/app/components/CatalogPagination.tsx, src/app/utils/catalogSeo.js.
- Modify UI: src/app/routes.ts, src/app/PrerenderData.tsx, src/main.tsx, src/entry-server.tsx.
- Modify UI: src/app/pages/Home.tsx, src/app/pages/GameDetail.tsx, src/app/components/SiteHeader.tsx.
- Modify UI generator: scripts/seo/export.mjs, scripts/refresh-seo.mjs.
- Modify service routing: ops/nginx/ludora-app.conf, src/nginxConfig.test.ts.
- Create UI tests: src/app/utils/catalogSeo.test.mjs, src/app/utils/catalogPrerender.test.mjs.

Interfaces:

- catalogPath(page) returns /juegos-de-mesa for page 1 and /juegos-de-mesa/pagina/N otherwise.
- categoryPath({id,name,page}) returns the routes defined in the spec using the existing slug normalizer.
- paginateCatalog(items,page,48) returns ordered page items, page count, and previous/next paths.
- The generator uses the same validated export for game, category and catalog generation.
- Every new valid page has a self-canonical and an exact matching prerender payload.

- [ ] Add route/pagination tests before implementation:

~~~js
assert.equal(catalogPath(1), "/juegos-de-mesa");
assert.equal(catalogPath(2), "/juegos-de-mesa/pagina/2");
assert.throws(() => catalogPath(0));
const items = Array.from({length: 49}, (_, n) => ({id: n + 1, name: "Game " + (n + 1)}));
assert.equal(paginateCatalog(items, 1, 48).items.length, 48);
assert.equal(paginateCatalog(items, 2, 48).items.length, 1);
assert.throws(() => paginateCatalog(items, 3, 48));
~~~

- [ ] Implement the page components and renderers with genuine anchor pagination, factual category copy, and visible eligible price summaries. Preserve the site's visual styles.
- [ ] Add narrowly scoped Nginx rules for generated catalog/category HTML, canonical page-1 redirects, wrong-slug resolution, and 404 pagination boundaries. Keep existing search and arbitrary filters noindex.
- [ ] Add a generated-site graph test that starts at /, follows internal HTML anchor links, and asserts that every exported game is reachable. Include games without categories.
- [ ] Validate SSR/client navigation in both directions between game, category, catalog, search, and homepage. Confirm metadata does not inherit another page's canonical.
- [ ] Run relevant UI/service tests and production builds, then commit and obtain review.

## Task 5: Accurate sitemaps and integrated change reconciliation

Files:

- Modify UI: scripts/seo-output.mjs, scripts/seo/manifest.mjs, scripts/refresh-seo.mjs.
- Modify UI tests: src/app/utils/indexabilityBuild.test.mjs, src/app/utils/seoRefresh.test.mjs.
- Modify service: ops/nginx/ludora-app.conf, src/nginxConfig.test.ts, canonical resolver only where required for renamed generated routes.

Interfaces:

- sitemapDocument accepts canonicalPaths for backward compatibility and optional page records with accurate lastmod for production generation.
- All sitemap entries refer to successfully generated indexable canonical routes in the same publication.
- Content fingerprints cover dependencies that change a page, including relevant offer prices, category membership, and relationship links.

- [ ] Add tests for unchanged lastmod, price/stock change, game rename, category membership change, removed game, empty category, and shrinking pagination.
- [ ] Test that an incomplete export causes no deletion and no sitemap publication. Test a successful empty category removal independently from a corrupt empty catalog.
- [ ] Implement sitemap/manifest publication in the same generation as the HTML. Do not add priority or changefreq. Escape names and URLs correctly.
- [ ] For renamed products, preserve resolution to the correct canonical page. Verify that removed/missing products do not pretend to be live comparisons.
- [ ] Crawl all generated local URLs for canonical, robots, status, and link consistency; run complete UI/service suites once the final changes are in place.
- [ ] Commit and request integrated review across both repos and the refresh/deployment scripts.

## Task 6: Deploy, verify refresh operation, and validate with Google

Files:

- Create UI: ops/seo/Deploy-LudoraSeo.ps1, docs/seo-refresh-operations.md.
- Update UI: docs/seo-crawl-access.md.
- Update service: ops/nginx/README.md.
- Update workspace runbook: C:/PROJECTS/ludora/docs/codex-deployment.md, following the workspace's document ownership.

- [ ] Document the exact API/UI SHAs, runtime paths, lock path, generation directories, status command, timer commands, and rollback procedure.
- [ ] Before promotion, verify resolved filesystem targets remain inside the intended Ludora deployment directories. Preserve unrelated artifacts and the last successful release.
- [ ] Deploy the public service first and verify the new export contract read-only. No SQL execution.
- [ ] Stage the compiled UI/runtime, perform a complete export/generation, validate output, install only the required Nginx routing, run nginx -t, then publish.
- [ ] Enable the systemd timer only after a manual refresh passes. Verify one timer-triggered cycle, its exact UI SHA, status, generation/manifest state, and exclusion of concurrent work.
- [ ] Verify representative game, zero-offer game, expansion, category and paginated catalog routes; inspect actual prices, schema, canonicals, and no-JavaScript links.
- [ ] Confirm a synthetic data change and failed refresh in staging exercise the update/rollback path. Do not change production records just to test refresh.
- [ ] Run Google live inspection and Rich Results Test on representative eligible products, homepage, and a category page. Submit the refreshed sitemap if needed and request sample recrawls after validation.
- [ ] Report exact deployed SHAs, tests, valid/remaining schema cases, timer state, and any limitations. Do not equate accepted recrawl requests with indexing or ranking.

## Plan self-review

- All five audited improvement areas are covered by Tasks 1-5; Task 6 makes them operational.
- Freshness is a dependency of offer publication, not deferred maintenance.
- Raw HTML, browser state, visible summaries, and JSON-LD use the same model and offer eligibility.
- All eligible games have a complete crawlable path even when their taxonomy is missing.
- Partial fetches cannot remove pages; renderer and assets cannot mix versions during publication.
- No new edition identity or database mutation is assumed.
- Google ranking gains remain measured after technical completion.
