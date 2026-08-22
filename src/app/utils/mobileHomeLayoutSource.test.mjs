import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), "utf8");

test("home restores its original content spacing at the desktop breakpoint", () => {
  const homeSource = source("../pages/Home.tsx");

  assert.match(homeSource, /pt-4 pb-10 md:pt-8 md:pb-16/);
  assert.match(homeSource, /px-3 mb-4 md:px-14 md:mb-7/);
  assert.match(homeSource, /px-3 py-10[\s\S]*md:px-14 md:py-16/);
});

test("home places the LudoRadar dismiss control after its primary action", () => {
  const calloutSource = source("../components/LudoscopioCallout.tsx");

  assert.match(
    calloutSource,
    /onClick=\{onTrigger\}[\s\S]*?<SearchIcon[\s\S]*?LudoRadar[\s\S]*?\{onDismiss && \([\s\S]*?aria-label="Cerrar sugerencia de LudoRadar"/,
  );
});

test("semantic search uses LudoRadar wording and magnifier icons on public surfaces", () => {
  const calloutSource = source("../components/LudoscopioCallout.tsx");
  const searchSource = source("../pages/Search.tsx");

  assert.doesNotMatch(calloutSource, /<Sparkles/);
  assert.match(calloutSource, /Prueba nuestro LudoRadar/);
  assert.match(calloutSource, /Buscar con LudoRadar/);
  assert.match(searchSource, /<SearchIcon className="mt-0\.5 h-4 w-4 flex-none text-fuchsia-300" \/>/);
  assert.match(searchSource, />LudoRadar<\/p>/);
  assert.match(searchSource, /Consultando LudoRadar\.\.\./);
});

test("home rows keep responsive rendering and lazy-loading geometry synchronized", () => {
  const rowSource = source("../components/GameRow.tsx");

  assert.match(rowSource, /const DESKTOP_CARD_SIZE = 168/);
  assert.match(rowSource, /const DESKTOP_CARD_GAP = 16/);
  assert.match(rowSource, /const MOBILE_CARD_SIZE = 132/);
  assert.match(rowSource, /const MOBILE_CARD_GAP = 10/);
  assert.match(rowSource, /const cardSize = isMobile \? MOBILE_CARD_SIZE : DESKTOP_CARD_SIZE/);
  assert.match(rowSource, /const left = index \* \(cardSize \+ cardGap\)/);
  assert.match(rowSource, /right: left \+ cardSize/);
  assert.match(rowSource, /style=\{\{ width: cardSize, height: cardSize \}\}/);
  assert.match(rowSource, /px-3 pb-1 md:px-14/);
  assert.match(rowSource, /gap-2\.5 md:gap-4/);
  assert.match(rowSource, /hidden w-14[\s\S]*md:flex/);
});

test("shared home chrome is compact only below the desktop breakpoint", () => {
  const headerSource = source("../components/SiteHeader.tsx");
  const footerSource = source("../components/SiteFooter.tsx");

  assert.match(headerSource, /h-14[\s\S]*md:h-16 md:gap-4 md:px-8/);
  assert.match(headerSource, /gap-0\.5[\s\S]*px-2 pb-2[\s\S]*md:px-6 md:pb-3/);
  assert.match(headerSource, /gap-4 overflow-x-auto md:gap-7/);
  assert.match(footerSource, /gap-4 px-4 py-6[\s\S]*md:gap-5 md:px-6 md:py-8/);
  assert.match(footerSource, /h-8 w-auto md:h-10/);
});
