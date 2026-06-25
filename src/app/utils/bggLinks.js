export const BGG_LOGO_URL = "https://cf.geekdo-static.com/images/logos/navbar-logo-bgg-b2.svg";

export function bggItemUrl(item) {
  const url = String(item?.bgg_url ?? "").trim();
  return url || undefined;
}
