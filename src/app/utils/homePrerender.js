const FEATURED_GAME_LIMIT = 8;

export function selectFeaturedGames(rows) {
  const featuredGames = [];
  const seenIds = new Set();

  for (const row of rows) {
    for (const product of Array.isArray(row?.products) ? row.products : []) {
      const id = Number(product?.id);
      const name = preferredName(product);
      if (!Number.isInteger(id) || id <= 0 || !name || seenIds.has(id)) continue;

      seenIds.add(id);
      featuredGames.push({ id, name });
      if (featuredGames.length === FEATURED_GAME_LIMIT) return featuredGames;
    }
  }

  return featuredGames;
}

function preferredName(product) {
  return [product?.canonical_name_es, product?.canonical_name]
    .find((value) => typeof value === "string" && value.trim())
    ?.trim();
}
