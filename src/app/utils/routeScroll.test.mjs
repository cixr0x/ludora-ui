import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const source = (relativePath) => {
  const path = resolve(testDir, relativePath);
  return existsSync(path) ? readFileSync(path, "utf8") : "";
};

test("Root installs a scroll reset for client-side route changes", () => {
  const rootSource = source("../Root.tsx");

  assert.match(rootSource, /import \{ ScrollToTop \}/);
  assert.match(rootSource, /<ScrollToTop \/>/);
  assert.match(rootSource, /<Outlet \/>/);
});

test("ScrollToTop resets window scroll when the route pathname changes", () => {
  const scrollSource = source("../components/ScrollToTop.tsx");

  assert.match(scrollSource, /useLocation/);
  assert.match(scrollSource, /pathname/);
  assert.match(scrollSource, /window\.scrollTo/);
  assert.doesNotMatch(scrollSource, /behavior:\s*["']smooth["']/);
});
