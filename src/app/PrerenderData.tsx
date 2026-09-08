import { createContext, type ReactNode, useContext } from "react";

import type { Game, GameDetail } from "./data/games";

export interface PrerenderedProduct extends GameDetail {
  relatedGames: Game[];
  expansionGames: Game[];
  comparisonPublishedAt?: string;
}

export interface CatalogCard {
  id: number;
  name: string;
  canonicalPath: string;
  image: string;
  minimumPrice: number | null;
}
export interface CatalogPageData {
  version: number;
  kind: "catalog" | "category" | "categories";
  canonicalPath: string;
  indexingEnabled: boolean;
  items?: CatalogCard[];
  categories?: Array<{ id: number; name: string; count: number; canonicalPath: string }>;
  category?: { id: number; name: string } | null;
  page?: number;
  pageCount?: number;
  totalItems?: number;
  previousPath?: string | null;
  nextPath?: string | null;
  pageLinks?: Array<{ page: number | null; path: string | null }>;
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
  catalogPage?: CatalogPageData;
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

export function usePrerenderedCatalogPage(): CatalogPageData | undefined {
  return useContext(PrerenderDataContext).catalogPage;
}
