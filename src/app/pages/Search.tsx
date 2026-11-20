import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams, type NavigateOptions } from "react-router";
import { productPath } from "../utils/productRoutes.js";
import { ArrowLeft, Search as SearchIcon, X, Dices, SlidersHorizontal, ChevronDown, ChevronRight } from "lucide-react";
import type { Game } from "../data/games";
import type { LudoscopioFilters } from "../api/catalog";
import {
  loadCatalogFilterOptions,
  loadCatalogSearchResults,
  loadLudoscopioCatalogGames,
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
import {
  hasLudoscopioControlParams,
  readLudoscopioControlParams,
  sameLudoscopioFilters,
  writeLudoscopioControlParams,
} from "../utils/ludoscopioFilters.js";
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

type LudoscopioSearchState = Pick<LudoscopioFilters, "theme" | "exactTitle"> & { prompt: string };
type LudoscopioSession = { prompt: string; filters?: LudoscopioFilters; results: Game[] };

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
  isLudoscopio: boolean,
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
    if (isLudoscopio) {
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
  }, [request, isLudoscopio]);

  const loadMore = useCallback(() => {
    if (isLudoscopio || isLoading || isLoadingMore || !hasMore) return;

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
  }, [hasMore, isLoading, isLoadingMore, nextOffset, request, isLudoscopio]);

  return { filterOptions, games, hasMore, isLoading, isLoadingMore, loadMore };
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
      type="button"
      aria-pressed={active}
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

function ThemeFilter({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const [draft, setDraft] = useState(value ?? "");
  return (
    <form
      className="mt-3 flex flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        onChange(draft.trim() || null);
      }}
    >
      <label className="min-w-0 flex-1 text-xs text-neutral-400">
        Tema
        <input
          className="mt-1 block w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-sm text-white"
          value={draft}
          maxLength={250}
          onChange={(event) => setDraft(event.target.value)}
        />
      </label>
      <button type="submit" disabled={draft.trim() === (value ?? "")} className="px-2 py-1.5 text-sm text-fuchsia-300 disabled:opacity-50">
        Aplicar
      </button>
      {value && (
        <button type="button" aria-label="Quitar tema" onClick={() => onChange(null)} className="rounded-md border border-neutral-800 p-1.5 text-neutral-400 hover:text-white">
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      )}
    </form>
  );
}

