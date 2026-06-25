import { buildCatalogSearchParams } from "../utils/catalogSearch.js";

export interface ApiTaxonomyEntry {
  id: number;
  bgg_id?: number | null;
  name: string;
  name_es?: string;
  website_url?: string;
}

export interface ApiOffer {
  id: number;
  store_id: number;
  store_name: string;
  store_domain?: string;
  store_website_url?: string;
  store_logo_url?: string;
  store_country?: string;
  source_url?: string;
  source_listing_url?: string;
  game_title: string;
  image_url?: string;
  price?: string | number | null;
  raw_price?: string;
  currency?: string;
  availability?: string;
  listing_status?: string;
  last_seen_at?: string;
}

export interface ApiTutorial {
  id: number;
  url: string;
  title?: string;
  language?: string;
  source?: string;
  status?: string;
}

export interface ApiItem {
  id: number;
  canonical_name: string;
  canonical_name_es?: string;
  image_url?: string;
  image_url_es?: string;
  item_type?: string;
  parent_item_id?: number | string | null;
  year_published?: number | null;
  description?: string;
  description_es?: string;
  min_players?: number | null;
  max_players?: number | null;
  min_minutes?: number | null;
  max_minutes?: number | null;
  complexity?: number | string | null;
  rating?: number | string | null;
  has_approved_listing?: boolean;
  is_expansion?: boolean;
  categories?: ApiTaxonomyEntry[];
  mechanics?: ApiTaxonomyEntry[];
  families?: ApiTaxonomyEntry[];
  designers?: ApiTaxonomyEntry[];
  publishers?: ApiTaxonomyEntry[];
  tutorials?: ApiTutorial[];
  offers?: ApiOffer[];
  semantic_distance?: number | string | null;
}

export interface ApiFrontPageRow {
  id: number;
  category_type: string;
  category_id: number;
  category_name: string;
  category_name_es?: string;
  title: string;
  order: number | string;
  products: ApiItem[];
}

interface ApiEnvelope<T> {
  data: T;
}

const API_BASE_URL = ((import.meta.env.VITE_LUDORA_API_URL as string | undefined) ?? "").replace(/\/$/, "");

export async function fetchFrontPage(): Promise<ApiFrontPageRow[]> {
  return fetchData<ApiFrontPageRow[]>("/api/front-page");
}

export interface ApiItemsQuery {
  categoryIds?: number[];
  complexity?: [number, number];
  limit?: number;
  mechanicIds?: number[];
  offset?: number;
  players?: number | null;
  playtimeRanges?: Array<[number, number]>;
  query?: string;
  q?: string;
}

export async function fetchItems(query?: ApiItemsQuery): Promise<ApiItem[]> {
  const params = buildCatalogSearchParams({
    categoryIds: query?.categoryIds,
    complexity: query?.complexity,
    limit: query?.limit,
    mechanicIds: query?.mechanicIds,
    offset: query?.offset,
    players: query?.players,
    playtimeRanges: query?.playtimeRanges,
    query: query?.query ?? query?.q,
  });
  const suffix = params.size ? `?${params.toString()}` : "";

  return fetchData<ApiItem[]>(`/api/items${suffix}`);
}

export async function fetchSemanticItems(query: { q: string; limit?: number }): Promise<ApiItem[]> {
  const params = new URLSearchParams();
  params.set("q", query.q);
  if (query.limit) params.set("limit", String(query.limit));

  return fetchData<ApiItem[]>(`/api/items/semantic-search?${params.toString()}`);
}

export async function fetchItem(id: number): Promise<ApiItem> {
  return fetchData<ApiItem>(`/api/items/${id}`);
}

async function fetchData<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`);
  if (!response.ok) {
    throw new Error(`Ludora API request failed with ${response.status}`);
  }

  const envelope = (await response.json()) as ApiEnvelope<T>;
  return envelope.data;
}
