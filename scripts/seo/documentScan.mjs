import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { canonicalFile } from "./manifest.mjs";

// Keep canonical paths once. Edges retain only deduplicated integer IDs, never
// substrings of a full HTML document or per-page copies of the source export.
export function createDocumentScan({ canonicalPaths, release, assetReferences }) {
  const ids = new Map(canonicalPaths.map((path, index) => [path, index]));
  const adjacency = new Array(canonicalPaths.length);
  const files = Object.create(null);
  let edgeCount = 0;
  if (ids.size !== canonicalPaths.length || !ids.has("/")) throw new Error("Invalid canonical scan inventory");

  async function scan(file, canonicalPath) {
    const index = ids.get(canonicalPath);
    if (index === undefined || adjacency[index]) throw new Error(`Unexpected or duplicate scanned page: ${canonicalPath}`);
    const bytes = await readFile(file);
    const document = bytes.toString("utf8");
    const canonical = new URL(canonicalPath, release.siteUrl).href;
    if (!document.includes(`rel="canonical" href="${canonical}"`) || !document.includes('<div id="root">')) throw new Error(`Invalid rendered canonical/root: ${canonicalPath}`);
    const policy = release.indexingEnabled ? "index, follow" : "noindex, nofollow";
    if (!document.includes(`<meta name="robots" content="${policy}"`)) throw new Error(`Invalid indexing policy: ${canonicalPath}`);
    for (const match of document.matchAll(/<script[^>]+type="application\/(?:ld\+)?json"[^>]*>([\s\S]*?)<\/script>/g)) JSON.parse(match[1]);
    for (const match of document.matchAll(/(?:src|href)="\/(assets\/[^"?#]+)(?:[?#][^"]*)?"/g)) assetReferences.add(decodeURIComponent(match[1]));
    const targets = new Set();
    for (const [, target] of document.matchAll(/<a\b[^>]*href="(\/[^"?#]*)/g)) {
      const targetId = ids.get(target);
      if (targetId !== undefined) targets.add(targetId);
      else if (/^\/(?:game|categoria|categorias|juegos-de-mesa)(?:\/|$)/.test(target)) throw new Error(`Missing generated link target ${target} from ${canonicalPath}`);
    }
    adjacency[index] = Uint32Array.from(targets);
    edgeCount += targets.size;
    files[canonicalFile(canonicalPath)] = createHash("sha256").update(bytes).digest("hex");
  }

  function validateGraph(checkDeadline = () => {}) {
    const reached = new Uint8Array(canonicalPaths.length), queue = new Uint32Array(canonicalPaths.length);
    const home = ids.get("/");
    queue[0] = home; reached[home] = 1;
    let count = 1;
    for (let cursor = 0; cursor < count; cursor++) {
      checkDeadline();
      const index = queue[cursor];
      if (!adjacency[index]) throw new Error(`Missing scanned document: ${canonicalPaths[index]}`);
      for (const target of adjacency[index]) if (!reached[target]) { reached[target] = 1; queue[count++] = target; }
    }
    for (let index = 0; index < canonicalPaths.length; index++) {
      checkDeadline();
      if (!reached[index]) throw new Error(`Unreachable generated page ${canonicalPaths[index]}`);
    }
    return { edges: edgeCount, adjacencyBytes: edgeCount * Uint32Array.BYTES_PER_ELEMENT };
  }

  return { files, scan, validateGraph };
}
