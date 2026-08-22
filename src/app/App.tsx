import { RouterProvider, type RouterProviderProps } from "react-router";

import { PrerenderDataProvider, type PrerenderData } from "./PrerenderData";

export default function App({
  prerenderData,
  router,
}: {
  prerenderData?: PrerenderData;
  router: RouterProviderProps["router"];
}) {
  return (
    <PrerenderDataProvider value={prerenderData}>
      <RouterProvider router={router} />
    </PrerenderDataProvider>
  );
}
