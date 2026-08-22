import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { build } from "vite";

import { DEFAULT_SITE_URL } from "../src/app/utils/siteSeo.js";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const distDir = resolve(projectRoot, "dist");
const serverOutDir = resolve(distDir, ".prerender");
const serverEntry = resolve(serverOutDir, "entry-server.mjs");
const apiOrigin = (process.env.LUDORA_PRERENDER_API_ORIGIN ?? "http://127.0.0.1:4000").replace(/\/+$/, "");
const siteUrl = process.env.LUDORA_SITE_URL ?? DEFAULT_SITE_URL;
const pageSize = 200;
const pageConcurrency = 2;

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
  const template = await readFile(resolve(distDir, "index.html"), "utf8");
  const { renderProductDocument } = await import(`${pathToFileURL(serverEntry).href}?v=${Date.now()}`);
  const items = await fetchPrerenderItems();

  for (const item of items) {
    const rendered = renderProductDocument({ item, siteUrl, template });
    const outputPath = resolve(distDir, `.${rendered.canonicalPath}.html`);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, rendered.document, "utf8");
  }

  process.stdout.write(`Prerendered ${items.length} product pages from ${apiOrigin}.\n`);
} finally {
  await rm(serverOutDir, { recursive: true, force: true });
}

async function fetchPrerenderItems() {
  let endpoint = "prerender";
  let firstPage = await fetchCatalogPage(endpoint, 0);
  if (firstPage.status === 400 || firstPage.status === 404) {
    endpoint = "";
    firstPage = await fetchCatalogPage(endpoint, 0);
    process.stdout.write("Prerender API feed is unavailable; using the compatible catalog feed.\n");
  }
  const items = [...firstPage.data];
  if (firstPage.data.length < pageSize) return items;

  for (let offset = pageSize; offset <= 100000; offset += pageSize * pageConcurrency) {
    const pages = await Promise.all(
      Array.from({ length: pageConcurrency }, (_, index) => fetchCatalogPage(endpoint, offset + index * pageSize)),
    );
    for (const page of pages) {
      items.push(...page.data);
      if (page.data.length < pageSize) return items;
    }
    if (items.length % 1000 === 0) process.stdout.write(`Fetched ${items.length} products for prerendering.\n`);
  }

  throw new Error("Prerender catalog exceeded the supported 100000 item range");
}

async function fetchCatalogPage(endpoint, offset) {
  const endpointPath = endpoint ? `/api/items/${endpoint}` : "/api/items";
  const response = await fetch(`${apiOrigin}${endpointPath}?limit=${pageSize}&offset=${offset}`);
  if (!response.ok && response.status !== 400 && response.status !== 404) {
    throw new Error(`Prerender catalog request failed with ${response.status}: ${response.url}`);
  }

  const envelope = await response.json();
  if (response.ok && !Array.isArray(envelope.data)) {
    throw new Error(`Prerender catalog response did not contain a data array: ${response.url}`);
  }

  return {
    data: Array.isArray(envelope.data) ? envelope.data : [],
    status: response.status,
  };
}
