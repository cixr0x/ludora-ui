const FEATURED_GAME_LIMIT = 8;

export function selectFeaturedGames(rows) {
  if (!Array.isArray(rows)) {
    throw new Error("Homepage prerender feed did not contain a rows array");
  }

  const featuredGames = [];
  const seenIds = new Set();

  for (const [rowIndex, row] of rows.entries()) {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      throw new Error(`Homepage prerender row ${rowIndex} must be an object`);
    }
    if (!Array.isArray(row.products)) {
      throw new Error(`Homepage prerender row ${rowIndex} products must be an array`);
    }

    for (const [productIndex, product] of row.products.entries()) {
      if (!product || typeof product !== "object" || Array.isArray(product)) {
        throw new Error(`Homepage prerender product ${rowIndex}:${productIndex} must be an object`);
      }

      const id = Number(product?.id);
      const name = preferredName(product);
      if (!Number.isInteger(id) || id <= 0) {
        throw new Error(`Homepage prerender product ${rowIndex}:${productIndex} must have a positive integer id`);
      }
      if (!name) {
        throw new Error(`Homepage prerender product ${rowIndex}:${productIndex} must have a canonical name`);
      }
      if (seenIds.has(id)) continue;

      seenIds.add(id);
      if (featuredGames.length < FEATURED_GAME_LIMIT) {
        featuredGames.push({ id, name });
      }
    }
  }

  if (featuredGames.length === 0) {
    throw new Error("Homepage prerender feed did not contain usable featured games");
  }

  return featuredGames;
}

function preferredName(product) {
  return [product?.canonical_name_es, product?.canonical_name]
    .find((value) => typeof value === "string" && value.trim())
    ?.trim();
}
