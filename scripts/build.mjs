import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { build } from "vite";

import {
  applyIndexingPolicy,
  parseIndexingEnabled,
  robotsDocument,
  sitemapDocument,
} from "./seo-output.mjs";
import { DEFAULT_SITE_URL } from "../src/app/utils/siteSeo.js";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const distDir = resolve(projectRoot, "dist");
const serverOutDir = resolve(distDir, ".prerender");
const serverEntry = resolve(serverOutDir, "entry-server.mjs");
const apiOrigin = (process.env.LUDORA_PRERENDER_API_ORIGIN ?? "http://127.0.0.1:4000").replace(/\/+$/, "");
const siteUrl = process.env.LUDORA_SITE_URL ?? DEFAULT_SITE_URL;
const indexingEnabled = parseIndexingEnabled(process.env.LUDORA_INDEXING_ENABLED);
const pageSize = 200;

await build({ root: projectRoot });
await build({
  root: projectRoot,
  build: {
    emptyOutDir: true,
    outDir: serverOutDir,
    rollupOptions: {
      output: {
        entryFileNames: "entry-server.mjs",
      },
    },
    ssr: resolve(projectRoot, "src/entry-server.tsx"),
  },
});

try {
  const templatePath = resolve(distDir, "index.html");
  const template = applyIndexingPolicy(await readFile(templatePath, "utf8"), indexingEnabled);
  await writeFile(templatePath, template, "utf8");
  const { renderProductDocument } = await import(`${pathToFileURL(serverEntry).href}?v=${Date.now()}`);
  const items = await fetchPrerenderItems();
  const canonicalPaths = [];
  const renderedPaths = new Map();

  for (const item of items) {
    const rendered = renderProductDocument({ item, siteUrl, template });
    const previousItemId = renderedPaths.get(rendered.canonicalPath);
    if (previousItemId !== undefined) {
      throw new Error(
        `Duplicate canonical path ${rendered.canonicalPath} for prerender items ${previousItemId} and ${item.id}`,
      );
    }
    renderedPaths.set(rendered.canonicalPath, item.id);
    canonicalPaths.push(rendered.canonicalPath);
    const outputPath = resolve(distDir, `.${rendered.canonicalPath}.html`);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, rendered.document, "utf8");
  }

  await Promise.all([
    writeFile(resolve(distDir, "robots.txt"), robotsDocument({ indexingEnabled, siteUrl }), "utf8"),
    writeFile(resolve(distDir, "sitemap.xml"), sitemapDocument({ canonicalPaths, siteUrl }), "utf8"),
  ]);

  process.stdout.write(`Prerendered ${items.length} product pages from ${apiOrigin}.\n`);
  process.stdout.write(`Generated ${indexingEnabled ? "indexable" : "blocked"} robots and sitemap output for ${siteUrl}.\n`);
} finally {
  await rm(serverOutDir, { recursive: true, force: true });
}

async function fetchPrerenderItems() {
  let firstPage = await fetchCatalogPage("prerender", { afterId: 0 });
  if (firstPage.status === 400 || firstPage.status === 404) {
    firstPage = await fetchCatalogPage("", { offset: 0 });
    process.stdout.write("Prerender API feed is unavailable; using the compatible catalog feed.\n");
    return fetchOffsetItems("", firstPage);
  }

  if (firstPage.meta?.pagination !== "keyset") {
    process.stdout.write("Prerender API does not support keyset pagination; using compatible offset pagination.\n");
    return fetchOffsetItems("prerender", firstPage);
  }

  return fetchKeysetItems(firstPage);
}

async function fetchKeysetItems(firstPage) {
  const items = [];
  const seenIds = new Set();
  let afterId = 0;
  let page = firstPage;

  while (items.length <= 100000) {
    let lastId = afterId;
    for (const item of page.data) {
      const itemId = Number(item.id);
      if (!Number.isInteger(itemId) || itemId <= lastId || seenIds.has(itemId)) {
        throw new Error(`Prerender keyset page returned an invalid or repeated item id: ${item.id}`);
      }
      seenIds.add(itemId);
      lastId = itemId;
      items.push(item);
    }

    if (page.data.length < pageSize) return items;
    const nextAfterId = Number(page.meta?.next_after_id);
    if (!Number.isInteger(nextAfterId) || nextAfterId !== lastId) {
      throw new Error(`Prerender API returned an invalid next_after_id after ${afterId}: ${page.meta?.next_after_id}`);
    }

    afterId = nextAfterId;
    if (Math.floor(items.length / 1000) > Math.floor((items.length - page.data.length) / 1000)) {
      process.stdout.write(`Fetched ${items.length} products for prerendering.\n`);
    }
    page = await fetchCatalogPage("prerender", { afterId });
  }

  throw new Error("Prerender catalog exceeded the supported 100000 item range");
}

async function fetchOffsetItems(endpoint, firstPage) {
  const items = [...firstPage.data];
  if (firstPage.data.length < pageSize) return items;

  for (let offset = pageSize; offset <= 100000; offset += pageSize) {
    const page = await fetchCatalogPage(endpoint, { offset });
    items.push(...page.data);
    if (page.data.length < pageSize) return items;
    if (items.length % 1000 === 0) process.stdout.write(`Fetched ${items.length} products for prerendering.\n`);
  }

  throw new Error("Prerender catalog exceeded the supported 100000 item range");
}

async function fetchCatalogPage(endpoint, { afterId, offset }) {
  const endpointPath = endpoint ? `/api/items/${endpoint}` : "/api/items";
  const query = new URLSearchParams({ limit: String(pageSize) });
  if (afterId !== undefined) query.set("after_id", String(afterId));
  else query.set("offset", String(offset ?? 0));
  const response = await fetch(`${apiOrigin}${endpointPath}?${query}`);
  if (!response.ok && response.status !== 400 && response.status !== 404) {
    throw new Error(`Prerender catalog request failed with ${response.status}: ${response.url}`);
  }

  const envelope = await response.json();
  if (response.ok && !Array.isArray(envelope.data)) {
    throw new Error(`Prerender catalog response did not contain a data array: ${response.url}`);
  }

  return {
    data: Array.isArray(envelope.data) ? envelope.data : [],
    meta: envelope && typeof envelope.meta === "object" ? envelope.meta : {},
    status: response.status,
  };
}
