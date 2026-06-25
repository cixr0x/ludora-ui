const IMG = (id: string) =>
  `https://images.unsplash.com/photo-${id}?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&w=400&h=400&q=80`;

export interface Game {
  id: number;
  name: string;
  image: string;
  altTitle?: string;
  isExpansion?: boolean;
  parentItemId?: number;
  genres: string[];
}

export interface GameTaxonomyEntry {
  id: number;
  name: string;
}

export interface StoreEntry {
  id: number;
  name: string;
  url?: string;
  country: string;
  image: string;
  gameTitle: string;
  price: string;
  priceValue: number;
  currency: string;
  inStock: boolean;
  stockLevel: "high" | "low" | "out";
  fulfillment: "shipping" | "pickup" | "both";
  storeRating: number;
  reviewCount: number;
}

export interface GameDetail extends Game {
  rating: number;
  bggUrl?: string;
  categories: string[];
  categoryEntries?: GameTaxonomyEntry[];
  mechanics: string[];
  mechanicEntries?: GameTaxonomyEntry[];
  description: string[];
  players: string;
  playTime: string;
  complexity: number;
  designer: string;
  publisher: string;
  tiktokId?: string;
  tiktokUser?: string;
  youtubeId?: string;
  stores: StoreEntry[];
}

export const strategyGames: Game[] = [
  { id: 1,  name: "Dead Cells: EL Juego de Mesa Rogue Lite", image: IMG("1677188010559-0667a1ed33a0"), altTitle: "Dead Cells: The Rogue-Lite Board Game", genres: ["Strategy", "Deck Building"] },
  { id: 2,  name: "Chess Masters",        image: IMG("1523875194681-bedd468c58bf"), genres: ["Strategy", "Abstract"] },
  { id: 3,  name: "Carcassonne",          image: IMG("1695480542225-bc22cac128d0"), altTitle: "カルカソンヌ", genres: ["Strategy"] },
  { id: 4,  name: "Terraforming Mars",    image: IMG("1585504198199-20277593b94f"), altTitle: "Marte Terraformato", genres: ["Strategy", "Worker Placement"] },
  { id: 5,  name: "Pandemic",             image: IMG("1676651471150-0e3a5f8de05e"), altTitle: "Pandémie", genres: ["Strategy", "Cooperative"] },
  { id: 6,  name: "Scythe",               image: IMG("1653080583467-cf46333f692e"), genres: ["Strategy", "Worker Placement"] },
  { id: 7,  name: "Go",                   image: IMG("1528819622765-d6bcf132f793"), altTitle: "囲碁", genres: ["Strategy", "Abstract"] },
  { id: 8,  name: "Twilight Imperium",    image: IMG("1606503153255-59d8b8b82176"), altTitle: "Imperio del Crepúsculo", genres: ["Strategy"] },
  { id: 9,  name: "Agricola",             image: IMG("1529699211952-734e80c4d42b"), genres: ["Strategy", "Worker Placement"] },
  { id: 10, name: "Wingspan",             image: IMG("1560174038-da43ac74f01b"),    altTitle: "Flügelschlag", genres: ["Strategy", "Worker Placement"] },
  { id: 11, name: "Brass: Birmingham",    image: IMG("1604948501466-4e9c339b9c24"), genres: ["Strategy"] },
  { id: 12, name: "Power Grid",           image: IMG("1586165368502-1bad197a6461"), altTitle: "Funkenschlag", genres: ["Strategy"] },
];

