import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { ArrowLeft, Search as SearchIcon, X, Dices, SlidersHorizontal, Sparkles } from "lucide-react";
import type { GameDetail } from "../data/games";
import { loadCatalogGameDetails, loadSemanticCatalogGameDetails } from "../data/catalog";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { t } from "../data/translations";
import { LudoscopioCallout } from "../components/LudoscopioCallout";

type PlaytimeKey = "short" | "medium" | "long";

const PLAYTIME_OPTIONS: { key: PlaytimeKey; label: string; range: [number, number] }[] = [
  { key: "short",  label: "Corta · <45m",   range: [0, 44] },
  { key: "medium", label: "Media · 45–90m",  range: [45, 90] },
  { key: "long",   label: "Larga · >90m",   range: [91, 999] },
];

const PLAYER_OPTIONS = [1, 2, 3, 4, 5, 6];

function parseRange(text: string): [number, number] {
  const nums = text.match(/\d+/g)?.map(Number) ?? [];
  if (nums.length === 0) return [0, 0];
  if (nums.length === 1) return [nums[0], nums[0]];
  return [nums[0], nums[1]];
}

function avgPlaytime(text: string): number {
  const [a, b] = parseRange(text);
  return (a + b) / 2;
}

function playtimeBucket(text: string): PlaytimeKey {
  const avg = avgPlaytime(text);
  if (avg < 45) return "short";
  if (avg <= 90) return "medium";
  return "long";
}

interface EnrichedGame {
  id: number;
  name: string;
  altTitle?: string;
  image: string;
  genres: string[];
  categories: string[];
  mechanics: string[];
  minPlayers: number;
  maxPlayers: number;
  playtime: PlaytimeKey;
  complexity: number;
}

