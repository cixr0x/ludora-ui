export function storeItemClickEndpoint(storeItemId, apiBaseUrl = defaultApiBaseUrl()) {
  const id = Number(storeItemId);
  const baseUrl = String(apiBaseUrl ?? "").replace(/\/$/, "");
  return `${baseUrl}/api/store-items/${id}/clicks`;
}

export function reportStoreItemClick(storeItemId, options = {}) {
  const id = Number(storeItemId);
  if (!Number.isInteger(id) || id <= 0) return false;

  const endpoint = storeItemClickEndpoint(id, options.apiBaseUrl ?? defaultApiBaseUrl());
  const navigatorObject = options.navigatorObject ?? globalThis.navigator;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch?.bind(globalThis);

  try {
    if (typeof navigatorObject?.sendBeacon === "function" && navigatorObject.sendBeacon(endpoint)) {
      return true;
    }
  } catch {
    // Best-effort analytics must not block the outbound click.
  }

  if (typeof fetchImpl === "function") {
    try {
      const fetchResult = fetchImpl(endpoint, {
        keepalive: true,
        method: "POST",
      });
      if (typeof fetchResult?.catch === "function") {
        void fetchResult.catch(() => undefined);
      }
      return true;
    } catch {
      return false;
    }
  }

  return false;
}

function defaultApiBaseUrl() {
  return ((import.meta.env?.VITE_LUDORA_API_URL ?? "")).replace(/\/$/, "");
}
