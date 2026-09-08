# Price comparison SEO design

Status: approved for implementation, with the user's correction to a 24-hour refresh interval for the small public VM and daily item updates. This document does not record a production change.

## Goal and verified baseline

Make game comparisons available in the first HTML response, express their offer data accurately, provide crawlable paths through the full eligible catalog, and refresh HTML and sitemaps as catalog data changes.

Verified on 2026-09-07 local time:

- Public UI main: fc3e8d1a9a101d537554f9d3963478dfaf603734.
- Public service main: d6e2a384ff8703ae517ec7268db390ff0813f169.
- Sitemap contains 7,089 URLs; it has no per-URL lastmod.
- Initial HTML has no offers for Sushi Go Party!, Dixit, or La Cosa, while their APIs return 20, 22, and 6 offers.
- Product JSON-LD has no offers. Product metadata emphasizes information and availability.
- Initial homepage HTML links to eight games; sampled products load related games and expansions after JavaScript starts.
- Search and legacy browse routes are deliberately noindex.
- Static product HTML and sitemap generation currently happen during the UI build.

## Approach

Use incremental static generation on the existing public VM, retaining Vite, React, the public API, and Nginx.

Alternatives considered:

1. Full application rebuild on every refresh: uses the existing command but repeatedly compiles unchanged assets and scales poorly with frequent updates.
2. Incremental HTML generation using a compiled renderer: recommended. Adds a bounded refresh worker and publication state while preserving static request serving.
3. Runtime SSR for every request: offers request-time data but introduces a new rendering service and a larger availability/performance surface.

Data path:

~~~text
Existing catalog and store records
  -> public API prerender feed, read-only and batched
  -> compiled renderer plus persisted page manifest
  -> validated generation containing HTML and sitemap
  -> atomic publication for Nginx

React starts with the same embedded snapshot and then refreshes live offers.
~~~

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

## 1. Catalog export and offer interpretation

Extend the existing keyset-paginated prerender feed. Its response remains backward compatible and includes the existing approved offers, language, and existing timestamps. Read in batches of 200; cap exports at a fixed maximum item ID captured at the start. Reject duplicate IDs, malformed records, non-advancing cursors, missing pages, and unexpected empty exports.

Use batch SQL to supply supporting relationships. Avoid one HTTP request or query per game. Source related-game ordering and expansion relationships from existing application rules, so SSR and the live page agree.

Expose language from the existing store_items.language column. Keep unknown language explicit. Existing fields such as last_updated and last_seen_at have broader operational meanings; verify which field records successful product refresh before labelling any value as a price-check time. A renderer's generation time must be described only as the comparison publication time.

Use one shared offer policy for visible summaries and JSON-LD:

- A price must be finite, strictly positive, and have an explicit supported currency.
- A link must be a public HTTP(S) listing URL.
- Store and listing eligibility follow confirmed LISTED records and active-store rules.
- Bundles remain visibly separate and do not enter the base-game price summary.
- Unknown availability remains unknown; do not manufacture InStock from absence of evidence.
- Available, unavailable, and out-of-stock states remain distinguishable.
- Cheapest-price summaries use only eligible available offers in the same currency and state that shipping is excluded unless shipping is known.
- Keep historical/out-of-stock visible cards where current UI policy permits them; they do not become available-price claims.

## 2. Game HTML, wording, and structured data

Render the offer cards, comparison summary, related-game links, and expansion links into the initial document. Embed that exact model for the first React render. Fetch current data after hydration and update the visible offers and JSON-LD together.

Product title:

    {game name}: compara precios en México | Ludo Radar

Product description:

    Compara precios de {game name} en tiendas de México. Consulta ofertas y disponibilidad y encuentra dónde comprarlo.

Keep the game-name H1. Use a comparison section heading:

    Precios de {game name} en tiendas de México

Homepage description:

    Compara precios de juegos de mesa en tiendas de México. Consulta disponibilidad, descubre juegos y encuentra dónde comprarlos.

Preserve game descriptions, facts, ratings attribution, and existing user navigation. Unknown and zero-offer cases display accurate explanatory text; they do not invent prices or automatically become noindex.

Emit Product.offers using individual Offer records from the eligible visible listings, with the actual seller, listing URL, price, currency, and availability when known. The site is a comparison service, not the seller.

Do not initially aggregate all records into one low/high range: the current public contract does not identify editions consistently. AggregateOffer is permitted only when the same product/edition and currency are established. Language alone is insufficient to prove edition equality. Ambiguous or incompatible listings are excluded from pricing markup rather than assigned invented identity. Product pages with no eligible offers can remain indexable without price-rich-result eligibility. Do not republish BoardGameGeek ratings as native user reviews.

## 3. Crawlable catalog and category navigation

Add static, first-class routes:

