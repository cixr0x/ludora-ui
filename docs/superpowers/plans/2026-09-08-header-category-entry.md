# Canonical category entry from the shared header

The deployed category landing pages work, but the homepage's visible category strip still uses `/search?category_ids=<id>`. This bypasses the approved category entry. Reuse `categoryPath({ id, name })` for those links; retain filtered Search for interactions made after entering the landing page.

- [x] Reproduce the visible homepage navigation and direct category routes in desktop/mobile Chrome; retain URLs, snapshots and screenshots.
- [x] Add failing real-browser desktop/mobile navigation coverage and update the existing source contract before implementation. Assert canonical landing, shared Explore controls, indexability, and a filter exit to persistent noindex Search retaining the category.
- [x] Replace only the header category URL construction with the existing canonical helper. Preserve ordinary header text search and Explore button behavior; no routing, generation, service or Nginx changes.
- [x] Run focused RED/GREEN, full UI and SEO browser suites, and production client build. Self-review, commit the focused files, and report evidence for root-owned review/integration. Do not push, deploy or execute SQL.
