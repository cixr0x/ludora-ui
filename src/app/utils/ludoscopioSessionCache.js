const LUDOSCOPIO_SESSION_CACHE_KEY = "ludora:ludoscopio:session:v2";

export function readLudoscopioSessionCache(storage = browserSessionStorage()) {
  try {
    const raw = storage?.getItem(LUDOSCOPIO_SESSION_CACHE_KEY);
    if (!raw) return null;

    return normalizeSessionCache(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeLudoscopioSessionCache(prompt, results, storage = browserSessionStorage()) {
  const normalized = normalizeSessionCache({ prompt, results });
  if (!normalized || !storage) return;

  try {
    storage.setItem(
      LUDOSCOPIO_SESSION_CACHE_KEY,
      JSON.stringify(normalized),
    );
  } catch {
  }
}

export function clearLudoscopioSessionCache(storage = browserSessionStorage()) {
  try {
    storage?.removeItem(LUDOSCOPIO_SESSION_CACHE_KEY);
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

function normalizeSessionCache(value) {
  const prompt = typeof value?.prompt === "string" ? value.prompt.trim() : "";
  if (!prompt || !Array.isArray(value.results)) return null;

  const results = value.results.map(normalizeSemanticResult);
  if (results.some((result) => !result)) return null;

  return { prompt, results };
}

function normalizeSemanticResult(value) {
  const id = positiveInteger(value?.id);
  if (!id) return null;

  const result = { ...value, id };
  return isValidSemanticResult(result) ? result : null;
}

function isValidSemanticResult(value) {
  return (
    value &&
    Number.isInteger(value.id) &&
    typeof value.name === "string" &&
    Array.isArray(value.genres) &&
    Array.isArray(value.categories) &&
    Array.isArray(value.mechanics) &&
    Array.isArray(value.categoryNames) &&
    Array.isArray(value.mechanicNames) &&
    typeof value.minPlayers === "number" &&
    typeof value.maxPlayers === "number" &&
    nullableNumber(value.minMinutes) &&
    nullableNumber(value.maxMinutes) &&
    typeof value.complexity === "number"
  );
}

function nullableNumber(value) {
  return value === null || typeof value === "number";
}

function positiveInteger(value) {
  const normalized = typeof value === "string" && value.trim() ? Number(value) : value;
  return Number.isInteger(normalized) && normalized > 0 ? normalized : null;
}
