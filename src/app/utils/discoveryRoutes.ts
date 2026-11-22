import type { DiscoveryMode } from "../api/catalog";

export const RADAR_PATH = "/search?tab=radar";
export function discoveryPath(mode: DiscoveryMode, ids: number[] = [], results = false): string {
  const params = new URLSearchParams({ tab: "radar", tool: mode === "mix" ? "mezcla" : "similares" });
  if (ids.length) params.set("ids", ids.join(","));
  if (results) params.set("ver", "resultados");
  return `/search?${params}`;
}

export function readDiscoveryIds(raw: string | null, mode: DiscoveryMode): number[] | null {
  if (raw === null || raw === "") return [];
  if (raw.length > 50) return null;
  const parts = raw.split(",");
  const ids = parts.map(Number);
  if (parts.length > (mode === "mix" ? 3 : 1) || new Set(ids).size !== ids.length ||
    parts.some((part, i) => !/^[1-9]\d*$/.test(part) || !Number.isSafeInteger(ids[i]))) return null;
  return ids;
}
