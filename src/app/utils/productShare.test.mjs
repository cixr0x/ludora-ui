import assert from "node:assert/strict";
import test from "node:test";

const detail = {
  id: 42,
  name: "Café & té: 50% + diversión",
  image: "",
  categories: [],
  description: [],
  players: "2-4",
  playTime: "30 mins",
  complexity: 1,
};

test("product sharing uses canonical URLs and handles browser sharing capabilities", async (t) => {
  const sharing = await import("./productShare.js").catch((error) => {
    if (error.code === "ERR_MODULE_NOT_FOUND") return null;
    throw error;
  });
  assert.ok(sharing, "Product sharing is not implemented");
  const { productShareData, socialShareLinks, copyProductLink, canNativeShare, shareProduct } = sharing;

  await t.test("defaults to the public site and a normalized product path", () => {
    const data = productShareData(detail);
    assert.equal(data.url, "https://www.ludoradar.mx/game/42/cafe-te-50-diversion");
    assert.equal(data.title, "Café & té: 50% + diversión | Ludo Radar");
    assert.equal(data.text, "Consulta Café & té: 50% + diversión en Ludo Radar.");
  });

  await t.test("prefers the published path over the current catalog name", () => {
    const data = productShareData(detail, "https://www.ludoradar.mx/", "/game/42/nombre-publicado");
    assert.equal(data.url, "https://www.ludoradar.mx/game/42/nombre-publicado");
  });

  await t.test("uses the configured metadata origin without navigation parameters", () => {
    const data = productShareData(detail, "https://catalog.example.mx", "/game/42/nombre-publicado");
    assert.equal(data.url, "https://catalog.example.mx/game/42/nombre-publicado");
    assert.throws(() => productShareData(detail, undefined, "/game/42/nombre-publicado?origen=busqueda"));
  });

  await t.test("social share links preserve encoded URLs and names for every destination", () => {
    const data = {
      url: "https://www.ludoradar.mx/game/42/cafe?nota=50%25&edicion=niñez#ofertas",
      title: "Café & té: 50% + diversión | Ludo Radar",
      text: "Consulta Café & té: 50% + diversión en Ludo Radar.",
    };
    const links = socialShareLinks(data).map((link) => ({ ...link, parsed: new URL(link.href) }));
    assert.equal(links.length, 5);
    const facebook = links.find((link) => link.label === "Facebook").parsed;
    assert.equal(facebook.origin + facebook.pathname, "https://www.facebook.com/sharer/sharer.php");
    assert.equal(facebook.searchParams.get("u"), data.url);
    const twitter = links.find((link) => link.label === "X / Twitter").parsed;
    assert.equal(twitter.origin + twitter.pathname, "https://twitter.com/intent/tweet");
    assert.equal(twitter.searchParams.get("url"), data.url);
    assert.equal(twitter.searchParams.get("text"), data.text);
    const reddit = links.find((link) => link.label === "Reddit").parsed;
    assert.equal(reddit.origin + reddit.pathname, "https://www.reddit.com/submit");
    assert.equal(reddit.searchParams.get("url"), data.url);
    assert.equal(reddit.searchParams.get("title"), data.title);
    const whatsapp = links.find((link) => link.label === "WhatsApp").parsed;
    assert.equal(whatsapp.origin + whatsapp.pathname, "https://wa.me/");
    assert.equal(whatsapp.searchParams.get("text"), `${data.text} ${data.url}`);
    const telegram = links.find((link) => link.label === "Telegram").parsed;
    assert.equal(telegram.origin + telegram.pathname, "https://t.me/share/url");
    assert.equal(telegram.searchParams.get("url"), data.url);
    assert.equal(telegram.searchParams.get("text"), data.text);
  });

  await t.test("copy waits for the clipboard to finish before reporting success", async () => {
    let finish;
    let stored = "";
    const clipboard = {
      writeText(value) {
        return new Promise((resolve) => { finish = () => { stored = value; resolve(); }; });
      },
    };
    const result = copyProductLink("https://www.ludoradar.mx/game/42/cafe", { clipboard });
    assert.equal(stored, "");
    finish();
    assert.equal(await result, "copied");
    assert.equal(stored, "https://www.ludoradar.mx/game/42/cafe");
  });

  await t.test("copy falls back to manual selection without a clipboard", async () => {
    assert.equal(await copyProductLink("https://www.ludoradar.mx/game/42/cafe", {}), "manual");
    assert.equal(await copyProductLink("https://www.ludoradar.mx/game/42/cafe", undefined), "manual");
  });

  await t.test("copy falls back to manual selection when permission is denied", async () => {
    const clipboard = { async writeText() { throw new Error("Permission denied"); } };
    assert.equal(await copyProductLink("https://www.ludoradar.mx/game/42/cafe", { clipboard }), "manual");
  });

  await t.test("native capability detection supports missing and rejecting browser APIs", () => {
    const data = productShareData(detail);
    assert.equal(canNativeShare(data, undefined), false);
    assert.equal(canNativeShare(data, {}), false);
    assert.equal(canNativeShare(data, { share() {} }), true);
    assert.equal(canNativeShare(data, { share() {}, canShare() { return false; } }), false);
    assert.equal(canNativeShare(data, { share() {}, canShare() { throw new Error("Unavailable"); } }), false);
  });

  await t.test("native sharing receives the product payload synchronously in the click turn", async () => {
    const data = productShareData(detail);
    let received;
    const browser = { share(value) { assert.equal(this, browser); received = value; return Promise.resolve(); } };
    const result = shareProduct(data, browser);
    assert.deepEqual(received, {
      title: "Café & té: 50% + diversión | Ludo Radar",
      text: "Consulta Café & té: 50% + diversión en Ludo Radar.",
      url: "https://www.ludoradar.mx/game/42/cafe-te-50-diversion",
    });
    assert.equal(await result, "shared");
  });

  await t.test("native sharing treats cancellation quietly", async () => {
    const browser = { async share() { throw Object.assign(new Error("Cancelled"), { name: "AbortError" }); } };
    assert.equal(await shareProduct(productShareData(detail), browser), "cancelled");
  });

  await t.test("native sharing reports failures and unsupported devices separately", async () => {
    const data = productShareData(detail);
    const browser = { async share() { throw new Error("Permission denied"); } };
    assert.equal(await shareProduct(data, browser), "error");
    assert.equal(await shareProduct(data, undefined), "unavailable");
    assert.equal(await shareProduct(data, { share() {}, canShare() { return false; } }), "unavailable");
  });
});
