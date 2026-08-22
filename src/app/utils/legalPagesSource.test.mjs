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

test("legal pages use shared public layout and published documentation content", () => {
  const privacySource = source("../pages/PrivacyPolicy.tsx");
  const termsSource = source("../pages/TermsOfService.tsx");

  assert.match(privacySource, /export function PrivacyPolicy\(\)/);
  assert.match(privacySource, /<SiteHeader\s+contextBar=/);
  assert.match(privacySource, /Aviso de Privacidad/);
  assert.match(privacySource, /Datos personales que recopilamos/);
  assert.match(privacySource, /Google Analytics/);
  assert.match(privacySource, /Derechos ARCO/);
  assert.match(privacySource, /Ley Federal de Protecci(?:o|\u00f3)n de Datos Personales/u);
  assert.doesNotMatch(privacySource, /Contenido pendiente de revisi(?:o|\u00f3)n legal/u);

  assert.match(termsSource, /export function TermsOfService\(\)/);
  assert.match(termsSource, /<SiteHeader\s+contextBar=/);
  assert.match(termsSource, /T(?:e|\u00e9)rminos de Servicio/u);
  assert.match(termsSource, /Ludo Radar no es una tienda/);
  assert.match(termsSource, /Enlaces y servicios de terceros/);
  assert.match(termsSource, /Relaciones comerciales/);
  assert.match(termsSource, /Para preguntas sobre estos T(?:e|\u00e9)rminos/u);
  assert.doesNotMatch(termsSource, /Contenido pendiente de revisi(?:o|\u00f3)n legal/u);
});
