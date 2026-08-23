export const SITE_NAME = "Ludo Radar";
export const DEFAULT_SITE_URL = "https://ludoradar.mx";
export const HOME_TITLE = "Ludo Radar  | Juegos de mesa en México: Descubre y compara precios";
export const HOME_DESCRIPTION =
  "Ludo Radar: La referencia de juegos de mesa en México. Descubre, conoce y encuentra la mejor oferta.";

export function siteRootUrl(value = DEFAULT_SITE_URL) {
  return `${String(value || DEFAULT_SITE_URL).replace(/\/+$/, "")}/`;
}
