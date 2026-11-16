import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "@playwright/test";
import { startFixtureServer } from "./fixture-server.mjs";
import { item, offer } from "./fixtures.mjs";

test("GA4 records visible product visits and outbound offer activations", { timeout: 60000 }, async () => {
  const server = await startFixtureServer({ productionAnalytics: true });
  let browser;
  try {
    browser = await chromium.launch({ channel: "chrome", headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    const firstPartyClicks = [];
    const gaRequests = [];
    const bundle = {
      ...offer, id: 11, store_id: undefined, store_name: "Tienda Paquetes",
      // Chromium's background tab can start navigation before interception.
      source_url: "http://localhost:5175/bgg-primary-logo-reverse.svg", is_bundle: true,
    };
    const nextProduct = { ...item, id: 852, canonical_name: "Juego relacionado", offers: [], related_items: [] };
    let releaseLiveDetail;
    const liveDetail = new Promise(resolve => { releaseLiveDetail = resolve; });

    await context.route(url => url.hostname !== "127.0.0.1", async route => {
      const url = new URL(route.request().url());
      if (url.hostname === "www.googletagmanager.com") {
        gaRequests.push(url.href);
        await route.fulfill({ contentType: "application/javascript", body: "" });
      } else {
        await route.fulfill({ contentType: "text/html", body: "<title>External link fixture</title>" });
      }
    });
    await context.route(url => url.pathname.startsWith("/api/"), async route => {
      const { pathname } = new URL(route.request().url());
      if (/^\/api\/store-items\/\d+\/clicks$/.test(pathname)) {
        firstPartyClicks.push([route.request().method(), pathname]);
        await route.fulfill({ status: 204 });
        return;
      }
      let data = [];
      if (pathname === "/api/items/851") {
        await liveDetail;
        data = { ...item, offers: [{ ...offer, price: 425 }, bundle] };
      } else if (pathname === "/api/items/852") {
        data = nextProduct;
      } else if (pathname === "/api/items/851/related") {
        data = [nextProduct];
      }
      await route.fulfill({ json: { data } });
    });

    const calls = command => page.evaluate(
      command => (window.dataLayer ?? []).map(args => Array.from(args)).filter(args => args[0] === command),
      command,
    );
    const waitForEventCount = (name, count) => page.waitForFunction(
      ({ name, count }) => (window.dataLayer ?? []).filter(args => args[0] === "event" && args[1] === name).length >= count,
      { name, count },
      { timeout: 5000 },
    );
    const activateExternalLink = async (link, activate, url) => {
      const popupPromise = context.waitForEvent("page");
      await activate(link);
      const popup = await popupPromise;
      await popup.waitForURL(url);
      await popup.close();
    };
    const dixitView = ["event", "view_item", { items: [{ item_id: "851", item_name: "Dixit" }] }];

    await page.goto("http://127.0.0.1:5175/game/851/dixit");
    await page.getByText("$350.00 MXN").waitFor();
    await waitForEventCount("view_item", 1);
    assert.deepEqual(await calls("config"), [["config", "G-QGR5CKL5S4"]]);
    assert.deepEqual(await calls("event"), [dixitView]);
    assert.deepEqual(gaRequests, ["https://www.googletagmanager.com/gtag/js?id=G-QGR5CKL5S4"]);

    releaseLiveDetail();
    await page.getByText("$425.00 MXN").waitFor();
    await page.getByRole("button", { name: "Comprar ahora" }).click();
    await activateExternalLink(
      page.getByRole("link", { name: "Ver tutorial completo en YouTube" }),
      link => link.click(),
      /https:\/\/www\.youtube\.com\//,
    );
    assert.deepEqual(await calls("event"), [dixitView]);
    assert.deepEqual(firstPartyClicks, []);

    const clickRequest = page.waitForResponse(response => new URL(response.url()).pathname === "/api/store-items/10/clicks");
    await activateExternalLink(
      page.getByRole("link", { name: /Ver oferta .* en Tienda Mesa$/ }),
      link => link.press("Enter"),
      "https://tienda.example/dixit",
    );
    await clickRequest;
    assert.deepEqual(firstPartyClicks, [["POST", "/api/store-items/10/clicks"]]);
    await activateExternalLink(
      page.getByRole("link", { name: /Ver oferta .* en Tienda Paquetes$/ }),
      link => link.click({ button: "middle" }),
      bundle.source_url,
    );

    await page.getByRole("link", { name: "Juego relacionado" }).click();
    await page.getByRole("heading", { name: "Juego relacionado", exact: true }).waitFor();
    await waitForEventCount("view_item", 2);
    await page.goBack();
    await page.getByRole("heading", { name: "Dixit", exact: true }).waitFor();
    await waitForEventCount("view_item", 3);

    assert.deepEqual(await calls("config"), [["config", "G-QGR5CKL5S4"]]);
    assert.deepEqual(await calls("event"), [
      dixitView,
      ["event", "store_offer_click", { product_id: "851", offer_id: "10", store_name: "Tienda Mesa", store_id: "7" }],
      ["event", "store_offer_click", { product_id: "851", offer_id: "11", store_name: "Tienda Paquetes" }],
      ["event", "view_item", { items: [{ item_id: "852", item_name: "Juego relacionado" }] }],
      dixitView,
    ]);
  } finally {
    await browser?.close();
    await server.close();
  }
});
