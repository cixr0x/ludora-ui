const LUDOSCOPIO_SESSION_CACHE_KEY = "ludora:ludoscopio:session:v2";

export function readLudoscopioSessionCache(storage = browserSessionStorage()) {
  try {
    const raw = storage?.getItem(LUDOSCOPIO_SESSION_CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!isValidSessionCache(parsed)) return null;

    return parsed;
  } catch {
    return null;
  }
}

export function writeLudoscopioSessionCache(prompt, results, storage = browserSessionStorage()) {
  const normalizedPrompt = typeof prompt === "string" ? prompt.trim() : "";
  if (!normalizedPrompt || !Array.isArray(results) || !storage) return;

  try {
    storage.setItem(
      LUDOSCOPIO_SESSION_CACHE_KEY,
      JSON.stringify({ prompt: normalizedPrompt, results }),
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

function isValidSessionCache(value) {
  return (
    value &&
    typeof value.prompt === "string" &&
    value.prompt.trim().length > 0 &&
    Array.isArray(value.results) &&
    value.results.every(isValidSemanticResult)
  );
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
