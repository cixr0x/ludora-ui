import { createContext, type ReactNode, useContext } from "react";

import type { Game, GameDetail } from "./data/games";

export interface PrerenderedProduct extends GameDetail {
  relatedGames: Game[];
  expansionGames: Game[];
  comparisonPublishedAt?: string;
}

export interface PrerenderedFeaturedGame {
  id: number;
  name: string;
}

export interface PrerenderData {
  homepage?: {
    featuredGames: PrerenderedFeaturedGame[];
  };
  product?: PrerenderedProduct;
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

export function usePrerenderedProduct(itemId: number): PrerenderedProduct | undefined {
  const product = useContext(PrerenderDataContext).product;
  return product?.id === itemId ? product : undefined;
}

export function usePrerenderedFeaturedGames(): PrerenderedFeaturedGame[] {
  return useContext(PrerenderDataContext).homepage?.featuredGames ?? [];
}
