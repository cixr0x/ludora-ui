import { Outlet } from "react-router";
import { ScrollToTop } from "./components/ScrollToTop";
import { SiteFooter } from "./components/SiteFooter";

export function Root() {
  return (
    <>
      <ScrollToTop />
      <Outlet />
      <SiteFooter />
    </>
  );
}
