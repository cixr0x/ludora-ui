export const publishedAt = "2026-09-08T06:00:00.000Z";
export const offer = {
  id: 10, store_id: 7, store_name: "Tienda Mesa", game_title: "Dixit edición española",
  source_url: "https://tienda.example/dixit", price: "350.00", currency: "MXN",
  availability: "available", store_active: true, listing_status: "LISTED", is_bundle: false,
  language: "es", refreshed_date: "2026-09-07T20:00:00.000Z",
};
export const item = {
  id: 851, canonical_name: "Dixit", canonical_path: "/game/851/dixit",
  description: "Un juego de imaginación.", min_players: 3, max_players: 6,
  categories: [], mechanics: [], designers: [], publishers: [], parent_items: [],
  offers: [offer],
  related_items: [{ id: 852, canonical_name: "Juego relacionado", image_url: "" }],
  expansion_items: [{ id: 853, canonical_name: "Expansión de Dixit", image_url: "" }],
};

export function jsonScript(document, id) {
  const matches = [...document.matchAll(new RegExp(`<script id="${id}"[^>]*>([\\s\\S]*?)<\\/script>`, "g"))];
  if (matches.length !== 1) throw new Error(`Expected one ${id} script`);
  return JSON.parse(matches[0][1]);
}

export function visibleText(document) {
  return document.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "").replace(/<[^>]*>/g, "")
    .replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

export function catalogFixtures() {
  return Array.from({ length: 50 }, (_, n) => {
    const name = `Juego ${String(n + 1).padStart(2, "0")}`;
    return { ...item, id: n + 1, canonical_name: name, canonical_path: `/game/${n + 1}/juego-${String(n + 1).padStart(2, "0")}`,
      offers: n === 0 ? [{ ...offer, game_title: name }] : [], related_items: [], expansion_items: [],
      categories: n < 49 ? [{ id: 7, name: "Estrategia" }] : [] };
  });
}
