export const HOME_SEARCH_LIMIT = 8;
export const HOME_SEARCH_DEBOUNCE_MS = 200;

export function homeSearchQuery(value) {
  const query = String(value ?? "").trim();
  return query.length >= 2 ? query : "";
}
