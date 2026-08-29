import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { createServer as createViteServer } from "vite";

const projectRoot = fileURLToPath(new URL("../../../", import.meta.url));
const template = readFileSync(new URL("../../../index.html", import.meta.url), "utf8");

test("the build rejects a malformed homepage feed before generating a blank featured section", async () => {
  const server = createServer((request, response) => {
    if (request.url === "/api/front-page") {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ data: [{ products: "not-an-array" }] }));
      return;
    }

    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ data: [], meta: { pagination: "keyset" } }));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  try {
    const { port } = server.address();
    const result = await runBuild(`http://127.0.0.1:${port}`);

    assert.notEqual(result.exitCode, 0);
    assert.match(result.output, /Homepage prerender row 0 products must be an array/);
  } finally {
    server.close();
    await once(server, "close");
  }
});

test("homepage first render is unchanged when the Ludoscopio callout was dismissed", async () => {
  const vite = await createViteServer({ root: projectRoot, server: { middlewareMode: true }, appType: "custom" });
  const originalWindow = globalThis.window;
  const originalConsoleError = console.error;

  try {
    console.error = (message, ...args) => {
      if (typeof message === "string" && message.startsWith("Warning: useLayoutEffect does nothing on the server")) {
        return;
      }
      originalConsoleError(message, ...args);
    };
    const { renderHomepageDocument } = await vite.ssrLoadModule("/src/entry-server.tsx");
    const featuredGames = [{ id: 4, name: "Fourth" }];
    const withoutSessionStorage = renderHomepageDocument({ featuredGames, template });

    globalThis.window = {
      sessionStorage: {
        getItem: () => "1",
      },
    };
    const withDismissedCallout = renderHomepageDocument({ featuredGames, template });

    assert.equal(rootMarkup(withDismissedCallout), rootMarkup(withoutSessionStorage));
    assert.match(withDismissedCallout, /<h1[^>]*>Juegos de mesa en México<\/h1>/);
    assert.match(withDismissedCallout, /href="\/game\/4\/fourth"/);
  } finally {
    console.error = originalConsoleError;
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
    await vite.close();
  }
});

function rootMarkup(document) {
  return document.match(/<div id="root">([\s\S]*)<\/div><script id="ludo-radar-prerender-data"/)?.[1] ?? "";
}

async function runBuild(apiOrigin) {
  const child = spawn(process.execPath, ["scripts/build.mjs"], {
    cwd: projectRoot,
    env: { ...process.env, LUDORA_PRERENDER_API_ORIGIN: apiOrigin },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk;
  });
  child.stderr.on("data", (chunk) => {
    output += chunk;
  });

  const [exitCode] = await once(child, "close");
  return { exitCode, output };
}
