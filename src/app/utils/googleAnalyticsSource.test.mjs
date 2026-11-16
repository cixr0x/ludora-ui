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

test("public root configures the production-only Google tag for automatic page views", () => {
  const analyticsSource = sourceOrEmpty("../components/GoogleAnalytics.tsx");
  const rootSource = source("../Root.tsx");

  assert.match(analyticsSource, /G-QGR5CKL5S4/);
  assert.doesNotMatch(analyticsSource, /G-5F9KFSSE0M/);
  assert.match(analyticsSource, /googletagmanager\.com\/gtag\/js/);
  assert.match(analyticsSource, /import\.meta\.env\.PROD/);
  assert.match(analyticsSource, /window\.gtag\("config", GA_MEASUREMENT_ID\)/);
  assert.doesNotMatch(analyticsSource, /send_page_view|["']page_view["']/);
  assert.match(analyticsSource, /function\s+gtag\(\)\s*{[\s\S]*dataLayer\?\.push\(arguments\)/);
  assert.doesNotMatch(analyticsSource, /dataLayer\?\.push\(args\)/);
  assert.match(rootSource, /<GoogleAnalytics \/>/);
});
