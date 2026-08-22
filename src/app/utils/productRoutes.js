const PRODUCT_SLUG_FALLBACK = "juego-de-mesa";

export function productSlug(value) {
  const source = typeof value === "string" ? value.trim() : "";
  const slug = source
    .normalize("NFKD")
    .replace(/\p{Mark}+/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || PRODUCT_SLUG_FALLBACK;
}

export function productPath(id, name) {
  const parsedId = Number(id);
  if (!Number.isInteger(parsedId) || parsedId <= 0) {
    throw new Error("Product route id must be a positive integer");
  }

  return `/game/${parsedId}/${productSlug(name)}`;
}
