import {
  fetchFrontPage,
  fetchItem,
  fetchItems,
  fetchSemanticItems,
  type ApiFrontPageRow,
  type ApiItem,
  type ApiOffer,
  type ApiTaxonomyEntry,
} from "../api/catalog";
import { isExpansionItem, positiveInteger } from "../utils/expansionDisplay.js";
import { bggItemUrl } from "../utils/bggLinks.js";
import { storeOfferUrl } from "../utils/storeLinks.js";
import {
  type Game,
  type GameDetail,
  type GameTaxonomyEntry,
  type StoreEntry,
} from "./games";

export interface CatalogRow {
  categoryId: number;
  categoryName: string;
  categoryType: string;
  title: string;
  games: Game[];
}

export function gamesFromRows(rows: CatalogRow[]): Game[] {
  const gamesById = new Map<number, Game>();

  for (const row of rows) {
    for (const game of row.games) {
      if (!gamesById.has(game.id)) gamesById.set(game.id, game);
    }
  }

  return Array.from(gamesById.values());
}

export async function loadFrontPageRows(): Promise<CatalogRow[]> {
  try {
    const rows = await fetchFrontPage();
    return rows
      .map(mapFrontPageRow)
      .filter((row) => row.games.length > 0);
  } catch {
    return [];
  }
}

export async function loadGames(): Promise<Game[]> {
  return gamesFromRows(await loadFrontPageRows());
}

export async function loadCatalogGameDetails(query?: Parameters<typeof fetchItems>[0]): Promise<GameDetail[]> {
  try {
    const items = await fetchItems(query ?? { limit: 200 });
    return items.map((item) => mapApiItemToDetail(item));
  } catch {
    return [];
  }
}

export async function loadSemanticCatalogGameDetails(query: string, limit = 40): Promise<GameDetail[]> {
  const items = await fetchSemanticItems({ q: query, limit });
  return items.map((item) => mapApiItemToDetail(item));
}

export async function loadGameDetail(id: number): Promise<GameDetail | undefined> {
  try {
    return mapApiItemToDetail(await fetchItem(id));
  } catch {
    return undefined;
  }
}

function mapFrontPageRow(row: ApiFrontPageRow): CatalogRow {
  const rowGenre = preferredText(row.category_name_es, row.category_name);

  return {
    categoryId: row.category_id,
    categoryName: rowGenre,
    categoryType: row.category_type,
    title: frontPageRowTitle(row, rowGenre),
    games: (row.products ?? []).map((item) => mapApiItemToGame(item, rowGenre)),
  };
}

function frontPageRowTitle(row: ApiFrontPageRow, rowGenre: string): string {
  const title = preferredText(row.title);
  const categoryName = preferredText(row.category_name);
  const translatedCategoryName = preferredText(row.category_name_es);

  if (!title) return rowGenre || "Ludora";
  if (translatedCategoryName && categoryName && title === categoryName) return translatedCategoryName;
  return title;
}

function mapApiItemToGame(item: ApiItem, extraGenre?: string): Game {
  const name = preferredText(item.canonical_name_es, item.canonical_name, "Juego sin nombre");
  const altTitle = item.canonical_name_es ? item.canonical_name : undefined;
  const genres = collectGenres(item, extraGenre);

  return {
    id: item.id,
    name,
    image: preferredText(item.image_url_es, item.image_url),
    altTitle: altTitle && altTitle !== name ? altTitle : undefined,
    isExpansion: isExpansionItem(item),
    parentItemId: positiveInteger(item.parent_item_id),
    genres,
  };
}

function mapApiItemToDetail(item: ApiItem): GameDetail {
  const base = mapApiItemToGame(item);
  const categoryEntries = taxonomyEntries(item.categories ?? []);
  const mechanicEntries = taxonomyEntries(item.mechanics ?? []);
  const categories = categoryEntries.map((entry) => entry.name);
  const mechanics = mechanicEntries.map((entry) => entry.name);
  const designers = taxonomyNames(item.designers ?? []);
  const publishers = taxonomyNames(item.publishers ?? []);
  const youtubeId = item.tutorials?.map((tutorial) => youtubeIdFromUrl(tutorial.url)).find(Boolean);

  return {
    ...base,
    rating: numericValue(item.rating, 0),
    bggUrl: bggItemUrl(item),
    categories,
    categoryEntries,
    mechanics,
    mechanicEntries,
    description: descriptionParagraphs(item),
    players: rangeText(item.min_players, item.max_players) || "Sin registrar",
    playTime: minutesText(item.min_minutes, item.max_minutes) || "Sin registrar",
    complexity: Math.max(0, Math.min(5, Math.round(numericValue(item.complexity, 0)))),
    designer: designers.join(", ") || "Sin registrar",
    publisher: publishers.join(", ") || "Sin registrar",
    youtubeId,
    stores: (item.offers ?? []).map((offer) => mapOffer(offer, base)).slice(0, 8),
  };
}

function collectGenres(item: ApiItem, extraGenre?: string): string[] {
  const names = [
    extraGenre,
    ...taxonomyNames(item.categories ?? []),
    ...taxonomyNames(item.families ?? []),
    ...taxonomyNames(item.mechanics ?? []),
  ].filter(Boolean);
  const expanded = names.flatMap((name) => [name, ...genreAliases(name)]);
  return Array.from(new Set(expanded));
}

