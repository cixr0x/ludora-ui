// Store data can contain arbitrary currency codes; retain only a bounded number
// of successful formatters across offer and catalog rendering.
const currencyFormatters = new Map();
const MAX_CURRENCY_FORMATTERS = 16;

export function formatStorePrice(value, currency = "MXN") {
  const numericPrice = Number(value);
  if (!Number.isFinite(numericPrice) || numericPrice === 0) return "Consultar";
  if (typeof currency !== "string" || !currency.trim()) return "Consultar";

  const normalizedCurrency =
    typeof currency === "string" && currency.trim() ? currency.trim().toUpperCase() : "MXN";

  try {
    let formatter = currencyFormatters.get(normalizedCurrency);
    if (!formatter) {
      formatter = new Intl.NumberFormat("es-MX", {
        currency: normalizedCurrency,
        style: "currency",
      });
      if (currencyFormatters.size >= MAX_CURRENCY_FORMATTERS) {
        currencyFormatters.delete(currencyFormatters.keys().next().value);
      }
      currencyFormatters.set(normalizedCurrency, formatter);
    }
    return formatter.format(numericPrice);
  } catch {
    return `${normalizedCurrency} ${numericPrice.toFixed(2)}`;
  }
}