export function Search({ categoryPage }: { categoryPage?: CatalogPageData } = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [routeParams, setRouteParams] = useSearchParams();
  const [completedLudoscopioSession, setCompletedLudoscopioSession] = useState<LudoscopioSession | null>(
    () => readLudoscopioSessionCache(),
  );
  const ludoscopioParam = routeParams.get("ludoscopio")?.trim();
  const shouldOpenLudoscopio = ludoscopioParam === "open";
  const requestedLudoscopioPrompt = ludoscopioParam && !shouldOpenLudoscopio
    ? ludoscopioParam : routeParams.get("ludoscopioPrompt")?.trim();
  const mode = location.state?.exploreResultMode;
  const routedLudoscopio = location.state?.ludoscopioSearch as LudoscopioSearchState | undefined;
  const restored = !requestedLudoscopioPrompt && !categoryPage && mode !== "ordinary" && !routedLudoscopio
    && (mode === "semantic" || !hasLudoscopioControlParams(routeParams)) ? completedLudoscopioSession : null;
  const ludoscopioPrompt = !categoryPage && mode !== "ordinary" ? routedLudoscopio?.prompt ?? restored?.prompt ?? "" : "";
  const restoredFilters = restored?.filters;
  const theme = routedLudoscopio ? routedLudoscopio.theme
    : restoredFilters ? restoredFilters.theme : restored?.prompt.slice(0, 250).trim() || null;
  const exactTitle = routedLudoscopio ? routedLudoscopio.exactTitle : restoredFilters?.exactTitle ?? null;
  const searchParams = useMemo(() => {
    if (categoryPage?.category) return new URLSearchParams({ category_ids: String(categoryPage.category.id) });
    if (restoredFilters && !hasLudoscopioControlParams(routeParams)) return writeLudoscopioControlParams(routeParams, restoredFilters);
    return routeParams;
  }, [categoryPage, routeParams, restoredFilters]);
  useEffect(() => {
    if (!categoryPage || !routeParams.size) return;
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of routeParams) next.set(key, value);
    navigate(`/search?${next}`, { replace: true, state: { exploreResultMode: "ordinary" } });
  }, [categoryPage, routeParams, searchParams, navigate]);
  const controls = useMemo(() => parseExploreControlParams(searchParams), [searchParams]);
  const ludoscopioFilters = useMemo<LudoscopioFilters | null>(
    () => ludoscopioPrompt ? readLudoscopioControlParams(searchParams, theme, exactTitle) : null,
    [exactTitle, ludoscopioPrompt, searchParams, theme],
  );
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
  const activeCategories = useMemo(() => parsePositiveIntegerSetParam(searchParams.get("category_ids")), [searchParams]);
  const activeMechanics = useMemo(() => parsePositiveIntegerSetParam(searchParams.get("mechanic_ids")), [searchParams]);
  const [categoriesCollapsed, setCategoriesCollapsed] = useState(true);
  const [mechanicsCollapsed, setMechanicsCollapsed] = useState(true);
  const players = ludoscopioFilters ? ludoscopioFilters.players : controls.players;
  const playerOptions = players !== null && players > 6 ? [...PLAYER_OPTIONS, players] : PLAYER_OPTIONS;
  const playtimes = useMemo(() => new Set<PlaytimeKey>(ludoscopioFilters?.playtimes ?? controls.playtimes as PlaytimeKey[]),
    [controls, ludoscopioFilters],
  );
  const complexity = useMemo<[number, number]>(
    () => ludoscopioFilters ? [ludoscopioFilters.complexityMin ?? 1, ludoscopioFilters.complexityMax ?? 5] : controls.complexity as [number, number],
    [controls, ludoscopioFilters],
  );
  const setSearchParams = useCallback((update: URLSearchParams | ((params: URLSearchParams) => URLSearchParams), options?: NavigateOptions) => {
    const next = new URLSearchParams(typeof update === "function" ? update(new URLSearchParams(searchParams)) : update);
    // These URL parameters launch a search once. Control edits must not copy them forward.
    next.delete("ludoscopio");
    next.delete("ludoscopioPrompt");
    const state = ludoscopioPrompt ? {
      exploreResultMode: "semantic",
      ludoscopioSearch: { prompt: ludoscopioPrompt, theme, exactTitle },
      ...options?.state,
    } : { exploreResultMode: "ordinary", ...options?.state };
    if (categoryPage) navigate(`/search${next.size ? `?${next}` : ""}`, { state, flushSync: options?.flushSync });
    else setRouteParams(next, { ...options, state });
  }, [categoryPage, exactTitle, ludoscopioPrompt, navigate, searchParams, setRouteParams, theme]);
  const promptRequest = useRef<AbortController | null>(null);
  const refinementRequest = useRef<AbortController | null>(null);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const [promptError, setPromptError] = useState<{ prompt: string; locationKey: string } | null>(null);
  const failedPrompt = pendingPrompt ? null : promptError?.locationKey === location.key
    ? promptError.prompt : location.state?.ludoscopioFailedPrompt ?? null;
  const isLudoscopio = Boolean(ludoscopioPrompt || pendingPrompt || failedPrompt);
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
    isLudoscopio,
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
  const suggestedCategories = categoryOptions.filter((category) => ludoscopioFilters?.suggestedCategoryIds.includes(category.id));
  const suggestedMechanics = mechanicOptions.filter((mechanic) => ludoscopioFilters?.suggestedMechanicIds.includes(mechanic.id));
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
    updateControl({ players: next === null ? null : String(next) });
  };
  const changePlaytime = (value: PlaytimeKey) => {
    const next = new Set(playtimes);
    if (next.has(value)) next.delete(value); else next.add(value);
    updateControl({
      playtimes: next.size ? PLAYTIME_OPTIONS.filter(option => next.has(option.key)).map(option => option.key).join(",") : null,
      duration_min: null,
      duration_max: null,
    });
  };
  const changeComplexity = (value: number) => {
    const next: [number, number] = complexity[0] === value && complexity[1] === value ? [1, 5]
      : value < complexity[0] ? [value, complexity[1]] : value > complexity[1] ? [complexity[0], value] : [value, value];
    updateControl({ complexity_min: next[0] === 1 && next[1] === 5 ? null : String(next[0]),
      complexity_max: next[0] === 1 && next[1] === 5 ? null : String(next[1]) });
  };

  const toggleTaxonomy = (
    activeIds: Set<number>,
    value: number,
    paramName: "category_ids" | "mechanic_ids",
  ) => {
    const nextIds = new Set(activeIds);
    if (nextIds.has(value)) nextIds.delete(value); else nextIds.add(value);
    setSearchParams(
      (currentParams) => setPositiveIntegerSetParam(currentParams, paramName, nextIds),
      { replace: true },
    );
  };

  const hasCurrentResults = completedLudoscopioSession?.prompt === ludoscopioPrompt &&
    ((restored && !completedLudoscopioSession.filters && !hasLudoscopioControlParams(routeParams)) ||
      sameLudoscopioFilters(completedLudoscopioSession.filters, ludoscopioFilters));
  const needsRefinement = Boolean(ludoscopioFilters && !hasCurrentResults && !pendingPrompt && !failedPrompt);
  const refinementKey = needsRefinement ? JSON.stringify([ludoscopioPrompt, ludoscopioFilters]) : null;
  const [failedRefinement, setFailedRefinement] = useState<string | null>(null);
  const [refinementAttempt, retryRefinement] = useState(0);
  const showRefinementError = refinementKey !== null && failedRefinement === refinementKey;
  const saveLudoscopioSession = useCallback((prompt: string, session: { filters: LudoscopioFilters; results: Game[] }) => {
    writeLudoscopioSessionCache(prompt, session.filters, session.results);
    setCompletedLudoscopioSession({ prompt, ...session });
  }, []);

  useEffect(() => {
    if (!refinementKey || !ludoscopioFilters) return;

    setFailedRefinement(null);
    const controller = new AbortController();
    refinementRequest.current = controller;
    const timeout = window.setTimeout(() => {
      loadLudoscopioCatalogGames({ filters: ludoscopioFilters }, controller.signal)
        .then(session => {
          if (controller.signal.aborted) return;
          saveLudoscopioSession(ludoscopioPrompt, session);
          if (!sameLudoscopioFilters(ludoscopioFilters, session.filters)) {
            setSearchParams(current => writeLudoscopioControlParams(current, session.filters), { replace: true });
          }
        })
        .catch(() => {
          if (!controller.signal.aborted) setFailedRefinement(refinementKey);
        });
    }, 250);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
      if (refinementRequest.current === controller) refinementRequest.current = null;
    };
  }, [ludoscopioFilters, ludoscopioPrompt, refinementAttempt, refinementKey, saveLudoscopioSession, setSearchParams]);

  const results: Array<Game & { canonicalPath?: string }> = isLudoscopio
    ? (hasCurrentResults ? completedLudoscopioSession?.results ?? [] : []) : games;
  const hasComplexityFilter = ludoscopioFilters
    ? ludoscopioFilters.complexityMin !== null || ludoscopioFilters.complexityMax !== null
    : complexity[0] !== 1 || complexity[1] !== 5;

  const activeFilterCount =
    (query.trim() ? 1 : 0) +
    (ludoscopioPrompt || pendingPrompt || failedPrompt ? 1 : 0) +
    (ludoscopioFilters?.durationMin != null ? 1 : 0) +
    (ludoscopioFilters?.durationMax != null ? 1 : 0) +
    activeCategories.size +
    activeMechanics.size +
    (players !== null ? 1 : 0) +
    playtimes.size +
    (hasComplexityFilter ? 1 : 0);
  const isLudoscopioLoading = Boolean(pendingPrompt || (needsRefinement && !showRefinementError));
  const isResultsLoading = isLudoscopio ? isLudoscopioLoading : isLoading;
  const resultCountText = `${results.length}${!isLudoscopio && hasMore ? "+" : ""} resultado${results.length !== 1 ? "s" : ""}`;

  const clearAll = () => {
    setQuery("");
    promptRequest.current?.abort();
    promptRequest.current = null;
    refinementRequest.current?.abort();
    setPendingPrompt(null);
    setPromptError(null);
    setCompletedLudoscopioSession(null);
    clearLudoscopioSessionCache();
    const nextParams = writeLudoscopioControlParams(searchParams, readLudoscopioControlParams(new URLSearchParams(), null, null));
    setSearchParams(nextParams, { replace: true, state: { exploreResultMode: "ordinary", ludoscopioSearch: null } });
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

  const handleLudoscopioSearch = useCallback(async (value: string, fromUrl = false) => {
    const prompt = value.trim();
    if (!prompt) return;
    if (categoryPage) {
      clearLudoscopioSessionCache();
      navigate(`/search?${new URLSearchParams({ ludoscopio: prompt })}`);
      return;
    }

    promptRequest.current?.abort();
    refinementRequest.current?.abort();
    const controller = new AbortController();
    promptRequest.current = controller;
    setPendingPrompt(prompt);
    setPromptError(null);
    try {
      const session = await loadLudoscopioCatalogGames({ prompt }, controller.signal);
      if (controller.signal.aborted) return;
      saveLudoscopioSession(prompt, session);
      setQuery(session.filters.query ?? "");
      setSearchParams(
        (currentParams) => writeLudoscopioControlParams(currentParams, session.filters),
        { replace: true, state: {
          exploreResultMode: "semantic",
          ludoscopioSearch: { prompt, theme: session.filters.theme, exactTitle: session.filters.exactTitle },
        } },
      );
    } catch (error) {
      if (controller.signal.aborted) return;
      if (fromUrl) {
        setSearchParams(searchParams, { replace: true, state: { ludoscopioFailedPrompt: prompt } });
      } else {
        setPromptError({ prompt, locationKey: location.key });
      }
      throw error;
    } finally {
      if (promptRequest.current === controller) {
        promptRequest.current = null;
        setPendingPrompt(null);
      }
    }
  }, [categoryPage, location.key, navigate, saveLudoscopioSession, searchParams, setSearchParams]);

  const updateLudoscopioSearch = (values: Partial<Pick<LudoscopioSearchState, "theme" | "exactTitle">>) => {
    setSearchParams(new URLSearchParams(searchParams), { replace: true, state: {
      ludoscopioSearch: { prompt: ludoscopioPrompt, theme, exactTitle, ...values },
    } });
  };

  useEffect(() => {
    setQuery(current => current.trim() === requestedTextQuery ? current : requestedTextQuery);
  }, [requestedTextQuery]);

  useEffect(() => () => {
    if (!promptRequest.current) return;
    promptRequest.current.abort();
    promptRequest.current = null;
    setPendingPrompt(null);
  }, [location.key]);

  useEffect(() => {
    if (requestedLudoscopioPrompt) void handleLudoscopioSearch(requestedLudoscopioPrompt, true).catch(() => {});
    else if (shouldOpenLudoscopio) setSearchParams(searchParams, { replace: true });
  }, [handleLudoscopioSearch, requestedLudoscopioPrompt, searchParams, setSearchParams, shouldOpenLudoscopio]);

  useEffect(() => {
    if (isLudoscopio || !hasMore || isResultsLoading) return;

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
  }, [hasMore, isLudoscopio, isResultsLoading, loadMore]);

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
                maxLength={isLudoscopio ? 500 : undefined}
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
              {playerOptions.map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={players === n}
                  onClick={() => changePlayers(n)}
                  className={`w-9 h-9 rounded-full text-sm border transition-colors ${
                    players === n
                      ? "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40"
                      : "bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white hover:border-neutral-700"
                  }`}
                >
                  {n === 6 && !isLudoscopio ? "6+" : n}
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
              {ludoscopioFilters?.durationMin != null && (
                <Toggle label={`Mínimo ${ludoscopioFilters.durationMin} min`} active removable onClick={() => updateControl({ duration_min: null })} />
              )}
              {ludoscopioFilters?.durationMax != null && (
                <Toggle label={`Máximo ${ludoscopioFilters.durationMax} min`} active removable onClick={() => updateControl({ duration_max: null })} />
              )}
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
                    type="button"
                    aria-pressed={inRange}
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
            {ludoscopioFilters && hasComplexityFilter && (
              <button
                type="button"
                onClick={() => updateControl({ complexity_min: null, complexity_max: null })}
                className="mt-1 text-xs text-fuchsia-300 hover:text-fuchsia-200"
              >
                Quitar filtro de complejidad
              </button>
            )}
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
                      toggleTaxonomy(activeCategories, category.id, "category_ids")
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
                      toggleTaxonomy(activeMechanics, mechanic.id, "mechanic_ids")
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
                      toggleTaxonomy(activeCategories, category.id, "category_ids")
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
                      toggleTaxonomy(activeMechanics, mechanic.id, "mechanic_ids")
                    }
                    removable
                  />
                ))}
              </div>
            </div>
          )}
          {ludoscopioPrompt && (
            <div className="mb-5 rounded-lg border border-fuchsia-500/20 bg-neutral-950 px-4 py-3">
              <div className="flex items-start gap-3">
                <SearchIcon className="mt-0.5 h-4 w-4 flex-none text-fuchsia-300" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs uppercase tracking-wider text-neutral-500">Ludo Radar</p>
                  <p className="mt-1 break-words text-sm text-neutral-200">Resultados para “{ludoscopioPrompt}”</p>
                  <ThemeFilter key={theme ?? ""} value={theme} onChange={(value) => updateLudoscopioSearch({ theme: value })} />
                  {exactTitle && (
                    <div className="mt-2">
                      <Toggle label={`Título exacto · ${exactTitle}`} active removable onClick={() => updateLudoscopioSearch({ exactTitle: null })} />
                    </div>
                  )}
                  {!pendingPrompt && !failedPrompt && (suggestedCategories.length > 0 || suggestedMechanics.length > 0) && (
                    <div role="group" aria-labelledby="ludoscopio-suggested-label" className="mt-3">
                      <p id="ludoscopio-suggested-label" className="mb-2 text-xs uppercase tracking-wider text-neutral-500">
                        Filtros sugeridos
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {suggestedCategories.map((category) => (
                          <Toggle
                            key={`suggested-category-${category.id}`}
                            label={t(category.name)}
                            active={activeCategories.has(category.id)}
                            onClick={() => toggleTaxonomy(activeCategories, category.id, "category_ids")}
                          />
                        ))}
                        {suggestedMechanics.map((mechanic) => (
                          <Toggle
                            key={`suggested-mechanic-${mechanic.id}`}
                            label={t(mechanic.name)}
                            active={activeMechanics.has(mechanic.id)}
                            onClick={() => toggleTaxonomy(activeMechanics, mechanic.id, "mechanic_ids")}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          {failedPrompt || showRefinementError ? (
            <div role="alert" className="rounded-lg border border-neutral-800 bg-neutral-950 px-4 py-3">
              <p className="text-sm text-red-300">No se pudo consultar Ludo Radar.</p>
              <button
                type="button"
                className="mt-2 text-sm text-fuchsia-300 hover:text-fuchsia-200"
                onClick={() => failedPrompt
                  ? void handleLudoscopioSearch(failedPrompt).catch(() => {})
                  : retryRefinement(attempt => attempt + 1)}
              >
                Reintentar
              </button>
            </div>
          ) : isResultsLoading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3 border border-dashed border-neutral-800 rounded-xl">
              <Dices className="w-10 h-10 text-neutral-700" />
              <p className="text-neutral-500 text-sm">{isLudoscopioLoading ? "Consultando Ludo Radar..." : "Cargando catálogo..."}</p>
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
              {!isLudoscopio && (
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