function taxonomyNames(entries: ApiTaxonomyEntry[]): string[] {
  return entries.map((entry) => preferredText(entry.name_es, entry.name)).filter(Boolean);
}

function taxonomyEntries(entries: ApiTaxonomyEntry[]): GameTaxonomyEntry[] {
  return entries
    .map((entry) => ({
      id: entry.id,
      name: preferredText(entry.name_es, entry.name),
    }))
    .filter((entry) => Number.isInteger(entry.id) && entry.id > 0 && entry.name);
}

function descriptionParagraphs(item: ApiItem): string[] {
  const source = preferredText(item.description_es, item.description);
  if (!source) return [];

  return source
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function mapOffer(offer: ApiOffer, game: Game): StoreEntry {
  const priceValue = numericValue(offer.price, 0);
  const currency = offer.currency || "MXN";
  const stockLevel = stockLevelFromAvailability(offer.availability);

  return {
    id: offer.id,
    name: offer.store_name,
    url: storeOfferUrl(offer),
    country: offer.store_country || "MX",
    image: offer.image_url || game.image,
    gameTitle: offer.game_title || game.name,
    price: formatPrice(priceValue, currency, offer.raw_price),
    priceValue,
    currency,
    inStock: stockLevel !== "out",
    stockLevel,
    fulfillment: "shipping",
    storeRating: 0,
    reviewCount: 0,
  };
}

function preferredText(...values: Array<string | undefined | null>): string {
  return values.find((value) => typeof value === "string" && value.trim().length > 0)?.trim() ?? "";
}

function numericValue(value: number | string | null | undefined, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function rangeText(min?: number | null, max?: number | null): string {
  if (!min && !max) return "";
  if (min && max && min !== max) return `${min}-${max}`;
  return String(min ?? max);
}

function minutesText(min?: number | null, max?: number | null): string {
  const range = rangeText(min, max);
  return range ? `${range} mins` : "";
}

function stockLevelFromAvailability(value?: string): StoreEntry["stockLevel"] {
  const normalized = (value ?? "").toLowerCase();
  if (normalized.includes("out") || normalized.includes("agotado") || normalized.includes("unavailable")) return "out";
  if (normalized.includes("low") || normalized.includes("pocas")) return "low";
  return "high";
}

function formatPrice(value: number, currency: string, raw?: string): string {
  const trimmedRaw = raw?.trim();
  if (trimmedRaw && /[^\d.,\s]/.test(trimmedRaw)) return trimmedRaw;
  if (!value) return "Consultar";
  try {
    return new Intl.NumberFormat("es-MX", {
      currency,
      style: "currency",
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

function youtubeIdFromUrl(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) return parsed.pathname.split("/").filter(Boolean)[0];
    if (parsed.hostname.includes("youtube.com")) return parsed.searchParams.get("v") ?? undefined;
  } catch {
    return undefined;
  }
  return undefined;
}

function genreAliases(value: string): string[] {
  const normalized = value.toLowerCase();
  const aliases: string[] = [];
  if (normalized.includes("party") || normalized.includes("fiesta")) aliases.push("Party");
  if (normalized.includes("strategy") || normalized.includes("estrateg")) aliases.push("Strategy");
  if (normalized.includes("classic") || normalized.includes("clasico")) aliases.push("Classic");
  if (normalized.includes("abstract")) aliases.push("Abstract");
  if (normalized.includes("cooperative") || normalized.includes("coop")) aliases.push("Cooperative");
  if (normalized.includes("deck")) aliases.push("Deck Building");
  if (normalized.includes("worker")) aliases.push("Worker Placement");
  if (normalized.includes("tile")) aliases.push("Tile Placement");
  if (normalized.includes("hand")) aliases.push("Hand Management");
  if (normalized.includes("set collection")) aliases.push("Set Collection");
  if (normalized.includes("draft")) aliases.push("Drafting");
  if (normalized.includes("engine")) aliases.push("Engine Building");
  if (normalized.includes("area")) aliases.push("Area Control");
  if (normalized.includes("push your luck")) aliases.push("Push Your Luck");
  if (normalized.includes("fantasy") || normalized.includes("fantasia")) aliases.push("Fantasy");
  if (normalized.includes("horror") || normalized.includes("terror")) aliases.push("Horror");
  if (normalized.includes("economic") || normalized.includes("econom")) aliases.push("Economic");
  if (normalized.includes("card") || normalized.includes("carta")) aliases.push("Card Game");
  if (normalized.includes("dice") || normalized.includes("dado")) aliases.push("Dice Rolling");
  if (normalized.includes("adventure") || normalized.includes("aventura")) aliases.push("Adventure");
  if (normalized.includes("auction") || normalized.includes("subasta")) aliases.push("Auction");
  if (normalized.includes("trading") || normalized.includes("negociacion")) aliases.push("Trading");
  if (normalized.includes("pattern") || normalized.includes("patron")) aliases.push("Pattern Building");
  return aliases;
}
