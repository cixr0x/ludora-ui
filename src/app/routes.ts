import type { RouteObject } from "react-router";
import { Root } from "./Root";
import { Home } from "./pages/Home";
import { GameDetail } from "./pages/GameDetail";
import { Browse } from "./pages/Browse";
import { Search } from "./pages/Search";
import { PrivacyPolicy } from "./pages/PrivacyPolicy";
import { TermsOfService } from "./pages/TermsOfService";
import { Catalog } from "./pages/Catalog";
import { Categories } from "./pages/Categories";
import { Category } from "./pages/Category";

export const routeDefinitions: RouteObject[] = [
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: Home },
      { path: "juegos-de-mesa", Component: Catalog },
      { path: "juegos-de-mesa/pagina/:page", Component: Catalog },
      { path: "categorias", Component: Categories },
      { path: "categoria/:id/:slug", Component: Category },
      { path: "categoria/:id/:slug/pagina/:page", Component: Category },
      { path: "game/:id/:slug", Component: GameDetail },
      { path: "game/:id", Component: GameDetail },
      { path: "browse/:genre", Component: Browse },
      { path: "search", Component: Search },
      { path: "privacidad", Component: PrivacyPolicy },
      { path: "terminos", Component: TermsOfService },
    ],
  },
];
