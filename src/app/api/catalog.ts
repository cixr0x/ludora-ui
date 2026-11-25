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
  store_platform?: string;
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
  currency?: string | null;
  availability?: string;
  store_active?: boolean;
  listing_status?: string;
  is_bundle?: boolean;
  last_seen_at?: string | null;
  last_updated?: string | null;
  refreshed_date?: string | null;
  store_updated_at?: string | null;
  language?: string | null;
}

export interface ApiTutorial {
  id: number;
  url: string;
  title?: string;
  language?: string;
  source?: string;
  status?: string;
}

export interface ApiItemReference {
  id: number | string;
  canonical_name: string;
  canonical_name_es?: string;
}

export interface ApiItem {
  id: number | string;
  bgg_id?: number | string | null;
  canonical_path?: string;
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
  parent_items?: ApiItemReference[];
  tutorials?: ApiTutorial[];
  offers?: ApiOffer[];
  related_items?: ApiRelatedItem[];
  expansion_items?: ApiRelatedItem[];
  updated_at?: string | null;
  semantic_distance?: number | string | null;
}

export type ApiItemSummary = Pick<
  ApiItem,
  | "id"
  | "canonical_name"
  | "canonical_name_es"
  | "image_url"
  | "image_url_es"
  | "item_type"
  | "parent_item_id"
  | "year_published"
  | "min_players"
  | "max_players"
  | "min_minutes"
  | "max_minutes"
  | "complexity"
  | "rating"
  | "has_approved_listing"
  | "is_expansion"
  | "categories"
  | "mechanics"
>;

export type ApiSearchResultItem = Pick<
  ApiItem,
  | "id"
  | "canonical_name"
  | "canonical_name_es"
  | "image_url"
  | "image_url_es"
  | "item_type"
  | "parent_item_id"
  | "is_expansion"
>;

export type ApiFrontPageItem = Pick<
  ApiItem,
  | "id"
  | "canonical_name"
  | "canonical_name_es"
  | "image_url"
  | "image_url_es"
>;

export type ApiRelatedItem = Pick<
  ApiItem,
  | "id"
  | "canonical_name"
  | "canonical_name_es"
  | "image_url"
  | "image_url_es"
>;

export interface ApiCatalogFilterOptions {
  categories: ApiTaxonomyEntry[];
  mechanics: ApiTaxonomyEntry[];
}

export interface ApiFrontPageRow {
  id: number;
  category_type: string;
  category_id: number;
  category_name: string;
  category_name_es?: string;
  title: string;
  title_display?: string | null;
  order: number | string;
  products: ApiFrontPageItem[];
}

export interface ApiBannerEvent {
  id: string;
  name: string;
  description: string;
  starts_at: string;
  ends_at: string;
  time_zone: string;
  min_price: string | null;
  max_price: string | null;
  country: string;
  city: string;
  venue: string;
  link: string;
}

export interface ContactFormSubmission {
  email: string;
  message: string;
  name: string;
}

interface ApiEnvelope<T> {
  data: T;
}

interface ApiFrontPage extends ApiEnvelope<ApiFrontPageRow[]> {
  meta?: {
    catalog_product_count?: number;
    tracked_store_count?: number;
  };
}

const API_BASE_URL = ((import.meta.env.VITE_LUDORA_API_URL as string | undefined) ?? "").replace(/\/$/, "");

export async function fetchFrontPage(): Promise<ApiFrontPage> {
  return fetchEnvelope<ApiFrontPage>("/api/front-page");
}

export async function fetchBannerEvent(signal: AbortSignal): Promise<ApiBannerEvent | null> {
  return fetchData<ApiBannerEvent | null>("/api/events/banner", signal);
}

