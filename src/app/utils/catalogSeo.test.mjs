import assert from "node:assert/strict";
import test from "node:test";
import { catalogPath, categoryPath, paginateCatalog, buildCatalogIndex, catalogPageModel, catalogPageDescriptors, parseCatalogDocument } from "./catalogSeo.js";

const items = Array.from({ length: 49 }, (_, n) => ({ id: n + 1, name: `Juego ${String(n + 1).padStart(2, "0")}`,
  canonicalPath: `/game/${n + 1}/juego-${String(n + 1).padStart(2, "0")}`, image: "", minimumPrice: n === 0 ? 350 : null,
  categories: n === 48 ? [] : [{ id: 7, name: "Estrategía" }] }));

test("catalog and category pagination have one canonical path and strict boundaries", () => {
  assert.equal(catalogPath(1), "/juegos-de-mesa");
  assert.equal(catalogPath(2), "/juegos-de-mesa/pagina/2");
  assert.equal(categoryPath({ id: 7, name: "Estrategía", page: 2 }), "/categoria/7/estrategia/pagina/2");
  for (const page of [0, -1, 1.5, "2", NaN]) assert.throws(() => catalogPath(page));
  assert.equal(paginateCatalog([...items].reverse(), 1, 48).items[0].id, 1);
  assert.equal(paginateCatalog(items, 1, 48).items.length, 48);
  assert.equal(paginateCatalog(items, 2, 48).items.length, 1);
  assert.equal(paginateCatalog(items, 1, 48).nextPath, "/juegos-de-mesa/pagina/2");
  assert.equal(paginateCatalog(items, 2, 48).previousPath, "/juegos-de-mesa");
  assert.throws(() => paginateCatalog(items, 3, 48));
});

test("compact indexes include uncategorized games and only nonempty categories", () => {
  const index = buildCatalogIndex(items);
  const descriptors = [...catalogPageDescriptors(index)];
  assert.deepEqual(descriptors.map(d => catalogPageModel(index, d).canonicalPath), [
    "/juegos-de-mesa", "/juegos-de-mesa/pagina/2", "/categorias", "/categoria/7/estrategia",
  ]);
  const page = catalogPageModel(index, { kind: "catalog", page: 2 });
  assert.equal(page.items[0].id, 49);
  assert.equal(page.totalItems, 49);
  const category = catalogPageModel(index, { kind: "category", categoryId: 7, page: 1 });
  assert.equal(category.totalItems, 48);
  assert.equal(category.items[0].minimumPrice, 350);
  assert.equal(category.items[0].offers, undefined);
  assert.throws(() => catalogPageModel(index, { kind: "category", categoryId: 7, page: 2 }));
});

test("HTML navigation accepts only the inert route-matched page payload", () => {
  const page = { ...catalogPageModel(buildCatalogIndex(items), { kind: "catalog", page: 1 }), indexingEnabled: true };
  const html = `<script>throw new Error('never execute')</script><script id="ludo-radar-prerender-data" type="application/json">${JSON.stringify({ catalogPage: page })}</script>`;
  assert.equal(parseCatalogDocument(html, "/juegos-de-mesa").items.length, 48);
  assert.throws(() => parseCatalogDocument(html, "/juegos-de-mesa/pagina/2"));
  assert.throws(() => parseCatalogDocument('<script type="application/json">{}</script>', "/juegos-de-mesa"));
  const invalid = { ...page, items: [{ ...page.items[0], canonicalPath: "https://wrong.example/game" }] };
  assert.throws(() => parseCatalogDocument(html.replace(JSON.stringify(page), JSON.stringify(invalid)), "/juegos-de-mesa"));
});

test("large catalogs keep a compact pagination window with first, last and adjacent links", () => {
  const many = Array.from({ length: 7148 }, (_, n) => ({ ...items[0], id: n + 1, name: `Game ${n + 1}`, categories: [] }));
  const model = catalogPageModel(buildCatalogIndex(many), { kind: "catalog", page: 76 });
  assert.equal(model.pageCount, 149);
  assert.deepEqual(model.pageLinks.filter(link => link.path).map(link => link.page), [1, 74, 75, 76, 77, 78, 149]);
  assert.equal(model.pageLinks.length, 9);
  assert.equal(model.nextPath, "/juegos-de-mesa/pagina/77");
});
