import { createServer } from "node:http";
import { once } from "node:events";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createServer as createViteServer } from "vite";
import { item, publishedAt } from "./fixtures.mjs";
import assert from "node:assert/strict";

export async function startFixtureServer() {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const vite = await createViteServer({ root, server: { middlewareMode: true, hmr: false }, appType: "custom" });
  const { renderProductDocument } = await vite.ssrLoadModule("/src/entry-server.tsx");
  const template = await readFile(new URL("../../index.html", import.meta.url), "utf8");
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
  try { html = renderProductDocument({ item, template, publishedAt }).document; }
  finally { console.error = originalError; }
  assert.deepEqual(unexpectedErrors, [], "SSR must emit no unexpected errors");
  const artifact = new URL("../../.superpowers/sdd/2026-09-07-price-comparison-seo/task-3-fixture.html", import.meta.url);
  await mkdir(new URL(".", artifact), { recursive: true });
  await writeFile(artifact, html);
  const server = createServer(async (req, res) => {
    if (req.url?.startsWith("/api/")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ data: req.url === "/api/items/851" ? item : [] }));
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
  const fixture = await startFixtureServer();
  console.log(`SEO fixture http://127.0.0.1:5175/game/851/dixit (${fixture.artifact})`);
  for (const signal of ["SIGTERM", "SIGINT"]) process.once(signal, async () => { await fixture.close(); process.exit(0); });
}
