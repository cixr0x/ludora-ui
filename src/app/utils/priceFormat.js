export function formatStorePrice(value, currency = "MXN") {
  const numericPrice = Number(value);
  if (!Number.isFinite(numericPrice) || numericPrice === 0) return "Consultar";

  const normalizedCurrency =
    typeof currency === "string" && currency.trim() ? currency.trim().toUpperCase() : "MXN";

  try {
    return new Intl.NumberFormat("es-MX", {
      currency: normalizedCurrency,
      style: "currency",
    }).format(numericPrice);
  } catch {
    return `${normalizedCurrency} ${numericPrice.toFixed(2)}`;
  }
}
