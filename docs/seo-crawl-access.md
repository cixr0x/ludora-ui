# Public crawl access

`npm run build:indexable` emits crawlable homepage, product, 48-game catalog,
category directory and paginated category HTML. Its generated
`robots.txt` blocks `/api/` except the browser reads needed to render those pages:

- `/api/front-page` and `/api/items/filter-options` use exact, end-anchored rules.
- `/api/items/1` through `/api/items/9` are positive item-ID prefixes. They cover
  item detail, related games and expansions, including the client's `?limit=` query.

Robots syntax supports `*` and `$`, not numeric character classes. These prefixes
therefore also cover any future digit-leading item paths. Review this policy before
adding other routes under those prefixes. Named catalog, summary, search-results,
prerender and semantic-search endpoints remain blocked. Public API responses retain
their service-owned `X-Robots-Tag: noindex, nofollow`; crawl access lets the renderer
read JSON without making that JSON an indexable page.

The default build still blocks all crawling. The indexable sitemap contains only
the selected generation's canonical pages, each with its own significant-content
`lastmod`; unchanged data and volatile fetch timestamps do not advance it. See
[Google's robots.txt matching rules](https://developers.google.com/crawling/docs/robots-txt/robots-txt-spec#url-matching-based-on-path-values).

The homepage document is also the SPA fallback for search, browse and legal routes.
Only `/` hydrates embedded homepage markup; fallback routes reject mismatched
snapshots and reset stale metadata before mounting their own page. Products and
catalogs hydrate only matching snapshots. Generated catalog navigation reads inert
same-origin HTML payloads without executing fetched scripts, follows published
redirects, and updates URL/metadata together. Search and legal routes stay noindex.

Category landing pages reuse the Explore interface with their route category
selected. They remain HTTP 200, indexable and self-canonical, including pagination;
the category directory and sitemap entries remain published. Their initial HTML
contains the exact 48-game slice and real product/pagination anchors, with Explore's
image/name card design. Hydration preserves that slice until a filter is edited.
Changing/removing the category or adding filters opens `/search?...`, which remains
`noindex, follow`. Player, playtime and complexity selections survive that transition
and reload through `players`, `playtimes` and `complexity_min`/`complexity_max` URL
parameters. Product pages and the all-games catalog retain price-comparison content;
undisplayed price changes do not advance category-page `lastmod`.

Private generation route registries drive canonical aliases. A newer database name
cannot redirect to an unpublished path; malformed, absent and out-of-range targets
return true 404 responses. The daily worker updates complete generations atomically
using one bulk export. See [refresh operations](seo-refresh-operations.md) for the
exact-SHA deployment, cgroup gate, daily timer and rollback procedures.