export async function reportBannerEventAction(
  id: string,
  action: "click" | "positive" | "negative" | "dismiss",
): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/api/events/${encodeURIComponent(id)}/stats/${action}`, {
      method: "POST",
      keepalive: true,
    });
  } catch {
    // Reporting must not interrupt the banner interaction.
  }
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
  const suffix = itemSearchSuffix(query);

  return fetchData<ApiItem[]>(`/api/items${suffix}`);
}

export async function fetchItemSummaries(query?: ApiItemsQuery): Promise<ApiItemSummary[]> {
  const suffix = itemSearchSuffix(query);

  return fetchData<ApiItemSummary[]>(`/api/items/summary${suffix}`);
}

export async function fetchSearchResults(query?: ApiItemsQuery): Promise<ApiSearchResultItem[]> {
  const suffix = itemSearchSuffix(query);

  return fetchData<ApiSearchResultItem[]>(`/api/items/search-results${suffix}`);
}

export async function fetchRelatedItems(id: number, limit?: number): Promise<ApiRelatedItem[]> {
  const params = new URLSearchParams();
  if (limit) params.set("limit", String(limit));
  const suffix = params.size ? `?${params.toString()}` : "";

  return fetchData<ApiRelatedItem[]>(`/api/items/${id}/related${suffix}`);
}

export async function fetchItemExpansions(id: number, limit?: number): Promise<ApiRelatedItem[]> {
  const params = new URLSearchParams();
  if (limit) params.set("limit", String(limit));
  const suffix = params.size ? `?${params.toString()}` : "";

  return fetchData<ApiRelatedItem[]>(`/api/items/${id}/expansions${suffix}`);
}

export async function fetchCatalogFilterOptions(): Promise<ApiCatalogFilterOptions> {
  return fetchData<ApiCatalogFilterOptions>("/api/items/filter-options");
}

export async function submitContactForm(submission: ContactFormSubmission, signal?: AbortSignal): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/contact`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(submission),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Ludora API request failed with ${response.status}`);
  }
}

function itemSearchSuffix(query?: ApiItemsQuery): string {
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
  return params.size ? `?${params.toString()}` : "";
}

export async function fetchSemanticItems(query: { q: string; limit?: number }): Promise<ApiItem[]> {
  const params = new URLSearchParams();
  params.set("q", query.q);
  if (query.limit) params.set("limit", String(query.limit));

  return fetchData<ApiItem[]>(`/api/items/semantic-search?${params.toString()}`);
}

// Matches the public service's LudoscopioFilters. Send either a new prompt
// or the latest meta.filters to refine without another interpretation.
export interface LudoscopioFilters {
  players: number | null;
  playtimes: Array<"short" | "medium" | "long">;
  durationMin: number | null;
  durationMax: number | null;
  complexityMin: number | null;
  complexityMax: number | null;
  categoryIds: number[];
  mechanicIds: number[];
  suggestedCategoryIds: number[];
  suggestedMechanicIds: number[];
  theme: string | null;
  exactTitle: string | null;
  query: string | null;
}

export type LudoscopioInput = ({ prompt: string } | { filters: LudoscopioFilters }) & { limit?: number };

export async function fetchLudoscopioItems(
  input: LudoscopioInput,
  signal: AbortSignal,
): Promise<{ data: ApiItem[]; meta: { count: number; limit: number; filters: LudoscopioFilters } }> {
  const response = await fetch(`${API_BASE_URL}/api/items/ludoscopio`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal,
  });
  if (!response.ok) throw new Error(`Ludora API request failed with ${response.status}`);
  return response.json();
}

export async function fetchItem(id: number): Promise<ApiItem> {
  return fetchData<ApiItem>(`/api/items/${id}`);
}

async function fetchData<T>(path: string, signal?: AbortSignal): Promise<T> {
  const envelope = await fetchEnvelope<ApiEnvelope<T>>(path, signal);
  return envelope.data;
}

async function fetchEnvelope<T extends ApiEnvelope<unknown>>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { signal });
  if (!response.ok) {
    throw new Error(`Ludora API request failed with ${response.status}`);
  }

  return response.json();
}
