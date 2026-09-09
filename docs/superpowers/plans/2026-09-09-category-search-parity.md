# Category landing and Search interface parity

Approved scope: category URLs use the ordinary Explore/Search live results and infinite scrolling. Retain their self-canonical indexable server document, initial product anchors and hidden SEO heading/description/pagination. Keep the category URL during loading/scrolling; filter changes keep the existing Search handoff. No service, SQL, deployment, refresh schedule or resource-limit changes.

- [x] Measure deployed desktop/mobile category versus equivalent Search: visible content/layout, card data/order/count, controls and scroll requests.
- [x] Add failing real-browser visible-DOM parity and identical infinite-loading tests on both viewports, including page-two category URLs. Retain independent SSR/no-JS/metadata/hydration checks.
- [x] Use the ordinary Search result state from the initial loading frame. Remove category-specific request/append suppression and use Search's ordinary page size, ordering, data and loading sentinel.
- [x] Move the unique heading/description, published product-link slice and crawlable pagination into a native hidden SEO fallback block. Preserve canonical metadata without adding a second visible result implementation.
- [x] Update obsolete publication-only browser expectations and supply realistic bounded search responses in the existing fixture. Run focused RED/GREEN, full UI/browser suites and production build; inspect desktop/mobile screenshots, self-review, commit and report.
