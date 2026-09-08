import { productPath, productSlug } from "./productRoutes.js";

export const CATALOG_PAGE_SIZE = 48;
function positive(value) {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error("Page and category IDs must be positive integers");
  return value;
}
export function catalogPath(page = 1) { return positive(page) === 1 ? "/juegos-de-mesa" : `/juegos-de-mesa/pagina/${page}`; }
export function categoryPath({ id, name, page = 1 }) {
  const path = `/categoria/${positive(id)}/${productSlug(name)}`;
  return positive(page) === 1 ? path : `${path}/pagina/${page}`;
}
const collator = new Intl.Collator("es", { sensitivity: "base" });
function order(left, right) { return collator.compare(left.name, right.name) || left.id - right.id; }

export function paginateCatalog(items, page = 1, size = CATALOG_PAGE_SIZE, pathForPage = catalogPath, alreadySorted = false) {
  positive(page); positive(size);
  const ordered = alreadySorted ? items : [...items].sort(order);
  const pageCount = Math.max(1, Math.ceil(ordered.length / size));
  if (page > pageCount) throw new Error("Catalog page is out of range");
  return { items: ordered.slice((page - 1) * size, page * size), page, pageCount, totalItems: ordered.length,
    previousPath: page > 1 ? pathForPage(page - 1) : null, nextPath: page < pageCount ? pathForPage(page + 1) : null };
}

export function buildCatalogIndex(items) {
  const ordered = [...items].sort(order);
  const categories = new Map();
  for (const item of ordered) {
    const seen = new Set();
    for (const category of item.categories ?? []) {
      positive(category.id);
      if (typeof category.name !== "string" || !category.name.trim()) throw new Error("Invalid catalog category");
      if (seen.has(category.id)) continue;
      seen.add(category.id);
      const current = categories.get(category.id);
      if (current && current.name !== category.name) throw new Error("Category identity changed within export");
      if (!current) categories.set(category.id, { id: category.id, name: category.name, items: [] });
      categories.get(category.id).items.push(item);
    }
  }
  return { items: ordered, categories };
}

export function* catalogPageDescriptors(index) {
  for (let page = 1; page <= Math.max(1, Math.ceil(index.items.length / CATALOG_PAGE_SIZE)); page++) yield { kind: "catalog", page };
  yield { kind: "categories" };
  for (const category of [...index.categories.values()].sort(order)) {
    for (let page = 1; page <= Math.ceil(category.items.length / CATALOG_PAGE_SIZE); page++) yield { kind: "category", categoryId: category.id, page };
  }
}

export function catalogPageModel(index, descriptor) {
  const { kind, page = 1, categoryId } = descriptor;
  if (kind === "categories") return { version: 1, kind, canonicalPath: "/categorias",
    categories: [...index.categories.values()].sort(order).map(category => ({ id: category.id, name: category.name,
      count: category.items.length, canonicalPath: categoryPath(category) })) };
  if (!["catalog", "category"].includes(kind)) throw new Error("Unknown catalog page kind");
  const category = kind === "category" ? index.categories.get(categoryId) : null;
  if (kind === "category" && !category) throw new Error("Unknown category");
  const pathForPage = category ? value => categoryPath({ ...category, page: value }) : catalogPath;
  const pagination = paginateCatalog(category?.items ?? index.items, page, CATALOG_PAGE_SIZE, pathForPage, true);
  const numbers = [...new Set([1, pagination.pageCount, ...Array.from({ length: 5 }, (_, n) => page + n - 2)])]
    .filter(value => value >= 1 && value <= pagination.pageCount).sort((a, b) => a - b);
  const pageLinks = [];
  for (let index = 0; index < numbers.length; index++) {
    if (index > 0 && numbers[index] - numbers[index - 1] > 1) pageLinks.push({ page: null, path: null });
    pageLinks.push({ page: numbers[index], path: pathForPage(numbers[index]) });
  }
  return { version: 1, kind, canonicalPath: pathForPage(page), ...pagination,
    items: pagination.items.map(item => ({ id: item.id, name: item.name, canonicalPath: item.canonicalPath,
      image: item.image, minimumPrice: item.minimumPrice })),
    category: category ? { id: category.id, name: category.name } : null,
    pageLinks };
}

export function catalogSeoMetadata(model) {
  const suffix = model.page > 1 ? ` — página ${model.page}` : "";
  if (model.kind === "categories") return { title: "Categorías de juegos de mesa | Ludo Radar",
    heading: "Categorías de juegos de mesa", description: "Explora las categorías de juegos de mesa y compara precios en tiendas de México." };
  if (model.kind === "category") return { title: `${model.category.name}: juegos de mesa${suffix} | Ludo Radar`,
    heading: `Juegos de mesa de ${model.category.name}${suffix}`,
    description: `Explora ${model.totalItems} juegos de mesa de ${model.category.name}. Compara precios y disponibilidad en tiendas de México.${suffix}` };
  return { title: `Juegos de mesa: compara precios en México${suffix} | Ludo Radar`,
    heading: `Juegos de mesa en México${suffix}`,
    description: `Explora ${model.totalItems} juegos de mesa y compara precios y disponibilidad en tiendas de México.${suffix}` };
}

export function parseCatalogDocument(html, canonicalPath) {
  const match = html.match(/<script id="ludo-radar-prerender-data" type="application\/json">([\s\S]*?)<\/script>/);
  const model = match ? JSON.parse(match[1]).catalogPage : undefined;
  if (!model || model.version !== 1 || model.canonicalPath !== canonicalPath ||
    typeof model.indexingEnabled !== "boolean" || !["catalog", "category", "categories"].includes(model.kind)) throw new Error("Invalid catalog navigation payload");
  if (model.kind === "categories") {
    if (canonicalPath !== "/categorias" || !Array.isArray(model.categories)) throw new Error("Invalid category directory");
    for (const entry of model.categories) {
      if (typeof entry.name !== "string" || !entry.name.trim() || !Number.isSafeInteger(entry.count) || entry.count < 1 ||
        categoryPath(entry) !== entry.canonicalPath) throw new Error("Invalid category navigation target");
    }
  } else {
    positive(model.page); positive(model.pageCount);
    if (model.page > model.pageCount || !Array.isArray(model.items) || model.items.length > CATALOG_PAGE_SIZE ||
      !Array.isArray(model.pageLinks)) throw new Error("Invalid catalog pagination payload");
    const expected = model.kind === "catalog" ? catalogPath(model.page) : categoryPath({ ...model.category, page: model.page });
    if (expected !== canonicalPath) throw new Error("Catalog payload path mismatch");
    if (!Number.isSafeInteger(model.totalItems) || model.totalItems < 0 ||
      model.pageCount !== Math.max(1, Math.ceil(model.totalItems / CATALOG_PAGE_SIZE))) throw new Error("Invalid catalog count");
    for (const item of model.items) {
      positive(item.id);
      if (typeof item.name !== "string" || !item.name.trim() || typeof item.image !== "string" ||
        productPath(item.id, item.name) !== item.canonicalPath ||
        (item.minimumPrice !== null && (typeof item.minimumPrice !== "number" || !Number.isFinite(item.minimumPrice) || item.minimumPrice <= 0))) {
        throw new Error("Invalid compact catalog card");
      }
    }
    for (const link of model.pageLinks) {
      if (link.page === null && link.path === null) continue;
      positive(link.page);
      const expectedPath = model.kind === "catalog" ? catalogPath(link.page) : categoryPath({ ...model.category, page: link.page });
      if (link.page > model.pageCount || link.path !== expectedPath) throw new Error("Invalid pagination link");
    }
  }
  return model;
}
