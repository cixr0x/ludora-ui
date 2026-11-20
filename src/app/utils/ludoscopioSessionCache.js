import {
  readLudoscopioControlParams,
  sameLudoscopioFilters,
  withLudoscopioSuggestionDefaults,
  writeLudoscopioControlParams,
} from "./ludoscopioFilters.js";

const LUDOSCOPIO_SESSION_CACHE_KEY = "ludora:ludoscopio:session:v3";
const LEGACY_SESSION_CACHE_KEY = "ludora:ludoscopio:session:v2";

export function readLudoscopioSessionCache(storage = browserSessionStorage()) {
  try {
    const raw = storage?.getItem(LUDOSCOPIO_SESSION_CACHE_KEY);
    if (raw) return normalizeSessionCache(JSON.parse(raw));
    const legacy = storage?.getItem(LEGACY_SESSION_CACHE_KEY);
    return legacy ? normalizeSessionCache(JSON.parse(legacy), true) : null;
  } catch {
    return null;
  }
}

export function writeLudoscopioSessionCache(prompt, filters, results, storage = browserSessionStorage()) {
  const normalized = normalizeSessionCache({ prompt, filters, results });
  if (!normalized || !storage) return;

  try {
    storage.setItem(
      LUDOSCOPIO_SESSION_CACHE_KEY,
      JSON.stringify(normalized),
    );
    storage.removeItem(LEGACY_SESSION_CACHE_KEY);
  } catch {
  }
}

export function clearLudoscopioSessionCache(storage = browserSessionStorage()) {
  try {
    storage?.removeItem(LUDOSCOPIO_SESSION_CACHE_KEY);
    storage?.removeItem(LEGACY_SESSION_CACHE_KEY);
  } catch {
  }
}

function browserSessionStorage() {
  try {
    return typeof window === "undefined" ? undefined : window.sessionStorage;
  } catch {
    return undefined;
  }
}

function normalizeSessionCache(value, legacy = false) {
  const prompt = typeof value?.prompt === "string" ? value.prompt.trim() : "";
  if (!prompt || !Array.isArray(value.results)) return null;

  const results = value.results.map(normalizeResult);
  if (results.some((result) => !result)) return null;

  if (legacy) return { prompt, results };
  const { filters } = value;
  if (!filters || !nullableText(filters.theme, 250) || !nullableText(filters.exactTitle, 500)) return null;
  const params = writeLudoscopioControlParams(new URLSearchParams(), filters);
  const normalized = readLudoscopioControlParams(params, filters.theme, filters.exactTitle);
  return sameLudoscopioFilters(withLudoscopioSuggestionDefaults(filters), normalized)
    ? { prompt, results, filters: normalized } : null;
}

function normalizeResult(value) {
  const id = positiveInteger(value?.id);
  if (!id || typeof value.name !== "string" || typeof value.image !== "string" || !Array.isArray(value.genres)) return null;
  return { ...value, id };
}

function nullableText(value, limit) {
  return value === null || (typeof value === "string" && value.trim() === value && value.length > 0 && value.length <= limit);
}

function positiveInteger(value) {
  const normalized = typeof value === "string" && value.trim() ? Number(value) : value;
  return Number.isInteger(normalized) && normalized > 0 ? normalized : null;
}
