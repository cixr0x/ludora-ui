import { Outlet } from "react-router";
import { GoogleAnalytics } from "./components/GoogleAnalytics";
import { ScrollToTop } from "./components/ScrollToTop";
import { SiteFooter } from "./components/SiteFooter";

export function Root() {
  return (
    <>
      <GoogleAnalytics />
      <ScrollToTop />
      <Outlet />
      <SiteFooter />
    </>
  );
}
