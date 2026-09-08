export const SITE_NAME = "Ludo Radar";
export const DEFAULT_SITE_URL = "https://www.ludoradar.mx";
export const HOME_TITLE = "Juegos de mesa en México: Descubre y compara precios | Ludo Radar";
export const HOME_DESCRIPTION =
  "Compara precios de juegos de mesa en tiendas de México. Consulta disponibilidad, descubre juegos y encuentra dónde comprarlos.";

export function siteRootUrl(value = DEFAULT_SITE_URL) {
  return `${String(value || DEFAULT_SITE_URL).replace(/\/+$/, "")}/`;
}
