import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { createDocumentScan } from "../../../scripts/seo/documentScan.mjs";
import { canonicalFile } from "../../../scripts/seo/manifest.mjs";
import { validateGeneratedGraph } from "../../../scripts/refresh-seo.mjs";

const release = { siteUrl: "https://www.ludoradar.mx", indexingEnabled: true };
const paths = ["/", "/juegos-de-mesa", "/game/1/first", "/game/2/second"];
function document(path, links) {
  return `<html><head><link rel="canonical" href="${release.siteUrl}${path}" /><meta name="robots" content="index, follow" /></head><body><div id="root">Español</div>${links.map(link => `<a href="${link}">game</a>`).join("")}<script type="application/ld+json">{"price":350}</script><link href="/assets/fixture.css?v=1" /></body></html>`;
}
async function fixture(t, mutate = documents => documents) {
  const root = await mkdtemp(join(tmpdir(), "ludoradar-document-scan-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const documents = mutate([
    document(paths[0], [paths[1], paths[1], "/search?q=game", "https://store.example/game"]),
    document(paths[1], [paths[2], paths[3], `${paths[2]}?view=price`]),
    document(paths[2], [paths[0]]), document(paths[3], [paths[0]]),
  ]);
  for (let index = 0; index < paths.length; index++) {
    const file = join(root, canonicalFile(paths[index]));
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, documents[index]);
  }
  return { root, documents };
}

test("combined scan agrees with file-based reachability and hashes exact bytes with compact deduplicated edges", async t => {
  const { root, documents } = await fixture(t);
  const assets = new Set();
  const scan = createDocumentScan({ canonicalPaths: paths, release, assetReferences: assets });
  const exact = Buffer.concat([Buffer.from(documents[0]), Buffer.from([255])]);
  await writeFile(join(root, "index.html"), exact);
  for (const path of paths) await scan.scan(join(root, canonicalFile(path)), path);
  await validateGeneratedGraph(root, paths);
  assert.deepEqual(scan.validateGraph(), { edges: 5, adjacencyBytes: 20 });
  assert.deepEqual([...assets], ["assets/fixture.css"]);
  assert.equal(Object.keys(scan.files).length, paths.length);
  assert.equal(scan.files["index.html"], createHash("sha256").update(exact).digest("hex"));
  assert.notEqual(scan.files["index.html"], createHash("sha256").update(exact.toString("utf8")).digest("hex"));
  assert.throws(() => scan.validateGraph(() => { throw new Error("deadline fixture"); }), /deadline fixture/);
});

for (const kind of ["missing", "unreachable"]) test(`both graph paths reject ${kind} canonical content`, async t => {
  const { root } = await fixture(t, documents => {
    documents[1] = document(paths[1], kind === "missing" ? ["/game/999/missing"] : [paths[2]]);
    return documents;
  });
  const error = kind === "missing" ? /Missing generated link target/ : /Unreachable generated page/;
  await assert.rejects(validateGeneratedGraph(root, paths), error);
  const scan = createDocumentScan({ canonicalPaths: paths, release, assetReferences: new Set() });
  await assert.rejects(async () => {
    for (const path of paths) await scan.scan(join(root, canonicalFile(path)), path);
    scan.validateGraph();
  }, error);
});

test("combined scan keeps canonical, root, indexing and JSON validation mandatory", async t => {
  const { root, documents } = await fixture(t);
  for (const [invalid, error] of [
    [documents[0].replace('rel="canonical"', 'rel="other"'), /canonical\/root/],
    [documents[0].replace('id="root"', 'id="other"'), /canonical\/root/],
    [documents[0].replace('index, follow', 'noindex, nofollow'), /indexing policy/],
    [documents[0].replace('{"price":350}', '{bad-json}'), /JSON|property name/],
  ]) {
    await writeFile(join(root, "index.html"), invalid);
    const scan = createDocumentScan({ canonicalPaths: paths, release, assetReferences: new Set() });
    await assert.rejects(scan.scan(join(root, "index.html"), "/"), error);
    assert.equal(Object.keys(scan.files).length, 0);
  }
});
