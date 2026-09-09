# Category Explore Interface Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans and test-driven-development. The existing implementer/reviewer pair owns this bounded change; do not spawn additional agents.

**Goal:** Keep category landing pages as HTTP 200, indexable, self-canonical publications while displaying the existing Explore interface with the route category selected.

**Architecture:** Preserve the generation model, private route registry, sitemap and Nginx behavior. Let the existing category publication loader render the shared `Search` component with its route-bound compact page data; do not copy the filters or result grid. Keep the published 48-card slice and real pagination anchors stable through SSR/hydration. Filter edits leave the landing route for `/search?...`, which remains `noindex, follow`.

**Tech stack:** React, React Router, Vite SSR, node:test, existing Chrome/Playwright fixtures.

**Approved scope:** User/controller instruction on 2026-09-08 supersedes the abandoned redirect proposal. `/categorias`, catalog and product pages remain unchanged. No service/Nginx edits, SQL, deploy, push or resource-policy changes are planned.

## Implementation and verification

- [x] Add behavioral SSR/browser regressions before production edits: category/page-two titles, canonical/indexability, Explore controls and selected category, crawlable product/pagination anchors, stable hydration despite cached semantic searches, and absence of the separate category catalog presentation.
- [x] Add filter URL state regressions for removing/changing categories and adding text, mechanics, players, playtime and complexity. Verify navigation to `/search`, noindex metadata, and filter persistence after reload.
- [x] Run the new tests and retain expected RED evidence in the ignored audit folder.
- [x] Update `src/app/components/CatalogPage.tsx` to reuse `src/app/pages/Search.tsx` for category models. Keep its validated inert-payload loading, missing-target handling, canonical redirects and category metadata.
- [x] Extend the shared Search interface with optional published-category data. Its existing results grid renders image/name cards and canonical product links, without the separate catalog price-summary line; category pages retain real pagination. Disable live search replacement/infinite loading until a filter edit moves to Search. Load normal filter options without dropping the selected route category. Omit undisplayed category prices from the compact model/fingerprint so price-only changes do not advance category lastmod; all-games catalog/product price content remains unchanged.
- [x] Reuse existing filter URL helpers and add a small validated parser for numeric/time filter state if needed. Route every filter edit through the same transition boundary; preserve ordinary Search and semantic search behavior.
- [x] Keep generation descriptors, sitemap membership, private route inventory and service/Nginx code unchanged. Update existing browser assertions to recognize the shared category result grid while retaining metadata/navigation checks.
- [x] Run focused SSR/filter/browser tests; run the complete UI suite and client build once final source is ready because shared Search and SSR paths change. Existing compiled reconciliation coverage must still prove category sitemap/HTML/route consistency and failed-export preservation.
- [x] Inspect desktop/mobile category fixture screenshots, self-review, commit only intentional UI changes, and write exact SHA, RED/GREEN, files and remaining deployment gates to an audit report. Root owns review/integration/production.

## Edge cases

- Direct category and pagination requests hydrate the exact published slice rather than an empty/client-reordered list.
- A cached Ludoscopio session must not replace a category landing page or cause hydration mismatch.
- Wrong slugs continue resolving through the existing published routing boundary; unknown/unpublished pages retain their current failure behavior.
- Query parameters on a category URL transfer to the corresponding Search URL; arbitrary filtered variants never gain a category canonical/indexable identity.
- Updating/removing the category and adding any supported filter transitions off the category URL. Filter URLs reconstruct the same controls after reload.
- `/categorias` stays an indexable directory with category landing links; all games remain reachable through the all-games catalog and real product anchors.
