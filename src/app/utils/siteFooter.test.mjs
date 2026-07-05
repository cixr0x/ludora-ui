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

test("SiteFooter renders contact, privacy, and BGG attribution in Spanish", () => {
  const footerSource = source("../components/SiteFooter.tsx");

  assert.match(footerSource, /ContactFormDialog/);
  assert.match(footerSource, /<ContactFormDialog\s*\/>/);
  assert.match(footerSource, /ContactFormDialog/);
  assert.match(footerSource, /Aviso de Privacidad/);
  assert.match(footerSource, /Con tecnolog(?:i|\u00ed)a de BoardGameGeek/u);
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

test("ContactFormDialog renders a footer-triggered contact form window", () => {
  const dialogSource = source("../components/ContactFormDialog.tsx");

  assert.match(dialogSource, /Dialog/);
  assert.match(dialogSource, /DialogTitle/);
  assert.match(dialogSource, /Contacto/);
  assert.match(dialogSource, /Nombre/);
  assert.match(dialogSource, /Correo electr(?:o|\u00f3)nico/u);
  assert.match(dialogSource, /Mensaje/);
  assert.match(dialogSource, /Enviando/);
  assert.match(dialogSource, /Enviar/);
  assert.match(dialogSource, /name="name"/);
  assert.match(dialogSource, /name="email"/);
  assert.match(dialogSource, /name="message"/);
  assert.match(dialogSource, /bg-neutral-100/);
  assert.match(dialogSource, /text-neutral-950/);
  assert.match(dialogSource, /submitContactForm/);
  assert.match(dialogSource, /type="submit"/);
});

test("Dialog overlay and content forward refs for Radix composition", () => {
  const dialogPrimitiveSource = source("../components/ui/dialog.tsx");

  assert.match(dialogPrimitiveSource, /const DialogOverlay = React\.forwardRef/);
  assert.match(dialogPrimitiveSource, /const DialogContent = React\.forwardRef/);
});

test("catalog api exposes contact form submission", () => {
  const apiSource = source("../api/catalog.ts");

  assert.match(apiSource, /export\s+interface\s+ContactFormSubmission/);
  assert.match(apiSource, /export\s+async\s+function\s+submitContactForm/);
  assert.match(apiSource, /\/api\/contact/);
  assert.match(apiSource, /method:\s*"POST"/);
  assert.match(apiSource, /JSON\.stringify\(submission\)/);
});
