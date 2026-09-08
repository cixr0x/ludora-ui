import { createHash, randomUUID } from "node:crypto";

const volatileKeys = new Set(["updated_at", "last_updated", "last_seen_at", "refreshed_date", "store_updated_at",
  "bgg_last_sync_at", "lastUpdated", "lastSeenAt", "refreshedDate", "storeUpdatedAt", "publishedAt", "generatedAt", "raw_price"]);

export function contentFingerprint(value) {
  const normalize = value => {
    if (Array.isArray(value)) return value.map(normalize);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(Object.keys(value).filter(key => !volatileKeys.has(key)).sort().map(key => [key, normalize(value[key])]));
  };
  return createHash("sha256").update(JSON.stringify(normalize(value))).digest("hex");
}

export function canonicalFile(canonicalPath) {
  if (canonicalPath === "/") return "index.html";
  if (typeof canonicalPath !== "string" || !/^\/[a-z0-9]+(?:[/-][a-z0-9]+)*$/.test(canonicalPath)) {
    throw new Error(`Unsafe canonical path: ${canonicalPath}`);
  }
  return `${canonicalPath.slice(1)}.html`;
}

export function reconcilePages({ previous, candidates, publishedAt, uiSha }) {
  if (!Number.isFinite(Date.parse(publishedAt)) || typeof uiSha !== "string" || !uiSha) throw new Error("Invalid manifest version metadata");
  const pages = {};
  const changedPaths = [];
  for (const candidate of candidates) {
    canonicalFile(candidate.canonicalPath);
    if (Object.hasOwn(pages, candidate.canonicalPath)) throw new Error(`Duplicate canonical path ${candidate.canonicalPath}`);
    if (typeof candidate.fingerprint !== "string" || !candidate.fingerprint) throw new Error("Missing content fingerprint");
    const old = previous?.pages?.[candidate.canonicalPath];
    const unchanged = previous?.uiSha === uiSha && old?.fingerprint === candidate.fingerprint;
    pages[candidate.canonicalPath] = { canonicalPath: candidate.canonicalPath, fingerprint: candidate.fingerprint,
      lastmod: unchanged ? old.lastmod : publishedAt };
    if (!unchanged) changedPaths.push(candidate.canonicalPath);
  }
  return { manifest: { version: 1, uiSha, generationId: randomUUID(), publishedAt, pages }, changedPaths,
    removedPaths: Object.keys(previous?.pages ?? {}).filter(path => !Object.hasOwn(pages, path)) };
}
