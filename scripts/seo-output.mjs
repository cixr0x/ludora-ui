import { siteRootUrl } from "../src/app/utils/siteSeo.js";

const ROBOTS_META_PATTERN = /<meta\s+name="robots"\s+content="[^"]*"\s*\/>/g;

export function parseIndexingEnabled(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized || normalized === "false") return false;
  if (normalized === "true") return true;
  throw new Error("LUDORA_INDEXING_ENABLED must be either true or false");
}

export function applyIndexingPolicy(document, indexingEnabled) {
  const matches = document.match(ROBOTS_META_PATTERN) ?? [];
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one robots meta tag in the built template; found ${matches.length}`);
  }

  const content = indexingEnabled ? "index, follow" : "noindex, nofollow";
  return document.replace(ROBOTS_META_PATTERN, `<meta name="robots" content="${content}" />`);
}

export function robotsDocument({ indexingEnabled, siteUrl }) {
  const sitemapUrl = new URL("sitemap.xml", siteRootUrl(siteUrl)).href;
  const crawlRules = indexingEnabled
    ? [
      "Disallow: /api/",
      "Allow: /api/front-page$",
      "Allow: /api/items/filter-options$",
      // Robots.txt has no numeric character classes. Positive-ID prefixes also
      // allow related/expansion reads with ?limit= while keeping named feeds blocked.
      ...Array.from({ length: 9 }, (_, index) => `Allow: /api/items/${index + 1}`),
    ]
    : ["Disallow: /"];
  return `User-agent: *\n${crawlRules.join("\n")}\nSitemap: ${sitemapUrl}\n`;
}

export function sitemapDocument({ canonicalPaths = [], pages, siteUrl }) {
  const rootUrl = new URL(siteRootUrl(siteUrl));
  // Page records are the authoritative published set. The legacy path-only
  // interface retains its implicit homepage and duplicate-path behavior.
  if (pages !== undefined && !Array.isArray(pages)) throw new Error("Sitemap pages must be an array");
  const records = pages ?? ["/", ...canonicalPaths].map(canonicalPath => ({ canonicalPath }));
  const urls = new Map();

  for (const { canonicalPath, lastmod } of records) {
    if (typeof canonicalPath !== "string" || !canonicalPath.startsWith("/") || canonicalPath.startsWith("//")) {
      throw new Error(`Sitemap canonical paths must be root-relative: ${canonicalPath}`);
    }

    const canonicalUrl = new URL(canonicalPath, rootUrl);
    if (canonicalUrl.origin !== rootUrl.origin) {
      throw new Error(`Sitemap canonical path escaped the configured origin: ${canonicalPath}`);
    }
    if (pages !== undefined) {
      if (urls.has(canonicalUrl.href)) throw new Error(`Duplicate sitemap canonical: ${canonicalPath}`);
      if (!validLastmod(lastmod)) throw new Error(`Invalid sitemap lastmod for ${canonicalPath}`);
    }
    urls.set(canonicalUrl.href, lastmod);
  }

  const entries = Array.from(urls, ([url, lastmod]) =>
    `  <url><loc>${escapeXml(url)}</loc>${lastmod ? `<lastmod>${escapeXml(lastmod)}</lastmod>` : ""}</url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
}

function validLastmod(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value) ||
    !Number.isFinite(Date.parse(value))) return false;
  const day = value.slice(0, 10);
  return new Date(`${day}T00:00:00Z`).toISOString().startsWith(day);
}

function escapeXml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
