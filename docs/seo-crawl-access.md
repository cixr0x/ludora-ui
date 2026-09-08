# Public crawl access

`npm run build:indexable` emits crawlable homepage and product HTML. Its generated
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

The default build still blocks all crawling. Sitemap and canonical URLs keep their
existing behavior. See [Google's robots.txt matching rules](https://developers.google.com/crawling/docs/robots-txt/robots-txt-spec#url-matching-based-on-path-values).

The homepage document is also the SPA fallback for search, browse and legal routes.
Only `/` hydrates embedded homepage markup; fallback routes clear it and mount their
own page. Product documents keep their existing hydration path.
