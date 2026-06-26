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

test("Root renders the shared site footer below routed pages", () => {
  const rootSource = source("../Root.tsx");

  assert.match(rootSource, /import \{ SiteFooter \}/);
  assert.match(rootSource, /<Outlet \/>/);
  assert.match(rootSource, /<SiteFooter \/>/);
});

test("SiteFooter renders contact, privacy, and powered by BGG attribution", () => {
  const footerSource = source("../components/SiteFooter.tsx");

  assert.match(footerSource, /Contact/);
  assert.match(footerSource, /Aviso de Privacidad/);
  assert.match(footerSource, /Powered by BoardGameGeek/);
  assert.match(footerSource, /h-10 w-auto/);
  assert.match(footerSource, /loading="lazy"/);
  assert.match(footerSource, /decoding="async"/);
});

test("SiteFooter uses the uploaded S3 BGG logo asset", () => {
  const footerConfigSource = source("./siteFooter.js");

  assert.match(
    footerConfigSource,
    /https:\/\/ludora\.s3\.us-east-2\.amazonaws\.com\/boardgame\/powered_by_BGG_01_SM\.png/,
  );
  assert.doesNotMatch(footerConfigSource, /cf\.geekdo-static\.com/);
});