export const partyGames: Game[] = [
  { id: 13, name: "Codenames",            image: IMG("1632501641765-e568d28b0015"), altTitle: "Nombre en Clave", genres: ["Party"] },
  { id: 14, name: "Exploding Kittens",    image: IMG("1629760946220-5693ee4c46ac"), genres: ["Party"] },
  { id: 15, name: "Dixit",                image: IMG("1637120149073-54319e6f9fc3"), altTitle: "ディクシット", genres: ["Party"] },
  { id: 16, name: "Ticket to Ride",       image: IMG("1530328411047-7063dbd29029"), altTitle: "Les Aventuriers du Rail", genres: ["Party", "Strategy"] },
  { id: 17, name: "Werewolf",             image: IMG("1560174038-da43ac74f01b"),    altTitle: "Loup-Garou pour une Nuit", genres: ["Party"] },
  { id: 18, name: "Sushi Go!",            image: IMG("1611996575749-79a3a250f948"), altTitle: "寿司ゴー!", genres: ["Party"] },
  { id: 19, name: "Taboo",                image: IMG("1611891487122-207579d67d98"), genres: ["Party"] },
  { id: 20, name: "Just One",             image: IMG("1676482721054-59f8326cd1d9"), altTitle: "Solo Uno", genres: ["Party", "Cooperative"] },
  { id: 21, name: "Wavelength",           image: IMG("1606503153255-59d8b8b82176"), genres: ["Party"] },
  { id: 22, name: "Mysterium",            image: IMG("1604948501466-4e9c339b9c24"), altTitle: "Мистериум", genres: ["Party", "Cooperative"] },
  { id: 23, name: "Telestrations",        image: IMG("1695480542225-bc22cac128d0"), genres: ["Party"] },
  { id: 24, name: "Pictionary",           image: IMG("1677188010559-0667a1ed33a0"), genres: ["Party"] },
];

export const classicGames: Game[] = [
  { id: 25, name: "Monopoly",             image: IMG("1677188010559-0667a1ed33a0"), altTitle: "Monopolio", genres: ["Classic"] },
  { id: 26, name: "Risk",                 image: IMG("1529699211952-734e80c4d42b"), altTitle: "Risiko", genres: ["Classic", "Strategy"] },
  { id: 27, name: "Clue",                 image: IMG("1604948501466-4e9c339b9c24"), altTitle: "Cluedo", genres: ["Classic"] },
  { id: 28, name: "Battleship",           image: IMG("1586165368502-1bad197a6461"), altTitle: "Bataille Navale", genres: ["Classic"] },
  { id: 29, name: "Trivial Pursuit",      image: IMG("1523875194681-bedd468c58bf"), genres: ["Classic"] },
  { id: 30, name: "Scrabble",             image: IMG("1695480542225-bc22cac128d0"), genres: ["Classic"] },
  { id: 31, name: "Sorry!",               image: IMG("1606503153255-59d8b8b82176"), genres: ["Classic"] },
  { id: 32, name: "Connect Four",         image: IMG("1611996575749-79a3a250f948"), altTitle: "Puissance 4", genres: ["Classic", "Abstract"] },
  { id: 33, name: "Othello",              image: IMG("1528819622765-d6bcf132f793"), altTitle: "Reversi", genres: ["Classic", "Abstract"] },
  { id: 34, name: "Checkers",             image: IMG("1653080583467-cf46333f692e"), altTitle: "Dames", genres: ["Classic", "Abstract"] },
  { id: 35, name: "Backgammon",           image: IMG("1571236207041-5fb70cec466e"), altTitle: "Tavli", genres: ["Classic"] },
  { id: 36, name: "Mahjong",              image: IMG("1676651471150-0e3a5f8de05e"), altTitle: "麻将", genres: ["Classic"] },
];

export const rpgGames: Game[] = [
  { id: 37, name: "Dungeons & Dragons",   image: IMG("1653080583467-cf46333f692e"), altTitle: "Donjons & Dragons", genres: ["RPG"] },
  { id: 38, name: "Gloomhaven",           image: IMG("1651355828101-1e96ef64b1ed"), altTitle: "グルームヘイヴン", genres: ["RPG", "Cooperative"] },
  { id: 39, name: "Arkham Horror",        image: IMG("1696197819145-dbcf7e97cbdc"), altTitle: "L'Horreur d'Arkham", genres: ["RPG", "Cooperative"] },
  { id: 40, name: "Pathfinder",           image: IMG("1651287898571-b678c99f30af"), genres: ["RPG", "Cooperative"] },
  { id: 41, name: "Spirit Island",        image: IMG("1560174038-da43ac74f01b"), genres: ["RPG", "Cooperative"] },
  { id: 42, name: "Descent",              image: IMG("1676651471150-0e3a5f8de05e"), altTitle: "Vers les Ténèbres", genres: ["RPG", "Cooperative"] },
  { id: 43, name: "Mansions of Madness",  image: IMG("1604948501466-4e9c339b9c24"), altTitle: "Mansiones de la Locura", genres: ["RPG", "Cooperative"] },
  { id: 44, name: "Mage Knight",          image: IMG("1529699211952-734e80c4d42b"), genres: ["RPG"] },
  { id: 45, name: "Runebound",            image: IMG("1586165368502-1bad197a6461"), genres: ["RPG"] },
  { id: 46, name: "Betrayal at House",    image: IMG("1696197819145-dbcf7e97cbdc"), altTitle: "Trahison à la Maison", genres: ["RPG"] },
  { id: 47, name: "Mice and Mystics",     image: IMG("1651287898571-b678c99f30af"), altTitle: "Souris et Mystiques", genres: ["RPG", "Cooperative"] },
  { id: 48, name: "Imperial Assault",     image: IMG("1651355828101-1e96ef64b1ed"), genres: ["RPG"] },
];

