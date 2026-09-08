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

  if (["available", "in_stock", "instock", "disponible", "low_stock", "pocas_unidades"].includes(normalized)) return "available";
  return "unknown";
}

export function storeAvailabilityLabel(status) {
  if (status === "unknown") return "Disponibilidad por confirmar";
  if (status === "unavailable") return "No disponible";
  if (status === "out_of_stock") return "Agotado";
  return "";
}

export function storeAvailabilityRank(status) {
  if (status === "unknown") return 1.5;
  if (status === "unavailable") return 2;
  if (status === "out_of_stock") return 1;
  return 0;
}
