import { createRoot, hydrateRoot } from "react-dom/client";
import { createBrowserRouter } from "react-router";
import App from "./app/App.tsx";
import type { PrerenderData } from "./app/PrerenderData.tsx";
import { routeDefinitions } from "./app/routes.ts";
import { resetProductMetadata } from "./app/components/ProductMetadata.tsx";
import "./styles/index.css";

const root = document.getElementById("root")!;
let prerenderData = readPrerenderData();
const routeItemId = window.location.pathname.match(/^\/game\/(\d+)(?:\/[^/]+)?\/?$/)?.[1];
const hasMatchingPrerenderData = (routeItemId && prerenderData?.product?.id === Number(routeItemId)) ||
  (prerenderData?.homepage && window.location.pathname === "/") ||
  (prerenderData?.catalogPage?.canonicalPath === window.location.pathname);
if (!hasMatchingPrerenderData) {
  if (prerenderData?.product || prerenderData?.catalogPage || document.getElementById("product-structured-data")) resetProductMetadata();
  prerenderData = undefined;
  document.getElementById("ludo-radar-prerender-data")?.remove();
}
const app = <App prerenderData={prerenderData} router={createBrowserRouter(routeDefinitions)} />;

if (hasMatchingPrerenderData && root.hasChildNodes()) {
  hydrateRoot(root, app);
} else {
  root.replaceChildren();
  createRoot(root).render(app);
}

function readPrerenderData(): PrerenderData | undefined {
  const element = document.getElementById("ludo-radar-prerender-data");
  if (!element?.textContent) return undefined;

  try {
    return JSON.parse(element.textContent) as PrerenderData;
  } catch {
    return undefined;
  }
}