export const quickGames: Game[] = [
  { id: 49, name: "Coup",                 image: IMG("1571236207041-5fb70cec466e"), altTitle: "Golpe de Estado", genres: ["Party"] },
  { id: 50, name: "Love Letter",          image: IMG("1528819622765-d6bcf132f793"), altTitle: "Liebesbrief", genres: ["Party"] },
  { id: 51, name: "6 Nimmt!",             image: IMG("1611996575749-79a3a250f948"), altTitle: "¡Toma 6!", genres: ["Party"] },
  { id: 52, name: "Uno",                  image: IMG("1629760946220-5693ee4c46ac"), altTitle: "ウノ", genres: ["Party", "Classic"] },
  { id: 53, name: "No Thanks!",           image: IMG("1632501641765-e568d28b0015"), altTitle: "Nein, Danke!", genres: ["Party"] },
  { id: 54, name: "Skull",                image: IMG("1651355828101-1e96ef64b1ed"), altTitle: "Bluff", genres: ["Party"] },
  { id: 55, name: "For Sale",             image: IMG("1530328411047-7063dbd29029"), genres: ["Strategy"] },
  { id: 56, name: "Bohnanza",             image: IMG("1637120149073-54319e6f9fc3"), genres: ["Party"] },
  { id: 57, name: "Spit",                 image: IMG("1676482721054-59f8326cd1d9"), genres: ["Party"] },
  { id: 58, name: "Hanabi",               image: IMG("1606503153255-59d8b8b82176"), altTitle: "花火", genres: ["Cooperative"] },
  { id: 59, name: "Cockroach Poker",      image: IMG("1585504198199-20277593b94f"), altTitle: "Kakerlakenpoker", genres: ["Party"] },
  { id: 60, name: "Blink",                image: IMG("1611891487122-207579d67d98"), genres: ["Party"] },
];

export function getAllGames(): Game[] {
  return [...strategyGames, ...partyGames, ...classicGames, ...rpgGames, ...quickGames];
}

export function getGameById(id: number): Game | undefined {
  return getAllGames().find((g) => g.id === id);
}

// ---------------------------------------------------------------------------
// Detailed data per game id
// ---------------------------------------------------------------------------

