import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const searchSource = () => readFileSync(new URL("../pages/Search.tsx", import.meta.url), "utf8");

test("search page loads more catalog results with offset-based infinite scrolling", () => {
  const source = searchSource();

  assert.match(source, /const SEARCH_PAGE_SIZE = 60/);
  assert.match(source, /appendUniqueCatalogResults/);
  assert.match(source, /hasMoreCatalogResults/);
  assert.match(source, /const \[nextOffset, setNextOffset\] = useState\(0\)/);
  assert.match(source, /const \[isLoadingMore, setIsLoadingMore\] = useState\(false\)/);
  assert.match(source, /offset: nextOffset/);
  assert.match(source, /IntersectionObserver/);
  assert.match(source, /loadMoreRef/);
  assert.match(source, /Cargando más juegos/);
});
