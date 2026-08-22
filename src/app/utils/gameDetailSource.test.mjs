import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

test("game detail shows the supplied BoardGameGeek logo beside ratings only for linked items", () => {
  const source = readFileSync(new URL("../pages/GameDetail.tsx", import.meta.url), "utf8");
  const apiCatalogSource = readFileSync(new URL("../api/catalog.ts", import.meta.url), "utf8");
  const catalogSource = readFileSync(new URL("../data/catalog.ts", import.meta.url), "utf8");
  const gamesSource = readFileSync(new URL("../data/games.ts", import.meta.url), "utf8");
  const logo = readFileSync(new URL("../../../public/bgg-primary-logo-reverse.svg", import.meta.url));

  assert.match(apiCatalogSource, /bgg_id\?: number \| string \| null/);
  assert.match(
    catalogSource,
    /export function mapApiItemToDetail[\s\S]*bggId:\s*positiveInteger\(item\.bgg_id\)/,
  );
  assert.match(gamesSource, /bggId\?: number/);
  assert.match(source, /const BGG_PRIMARY_LOGO_URL = "\/bgg-primary-logo-reverse\.svg"/);
  assert.match(source, /\{detail\.bggId && \(/);
  assert.match(source, /src=\{BGG_PRIMARY_LOGO_URL\}/);
  assert.match(source, /alt="BoardGameGeek"/);
  assert.match(source, /className="h-7 w-auto flex-none"/);
  assert.doesNotMatch(source, /href=\{detail\.bgg/);
  assert.equal(
    createHash("sha256").update(logo).digest("hex"),
    "d174224232914ce4d088f04b6248f2697af6e091177be0cf374e6b64933ed54a",
  );
});

test("catalog detail mapping extracts TikTok tutorial metadata", () => {
  const source = readFileSync(new URL("../data/catalog.ts", import.meta.url), "utf8");

  assert.match(source, /tiktokTutorialFromUrl/);
  assert.match(source, /tiktokId:\s*tiktokTutorial\?\.id/);
  assert.match(source, /tiktokUser:\s*tiktokTutorial\?\.user/);
});

test("game detail uses the TikTok player iframe without the share card embed", () => {
  const source = readFileSync(new URL("../pages/GameDetail.tsx", import.meta.url), "utf8");

  assert.match(source, /https:\/\/www\.tiktok\.com\/player\/v1\/\$\{tiktokId\}/);
  assert.match(source, /description=0/);
  assert.match(source, /music_info=0/);
  assert.doesNotMatch(source, /className="tiktok-embed"/);
  assert.doesNotMatch(source, /https:\/\/www\.tiktok\.com\/embed\.js/);
  assert.doesNotMatch(source, /tiktok\.com\/embed\/v2/);
});

test("game detail hides the TikTok player when no linked tutorial exists", () => {
  const source = readFileSync(new URL("../pages/GameDetail.tsx", import.meta.url), "utf8");

  assert.match(source, /\{detail\.tiktokId && \(/);
  assert.doesNotMatch(source, /tiktokPlayerUrl \? \(/);
  assert.doesNotMatch(source, /\bDices\b/);
  assert.doesNotMatch(source, /@ludora/);
});

test("game detail thanks and links to the TikTok tutorial creator", () => {
  const source = readFileSync(new URL("../pages/GameDetail.tsx", import.meta.url), "utf8");

  assert.match(source, /Gracias a/);
  assert.match(source, /No olviden/);
  assert.match(source, /seguirlos/);
  assert.match(source, /para m(?:a|\u00e1)s contenido!/u);
  assert.match(source, /className="text-sm leading-snug text-neutral-500"/);
  assert.match(source, /https:\/\/www\.tiktok\.com\/@\$\{tiktokUser\}/);
  assert.equal(source.match(/href=\{tiktokProfileUrl\}/g)?.length, 2);
});

test("game detail highlights the enabled buy-now button while keeping disabled state neutral", () => {
  const source = readFileSync(new URL("../pages/GameDetail.tsx", import.meta.url), "utf8");

  assert.match(source, /bg-fuchsia-500/);
  assert.match(source, /hover:bg-fuchsia-400/);
  assert.match(source, /shadow-\[0_0_18px_rgba\(217,70,239,0\.25\)\]/);
  assert.match(source, /bg-neutral-900 border border-neutral-800 text-neutral-600 text-sm py-2 rounded-lg cursor-not-allowed/);
});

test("game detail reports store offer clicks while preserving external links", () => {
  const source = readFileSync(new URL("../pages/GameDetail.tsx", import.meta.url), "utf8");

  assert.match(source, /import \{ reportStoreItemClick \} from "\.\.\/utils\/storeClickTracking\.js";/);
  assert.match(source, /href=\{store\.url\}/);
  assert.match(source, /target="_blank"/);
  assert.match(source, /rel="noopener noreferrer"/);
  assert.match(source, /onClick=\{\(\) => reportStoreItemClick\(store\.id\)\}/);
});

test("game detail distinguishes out-of-stock and no-longer-available store offers", () => {
  const source = readFileSync(new URL("../pages/GameDetail.tsx", import.meta.url), "utf8");
  const catalogSource = readFileSync(new URL("../data/catalog.ts", import.meta.url), "utf8");

  assert.match(source, /storeAvailabilityLabel/);
  assert.match(source, /availabilityStatus === "unavailable"/);
  assert.match(source, /availabilityStatus !== "unavailable" && <p[^>]*>\{store\.price\}<\/p>/);
  assert.match(source, />Disponibilidad en Tiendas<\/h/);
  assert.match(source, /La versión, edición o idioma disponible puede variar según la tienda\./);
  assert.match(catalogSource, /storeAvailabilityState\(offer\.availability, offer\.store_active\)/);
  assert.match(catalogSource, /storeAvailabilityRank\(left\.availabilityStatus\) - storeAvailabilityRank\(right\.availabilityStatus\)/);
  assert.doesNotMatch(catalogSource, /\.slice\(0, 8\)/);
});

test("game detail separates bundle offers from single-item offers", () => {
  const source = readFileSync(new URL("../pages/GameDetail.tsx", import.meta.url), "utf8");
  const catalogSource = readFileSync(new URL("../data/catalog.ts", import.meta.url), "utf8");
  const apiCatalogSource = readFileSync(new URL("../api/catalog.ts", import.meta.url), "utf8");
  const gamesSource = readFileSync(new URL("../data/games.ts", import.meta.url), "utf8");

  assert.match(apiCatalogSource, /is_bundle\?: boolean/);
  assert.match(gamesSource, /isBundle\?: boolean/);
  assert.match(catalogSource, /isBundle:\s*Boolean\(offer\.is_bundle\)/);
  assert.match(source, /const singleStoreOffers = detail\.stores\.filter\(\(store\) => !store\.isBundle\)/);
  assert.match(source, /const bundleStoreOffers = detail\.stores\.filter\(\(store\) => store\.isBundle\)/);
  assert.match(source, />Paquetes<\/h3>/);
  assert.match(source, /singleStoreOffers\.map/);
  assert.match(source, /bundleStoreOffers\.map/);
});

test("game detail collapses overflowing publishers to one expandable line", () => {
  const source = readFileSync(new URL("../pages/GameDetail.tsx", import.meta.url), "utf8");

  assert.match(source, /function ExpandablePublisherList/);
  assert.match(source, /publisherElement\.scrollWidth > publisherElement\.clientWidth \+ 1/);
  assert.match(source, /overflow-hidden whitespace-nowrap text-white/);
  assert.match(source, /aria-expanded=\{expanded\}/);
  assert.match(source, /className=\{`\$\{expanded \? "ml-1" : "flex-none"\} text-white font-normal underline/);
  assert.match(source, /expanded \? "Ver menos" : "… Ver más"/);
  assert.match(source, /<ExpandablePublisherList publisher=\{detail\.publisher\} \/>/);
});

test("expansion parent links list every parent with comma separators and action-link styling", () => {
  const source = readFileSync(new URL("../pages/GameDetail.tsx", import.meta.url), "utf8");

  assert.match(source, /detail\.parentGames\.map\(\(parentGame, index\) => \(/);
  assert.match(source, /\{index > 0 && ", "\}/);
  assert.match(source, /to=\{productPath\(parentGame\.id, parentGame\.name\)\}/);
  assert.match(source, /className="text-fuchsia-300 transition-colors hover:text-fuchsia-200 hover:underline/);
  assert.doesNotMatch(source, /setParentGame|loadGameDetail\(nextDetail\.parentItemId\)/);
});

test("catalog detail maps every API parent item to a localized game reference", () => {
  const apiSource = readFileSync(new URL("../api/catalog.ts", import.meta.url), "utf8");
  const catalogSource = readFileSync(new URL("../data/catalog.ts", import.meta.url), "utf8");

  assert.match(apiSource, /parent_items\?: ApiItemReference\[\]/);
  assert.match(catalogSource, /parentGames: itemReferences\(item\.parent_items \?\? \[\]\)/);
  assert.match(catalogSource, /name: preferredText\(item\.canonical_name_es, item\.canonical_name\)/);
});

test("game detail loads expansions and related games separately from primary detail rendering", () => {
  const source = readFileSync(new URL("../pages/GameDetail.tsx", import.meta.url), "utf8");

  assert.match(source, /import \{ loadGameDetail,\s*loadGameExpansions,\s*loadRelatedGames \} from "\.\.\/data\/catalog";/);
  assert.match(source, /const \[expansionGames, setExpansionGames\] = useState<Game\[\]>\(\[\]\);/);
  assert.match(source, /const \[relatedGames, setRelatedGames\] = useState<Game\[\]>\(\[\]\);/);
  assert.match(source, /loadGameDetail\(itemId\)\.then\(\(nextDetail\) => \{/);
  assert.match(source, /setDetail\(nextDetail\);[\s\S]*setIsLoading\(false\);/);
  assert.match(source, /loadGameExpansions\(itemId\)/);
  assert.match(source, /loadRelatedGames\(itemId\)/);
  assert.doesNotMatch(source, /loadGames/);
  assert.doesNotMatch(source, /const gamesPromise = loadGames\(\);/);
  assert.doesNotMatch(source, /Promise\.all\(\[gamesPromise,\s*parentPromise\]\)/);
  assert.doesNotMatch(source, /const relatedGames = allGames/);
  assert.match(source, /expansionGames\.length > 0/);
  assert.match(source, />Expansiones<\/h2>/);
  assert.match(source, /<RelatedRow games=\{expansionGames\} \/>/);
  assert.ok(
    source.indexOf(">Expansiones</h2>") < source.indexOf(">Disponibilidad en Tiendas</h2>"),
    "Expansiones should render before Disponibilidad en Tiendas",
  );
});

test("game detail links category and mechanic chips to filtered explore results", () => {
  const source = readFileSync(new URL("../pages/GameDetail.tsx", import.meta.url), "utf8");

  assert.match(source, /import \{ buildExploreTaxonomyPath \} from "\.\.\/utils\/catalogSearch\.js";/);
  assert.match(source, /to=\{buildExploreTaxonomyPath\(taxonomyType,\s*item\.id\)\}/);
  assert.match(source, /taxonomyType="category"/);
  assert.match(source, /taxonomyType="mechanic"/);
  assert.match(source, /entries=\{detail\.categoryEntries\}/);
  assert.match(source, /entries=\{detail\.mechanicEntries\}/);
});
