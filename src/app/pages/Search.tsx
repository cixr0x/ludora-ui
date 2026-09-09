import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams, type NavigateOptions } from "react-router";
import { productPath } from "../utils/productRoutes.js";
import { ArrowLeft, Search as SearchIcon, X, Dices, SlidersHorizontal, ChevronDown, ChevronRight } from "lucide-react";
import type { Game, GameDetail, GameTaxonomyEntry } from "../data/games";
import {
  loadCatalogFilterOptions,
  loadCatalogSearchResults,
  loadSemanticCatalogGameDetails,
  type CatalogFilterOptions,
  type CatalogSearchResult,
} from "../data/catalog";
import { ExpansionBadge } from "../components/ExpansionBadge";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { SiteHeader } from "../components/SiteHeader";
import { t } from "../data/translations";
import { LudoscopioCallout } from "../components/LudoscopioCallout";
import type { CatalogPageData } from "../PrerenderData";
import { CatalogPagination } from "../components/CatalogPagination";
import { catalogSeoMetadata } from "../utils/catalogSeo.js";
import { EXPANSION_BADGE_CORNER_CLASS } from "../utils/expansionDisplay.js";
import {
  appendUniqueCatalogResults,
  hasMoreCatalogResults,
  parsePositiveIntegerSetParam,
  parseExploreControlParams,
  setPositiveIntegerSetParam,
  shouldShowFilterRemoveIcon,
  sortTaxonomyOptionsByActive,
} from "../utils/catalogSearch.js";
import { filterSemanticSearchResults, parseRangeText } from "../utils/searchResultFiltering.js";
import {
  clearLudoscopioSessionCache,
  readLudoscopioSessionCache,
  writeLudoscopioSessionCache,
} from "../utils/ludoscopioSessionCache.js";

type PlaytimeKey = "short" | "medium" | "long";

const PLAYTIME_OPTIONS: { key: PlaytimeKey; label: string; range: [number, number] }[] = [
  { key: "short",  label: "Corta · <45m",   range: [0, 44] },
  { key: "medium", label: "Media · 45–90m",  range: [45, 90] },
  { key: "long",   label: "Larga · >90m",   range: [91, 999] },
];

const PLAYER_OPTIONS = [1, 2, 3, 4, 5, 6];
const SEARCH_PAGE_SIZE = 60;

interface FilterableSemanticResult extends Game {
  categories: GameTaxonomyEntry[];
  mechanics: GameTaxonomyEntry[];
  categoryNames: string[];
  mechanicNames: string[];
  minPlayers: number;
  maxPlayers: number;
  minMinutes: number | null;
  maxMinutes: number | null;
  complexity: number;
}

interface CatalogSearchRequest {
  categoryIds: number[];
  complexity: [number, number];
  mechanicIds: number[];
  players: number | null;
  playtimeRanges: Array<[number, number]>;
  query: string;
}

interface QueryInputHandoff {
  value: string;
  start: number;
  end: number;
  direction: "forward" | "backward" | "none";
}