const specificDetail: Record<number, Omit<GameDetail, keyof Game>> = {
  1: {
    rating: 8.7,
    categories: ["Adventure", "Fighting", "Video Game Theme"],
    mechanics: ["Deck Building", "Modular Board", "Rondel", "Variable Player Powers", "Dice Rolling", "Hand Management", "Push Your Luck", "Action Points", "Simultaneous Action Selection", "Campaign / Legacy", "Tableau Building", "Resource Management", "Open Drafting"],
    description: [
      "Dead Cells: The Rogue-Lite Board Game faithfully translates the acclaimed video game's frantic action and permanent death mechanics to the tabletop. Battle through ever-changing dungeons filled with deadly enemies, collect powerful weapons, and attempt to reach the final boss before your inevitable demise.",
      "Each run feels completely fresh thanks to a modular dungeon system that randomizes room layouts, enemy placements, and loot drops. Choose your weapons wisely — brutality, tactics, and survival build paths each offer radically different playstyles that reward both mastery and bold improvisation.",
      "Die, learn, and grow stronger. Between runs, spend gathered Cells to unlock permanent upgrades that slightly tip the odds in your favor. With over 50 weapons, 30 enemy types, and 5 unique biomes, no two playthroughs are ever the same. The challenge is relentless — the satisfaction, unmatched.",
    ],
    players: "1–4",
    playTime: "45–90 mins",
    complexity: 4,
    designer: "Sébastien Pauchon",
    publisher: "Asmodee",
    tiktokId: "7390284756234891307",
    tiktokUser: "ludotutoriales",
    youtubeId: "zFHqkHhpVSc",
    stores: [
      { id: 1, name: "Zacatrus",        country: "🇪🇸", image: IMG("1677188010559-0667a1ed33a0"), gameTitle: "Dead Cells: El Juego de Mesa",           price: "€54.95", priceValue: 54.95, currency: "EUR", inStock: true,  stockLevel: "high", fulfillment: "shipping", storeRating: 4.8, reviewCount: 412 },
      { id: 2, name: "Philibert",        country: "🇫🇷", image: IMG("1529699211952-734e80c4d42b"), gameTitle: "Dead Cells: Le Jeu Rogue-Lite",          price: "€59.99", priceValue: 59.99, currency: "EUR", inStock: true,  stockLevel: "high", fulfillment: "both",     storeRating: 4.6, reviewCount: 1203 },
      { id: 3, name: "Ludonauta",        country: "🇪🇸", image: IMG("1606503153255-59d8b8b82176"), gameTitle: "Dead Cells: EL Juego de Mesa Rogue Lite", price: "€52.50", priceValue: 52.50, currency: "EUR", inStock: true,  stockLevel: "low",  fulfillment: "shipping", storeRating: 4.5, reviewCount: 287 },
      { id: 4, name: "Board Game Bliss", country: "🇺🇸", image: IMG("1585504198199-20277593b94f"), gameTitle: "Dead Cells: The Rogue-Lite Board Game",   price: "$64.99", priceValue: 64.99, currency: "USD", inStock: true,  stockLevel: "high", fulfillment: "shipping", storeRating: 4.7, reviewCount: 835 },
      { id: 5, name: "Mighty Ape",       country: "🇦🇺", image: IMG("1676651471150-0e3a5f8de05e"), gameTitle: "Dead Cells Board Game",                   price: "A$89.99",priceValue: 89.99, currency: "AUD", inStock: false, stockLevel: "out",  fulfillment: "shipping", storeRating: 4.4, reviewCount: 156 },
      { id: 6, name: "El Dragón Lúdico", country: "🇪🇸", image: IMG("1653080583467-cf46333f692e"), gameTitle: "Dead Cells: Juego de Mesa Rogue Lite",    price: "€56.00", priceValue: 56.00, currency: "EUR", inStock: true,  stockLevel: "high", fulfillment: "pickup",   storeRating: 4.9, reviewCount: 74 },
    ],
  },
};

// ---------------------------------------------------------------------------
// Mock generator for games without specific data
// ---------------------------------------------------------------------------

const PLAYER_COUNTS  = ["2–4", "2–6", "1–4", "3–6", "2–5"];
const PLAY_TIMES     = ["30–60 mins", "45–90 mins", "60–120 mins", "20–45 mins", "90–150 mins"];
const COMPLEXITIES   = [2, 3, 3, 4, 2];
const DESIGNERS      = ["Uwe Rosenberg", "Antoine Bauza", "Stefan Feld", "Vlaada Chvátil", "Martin Wallace"];
const PUBLISHERS     = ["Ravensburger", "Asmodee", "Fantasy Flight Games", "Z-Man Games", "Days of Wonder"];

const CATEGORY_POOL = [
  ["Abstract Strategy", "Two-Player"],
  ["City Building", "Economic", "Territory Building"],
  ["Cooperative", "Pandemic", "Survival"],
  ["Party Game", "Social Deduction", "Word Game"],
  ["Area Control", "Wargame", "Political"],
  ["Exploration", "Fantasy", "Adventure"],
  ["Card Game", "Hand Management"],
  ["Worker Placement", "Resource Management"],
  ["Deck Building", "Engine Building"],
  ["Tile Placement", "Pattern Building"],
];

