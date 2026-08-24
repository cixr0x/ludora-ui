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
  const crawlRule = indexingEnabled ? "Disallow: /api/" : "Disallow: /";
  return `User-agent: *\n${crawlRule}\nSitemap: ${sitemapUrl}\n`;
}

export function sitemapDocument({ canonicalPaths, siteUrl }) {
  const rootUrl = new URL(siteRootUrl(siteUrl));
  const urls = new Set([rootUrl.href]);

  for (const canonicalPath of canonicalPaths) {
    if (typeof canonicalPath !== "string" || !canonicalPath.startsWith("/") || canonicalPath.startsWith("//")) {
      throw new Error(`Sitemap canonical paths must be root-relative: ${canonicalPath}`);
    }

    const canonicalUrl = new URL(canonicalPath, rootUrl);
    if (canonicalUrl.origin !== rootUrl.origin) {
      throw new Error(`Sitemap canonical path escaped the configured origin: ${canonicalPath}`);
    }
    urls.add(canonicalUrl.href);
  }

  const entries = Array.from(urls, (url) => `  <url><loc>${escapeXml(url)}</loc></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
}

function escapeXml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
