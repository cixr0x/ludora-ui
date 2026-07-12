export function storeAvailabilityState(availability, storeActive = true) {
  if (storeActive === false) return "unavailable";

  const normalized = String(availability ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  if (
    normalized.includes("out_of_stock") ||
    normalized.includes("outofstock") ||
    normalized.includes("sold_out") ||
    normalized.includes("soldout") ||
    normalized.includes("agotado") ||
    normalized.includes("sin_stock") ||
    normalized.includes("unavailable") ||
    normalized.includes("no_disponible")
  ) {
    return "out_of_stock";
  }

  return "available";
}

export function storeAvailabilityLabel(status) {
  if (status === "unavailable") return "No disponible";
  if (status === "out_of_stock") return "Agotado";
  return "";
}