const MECHANIC_POOL = [
  ["Open Drafting", "Tile Placement", "Pattern Recognition"],
  ["Worker Placement", "Resource Management", "Tableau Building"],
  ["Deck Building", "Hand Management", "Variable Player Powers"],
  ["Social Deduction", "Hidden Roles", "Voting"],
  ["Dice Rolling", "Push Your Luck", "Action Points"],
  ["Area Majority", "Network Building", "Route Building"],
  ["Layering", "Card Drafting", "Set Collection"],
  ["Modular Board", "Variable Set-up", "Campaign"],
  ["Simultaneous Action Selection", "Trading", "Negotiation"],
  ["Cooperative Play", "Communication Limits", "Role Playing"],
];

const STORE_NAMES: { name: string; country: string; fulfillment: StoreEntry["fulfillment"] }[] = [
  { name: "Zacatrus",         country: "🇪🇸", fulfillment: "shipping" },
  { name: "Philibert",        country: "🇫🇷", fulfillment: "both" },
  { name: "Ludonauta",        country: "🇪🇸", fulfillment: "shipping" },
  { name: "Board Game Bliss", country: "🇺🇸", fulfillment: "shipping" },
  { name: "Mighty Ape",       country: "🇦🇺", fulfillment: "shipping" },
];

const STORE_IMAGES = [
  IMG("1529699211952-734e80c4d42b"),
  IMG("1677188010559-0667a1ed33a0"),
  IMG("1606503153255-59d8b8b82176"),
  IMG("1585504198199-20277593b94f"),
  IMG("1676651471150-0e3a5f8de05e"),
];

const CURRENCIES = ["EUR", "EUR", "EUR", "USD", "AUD"];
const PRICES_BASE = [39.95, 42.99, 38.50, 44.99, 64.99];
const CURRENCY_SYMBOLS = ["€", "€", "€", "$", "A$"];

function mockDetail(game: Game): Omit<GameDetail, keyof Game> {
  const i = game.id % 5;
  return {
    rating: parseFloat((7.0 + (game.id % 20) / 10).toFixed(1)),
    categories: CATEGORY_POOL[game.id % CATEGORY_POOL.length],
    mechanics:  MECHANIC_POOL[game.id % MECHANIC_POOL.length],
    description: [
      `${game.name} is a captivating tabletop experience that challenges players to think strategically while adapting to constantly shifting circumstances. Rich in texture and replayability, each session reveals something new within its carefully crafted systems.`,
      `The game's mechanics reward forward planning while leaving meaningful room for creative improvisation. Players must balance immediate tactical needs against longer-term strategic goals, ensuring every decision carries real weight.`,
      `Suitable for both seasoned veterans and newcomers to the hobby, ${game.name} delivers an accessible yet deeply rewarding experience that earns its place at any game table.`,
    ],
    players:    PLAYER_COUNTS[i],
    playTime:   PLAY_TIMES[i],
    complexity: COMPLEXITIES[i],
    designer:   DESIGNERS[i],
    publisher:  PUBLISHERS[i],
    stores: STORE_NAMES.map((s, idx) => {
      const basePrice = PRICES_BASE[idx] + (game.id % 8) * 0.5;
      const stockSeed = (game.id + idx) % 4;
      const stockLevel: StoreEntry["stockLevel"] = stockSeed === 0 ? "out" : stockSeed === 1 ? "low" : "high";
      const titleVariants = [
        game.altTitle ?? game.name,
        game.name,
        `${game.name} – Board Game`,
        game.altTitle ? `${game.name} / ${game.altTitle}` : `${game.name} (Board Game)`,
        game.altTitle ?? `${game.name} Board Game`,
      ];
      return {
        id: idx + 1,
        name: s.name,
        country: s.country,
        image: STORE_IMAGES[idx],
        gameTitle: titleVariants[idx % titleVariants.length],
        price: `${CURRENCY_SYMBOLS[idx]}${basePrice.toFixed(2)}`,
        priceValue: basePrice,
        currency: CURRENCIES[idx],
        inStock: stockLevel !== "out",
        stockLevel,
        fulfillment: s.fulfillment,
        storeRating: parseFloat((4.2 + ((game.id + idx) % 8) / 10).toFixed(1)),
        reviewCount: 50 + ((game.id * 17 + idx * 31) % 1200),
      };
    }),
  };
}

export function getGameDetail(game: Game): GameDetail {
  const extra = specificDetail[game.id] ?? mockDetail(game);
  return { ...game, ...extra };
}
