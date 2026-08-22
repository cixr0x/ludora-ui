import { renderToString } from "react-dom/server";
import { createMemoryRouter } from "react-router";

import App from "./app/App";
import type { ApiItem } from "./app/api/catalog";
import { mapApiItemToDetail } from "./app/data/catalog";
import { routeDefinitions } from "./app/routes";
import { productSeoMetadata } from "./app/utils/productSeo.js";
import { productPath } from "./app/utils/productRoutes.js";
import { DEFAULT_SITE_URL } from "./app/utils/siteSeo.js";

export function renderProductDocument({
  item,
  siteUrl = DEFAULT_SITE_URL,
  template,
}: {
  item: ApiItem;
  siteUrl?: string;
  template: string;
}): { canonicalPath: string; document: string } {
  const detail = mapApiItemToDetail({ ...item, offers: [] });
  const canonicalPath = productPath(detail.id, detail.name);
  if (item.canonical_path && item.canonical_path !== canonicalPath) {
    throw new Error(
      `API canonical path ${item.canonical_path} does not match UI path ${canonicalPath} for item ${detail.id}`,
    );
  }

  const prerenderData = { product: detail };
  const router = createMemoryRouter(routeDefinitions, { initialEntries: [canonicalPath] });
  const appHtml = renderToString(<App prerenderData={prerenderData} router={router} />);
  const metadata = productSeoMetadata(detail, siteUrl);
  const rootMarkup = `<div id="root">${appHtml}</div><script id="ludo-radar-prerender-data" type="application/json">${serializeJsonForHtml(prerenderData)}</script>`;

  let document = template.replace(/<div id="root"><\/div>/, rootMarkup);
  if (document === template) {
    throw new Error("Could not find the root element in the built HTML template");
  }

  document = replaceTitle(document, metadata.title);
  document = replaceMeta(document, "name", "description", metadata.description);
  document = replaceMeta(document, "property", "og:title", metadata.title);
  document = replaceMeta(document, "property", "og:description", metadata.description);
  document = replaceMeta(document, "property", "og:type", "product");
  document = replaceMeta(document, "property", "og:url", metadata.canonicalUrl);
  document = replaceMeta(document, "name", "twitter:card", metadata.imageUrl ? "summary_large_image" : "summary");
  document = replaceMeta(document, "name", "twitter:title", metadata.title);
  document = replaceMeta(document, "name", "twitter:description", metadata.description);
  document = replaceCanonical(document, metadata.canonicalUrl);

  const productHead = [
    metadata.imageUrl
      ? `<meta property="og:image" content="${escapeHtmlAttribute(metadata.imageUrl)}" />`
      : "",
    metadata.imageUrl
      ? `<meta name="twitter:image" content="${escapeHtmlAttribute(metadata.imageUrl)}" />`
      : "",
    `<script id="product-structured-data" type="application/ld+json">${serializeJsonForHtml(metadata.structuredData)}</script>`,
  ]
    .filter(Boolean)
    .join("\n      ");

  document = document.replace("</head>", `      ${productHead}\n    </head>`);
  return { canonicalPath, document };
}

function replaceTitle(document: string, title: string): string {
  return document.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtmlText(title)}</title>`);
}

function replaceMeta(
  document: string,
  attribute: "name" | "property",
  key: string,
  content: string,
): string {
  const pattern = new RegExp(`<meta\\s+${attribute}="${escapeRegExp(key)}"\\s+content="[^"]*"\\s*\\/>`);
  const replacement = `<meta ${attribute}="${key}" content="${escapeHtmlAttribute(content)}" />`;
  if (pattern.test(document)) return document.replace(pattern, replacement);
  return document.replace("</head>", `      ${replacement}\n    </head>`);
}

function replaceCanonical(document: string, href: string): string {
  const pattern = /<link\s+rel="canonical"\s+href="[^"]*"\s*\/>/;
  const replacement = `<link rel="canonical" href="${escapeHtmlAttribute(href)}" />`;
  if (pattern.test(document)) return document.replace(pattern, replacement);
  return document.replace("</head>", `      ${replacement}\n    </head>`);
}

function serializeJsonForHtml(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function escapeHtmlAttribute(value: string): string {
  return escapeHtmlText(value).replace(/"/g, "&quot;");
}

function escapeHtmlText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
