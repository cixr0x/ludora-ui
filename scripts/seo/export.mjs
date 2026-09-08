import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { productPath } from "../../src/app/utils/productRoutes.js";
import { apiMinimumPrice } from "../../src/app/utils/offerSeo.js";

export async function fetchSeoExport({ apiOrigin, fetchImpl = fetch, spoolParent = tmpdir(), signal, onProgress = () => {} }) {
  await mkdir(spoolParent, { recursive: true });
  const directory = await mkdtemp(join(spoolParent, "export-"));
  const cleanup = () => rm(directory, { recursive: true, force: true });
  const items = [];
  const ids = new Set();
  const references = new Set();
  const stats = { games: 0, offers: 0, related: 0, expansions: 0, batches: 0, serializedBytes: 0 };
  let afterId = 0;
  let maxId;
  try {
    while (items.length <= 100000) {
      signal?.throwIfAborted();
      const query = new URLSearchParams({ after_id: String(afterId), limit: "200" });
      if (maxId !== undefined) query.set("maxId", String(maxId));
      const response = await fetchImpl(`${apiOrigin.replace(/\/+$/, "")}/api/items/prerender?${query}`, { signal });
      if (!response.ok) throw new Error(`SEO export request failed with ${response.status}`);
      const envelope = await response.json();
      const meta = envelope?.meta;
      if (!Array.isArray(envelope?.data) || !meta || meta.export_version !== 2 || meta.pagination !== "keyset" ||
        meta.after_id !== afterId || meta.count !== envelope.data.length || meta.limit !== 200 || envelope.data.length > 200) {
        throw new Error("Malformed SEO export v2 envelope");
      }
      if (!Number.isSafeInteger(meta.max_id) || meta.max_id < 0 || (maxId !== undefined && meta.max_id !== maxId)) {
        throw new Error("SEO export maximum max_id changed or is invalid");
      }
      maxId = meta.max_id;
      stats.batches++;
      let lastId = afterId;
      for (const record of envelope.data) {
        const id = Number(record?.id);
        if (!Number.isSafeInteger(id) || id <= lastId || id > maxId || ids.has(id) ||
          typeof record?.canonical_name !== "string" || !record.canonical_name.trim()) throw new Error("Invalid or repeated SEO export item");
        const name = record.canonical_name_es?.trim() || record.canonical_name.trim();
        if (record.canonical_path !== productPath(id, name)) throw new Error(`Invalid canonical path for export item ${id}`);
        for (const key of ["categories", "mechanics", "families", "designers", "publishers", "parent_items", "offers", "related_items", "expansion_items"]) {
          if (!Array.isArray(record[key])) throw new Error(`Missing ${key} array on export item ${id}`);
        }
        for (const reference of [...record.parent_items, ...record.related_items, ...record.expansion_items]) {
          const refId = Number(reference?.id);
          if (!Number.isSafeInteger(refId) || refId <= 0 || refId > maxId || !reference.canonical_name?.trim()) {
            throw new Error(`Invalid relationship on export item ${id}`);
          }
          references.add(refId);
        }
        const serialized = JSON.stringify(record);
        await writeFile(join(directory, `${id}.json`), serialized, { flag: "wx" });
        items.push({ id, name, canonicalPath: record.canonical_path, image: record.image_url_es || record.image_url || "",
          minimumPrice: apiMinimumPrice(record.offers),
          categories: record.categories.map(category => ({ id: Number(category.id), name: category.name_es?.trim() || category.name?.trim() })),
          canonical_path: record.canonical_path, canonical_name: record.canonical_name, canonical_name_es: record.canonical_name_es });
        stats.games++; stats.offers += record.offers.length;
        stats.related += record.related_items.length; stats.expansions += record.expansion_items.length;
        stats.serializedBytes += Buffer.byteLength(serialized);
        ids.add(id); lastId = id;
      }
      if (meta.next_after_id !== lastId) throw new Error("SEO export returned a nonadvancing or invalid next_after_id");
      onProgress({ ...stats });
      if (!envelope.data.length) {
        if (!items.length) throw new Error("Unexpected empty SEO export");
        if (afterId !== maxId) throw new Error("SEO export ended before its captured maximum ID");
        for (const id of references) if (!ids.has(id)) throw new Error(`SEO export is missing relationship target ${id}`);
        return { complete: true, maxId, items, stats, directory, cleanup,
          readItem: async id => {
            if (!ids.has(Number(id))) throw new Error(`Unknown export item ${id}`);
            return JSON.parse(await readFile(join(directory, `${Number(id)}.json`), "utf8"));
          } };
      }
      afterId = lastId;
    }
    throw new Error("SEO export exceeds the supported 100000 item range");
  } catch (error) {
    // Retain source/validation failure as the primary error if spool removal fails too.
    try { await cleanup(); }
    catch (cleanupError) {
      error.cleanupErrors = [...(error.cleanupErrors ?? []), { phase: "export-spool", error: cleanupError.message, code: cleanupError.code }];
    }
    throw error;
  }
}