function useCatalogSearchGames(
  request: CatalogSearchRequest,
  semanticGames: FilterableSemanticResult[] | null,
): {
  filterOptions: CatalogFilterOptions;
  games: CatalogSearchResult[];
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  loadMore: () => void;
} {
  const [games, setGames] = useState<CatalogSearchResult[]>([]);
  const [filterOptions, setFilterOptions] = useState<CatalogFilterOptions>({ categories: [], mechanics: [] });
  const hasFilterOptionsRef = useRef(false);
  const isLoadingFilterOptionsRef = useRef(false);
  const loadSequenceRef = useRef(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [nextOffset, setNextOffset] = useState(0);

  useEffect(() => {
    if (hasFilterOptionsRef.current || isLoadingFilterOptionsRef.current) {
      return;
    }

    let isActive = true;
    isLoadingFilterOptionsRef.current = true;

    loadCatalogFilterOptions()
      .then((options) => {
        if (!isActive || hasFilterOptionsRef.current) return;
        setFilterOptions(options);
        hasFilterOptionsRef.current = true;
      })
      .finally(() => {
        isLoadingFilterOptionsRef.current = false;
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (semanticGames) {
      loadSequenceRef.current += 1;
      setIsLoading(false);
      setIsLoadingMore(false);
      setHasMore(false);
      return;
    }

    let isActive = true;
    const sequence = loadSequenceRef.current + 1;
    const delay = request.query.trim() ? 250 : 0;
    loadSequenceRef.current = sequence;
    setGames([]);
    setNextOffset(0);
    setHasMore(true);
    setIsLoadingMore(false);
    setIsLoading(true);

    const timeout = window.setTimeout(() => {
      loadCatalogSearchResults({
        categoryIds: request.categoryIds,
        complexity: request.complexity,
        limit: SEARCH_PAGE_SIZE,
        mechanicIds: request.mechanicIds,
        offset: 0,
        players: request.players,
        playtimeRanges: request.playtimeRanges,
        query: request.query,
      })
        .then((results) => {
          if (!isActive || loadSequenceRef.current !== sequence) return;
          setGames(results);
          setNextOffset(results.length);
          setHasMore(hasMoreCatalogResults(results.length, SEARCH_PAGE_SIZE));
        })
        .finally(() => {
          if (isActive && loadSequenceRef.current === sequence) setIsLoading(false);
        });
    }, delay);

    return () => {
      isActive = false;
      window.clearTimeout(timeout);
    };
  }, [request, semanticGames]);

  const loadMore = useCallback(() => {
    if (semanticGames || isLoading || isLoadingMore || !hasMore) return;

    const sequence = loadSequenceRef.current;
    setIsLoadingMore(true);

    loadCatalogSearchResults({
      categoryIds: request.categoryIds,
      complexity: request.complexity,
      limit: SEARCH_PAGE_SIZE,
      mechanicIds: request.mechanicIds,
      offset: nextOffset,
      players: request.players,
      playtimeRanges: request.playtimeRanges,
      query: request.query,
    })
      .then((results) => {
        if (loadSequenceRef.current !== sequence) return;
        setGames((currentGames) => appendUniqueCatalogResults(currentGames, results));
        setNextOffset((currentOffset) => currentOffset + results.length);
        setHasMore(hasMoreCatalogResults(results.length, SEARCH_PAGE_SIZE));
      })
      .finally(() => {
        if (loadSequenceRef.current === sequence) setIsLoadingMore(false);
      });
  }, [hasMore, isLoading, isLoadingMore, nextOffset, request, semanticGames]);

  return { filterOptions, games, hasMore, isLoading, isLoadingMore, loadMore };
}

function sameNumberSet(left: Set<number>, right: Set<number>): boolean {
  if (left.size !== right.size) return false;
  for (const value of left) if (!right.has(value)) return false;
  return true;
}

function taxonomyEntriesFromDetail(
  detail: Pick<GameDetail, "categoryEntries" | "mechanicEntries">,
  key: "categoryEntries" | "mechanicEntries",
  names: string[],
): GameTaxonomyEntry[] {
  const entries = detail[key];
  if (entries?.length) return entries;
  return names.map((name, index) => ({ id: -(index + 1), name }));
}

function mapDetailToFilterableSemanticResult(detail: GameDetail): FilterableSemanticResult {
  const [minPlayers, maxPlayers] = parseRangeText(detail.players);
  const playtimeRange = parseRangeText(detail.playTime, null);
  const categories = taxonomyEntriesFromDetail(detail, "categoryEntries", detail.categories);
  const mechanics = taxonomyEntriesFromDetail(detail, "mechanicEntries", detail.mechanics);

  return {
    id: detail.id,
    name: detail.name,
    altTitle: detail.altTitle,
    image: detail.image,
    isExpansion: detail.isExpansion,
    genres: detail.genres,
    categories,
    mechanics,
    categoryNames: categories.map((entry) => entry.name),
    mechanicNames: mechanics.map((entry) => entry.name),
    minPlayers,
    maxPlayers,
    minMinutes: playtimeRange?.[0] ?? null,
    maxMinutes: playtimeRange?.[1] ?? null,
    complexity: detail.complexity,
  };
}

function Toggle({
  active,
  label,
  onClick,
  removable = false,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  removable?: boolean;
}) {
  const showRemoveIcon = shouldShowFilterRemoveIcon({ active, removable });

  return (
    <button
      aria-label={showRemoveIcon ? `${label}, desactivar filtro` : label}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors ${
        active
          ? "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40"
          : "bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white hover:border-neutral-700"
      }`}
    >
      <span>{label}</span>
      {showRemoveIcon && <X aria-hidden="true" className="h-3 w-3 text-fuchsia-200" />}
    </button>
  );
}

export function Search({ categoryPage }: { categoryPage?: CatalogPageData } = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [routeParams, setRouteParams] = useSearchParams();
  const searchParams = useMemo(() => categoryPage?.category
    ? new URLSearchParams({ category_ids: String(categoryPage.category.id) }) : routeParams, [categoryPage, routeParams]);
  const setSearchParams = useCallback((update: URLSearchParams | ((params: URLSearchParams) => URLSearchParams), options?: NavigateOptions) => {
    const next = typeof update === "function" ? update(new URLSearchParams(searchParams)) : update;
    if (categoryPage) {
      clearLudoscopioSessionCache();
      navigate(`/search${next.size ? `?${next}` : ""}`, { state: options?.state, flushSync: options?.flushSync });
    }
    else setRouteParams(next, options);
  }, [categoryPage, navigate, searchParams, setRouteParams]);
  useEffect(() => {
    if (!categoryPage || !routeParams.size) return;
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of routeParams) next.set(key, value);
    clearLudoscopioSessionCache();
    navigate(`/search?${next}`, { replace: true });
  }, [categoryPage, routeParams, searchParams, navigate]);
  const controls = useMemo(() => parseExploreControlParams(searchParams), [searchParams]);
  const requestedTextQuery = searchParams.get("q")?.trim() ?? "";
  const [queryHandoff] = useState<QueryInputHandoff | null>(() => {
    const handoff = location.state?.exploreQueryInput;
    return !categoryPage && typeof handoff?.value === "string" && handoff.value.trim() === requestedTextQuery ? handoff : null;
  });
  const [query, setQuery] = useState(queryHandoff?.value ?? requestedTextQuery);
  const queryInputRef = useRef<HTMLInputElement | null>(null);
  const queryComposingRef = useRef(false);
  useLayoutEffect(() => {
    if (!queryHandoff || !queryInputRef.current) return;
    queryInputRef.current.focus({ preventScroll: true });
    queryInputRef.current.setSelectionRange(queryHandoff.start, queryHandoff.end, queryHandoff.direction);
  }, [queryHandoff]);
  const [activeCategories, setActiveCategories] = useState<Set<number>>(() =>
    parsePositiveIntegerSetParam(searchParams.get("category_ids")),
  );
  const [activeMechanics, setActiveMechanics] = useState<Set<number>>(() =>
    parsePositiveIntegerSetParam(searchParams.get("mechanic_ids")),
  );
  const [categoriesCollapsed, setCategoriesCollapsed] = useState(true);
  const [mechanicsCollapsed, setMechanicsCollapsed] = useState(true);
  const [players, setPlayers] = useState<number | null>(controls.players);
  const [playtimes, setPlaytimes] = useState<Set<PlaytimeKey>>(() => new Set(controls.playtimes as PlaytimeKey[]));
  const [complexity, setComplexity] = useState<[number, number]>(controls.complexity as [number, number]);
  const [cachedLudoscopioSession] = useState(() => categoryPage ? null : readLudoscopioSessionCache());
  const [semanticQuery, setSemanticQuery] = useState(() => cachedLudoscopioSession?.prompt ?? "");
  const [semanticGames, setSemanticGames] = useState<FilterableSemanticResult[] | null>(
    () => cachedLudoscopioSession?.results ?? null,
  );
  const [isSemanticLoading, setIsSemanticLoading] = useState(false);
  const selectedPlaytimeRanges = useMemo(
    () =>
      Array.from(playtimes)
        .map((playtime) => PLAYTIME_OPTIONS.find((option) => option.key === playtime)?.range)
        .filter((range): range is [number, number] => Boolean(range)),
    [playtimes],
  );
  const searchRequest = useMemo<CatalogSearchRequest>(
    () => ({
      categoryIds: Array.from(activeCategories).sort((left, right) => left - right),
      complexity,
      mechanicIds: Array.from(activeMechanics).sort((left, right) => left - right),
      players,
      playtimeRanges: selectedPlaytimeRanges,
      query,
    }),
    [activeCategories, activeMechanics, complexity, players, query, selectedPlaytimeRanges],
  );
  const { filterOptions, games, hasMore, isLoading, isLoadingMore, loadMore } = useCatalogSearchGames(
    searchRequest,
    semanticGames,
  );
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const categoryOptions = useMemo(() => filterOptions.categories, [filterOptions.categories]);
  const mechanicOptions = useMemo(() => filterOptions.mechanics, [filterOptions.mechanics]);
  const allCategories = useMemo(
    () => sortTaxonomyOptionsByActive(categoryOptions, activeCategories),
    [activeCategories, categoryOptions],
  );
  const allMechanics = useMemo(
    () => sortTaxonomyOptionsByActive(mechanicOptions, activeMechanics),
    [activeMechanics, mechanicOptions],
  );
  const activeCategoryOptions = useMemo(
    () => allCategories.filter((category) => activeCategories.has(category.id)),
    [activeCategories, allCategories],
  );
  const activeMechanicOptions = useMemo(
    () => allMechanics.filter((mechanic) => activeMechanics.has(mechanic.id)),
    [activeMechanics, allMechanics],
  );
  const updateControl = (values: Record<string, string | null>) => {
    setSearchParams(current => {
      for (const [key, value] of Object.entries(values)) {
        if (value === null) current.delete(key); else current.set(key, value);
      }
      return current;
    }, { replace: true });
  };
  const changePlayers = (value: number) => {
    const next = players === value ? null : value;
    setPlayers(next); updateControl({ players: next === null ? null : String(next) });
  };
  const changePlaytime = (value: PlaytimeKey) => {
    const next = new Set(playtimes);
    if (next.has(value)) next.delete(value); else next.add(value);
    setPlaytimes(next);
    updateControl({ playtimes: next.size ? PLAYTIME_OPTIONS.filter(option => next.has(option.key)).map(option => option.key).join(",") : null });
  };
  const changeComplexity = (value: number) => {
    const next: [number, number] = complexity[0] === value && complexity[1] === value ? [1, 5]
      : value < complexity[0] ? [value, complexity[1]] : value > complexity[1] ? [complexity[0], value] : [value, value];
    setComplexity(next);
    updateControl({ complexity_min: next[0] === 1 && next[1] === 5 ? null : String(next[0]),
      complexity_max: next[0] === 1 && next[1] === 5 ? null : String(next[1]) });
  };

  const toggleTaxonomy = (
    activeIds: Set<number>,
    value: number,
    setter: (ids: Set<number>) => void,
    paramName: "category_ids" | "mechanic_ids",
  ) => {
    const nextIds = new Set(activeIds);
    if (nextIds.has(value)) nextIds.delete(value); else nextIds.add(value);
    setter(nextIds);
    setSearchParams(
      (currentParams) => setPositiveIntegerSetParam(currentParams, paramName, nextIds),
      { replace: true },
    );
  };

  const results = useMemo<Array<Game & { canonicalPath?: string }>>(
    () => semanticGames ? filterSemanticSearchResults(semanticGames, searchRequest) : games,
    [games, searchRequest, semanticGames],
  );

  const activeFilterCount =
    (query.trim() ? 1 : 0) +
    (semanticQuery ? 1 : 0) +
    activeCategories.size +
    activeMechanics.size +
    (players !== null ? 1 : 0) +
    playtimes.size +
    (complexity[0] !== 1 || complexity[1] !== 5 ? 1 : 0);
  const isResultsLoading = isLoading || isSemanticLoading;
  const resultCountText = `${results.length}${!semanticGames && hasMore ? "+" : ""} resultado${results.length !== 1 ? "s" : ""}`;

  const clearAll = () => {
    setQuery("");
    setActiveCategories(new Set());
    setActiveMechanics(new Set());
    setPlayers(null);
    setPlaytimes(new Set());
    setComplexity([1, 5]);
    setSemanticQuery("");
    setSemanticGames(null);
    clearLudoscopioSessionCache();
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("q");
    nextParams.delete("category_ids");
    nextParams.delete("mechanic_ids");
    for (const key of ["players", "playtimes", "complexity_min", "complexity_max"]) nextParams.delete(key);
    setSearchParams(nextParams, { replace: true });
  };

  const handleTextQueryChange = (value: string) => {
    setQuery(value);
    if (categoryPage && queryComposingRef.current) return;
    const input = queryInputRef.current;
    const handoff: QueryInputHandoff | undefined = categoryPage && input === document.activeElement ? {
      value, start: input.selectionStart ?? value.length, end: input.selectionEnd ?? value.length,
      direction: input.selectionDirection ?? "none",
    } : undefined;
    setSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams);
      const nextQuery = value.trim();
      if (nextQuery) nextParams.set("q", nextQuery);
      else nextParams.delete("q");
      return nextParams;
    }, handoff ? { state: { exploreQueryInput: handoff }, flushSync: true } : { replace: true });
  };

  const handleLudoscopioSearch = useCallback(async (value: string) => {
    const prompt = value.trim();
    if (!prompt || isSemanticLoading) return;
    if (categoryPage) {
      clearLudoscopioSessionCache();
      navigate(`/search?${new URLSearchParams({ ludoscopio: prompt })}`);
      return;
    }

    setIsSemanticLoading(true);
    try {
      const details = await loadSemanticCatalogGameDetails(prompt, 40);
      const semanticResults = details.map(mapDetailToFilterableSemanticResult);
      setSemanticGames(semanticResults);
      setSemanticQuery(prompt);
      writeLudoscopioSessionCache(prompt, semanticResults);
      setQuery("");
      setSearchParams((currentParams) => {
        const nextParams = new URLSearchParams(currentParams);
        for (const key of ["q", "category_ids", "mechanic_ids", "players", "playtimes", "complexity_min", "complexity_max", "ludoscopio", "ludoscopioPrompt"]) nextParams.delete(key);
        return nextParams;
      }, { replace: true });
      setActiveCategories(new Set());
      setActiveMechanics(new Set());
      setPlayers(null);
      setPlaytimes(new Set());
      setComplexity([1, 5]);
    } finally {
      setIsSemanticLoading(false);
    }
  }, [categoryPage, isSemanticLoading, navigate, setSearchParams]);

  const shouldOpenLudoscopio = searchParams.get("ludoscopio") === "open";

  useEffect(() => {
    setQuery(current => current.trim() === requestedTextQuery ? current : requestedTextQuery);
  }, [requestedTextQuery]);

  useEffect(() => {
    setPlayers(controls.players);
    setPlaytimes(new Set(controls.playtimes as PlaytimeKey[]));
    setComplexity(controls.complexity as [number, number]);
  }, [controls]);

  useEffect(() => {
    const nextCategories = parsePositiveIntegerSetParam(searchParams.get("category_ids"));
    const nextMechanics = parsePositiveIntegerSetParam(searchParams.get("mechanic_ids"));

    setActiveCategories((current) => (sameNumberSet(current, nextCategories) ? current : nextCategories));
    setActiveMechanics((current) => (sameNumberSet(current, nextMechanics) ? current : nextMechanics));
  }, [searchParams]);

  useEffect(() => {
    const ludoscopioParam = searchParams.get("ludoscopio")?.trim();
    const requestedPrompt =
      ludoscopioParam && ludoscopioParam !== "open"
        ? ludoscopioParam
        : searchParams.get("ludoscopioPrompt")?.trim();
    if (!ludoscopioParam && !requestedPrompt) return;

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("ludoscopio");
    nextParams.delete("ludoscopioPrompt");
    setSearchParams(nextParams, { replace: true });
    if (requestedPrompt) void handleLudoscopioSearch(requestedPrompt);
  }, [handleLudoscopioSearch, searchParams, setSearchParams]);

  useEffect(() => {
    if (semanticGames || !hasMore || isResultsLoading) return;

    const target = loadMoreRef.current;
    if (!target || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMore();
      },
      { rootMargin: "480px 0px" },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, isResultsLoading, loadMore, semanticGames]);

  return (
    <div
      className="min-h-screen text-white"
      style={{
        background: "radial-gradient(ellipse 130% 38% at 50% -5%, rgba(217, 70, 239, 0.08) 0%, transparent 58%), rgb(10, 10, 10)",
      }}
    >
      <SiteHeader
        contextBar={
          <div className="flex min-h-12 flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/5 px-4 py-2 sm:px-8">
            <button
              onClick={() => (window.history.state?.idx > 0 ? navigate(-1) : navigate("/"))}
              className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">Volver</span>
            </button>
            <span className="text-neutral-700">|</span>
            <SlidersHorizontal className="w-4 h-4 text-fuchsia-400" />
            <span className="text-white text-sm">Encuentra tu próximo juego</span>
            <span className="text-neutral-600 text-sm">
              {isResultsLoading ? "· Cargando" : `· ${resultCountText}`}
            </span>
            {activeFilterCount > 0 && (
              <button
                onClick={clearAll}
                className="ml-auto text-xs text-neutral-500 hover:text-fuchsia-300 transition-colors flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                Borrar todo ({activeFilterCount})
              </button>
            )}
          </div>
        }
      />

      <main className="w-full px-4 py-8 sm:px-6 lg:px-8 grid gap-8 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* Filters sidebar */}
        <aside className="space-y-6">
          {/* Search box */}
          <div>
            <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-2">Buscar</label>
            <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 focus-within:border-fuchsia-500/50 transition-colors">
              <SearchIcon className="w-4 h-4 text-neutral-500 flex-none" />
              <input
                type="text"
                ref={queryInputRef}
                value={query}
                onChange={(e) => handleTextQueryChange(e.target.value)}
                onCompositionStart={() => { queryComposingRef.current = true; }}
                onCompositionEnd={(event) => {
                  queryComposingRef.current = false;
                  if (categoryPage) handleTextQueryChange(event.currentTarget.value);
                }}
                placeholder="Nombre, temática, mecánica…"
                className="bg-transparent text-sm text-white placeholder:text-neutral-600 outline-none w-full"
              />
              {query && (
                <button onClick={() => handleTextQueryChange("")} className="text-neutral-500 hover:text-white transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <LudoscopioCallout
              className="mt-3"
              initialOpen={shouldOpenLudoscopio}
              onSearch={handleLudoscopioSearch}
            />
          </div>

          {/* Player count */}
          <div>
            <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-2">Jugadores</label>
            <div className="flex gap-1.5 flex-wrap">
              {PLAYER_OPTIONS.map((n) => (
                <button
                  key={n}
                  onClick={() => changePlayers(n)}
                  className={`w-9 h-9 rounded-full text-sm border transition-colors ${
                    players === n
                      ? "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40"
                      : "bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white hover:border-neutral-700"
                  }`}
                >
                  {n === 6 ? "6+" : n}
                </button>
              ))}
            </div>
          </div>

          {/* Playtime */}
          <div>
            <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-2">Duración</label>
            <div className="flex flex-col gap-1.5">
              {PLAYTIME_OPTIONS.map((opt) => (
                <Toggle
                  key={opt.key}
                  label={opt.label}
                  active={playtimes.has(opt.key)}
                  onClick={() => changePlaytime(opt.key)}
                />
              ))}
            </div>
          </div>

          {/* Complexity */}
          <div>
            <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-2">
              Complejidad
              <span className="ml-2 text-fuchsia-400 normal-case tracking-normal">
                {complexity[0]} – {complexity[1]}
              </span>
            </label>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => {
                const inRange = n >= complexity[0] && n <= complexity[1];
                return (
                  <button
                    key={n}
                    onClick={() => changeComplexity(n)}
                    className={`flex-1 py-1.5 rounded-md text-sm border transition-colors ${
                      inRange
                        ? "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40"
                        : "bg-neutral-900 text-neutral-500 border-neutral-800 hover:text-white"
                    }`}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-neutral-600 mt-1.5">Toca un valor para fijar, o dos para definir un rango.</p>
          </div>

          {/* Categories */}
          <div>
            <button
              type="button"
              aria-expanded={!categoriesCollapsed}
              aria-label={categoriesCollapsed ? "Expandir categorías" : "Colapsar categorías"}
              aria-controls="category-filter-options"
              onClick={() => setCategoriesCollapsed((collapsed) => !collapsed)}
              className="mb-2 flex w-full items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-2 text-left text-xs uppercase tracking-wider text-neutral-400 transition-colors hover:border-neutral-700 hover:bg-neutral-900 hover:text-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-500/50"
            >
              <span className="min-w-0">
                Categorías
                {activeCategories.size > 0 && (
                  <span className="ml-2 text-fuchsia-400 normal-case tracking-normal">{activeCategories.size} activas</span>
                )}
              </span>
              <span className="ml-3 inline-flex flex-none items-center gap-1.5 rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-[11px] font-medium normal-case tracking-normal text-neutral-300">
                {categoriesCollapsed ? "Expandir" : "Colapsar"}
                {categoriesCollapsed ? (
                  <ChevronRight aria-hidden="true" className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown aria-hidden="true" className="h-3.5 w-3.5" />
                )}
              </span>
            </button>
            {!categoriesCollapsed && (
              <div id="category-filter-options" className="flex flex-wrap gap-1.5">
                {allCategories.map((category) => (
                  <Toggle
                    key={category.id}
                    label={t(category.name)}
                    active={activeCategories.has(category.id)}
                    onClick={() =>
                      toggleTaxonomy(activeCategories, category.id, setActiveCategories, "category_ids")
                    }
                    removable
                  />
                ))}
              </div>
            )}
          </div>

          {/* Mechanics */}
          <div>
            <button
              type="button"
              aria-expanded={!mechanicsCollapsed}
              aria-label={mechanicsCollapsed ? "Expandir mecánicas" : "Colapsar mecánicas"}
              aria-controls="mechanic-filter-options"
              onClick={() => setMechanicsCollapsed((collapsed) => !collapsed)}
              className="mb-2 flex w-full items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-2 text-left text-xs uppercase tracking-wider text-neutral-400 transition-colors hover:border-neutral-700 hover:bg-neutral-900 hover:text-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-500/50"
            >
              <span className="min-w-0">
                Mecánicas
                {activeMechanics.size > 0 && (
                  <span className="ml-2 text-fuchsia-400 normal-case tracking-normal">{activeMechanics.size} activas</span>
                )}
              </span>
              <span className="ml-3 inline-flex flex-none items-center gap-1.5 rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-[11px] font-medium normal-case tracking-normal text-neutral-300">
                {mechanicsCollapsed ? "Expandir" : "Colapsar"}
                {mechanicsCollapsed ? (
                  <ChevronRight aria-hidden="true" className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown aria-hidden="true" className="h-3.5 w-3.5" />
                )}
              </span>
            </button>
            {!mechanicsCollapsed && (
              <div id="mechanic-filter-options" className="flex flex-wrap gap-1.5">
                {allMechanics.map((mechanic) => (
                  <Toggle
                    key={mechanic.id}
                    label={t(mechanic.name)}
                    active={activeMechanics.has(mechanic.id)}
                    onClick={() =>
                      toggleTaxonomy(activeMechanics, mechanic.id, setActiveMechanics, "mechanic_ids")
                    }
                    removable
                  />
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* Results */}
        <section className="min-w-0">
          {categoryPage && <div hidden className="hidden">
            <h1 className="text-2xl font-bold md:text-3xl">{catalogSeoMetadata(categoryPage).heading}</h1>
            <p className="mt-3 max-w-3xl text-neutral-300">{catalogSeoMetadata(categoryPage).description}</p>
            <ul>
              {categoryPage.items?.map(game => <li key={game.id}>
                <Link to={game.canonicalPath}>{game.name}</Link>
              </li>)}
            </ul>
            <CatalogPagination model={categoryPage} />
          </div>}
          {(activeCategoryOptions.length > 0 || activeMechanicOptions.length > 0) && (
            <div
              aria-label="Filtros de categoría y mecánica activos"
              className="mb-5 rounded-lg border border-neutral-800 bg-neutral-950 px-4 py-3"
            >
              <p className="mb-2 text-xs uppercase tracking-wider text-neutral-500">Filtros activos</p>
              <div className="flex flex-wrap gap-1.5">
                {activeCategoryOptions.map((category) => (
                  <Toggle
                    key={`active-category-${category.id}`}
                    label={t(category.name)}
                    active
                    onClick={() =>
                      toggleTaxonomy(activeCategories, category.id, setActiveCategories, "category_ids")
                    }
                    removable
                  />
                ))}
                {activeMechanicOptions.map((mechanic) => (
                  <Toggle
                    key={`active-mechanic-${mechanic.id}`}
                    label={t(mechanic.name)}
                    active
                    onClick={() =>
                      toggleTaxonomy(activeMechanics, mechanic.id, setActiveMechanics, "mechanic_ids")
                    }
                    removable
                  />
                ))}
              </div>
            </div>
          )}
          {semanticQuery && (
            <div className="mb-5 rounded-lg border border-fuchsia-500/20 bg-neutral-950 px-4 py-3">
              <div className="flex items-start gap-3">
                <SearchIcon className="mt-0.5 h-4 w-4 flex-none text-fuchsia-300" />
                <div>
                  <p className="text-xs uppercase tracking-wider text-neutral-500">LudoRadar</p>
                  <p className="mt-1 text-sm text-neutral-200">Resultados para “{semanticQuery}”</p>
                </div>
              </div>
            </div>
          )}
          {isResultsLoading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3 border border-dashed border-neutral-800 rounded-xl">
              <Dices className="w-10 h-10 text-neutral-700" />
              <p className="text-neutral-500 text-sm">{isSemanticLoading ? "Consultando LudoRadar..." : "Cargando catálogo..."}</p>
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3 border border-dashed border-neutral-800 rounded-xl">
              <Dices className="w-10 h-10 text-neutral-700" />
              <p className="text-neutral-500 text-sm">Ningún juego coincide con estos filtros.</p>
              <button onClick={clearAll} className="text-fuchsia-400 hover:text-fuchsia-300 text-sm transition-colors">
                Borrar todos los filtros
              </button>
            </div>
          ) : (
            <>
              <div aria-label="Resultados de juegos" className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}>
                {results.map((game) => (
                  <Link key={game.id} to={game.canonicalPath ?? productPath(game.id, game.name)} className="group flex flex-col">
                    <div className="relative flex items-center justify-center rounded-md overflow-hidden mb-1.5" style={{ aspectRatio: "1" }}>
                      <div className="relative inline-flex max-h-full max-w-full">
                        {game.image ? <ImageWithFallback
                          src={game.image}
                          alt={game.name}
                          className="block max-h-full max-w-full object-contain"
                        /> : <div aria-hidden="true" className="flex h-36 w-36 max-w-full items-center justify-center rounded bg-neutral-800 text-xs text-neutral-500">Imagen no disponible</div>}
                        {game.isExpansion && <ExpansionBadge className={EXPANSION_BADGE_CORNER_CLASS} />}
                      </div>
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />
                    </div>
                    <p className="text-neutral-300 text-sm text-center group-hover:text-white transition-colors truncate px-1 leading-snug">
                      {game.name}
                    </p>
                    {game.altTitle && (
                      <p className="text-neutral-600 text-xs text-center mt-0.5 truncate px-1">{game.altTitle}</p>
                    )}
                  </Link>
                ))}
              </div>
              {!semanticGames && (
                <div
                  ref={loadMoreRef}
                  aria-live="polite"
                  className="flex min-h-16 items-center justify-center py-8 text-sm text-neutral-500"
                >
                  {isLoadingMore ? (
                    <span>Cargando más juegos...</span>
                  ) : hasMore ? (
                    <span className="sr-only">Cargar más resultados</span>
                  ) : (
                    <span>No hay más resultados.</span>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}
