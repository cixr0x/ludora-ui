import { createRoot, hydrateRoot } from "react-dom/client";
import { createBrowserRouter } from "react-router";
import App from "./app/App.tsx";
import type { PrerenderData } from "./app/PrerenderData.tsx";
import { routeDefinitions } from "./app/routes.ts";
import "./styles/index.css";

const root = document.getElementById("root")!;
const prerenderData = readPrerenderData();
const app = <App prerenderData={prerenderData} router={createBrowserRouter(routeDefinitions)} />;

if (prerenderData?.product && root.hasChildNodes()) {
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
