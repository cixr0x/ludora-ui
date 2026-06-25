export function buildCatalogSearchParams(filters) {
  const params = new URLSearchParams();
  const query = String(filters.query ?? "").trim();
  const categoryIds = uniquePositiveIntegers(filters.categoryIds ?? []);
  const mechanicIds = uniquePositiveIntegers(filters.mechanicIds ?? []);
  const playtimeRanges = Array.isArray(filters.playtimeRanges) ? filters.playtimeRanges : [];
  const durationMin = minRangeValue(playtimeRanges, 0);
  const durationMax = maxRangeValue(playtimeRanges, 1);
  const complexity = Array.isArray(filters.complexity) ? filters.complexity : [1, 5];
  const complexityMin = Number(complexity[0]);
  const complexityMax = Number(complexity[1]);
  const players = filters.players === null || filters.players === undefined ? undefined : Number(filters.players);
  const limit = Number(filters.limit);
  const offset = Number(filters.offset);

  if (query) params.set("q", query);
  if (Number.isInteger(players) && players > 0) params.set("players", String(players));
  if (Number.isFinite(durationMin)) params.set("duration_min", String(durationMin));
  if (Number.isFinite(durationMax)) params.set("duration_max", String(durationMax));
  if (Number.isFinite(complexityMin) && Number.isFinite(complexityMax) && (complexityMin !== 1 || complexityMax !== 5)) {
    params.set("complexity_min", String(complexityMin));
    params.set("complexity_max", String(complexityMax));
  }
  if (categoryIds.length > 0) params.set("category_ids", categoryIds.join(","));
  if (mechanicIds.length > 0) params.set("mechanic_ids", mechanicIds.join(","));
  if (Number.isInteger(limit) && limit > 0) params.set("limit", String(limit));
  if (Number.isInteger(offset) && offset > 0) params.set("offset", String(offset));

  return params;
}

export function buildExploreTaxonomyPath(categoryType, categoryId) {
  const id = Number(categoryId);
  if (!Number.isInteger(id) || id <= 0) return "/search";

  const paramName = taxonomyParamName(categoryType);
  if (!paramName) return "/search";

  const params = new URLSearchParams();
  params.set(paramName, String(id));
  return `/search?${params.toString()}`;
}

export function parsePositiveIntegerSetParam(value) {
  return new Set(parsePositiveIntegerList(value));
}

export function sortTaxonomyOptionsByActive(options, activeIds) {
  const activeIdSet = activeIds instanceof Set ? activeIds : new Set(activeIds ?? []);

  return [...options].sort((left, right) => {
    const leftActive = activeIdSet.has(left.id);
    const rightActive = activeIdSet.has(right.id);
    if (leftActive !== rightActive) return leftActive ? -1 : 1;
    return left.name.localeCompare(right.name, "es");
  });
}

function uniquePositiveIntegers(values) {
  return Array.from(new Set(parsePositiveIntegerList(values)));
}

function parsePositiveIntegerList(value) {
  const values = Array.isArray(value) ? value : [value];

  return values
    .flatMap((entry) => String(entry ?? "").split(","))
    .map((entry) => Number(entry.trim()))
    .filter((entry) => Number.isInteger(entry) && entry > 0);
}

function taxonomyParamName(categoryType) {
  if (categoryType === "category") return "category_ids";
  if (categoryType === "mechanic") return "mechanic_ids";
  return "";
}

function minRangeValue(ranges, index) {
  const values = ranges.map((range) => Number(range?.[index])).filter(Number.isFinite);
  return values.length > 0 ? Math.min(...values) : undefined;
}

function maxRangeValue(ranges, index) {
  const values = ranges.map((range) => Number(range?.[index])).filter(Number.isFinite);
  return values.length > 0 ? Math.max(...values) : undefined;
}
