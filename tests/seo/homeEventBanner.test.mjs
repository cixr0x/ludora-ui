import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { build, createServer } from "vite";

const homepage = "https://ludo-radar.test/";
const event = {
  id: "42",
  name: "Encuentro de Juegos",
  description: "Un fin de semana de juegos.",
  starts_at: "2026-11-28T16:00:00Z",
  ends_at: "2026-11-30T00:00:00Z",
  time_zone: "America/Mexico_City",
  min_price: "120.00",
  max_price: "180.00",
  country: "México",
  city: "Ciudad de México",
  venue: "Centro de Exposiciones",
  link: "https://encuentro.example/",
};
const nextEvent = {
  ...event,
  id: "43",
  name: "Jornada de Prototipos",
  starts_at: "2026-12-01T16:00:00Z",
  ends_at: "2026-12-02T00:00:00Z",
};
const eventParameters = { promoted_event_id: "42" };
const beforeExpiration = Date.parse(event.ends_at) - 1000;

test("the homepage event banner reports impressions, clicks and votes until it expires", { timeout: 60000 }, async () => {
  const assets = await buildHomepage();
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 70 }, timezoneId: "Asia/Tokyo" });
    let visibleEvent = event;
    let bannerRequests = 0;
    const statWrites = [];
    await routeHomepage(context, assets, () => {
      bannerRequests += 1;
      return visibleEvent;
    }, statWrites);
    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", error => pageErrors.push(error.message));
    await page.clock.setFixedTime(new Date("2026-11-20T18:00:00Z"));
    await page.goto(homepage);

    const banner = page.getByRole("region", { name: event.name });
    await banner.waitFor({ timeout: 5000 });
    assert.ok((await banner.boundingBox()).y > 70, "the banner starts below the mobile viewport");
    assert.deepEqual(await bannerEvents(page), []);

    await setPageVisibility(page, "hidden");
    await page.setViewportSize({ width: 390, height: 700 });
    await banner.scrollIntoViewIfNeeded();
    await banner.evaluate(node => new Promise(resolve => {
      const observer = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.intersectionRatio > 0)) {
          observer.disconnect();
          setTimeout(resolve, 0);
        }
      });
      observer.observe(node);
    }));
    assert.deepEqual(await bannerEvents(page), [], "an intersecting banner in a hidden tab has no impression");

    await setPageVisibility(page, "visible");
    await page.waitForFunction(() => window.dataLayer?.some(args => args[1] === "event_banner_impression"));
    assert.deepEqual(await bannerEvents(page), [
      ["event_banner_impression", eventParameters],
    ]);
    const bounds = await banner.boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 390, "the banner fits the mobile viewport");
    assert.match(await banner.innerText(), /28\s*[–-]\s*29 de noviembre de 2026/);
    assert.match(await banner.innerText(), /Centro de Exposiciones, Ciudad de México, México/);
    const intro = banner.getByText("Encontramos un evento próximo que podría interesarte:", { exact: true });
    const poll = banner.getByText("¿Te parece útil esta información?", { exact: true });
    const close = banner.getByRole("button", { name: "Cerrar aviso del evento", exact: true });
    assert.equal(await intro.count(), 1);
    assert.equal(await poll.count(), 1);
    assert.equal(await close.count(), 1);
    const mobileIntro = await intro.boundingBox();
    assert.ok((await close.boundingBox()).x >= mobileIntro.x + mobileIntro.width, "close is to the right of the event on mobile");
    const places = banner.getByText(/Centro de Exposiciones, Ciudad de México, México/);
    const mobilePlaces = await places.boundingBox();
    assert.ok((await poll.boundingBox()).y >= mobilePlaces.y + mobilePlaces.height, "the poll stacks below the event on mobile");
    assert.ok(await banner.evaluate(node => node.scrollWidth <= node.clientWidth), "the banner has no mobile overflow");

    const details = banner.getByRole("link", { name: event.name, exact: true });
    assert.equal(await banner.getByRole("link").count(), 1);
    assert.equal(await details.getAttribute("href"), event.link);
    assert.equal(await details.getAttribute("target"), "_blank");
    assert.match(await details.getAttribute("rel"), /\bnoopener\b/);
    assert.ok(await details.evaluate(node => parseFloat(getComputedStyle(node).fontSize) < 14), "the event title is smaller than before");

    await page.setViewportSize({ width: 1280, height: 800 });
    const desktopIntro = await intro.boundingBox();
    const desktopPoll = await poll.boundingBox();
    assert.ok(desktopPoll.x >= desktopIntro.x + desktopIntro.width, "the poll sits to the right on desktop");
    assert.ok(desktopPoll.y < (await places.boundingBox()).y, "the two sides share the desktop row");

    const [keyboardPopup, keyboardClick] = await Promise.all([
      context.waitForEvent("page", { timeout: 5000 }),
      statResponse(page, event.id, "click"),
      details.press("Enter"),
    ]);
    assert.equal(keyboardClick.status(), 204);
    await keyboardPopup.waitForURL(event.link, { timeout: 5000 });
    await keyboardPopup.close();

    // Chromium can start loading a background tab before interception.
    const [middleClickPopup] = await Promise.all([
      context.waitForEvent("page", { timeout: 5000 }),
      statResponse(page, event.id, "click"),
      details.click({ button: "middle" }),
    ]);
    await middleClickPopup.close();

    const [primaryClickPopup] = await Promise.all([
      context.waitForEvent("page", { timeout: 5000 }),
      statResponse(page, event.id, "click"),
      details.click(),
    ]);
    await primaryClickPopup.waitForURL(event.link, { timeout: 5000 });
    await primaryClickPopup.close();

    const yes = banner.getByRole("button", { name: "Me parece útil", exact: true });
    const no = banner.getByRole("button", { name: "No me parece útil", exact: true });
    const desktopNo = await no.boundingBox();
    assert.ok((await close.boundingBox()).x >= desktopNo.x + desktopNo.width, "close is the far-right desktop action");
    for (const button of [yes, no, close]) {
      const { width, height } = await button.boundingBox();
      assert.ok(width >= 44 && height >= 44, "the icon button has a 44px hit area");
      assert.equal(await button.innerText(), "");
      assert.equal(await button.locator("svg").count(), 1);
    }
    await details.press("Tab");
    assert.ok(await yes.evaluate(node => node.matches(":focus-visible") && getComputedStyle(node).boxShadow !== "none"));
    await Promise.all([statResponse(page, event.id, "positive"), yes.click()]);
    await banner.getByRole("status").filter({ hasText: "Gracias por tu opinión" }).waitFor();
    assert.equal(await no.count(), 0);
    assert.deepEqual(await bannerEvents(page), [
      ["event_banner_impression", eventParameters],
      ["event_banner_click", eventParameters],
      ["event_banner_click", eventParameters],
      ["event_banner_click", eventParameters],
      ["event_banner_vote_yes", eventParameters],
    ]);
    await page.reload();
    await banner.getByRole("status").filter({ hasText: "Gracias por tu opinión" }).waitFor();
    assert.equal(await yes.count(), 0);
    assert.deepEqual((await bannerEvents(page)).filter(([name]) => name.startsWith("event_banner_vote")), []);
    assert.deepEqual(pageErrors, [], "the prerendered home hydrates without client errors");

    const requestsBeforeDismissal = bannerRequests;
    await banner.getByRole("status").press("Tab");
    assert.ok(await close.evaluate(node => node.matches(":focus-visible") && getComputedStyle(node).boxShadow !== "none"));
    await Promise.all([statResponse(page, event.id, "dismiss"), close.press("Enter")]);
    await banner.waitFor({ state: "detached" });

    visibleEvent = nextEvent;
    await returnHomeThroughPrivacy(page);
    await page.getByText("No pudimos cargar el catálogo.").waitFor();
    assert.equal(bannerRequests, requestsBeforeDismissal);
    const replacement = page.getByRole("region", { name: nextEvent.name });
    assert.equal(await replacement.count(), 0);

    await page.reload();
    await page.getByText("No pudimos cargar el catálogo.").waitFor();
    assert.equal(bannerRequests, requestsBeforeDismissal);
    assert.equal(await replacement.count(), 0);

    const freshTab = await context.newPage();
    await freshTab.clock.setFixedTime(new Date("2026-11-20T18:00:00Z"));
    await freshTab.goto(homepage);
    const freshBanner = freshTab.getByRole("region", { name: nextEvent.name });
    await freshBanner.waitFor();
    assert.equal(bannerRequests, requestsBeforeDismissal + 1);

    // Restore a document after another page in its tab recorded the dismissal.
    const dismissedSession = await page.evaluate(() => Object.entries(window.sessionStorage));
    await freshTab.evaluate(entries => {
      for (const [key, value] of entries) window.sessionStorage.setItem(key, value);
      window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
    }, dismissedSession);
    await freshBanner.waitFor({ state: "detached", timeout: 5000 });
    assert.equal(bannerRequests, requestsBeforeDismissal + 1);
    assert.deepEqual(statWrites, [
      ["POST", "/api/events/42/stats/click"],
      ["POST", "/api/events/42/stats/click"],
      ["POST", "/api/events/42/stats/click"],
      ["POST", "/api/events/42/stats/positive"],
      ["POST", "/api/events/42/stats/dismiss"],
    ]);
    await freshTab.close();

    const privateContext = await browser.newContext();
    let availableEvent = event;
    let privateBannerRequests = 0;
    const privateStatWrites = [];
    await routeHomepage(privateContext, assets, () => {
      privateBannerRequests += 1;
      return availableEvent;
    }, privateStatWrites);
    await privateContext.addInitScript(() => {
      for (const storage of ["localStorage", "sessionStorage"]) {
        Object.defineProperty(window, storage, { get() { throw new Error("Storage is blocked"); } });
      }
    });
    const expiringPage = await privateContext.newPage();
    await expiringPage.clock.install({ time: new Date(beforeExpiration - 1000) });
    await expiringPage.clock.pauseAt(new Date(beforeExpiration));
    await expiringPage.goto(homepage);

    const expiringBanner = expiringPage.getByRole("region", { name: event.name });
    await expiringBanner.waitFor();
    const expiringNo = expiringBanner.getByRole("button", { name: "No me parece útil", exact: true });
    await Promise.all([statResponse(expiringPage, event.id, "negative"), expiringNo.press("Enter")]);
    await expiringBanner.getByRole("status").filter({ hasText: "Gracias por tu opinión" }).waitFor();
    assert.deepEqual((await bannerEvents(expiringPage)).filter(([name]) => name.startsWith("event_banner_vote")), [
      ["event_banner_vote_no", eventParameters],
    ]);

    await returnHomeThroughPrivacy(expiringPage);
    await expiringBanner.waitFor();
    assert.equal(await expiringNo.count(), 0);
    assert.equal(await expiringBanner.getByRole("status").innerText(), "Gracias por tu opinión");
    assert.deepEqual((await bannerEvents(expiringPage)).filter(([name]) => name.startsWith("event_banner_vote")), [
      ["event_banner_vote_no", eventParameters],
    ]);

    await expiringPage.clock.fastForward(999);
    assert.equal(await expiringBanner.count(), 1);
    availableEvent = nextEvent;
    await expiringPage.clock.fastForward(1);
    await expiringBanner.waitFor({ state: "detached" });
    const nextBanner = expiringPage.getByRole("region", { name: nextEvent.name });
    await nextBanner.getByRole("button", { name: "No me parece útil", exact: true }).waitFor();
    assert.equal(await nextBanner.getByText("1 de diciembre de 2026").count(), 1);

    availableEvent = null;
    const emptyResponse = expiringPage.waitForResponse(`${homepage}api/events/banner`);
    await expiringPage.reload();
    await emptyResponse;
    assert.equal(await expiringBanner.count(), 0);
    assert.equal(await nextBanner.count(), 0);
    assert.deepEqual(await bannerEvents(expiringPage), []);

    availableEvent = nextEvent;
    await returnHomeThroughPrivacy(expiringPage);
    await nextBanner.waitFor();
    const privateRequestsBeforeDismissal = privateBannerRequests;
    await Promise.all([
      statResponse(expiringPage, nextEvent.id, "dismiss"),
      nextBanner.getByRole("button", { name: "Cerrar aviso del evento", exact: true }).press("Enter"),
    ]);
    await nextBanner.waitFor({ state: "detached" });
    await returnHomeThroughPrivacy(expiringPage);
    await expiringPage.getByText("No pudimos cargar el catálogo.").waitFor();
    assert.equal(await nextBanner.count(), 0, "dismissal persists across SPA navigation when session storage is blocked");
    assert.equal(privateBannerRequests, privateRequestsBeforeDismissal);
    assert.deepEqual(privateStatWrites, [
      ["POST", "/api/events/42/stats/negative"],
      ["POST", "/api/events/43/stats/dismiss"],
    ]);
  } finally {
    await browser.close();
  }
});

