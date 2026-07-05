import { createBrowserRouter } from "react-router";
import { Root } from "./Root";
import { Home } from "./pages/Home";
import { GameDetail } from "./pages/GameDetail";
import { Browse } from "./pages/Browse";
import { Search } from "./pages/Search";
import { PrivacyPolicy } from "./pages/PrivacyPolicy";
import { TermsOfService } from "./pages/TermsOfService";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: Home },
      { path: "game/:id", Component: GameDetail },
      { path: "browse/:genre", Component: Browse },
      { path: "search", Component: Search },
      { path: "privacidad", Component: PrivacyPolicy },
      { path: "terminos", Component: TermsOfService },
    ],
  },
]);
