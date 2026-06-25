import { Outlet } from "react-router";
import { SiteFooter } from "./components/SiteFooter";

export function Root() {
  return (
    <>
      <Outlet />
      <SiteFooter />
    </>
  );
}
