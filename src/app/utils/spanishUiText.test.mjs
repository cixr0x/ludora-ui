import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), "utf8");
const projectSource = (relativePath) => readFileSync(new URL(`../../../${relativePath}`, import.meta.url), "utf8");

test("public UI copy is Spanish in metadata, shared controls, and contact form", () => {
  const sources = [
    projectSource("index.html"),
    source("../components/ContactFormDialog.tsx"),
    source("../components/SiteFooter.tsx"),
    source("../components/SiteHeader.tsx"),
    source("../components/GameRow.tsx"),
    source("../components/figma/ImageWithFallback.tsx"),
    source("../components/ui/command.tsx"),
    source("../components/ui/dialog.tsx"),
    source("../components/ui/carousel.tsx"),
    source("../components/ui/pagination.tsx"),
    source("../components/ui/sheet.tsx"),
    source("../components/ui/sidebar.tsx"),
    source("../pages/GameDetail.tsx"),
    source("../pages/Home.tsx"),
  ].join("\n");

  const forbiddenEnglishCopyPatterns = [
    /Browse and discover board games/,
    />Contact\s*</,
    /<DialogTitle>Contact<\/DialogTitle>/,
    /Tell us what you need from Ludora\./,
    />Name<\/Label>/,
    />Message<\/Label>/,
    /Sending\.\.\./,
    /:\s*"Send"/,
    /aria-label="Footer"/,
    /aria-label="Powered by BoardGameGeek"/,
    /alt="Powered by BoardGameGeek"/,
    /alt="Powered by BGG"/,
    /aria-label="Scroll left"/,
    /aria-label="Scroll right"/,
    /aria-label="Image failed to load"/,
    />Close<\/span>/,
    /Toggle Sidebar/,
    /Search for a command to run/,
    /Command Palette/,
    /Previous slide/,
    /Next slide/,
    /aria-roledescription="carousel"/,
    /aria-roledescription="slide"/,
    /aria-label="pagination"/,
    /Go to previous page/,
    /Go to next page/,
    />Previous<\/span>/,
    />Next<\/span>/,
    /More pages/,
  ];

  for (const pattern of forbiddenEnglishCopyPatterns) {
    assert.doesNotMatch(sources, pattern, `English UI copy remains: ${pattern}`);
  }

  assert.match(projectSource("index.html"), /<html lang="es">/);
  assert.match(source("../components/ContactFormDialog.tsx"), />Contacto</);
  assert.match(source("../components/ContactFormDialog.tsx"), />Nombre</);
  assert.match(source("../components/ContactFormDialog.tsx"), />Mensaje</);
  assert.match(source("../components/ContactFormDialog.tsx"), /Enviando/);
  assert.match(source("../components/ContactFormDialog.tsx"), /"Enviar"/);
  assert.match(source("../components/ui/dialog.tsx"), />Cerrar</);
});
