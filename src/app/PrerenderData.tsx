import { createContext, type ReactNode, useContext } from "react";

import type { GameDetail } from "./data/games";

export interface PrerenderData {
  product?: GameDetail;
}

const PrerenderDataContext = createContext<PrerenderData>({});

export function PrerenderDataProvider({
  children,
  value,
}: {
  children: ReactNode;
  value?: PrerenderData;
}) {
  return <PrerenderDataContext.Provider value={value ?? {}}>{children}</PrerenderDataContext.Provider>;
}

export function usePrerenderedProduct(itemId: number): GameDetail | undefined {
  const product = useContext(PrerenderDataContext).product;
  return product?.id === itemId ? product : undefined;
}
