import { Outlet } from "react-router";
import { GoogleAnalytics } from "./components/GoogleAnalytics";
import { ScrollToTop } from "./components/ScrollToTop";
import { SiteFooter } from "./components/SiteFooter";
import { RouteMetadata } from "./components/ProductMetadata";

export function Root() {
  return (
    <>
      <GoogleAnalytics />
      <RouteMetadata />
      <ScrollToTop />
      <Outlet />
      <SiteFooter />
    </>
  );
}