function useEnrichedGames(): { games: EnrichedGame[]; isLoading: boolean } {
  const [games, setGames] = useState<EnrichedGame[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isActive = true;
    setIsLoading(true);

    loadCatalogGameDetails()
      .then((details) => {
        if (!isActive) return;
        setGames(details.map(mapDetailToEnriched));
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, []);

  return { games, isLoading };
}

function mapDetailToEnriched(detail: GameDetail): EnrichedGame {
  const [min, max] = parseRange(detail.players);

  return {
    id: detail.id,
    name: detail.name,
    altTitle: detail.altTitle,
    image: detail.image,
    genres: detail.genres,
    categories: detail.categories,
    mechanics: detail.mechanics,
    minPlayers: min,
    maxPlayers: max,
    playtime: playtimeBucket(detail.playTime),
    complexity: detail.complexity,
  };
}

function Toggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
        active
          ? "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40"
          : "bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white hover:border-neutral-700"
      }`}
    >
      {label}
    </button>
  );
}

export function Search() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { games, isLoading } = useEnrichedGames();

  const allCategories = useMemo(() => {
    const s = new Set<string>();
    games.forEach((g) => g.categories.forEach((c) => s.add(c)));
    return Array.from(s).sort();
  }, [games]);

  const allMechanics = useMemo(() => {
    const s = new Set<string>();
    games.forEach((g) => g.mechanics.forEach((m) => s.add(m)));
    return Array.from(s).sort();
  }, [games]);

  const [query, setQuery] = useState("");
  const [activeCategories, setActiveCategories] = useState<Set<string>>(new Set());
  const [activeMechanics, setActiveMechanics] = useState<Set<string>>(new Set());
  const [players, setPlayers] = useState<number | null>(null);
  const [playtimes, setPlaytimes] = useState<Set<PlaytimeKey>>(new Set());
  const [complexity, setComplexity] = useState<[number, number]>([1, 5]);
  const [semanticQuery, setSemanticQuery] = useState("");
  const [semanticGames, setSemanticGames] = useState<EnrichedGame[] | null>(null);
  const [isSemanticLoading, setIsSemanticLoading] = useState(false);

  const toggle = <T,>(set: Set<T>, value: T, setter: (s: Set<T>) => void) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value); else next.add(value);
    setter(next);
  };

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sourceGames = semanticGames ?? games;
    return sourceGames.filter((g) => {
      if (q.length > 0) {
        const haystack = [g.name, g.altTitle, ...g.categories, ...g.mechanics, ...g.genres].join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (activeCategories.size > 0) {
        const pool = new Set(g.categories);
        for (const c of activeCategories) if (!pool.has(c)) return false;
      }
      if (activeMechanics.size > 0) {
        const pool = new Set(g.mechanics);
        for (const m of activeMechanics) if (!pool.has(m)) return false;
      }
      if (players !== null) {
        if (players < g.minPlayers || players > g.maxPlayers) return false;
      }
      if (playtimes.size > 0 && !playtimes.has(g.playtime)) return false;
      if (
        (complexity[0] !== 1 || complexity[1] !== 5) &&
        (g.complexity < complexity[0] || g.complexity > complexity[1])
      ) {
        return false;
      }
      return true;
    });
  }, [games, semanticGames, query, activeCategories, activeMechanics, players, playtimes, complexity]);

  const activeFilterCount =
    (query.trim() ? 1 : 0) +
    (semanticQuery ? 1 : 0) +
    activeCategories.size +
    activeMechanics.size +
    (players !== null ? 1 : 0) +
    playtimes.size +
    (complexity[0] !== 1 || complexity[1] !== 5 ? 1 : 0);
  const isResultsLoading = isLoading || isSemanticLoading;

  const clearAll = () => {
    setQuery("");
    setActiveCategories(new Set());
    setActiveMechanics(new Set());
    setPlayers(null);
    setPlaytimes(new Set());
    setComplexity([1, 5]);
    setSemanticQuery("");
    setSemanticGames(null);
  };

  const handleTextQueryChange = (value: string) => {
    setQuery(value);
    if (semanticGames) {
      setSemanticQuery("");
      setSemanticGames(null);
    }
  };

  const handleLudoscopioSearch = useCallback(async (value: string) => {
    const prompt = value.trim();
    if (!prompt || isSemanticLoading) return;

    setIsSemanticLoading(true);
    try {
      const details = await loadSemanticCatalogGameDetails(prompt, 40);
      setSemanticGames(details.map(mapDetailToEnriched));
      setSemanticQuery(prompt);
      setQuery("");
      setActiveCategories(new Set());
      setActiveMechanics(new Set());
      setPlayers(null);
      setPlaytimes(new Set());
      setComplexity([1, 5]);
    } finally {
      setIsSemanticLoading(false);
    }
  }, [isSemanticLoading]);

  const shouldOpenLudoscopio = searchParams.get("ludoscopio") === "open";

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

  return (
    <div
      className="min-h-screen text-white"
      style={{
        background: "radial-gradient(ellipse 130% 38% at 50% -5%, rgba(217, 70, 239, 0.08) 0%, transparent 58%), rgb(10, 10, 10)",
      }}
    >
      {/* Header */}
      <div className="sticky top-0 z-40 bg-neutral-950/80 backdrop-blur-md border-b border-white/5 px-8 h-14 flex items-center gap-4">
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
          {isResultsLoading ? "· Cargando" : `· ${results.length} resultado${results.length !== 1 ? "s" : ""}`}
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

      <div className="max-w-6xl mx-auto px-8 py-8 grid gap-8 lg:grid-cols-[320px_1fr]">
        {/* Filters sidebar */}
        <aside className="space-y-6">
          {/* Search box */}
          <div>
            <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-2">Buscar</label>
            <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 focus-within:border-fuchsia-500/50 transition-colors">
              <SearchIcon className="w-4 h-4 text-neutral-500 flex-none" />
              <input
                type="text"
                value={query}
                onChange={(e) => handleTextQueryChange(e.target.value)}
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
                  onClick={() => setPlayers(players === n ? null : n)}
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
                  onClick={() => toggle(playtimes, opt.key, setPlaytimes)}
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
                    onClick={() => {
                      if (complexity[0] === n && complexity[1] === n) {
                        setComplexity([1, 5]);
                      } else if (n < complexity[0]) {
                        setComplexity([n, complexity[1]]);
                      } else if (n > complexity[1]) {
                        setComplexity([complexity[0], n]);
                      } else {
                        setComplexity([n, n]);
                      }
                    }}
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
            <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-2">
              Categorías
              {activeCategories.size > 0 && (
                <span className="ml-2 text-fuchsia-400 normal-case tracking-normal">{activeCategories.size} activas</span>
              )}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {allCategories.map((c) => (
                <Toggle
                  key={c}
                  label={t(c)}
                  active={activeCategories.has(c)}
                  onClick={() => toggle(activeCategories, c, setActiveCategories)}
                />
              ))}
            </div>
          </div>

          {/* Mechanics */}
          <div>
            <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-2">
              Mecánicas
              {activeMechanics.size > 0 && (
                <span className="ml-2 text-fuchsia-400 normal-case tracking-normal">{activeMechanics.size} activas</span>
              )}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {allMechanics.map((m) => (
                <Toggle
                  key={m}
                  label={t(m)}
                  active={activeMechanics.has(m)}
                  onClick={() => toggle(activeMechanics, m, setActiveMechanics)}
                />
              ))}
            </div>
          </div>
        </aside>

        {/* Results */}
        <section>
          {semanticQuery && (
            <div className="mb-5 rounded-lg border border-fuchsia-500/20 bg-neutral-950 px-4 py-3">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-0.5 h-4 w-4 flex-none text-fuchsia-300" />
                <div>
                  <p className="text-xs uppercase tracking-wider text-neutral-500">Ludoscopio</p>
                  <p className="mt-1 text-sm text-neutral-200">Resultados para “{semanticQuery}”</p>
                </div>
              </div>
            </div>
          )}
          {isResultsLoading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3 border border-dashed border-neutral-800 rounded-xl">
              <Dices className="w-10 h-10 text-neutral-700" />
              <p className="text-neutral-500 text-sm">{isSemanticLoading ? "Consultando Ludoscopio..." : "Cargando catálogo..."}</p>
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
            <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}>
              {results.map((game) => (
                <Link key={game.id} to={`/game/${game.id}`} className="group flex flex-col">
                  <div className="relative rounded-md overflow-hidden mb-1.5" style={{ aspectRatio: "1" }}>
                    <ImageWithFallback
                      src={game.image}
                      alt={game.name}
                      className="w-full h-full object-contain"
                    />
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
          )}
        </section>
      </div>
    </div>
  );
}
