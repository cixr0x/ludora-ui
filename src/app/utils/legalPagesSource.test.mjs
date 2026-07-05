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

test("public router exposes privacy and terms pages", () => {
  const routesSource = source("../routes.ts");

  assert.match(routesSource, /import \{ PrivacyPolicy \} from "\.\/pages\/PrivacyPolicy"/);
  assert.match(routesSource, /import \{ TermsOfService \} from "\.\/pages\/TermsOfService"/);
  assert.match(routesSource, /\{\s*path: "privacidad",\s*Component: PrivacyPolicy\s*\}/);
  assert.match(routesSource, /\{\s*path: "terminos",\s*Component: TermsOfService\s*\}/);
});

test("legal page skeletons use shared public layout and review placeholders", () => {
  const privacySource = source("../pages/PrivacyPolicy.tsx");
  const termsSource = source("../pages/TermsOfService.tsx");

  assert.match(privacySource, /export function PrivacyPolicy\(\)/);
  assert.match(privacySource, /<SiteHeader\s+contextBar=/);
  assert.match(privacySource, /Aviso de Privacidad/);
  assert.match(privacySource, /Contenido pendiente de revisi(?:o|\u00f3)n legal/u);

  assert.match(termsSource, /export function TermsOfService\(\)/);
  assert.match(termsSource, /<SiteHeader\s+contextBar=/);
  assert.match(termsSource, /T(?:e|\u00e9)rminos de Servicio/u);
  assert.match(termsSource, /Contenido pendiente de revisi(?:o|\u00f3)n legal/u);
});
