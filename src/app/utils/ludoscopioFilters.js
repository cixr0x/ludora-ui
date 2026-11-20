import { parsePositiveIntegerSetParam, setPositiveIntegerSetParam } from "./catalogSearch.js";

/** @typedef {import("../api/catalog").LudoscopioFilters} LudoscopioFilters */
/** @type {LudoscopioFilters["playtimes"]} */
const playtimeOptions = ["short", "medium", "long"];
const controlKeys = ["q", "players", "playtimes", "duration_min", "duration_max",
  "complexity_min", "complexity_max", "category_ids", "mechanic_ids"];

export function hasLudoscopioControlParams(params) {
  return controlKeys.some(key => params.has(key));
}

export function writeLudoscopioControlParams(params, filters) {
  let next = new URLSearchParams(params);
  const values = {
    q: filters.query,
    players: filters.players,
    playtimes: filters.playtimes.join(","),
    duration_min: filters.durationMin,
    duration_max: filters.durationMax,
    complexity_min: filters.complexityMin,
    complexity_max: filters.complexityMax,
  };
  for (const [key, value] of Object.entries(values)) {
    if (value === null || value === "") next.delete(key);
    else next.set(key, String(value));
  }
  next = setPositiveIntegerSetParam(next, "category_ids", filters.categoryIds);
  return setPositiveIntegerSetParam(next, "mechanic_ids", filters.mechanicIds);
}

/** @returns {LudoscopioFilters} */
export function readLudoscopioControlParams(params, theme, exactTitle) {
  const durationMin = readBound(params, "duration_min", 1, 100000);
  const durationMax = readBound(params, "duration_max", 1, 100000);
  const selectedPlaytimes = (params.get("playtimes") ?? "").split(",");
  return {
    players: readBound(params, "players", 1, 100),
    playtimes: durationMin === null && durationMax === null
      ? playtimeOptions.filter(key => selectedPlaytimes.includes(key)) : [],
    durationMin,
    durationMax,
    complexityMin: readBound(params, "complexity_min", 1, 5, false),
    complexityMax: readBound(params, "complexity_max", 1, 5, false),
    categoryIds: readIds(params, "category_ids"),
    mechanicIds: readIds(params, "mechanic_ids"),
    theme,
    exactTitle,
    query: params.get("q")?.trim() || null,
  };
}

export function sameLudoscopioFilters(left, right) {
  if (!left || !right) return left === right;
  return Object.keys(left).length === Object.keys(right).length
    && Object.entries(left).every(([key, value]) => JSON.stringify(value) === JSON.stringify(right[key]));
}

function readBound(params, key, min, max, wholeNumber = true) {
  const parsed = Number(params.get(key));
  return Number.isFinite(parsed) && (!wholeNumber || Number.isInteger(parsed)) && parsed >= min && parsed <= max
    ? parsed : null;
}

function readIds(params, key) {
  return [...parsePositiveIntegerSetParam(params.get(key))].sort((a, b) => a - b);
}
