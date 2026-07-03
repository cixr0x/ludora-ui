import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), "utf8");
const sourceOrEmpty = (relativePath) => {
  try {
    return source(relativePath);
  } catch (error) {
    if (error?.code === "ENOENT") return "";
    throw error;
  }
};

test("public root installs production-only GA4 route tracking", () => {
  const analyticsSource = sourceOrEmpty("../components/GoogleAnalytics.tsx");
  const rootSource = source("../Root.tsx");

  assert.match(analyticsSource, /G-5F9KFSSE0M/);
  assert.match(analyticsSource, /googletagmanager\.com\/gtag\/js/);
  assert.match(analyticsSource, /import\.meta\.env\.PROD/);
  assert.match(analyticsSource, /send_page_view:\s*false/);
  assert.match(analyticsSource, /useLocation/);
  assert.match(analyticsSource, /page_path:\s*`\$\{pathname\}\$\{search\}`/);
  assert.match(rootSource, /<GoogleAnalytics \/>/);
});