async function buildHomepage() {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const { output } = await build({ root, logLevel: "silent", build: { write: false } });
  const assets = new Map(output.map(file => [`/${file.fileName}`, (file.type === "chunk" ? file.code : file.source)]));
  const vite = await createServer({ root, server: { middlewareMode: true, hmr: false, watch: null }, appType: "custom" });
  const originalConsoleError = console.error;
  try {
    console.error = (message, ...args) => {
      if (!String(message).startsWith("Warning: useLayoutEffect does nothing on the server")) originalConsoleError(message, ...args);
    };
    const { renderHomepageDocument } = await vite.ssrLoadModule("/src/entry-server.tsx");
    assets.set("/", renderHomepageDocument({ featuredGames: [], template: assets.get("/index.html") }));
  } finally {
    console.error = originalConsoleError;
    await vite.close();
  }
  return assets;
}

async function routeHomepage(context, assets, getEvent, statWrites) {
  await context.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.href === event.link) return route.fulfill({ contentType: "text/html", body: "<title>Official site fixture</title>" });
    if (url.origin !== new URL(homepage).origin) return route.abort();
    if (url.pathname === "/api/events/banner") return route.fulfill({ json: { data: getEvent() } });
    if (/^\/api\/events\/[^/]+\/stats\//.test(url.pathname)) {
      statWrites.push([route.request().method(), url.pathname]);
      return route.fulfill({ status: 204 });
    }
    if (url.pathname.startsWith("/api/")) return route.fulfill({ json: { data: [] } });
    const body = assets.get(url.pathname);
    if (body === undefined) return route.fulfill({ status: 204 });
    const contentType = url.pathname.endsWith(".js") ? "text/javascript" : url.pathname.endsWith(".css") ? "text/css" : "text/html";
    return route.fulfill({ contentType, body: typeof body === "string" ? body : Buffer.from(body) });
  });
}

function statResponse(page, id, action) {
  return page.waitForResponse(response =>
    response.url() === `${homepage}api/events/${id}/stats/${action}` && response.request().method() === "POST",
    { timeout: 5000 });
}

function bannerEvents(page) {
  return page.evaluate(() => (window.dataLayer ?? [])
    .filter(args => args[0] === "event" && args[1].startsWith("event_banner_"))
    .map((args) => [args[1], args[2]]));
}

function setPageVisibility(page, state) {
  return page.evaluate(state => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: state });
    document.dispatchEvent(new Event("visibilitychange"));
  }, state);
}

async function returnHomeThroughPrivacy(page) {
  await page.getByRole("link", { name: "Aviso de Privacidad" }).press("Enter");
  await page.waitForURL(new URL("/privacidad", homepage).href, { timeout: 5000 });
  await page.getByRole("link", { name: "Inicio", exact: true }).press("Enter");
}