- /juegos-de-mesa: catalog page 1.
- /juegos-de-mesa/pagina/:page: subsequent catalog pages.
- /categorias: a directory of existing nonempty categories.
- /categoria/:id/:slug: category page 1.
- /categoria/:id/:slug/pagina/:page: subsequent category pages.

Use 48 games per page, deterministic name/ID ordering, ordinary anchor links for next/previous and numbered pages, and self-canonicals on every valid page. Redirect explicit page 1 to its root. Nonpositive, malformed, or out-of-range pages return 404; they do not duplicate page 1.

Generate each nonempty category from existing taxonomy and eligible catalog membership. Give it a factual Spanish heading/intro, its category name, game count, game links, and the same price-summary rules. Do not generate arbitrary category-mechanic-price-filter combinations.

Add links from the homepage and navigation to the catalog and category directory, from product categories to their canonical category pages, and from category pages to every eligible member through pagination. Expand prerender context and route matching to support these pages safely.

The catalog supplies a complete fallback discovery path even for games without categories. A static link crawler starting at the homepage must reach every eligible game without JavaScript, form submission, or scrolling.

## 4. Refresh, publication, and sitemap state

Separate application compilation from HTML generation. Retain the compiled renderer outside the Nginx document root, versioned with its template, dependencies, and UI commit.

Approved refresh interval: 24 hours. This interval republishes already-collected catalog data; it does not change the once-daily item update schedule. Do not shorten the interval automatically.

A single systemd timer invokes a bounded worker once every 24 hours. The worker and deployment process share an exclusive lock. Set a 10-minute worker deadline; overlapping runs skip rather than pile up. Use sequential export/rendering, Nice=10, CPUQuota=50% (half of one CPU), MemoryHigh=320M, MemoryMax=384M, and a 256 MB Node old-space limit. The verified public VM has 2 CPUs and approximately 1 GB RAM. Measure a complete run under these limits before enabling the timer; do not increase resource consumption automatically if it fails. Emit start/completion/failure, source counts, rendered/reused/removed page counts, duration, generation ID, and UI SHA to the journal and local status file. No recurring user-message automation is created.

Fetch the complete bounded export first. Calculate a fingerprint of meaningful content for each page: game facts, eligible offer prices and availability, relevant store facts, and internal links. Preserve unchanged HTML and lastmod. Exclude export timestamps, polling timestamps, and unchanged source-check timestamps from the significant-change hash.

Use a persisted manifest outside the public document root to track path, fingerprint, last significant publication time, and renderer version. New or changed pages get the successful publication timestamp as lastmod; unchanged pages retain it. A code release that changes rendered content invalidates the affected pages.

Build changed HTML and sitemap into a staged generation. Validate canonical paths, indexing policy, JSON-LD, link targets, and export completeness before switching the Nginx-visible generation atomically. Keep the previous complete generation for rollback. Retain preceding hashed assets for browser sessions spanning a deployment.

On API, validation, or rendering failure, leave the prior generation live and record the failure. Show an honest publication timestamp; do not claim last-known prices are guaranteed current. A subsequent successful run reconciles changes. Refresh failures must be visible in operational status; static hosting alone cannot guarantee freshness during a prolonged worker outage.

Remove obsolete static paths and sitemap entries only after a complete successful export. Handle changed game slugs with a canonical resolver rather than presenting unrelated homepage content. Genuine missing games should have an explicit missing-page response; changes to the current invalid-game redirect policy must be narrowly scoped and regression tested.

Sitemaps include only valid canonical indexable homepage, game, catalog, and category pages with accurate lastmod. Keep the existing sitemap.xml URL. No priority or changefreq fields.

## Validation and rollout

Implement and review in dependent milestones: export/policy; refresh infrastructure; game output; catalog navigation; integrated deployment. Do not enable a scheduled worker before its validated publication path and refresh-safe templates are ready.

Tests must cover actual API responses, actual renderer HTML, matching first client render, schema price/availability accuracy, zero/invalid/ambiguous offers, pagination boundary routing, static graph reachability, unchanged lastmod, add/update/remove reconciliation, failed exports, concurrent runs, and rollback.

Run the UI and service suites and production builds. Deploy service first, then stage the matching UI/runtime and Nginx routing, validate and publish, and enable the timer. Verify exact deployed SHAs and a real refresh cycle. Use Google's live inspection and Rich Results Test on representative eligible products and a category page; sitemap submission and sample recrawl requests follow successful publication.

Success means discoverable, accurate, refreshable pages and successful technical checks. New Google indexing and rankings are measured outcomes, not deployment guarantees.

## References

- Google product snippets and shopping aggregators: https://developers.google.com/search/docs/appearance/structured-data/product-snippet
- Google crawlable pagination: https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading
- Google sitemap lastmod: https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
