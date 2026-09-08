import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { transformWithEsbuild } from "vite";

const source = readFileSync(new URL("../../main.tsx", import.meta.url), "utf8");
const { code } = await transformWithEsbuild(source, "main.tsx", { format: "cjs", jsx: "automatic" });
const homepageData = { homepage: { featuredGames: [{ id: 851, name: "Dixit" }] } };

test("fallback routes replace homepage HTML before mounting their own page", () => {
  for (const pathname of ["/search", "/browse/strategy", "/privacidad", "/terminos"]) {
    assert.deepEqual(bootstrap({ pathname, data: homepageData }), ["clear", "mount"], pathname);
    assert.deepEqual(bootstrap({ pathname, data: { product: { id: 851 } } }), ["clear", "mount"], pathname);
  }
});

test("the homepage and prerendered product still hydrate their existing HTML", () => {
  assert.deepEqual(bootstrap({ pathname: "/", data: homepageData }), ["hydrate"]);
  assert.deepEqual(bootstrap({ pathname: "/game/851/dixit", data: { product: { id: 851 } } }), ["hydrate"]);
  assert.deepEqual(bootstrap({ pathname: "/game/852/another", data: { product: { id: 851 } } }), ["clear", "mount"]);
});

test("missing data or empty markup mounts normally", () => {
  assert.deepEqual(bootstrap({ pathname: "/" }), ["clear", "mount"]);
  assert.deepEqual(bootstrap({ pathname: "/", data: homepageData, hasMarkup: false }), ["clear", "mount"]);
});

test("fallback mounting rejects product context while matching hydration retains it", () => {
  const data = { product: { id: 851 } };
  for (const pathname of ["/privacidad", "/search", "/game/852/another"]) {
    let mountedData;
    bootstrap({ pathname, data, capture: value => { mountedData = value; } });
    assert.equal(mountedData, undefined, pathname);
  }
  let hydratedData;
  bootstrap({ pathname: "/game/851/dixit", data, capture: value => { hydratedData = value; } });
  assert.equal(hydratedData.product.id, 851);
});

function bootstrap({ pathname, data, hasMarkup = true, capture = () => {} }) {
  const operations = [];
  const root = {
    hasChildNodes: () => hasMarkup,
    replaceChildren: () => operations.push("clear"),
  };
  // Keep the real bootstrap decision; substitute the DOM and React entry points
  // so this regression does not require a browser or run unrelated page effects.
  const modules = {
    "react/jsx-runtime": { jsx: (_component, props) => props },
    "react-dom/client": {
      createRoot: (target) => {
        assert.equal(target, root);
        return { render: app => { capture(app.prerenderData); operations.push("mount"); } };
      },
      hydrateRoot: (target, app) => {
        assert.equal(target, root);
        capture(app.prerenderData);
        operations.push("hydrate");
      },
    },
    "react-router": { createBrowserRouter: () => ({}) },
    "./app/App.tsx": { default: () => null },
    "./app/routes.ts": { routeDefinitions: [] },
    "./app/components/ProductMetadata.tsx": { resetProductMetadata: () => {} },
    "./styles/index.css": {},
  };
  runInNewContext(code, {
    require: (name) => {
      assert.ok(Object.hasOwn(modules, name), `Unexpected bootstrap dependency: ${name}`);
      return modules[name];
    },
    document: {
      getElementById: (id) => id === "root" ? root : id === "ludo-radar-prerender-data" && data
        ? { textContent: JSON.stringify(data), remove: () => {} } : null,
    },
    window: { location: { pathname } },
  });
  return operations;
}
