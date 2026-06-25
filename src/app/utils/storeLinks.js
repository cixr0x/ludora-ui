export function storeOfferUrl(offer) {
  return [
    offer?.source_url,
    offer?.source_listing_url,
    offer?.store_website_url,
  ]
    .map(normalizeHttpUrl)
    .find(Boolean);
}

export function hasStoreOfferLinks(stores) {
  return Array.isArray(stores) && stores.some((store) => typeof store?.url === "string" && store.url.trim().length > 0);
}

function normalizeHttpUrl(value) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) return undefined;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") return parsed.href;
  } catch {
    return undefined;
  }

  return undefined;
}
