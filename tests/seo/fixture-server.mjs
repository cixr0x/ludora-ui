import { createServer } from "node:http";
import { once } from "node:events";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createServer as createViteServer } from "vite";
import { item, publishedAt, catalogFixtures } from "./fixtures.mjs";
import assert from "node:assert/strict";
import { buildCatalogIndex, catalogPageDescriptors, catalogPageModel } from "../../src/app/utils/catalogSeo.js";
import { apiMinimumPrice } from "../../src/app/utils/offerSeo.js";

export async function startFixtureServer({ catalog = false } = {}) {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const vite = await createViteServer({ root, server: { middlewareMode: true, hmr: false }, appType: "custom" });
  const { renderProductDocument, renderCatalogDocument, renderHomepageDocument } = await vite.ssrLoadModule("/src/entry-server.tsx");
  let template = await readFile(new URL("../../index.html", import.meta.url), "utf8");
  // Development main.tsx injects CSS through JavaScript. Serve the same CSS
  // explicitly so this fixture also supports styled JavaScript-disabled QA.
  template = template.replace("</head>", '<link rel="stylesheet" href="/src/styles/index.css?direct"></head>');
  if (catalog) template = template.replace("noindex, nofollow", "index, follow");
  // React 18's development SSR reports Router's useLayoutEffect. The production
  // retained renderer is compiled with NODE_ENV=production; only that known
  // server diagnostic is expected here. Browser hydration errors remain fatal.
  const originalError = console.error;
  const unexpectedErrors = [];
  console.error = (message, ...args) => {
    if (String(message).startsWith("Warning: useLayoutEffect does nothing on the server")) return;
    unexpectedErrors.push(String(message)); originalError(message, ...args);
  };
  let html;
  const documents = new Map(), records = catalog ? catalogFixtures() : [item];
  try {
    html = renderProductDocument({ item, template, publishedAt }).document;
    if (catalog) {
      const index = buildCatalogIndex(records.map(record => ({ id: record.id, name: record.canonical_name,
        canonicalPath: record.canonical_path, categories: record.categories, image: "", minimumPrice: apiMinimumPrice(record.offers) })));
      documents.set("/", renderHomepageDocument({ template, featuredGames: records.slice(0, 8).map(record => ({ id: record.id, name: record.canonical_name })) }));
      for (const descriptor of catalogPageDescriptors(index)) {
        const model = { ...catalogPageModel(index, descriptor), indexingEnabled: true };
        documents.set(model.canonicalPath, renderCatalogDocument({ model, template }).document.replace("</body>", '<script>window.fetchedHtmlExecutions=(window.fetchedHtmlExecutions||0)+1</script></body>'));
      }
      for (const record of records) documents.set(record.canonical_path, renderProductDocument({ item: record, template, publishedAt }).document);
    }
  }
  finally { console.error = originalError; }
  assert.deepEqual(unexpectedErrors, [], "SSR must emit no unexpected errors");
  const artifact = new URL(`../../.superpowers/sdd/2026-09-07-price-comparison-seo/task-${catalog ? 4 : 3}-fixture.html`, import.meta.url);
  await mkdir(new URL(".", artifact), { recursive: true });
  await writeFile(artifact, catalog ? documents.get("/juegos-de-mesa") : html);
  const server = createServer(async (req, res) => {
    if (req.url?.startsWith("/api/")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      const id = req.url.match(/^\/api\/items\/(\d+)$/)?.[1];
      const data = id ? records.find(record => record.id === Number(id)) : [];
      res.end(JSON.stringify({ data }));
    } else if (catalog) {
      const gameId = req.url?.match(/^\/game\/([1-9][0-9]*)(?:\/[a-z0-9-]+)?\/?$/)?.[1];
      const game = gameId ? records.find(record => record.id === Number(gameId)) : undefined;
      if (game && req.url !== game.canonical_path) {
        res.writeHead(301, { Location: game.canonical_path }); res.end(); return;
      }
      if (req.url === "/categoria/7/antigua/pagina/2") {
        res.writeHead(301, { Location: "/categoria/7/estrategia/pagina/2" }); res.end(); return;
      }
      const pathname = new URL(req.url, "http://localhost").pathname;
      const document = documents.get(pathname) ?? (["/search", "/privacidad", "/terminos"].includes(pathname) ? documents.get("/") : undefined);
      if (document) {
        res.writeHead(200, { "Content-Type": "text/html" }); res.end(await vite.transformIndexHtml(req.url, document));
      } else vite.middlewares(req, res, () => { res.writeHead(404); res.end(); });
    } else if (req.url?.startsWith("/game/") || ["/search", "/privacidad", "/terminos"].includes(req.url)) {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(await vite.transformIndexHtml(req.url, html));
    } else vite.middlewares(req, res, () => { res.writeHead(404); res.end(); });
  });
  try { server.listen(5175, "127.0.0.1"); await once(server, "listening"); }
  catch (error) { await vite.close(); throw error; }
  return { artifact: fileURLToPath(artifact), async close() { server.closeAllConnections(); server.close(); await once(server, "close"); await vite.close(); } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const fixture = await startFixtureServer({ catalog: process.argv.includes("--catalog") });
  console.log(`SEO fixture http://127.0.0.1:5175${process.argv.includes("--catalog") ? "/juegos-de-mesa" : "/game/851/dixit"} (${fixture.artifact})`);
  for (const signal of ["SIGTERM", "SIGINT"]) process.once(signal, async () => { await fixture.close(); process.exit(0); });
}
