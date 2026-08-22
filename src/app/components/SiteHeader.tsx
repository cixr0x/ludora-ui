import { type FormEvent, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Compass, Search, X } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { loadCatalogFilterOptions, loadCatalogSearchResults } from "../data/catalog";
import type { Game } from "../data/games";
import { t } from "../data/translations";
import { buildExploreSearchPath, buildExploreTaxonomyPath } from "../utils/catalogSearch.js";
import { HOME_SEARCH_DEBOUNCE_MS, HOME_SEARCH_LIMIT, homeSearchQuery } from "../utils/homeSearch.js";
import { productPath } from "../utils/productRoutes.js";

interface CategoryStripItem {
  key: string;
  label: string;
  to: string;
}

interface SiteHeaderProps {
  contextBar?: ReactNode;
}

export function SiteHeader({ contextBar }: SiteHeaderProps) {
  const [searchValue, setSearchValue] = useState("");
  const [searchResults, setSearchResults] = useState<Game[]>([]);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [categoryStripItems, setCategoryStripItems] = useState<CategoryStripItem[]>([]);
  const genreScrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const activeSearchQuery = homeSearchQuery(searchValue);
  const shouldLoadCategoryStrip = contextBar === undefined;

  const clearSearch = useCallback(() => {
    setSearchValue("");
  }, []);

  const handleResultClick = (id: number, name: string) => {
    clearSearch();
    navigate(productPath(id, name));
  };

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const destination = buildExploreSearchPath(searchValue);
    if (destination === "/search") return;

    clearSearch();
    navigate(destination);
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") clearSearch();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [clearSearch]);

  useEffect(() => {
    if (!shouldLoadCategoryStrip) return undefined;

    let isActive = true;

    loadCatalogFilterOptions()
      .then((options) => {
        if (!isActive) return;
        const items = options.categories.map((category) => {
          const to = buildExploreTaxonomyPath("category", category.id);
          return {
            key: `category:${category.id}`,
            label: category.name,
            to,
          };
        });
        setCategoryStripItems(items.filter((item) => item.to !== "/search"));
      })
      .catch(() => {
        if (isActive) setCategoryStripItems([]);
      });

    return () => {
      isActive = false;
    };
  }, [shouldLoadCategoryStrip]);

  useEffect(() => {
    if (!activeSearchQuery) {
      setSearchResults([]);
      setIsSearchLoading(false);
      return undefined;
    }

    let isActive = true;
    setIsSearchLoading(true);

    const timeoutId = window.setTimeout(() => {
      loadCatalogSearchResults({ query: activeSearchQuery, limit: HOME_SEARCH_LIMIT })
        .then((results) => {
          if (isActive) setSearchResults(results);
        })
        .catch(() => {
          if (isActive) setSearchResults([]);
        })
        .finally(() => {
          if (isActive) setIsSearchLoading(false);
        });
    }, HOME_SEARCH_DEBOUNCE_MS);

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
    };
  }, [activeSearchQuery]);

  const scrollGenre = (dir: "left" | "right") => {
    const el = genreScrollRef.current;
    if (!el) return;
    const atStart = el.scrollLeft <= 4;
    const atEnd = el.scrollLeft >= el.scrollWidth - el.clientWidth - 4;
    if (dir === "left" && atStart) {
      el.scrollTo({ left: el.scrollWidth, behavior: "smooth" });
    } else if (dir === "right" && atEnd) {
      el.scrollTo({ left: 0, behavior: "smooth" });
    } else {
      el.scrollBy({ left: dir === "left" ? -240 : 240, behavior: "smooth" });
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-neutral-950/85 backdrop-blur-md border-b border-white/5">
      <div className="flex flex-col gap-2 px-3 py-3 md:h-16 md:flex-row md:items-center md:justify-between md:gap-4 md:px-8 md:py-0">
        <div className="flex w-full flex-none items-center md:w-auto">
          <Link
            to="/"
            className="ludora-wordmark text-xl inline-flex items-center gap-2 rounded-sm transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-300 sm:text-2xl"
          >
            <span>
              <span className="ludora-wordmark-accent">L</span>udo{" "}
              <span className="ludora-wordmark-accent">R</span>adar
            </span>
            <img
              src="/ludoradar-icon.webp"
              alt=""
              aria-hidden="true"
              className="h-7 w-7 flex-none object-contain sm:h-8 sm:w-8"
            />
          </Link>
        </div>

        <div className="flex w-full min-w-0 items-center gap-2 sm:gap-3 md:w-auto">
          <div className="relative min-w-0 flex-1 md:flex-none">
            <form
              onSubmit={handleSearchSubmit}
              className="flex w-full items-center gap-2 rounded-full border border-neutral-600 bg-neutral-800 px-3 py-2 transition-colors focus-within:border-neutral-400 sm:px-4 md:w-auto"
            >
              <Search className="w-4 h-4 flex-none text-neutral-400" />
              <input
                type="text"
                placeholder="Buscar juegos..."
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-neutral-500 outline-none md:w-64 md:flex-none lg:w-72"
              />
              {searchValue && (
                <button
                  type="button"
                  aria-label="Limpiar busqueda"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    clearSearch();
                  }}
                  className="flex-none text-neutral-500 hover:text-neutral-300 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </form>

            {activeSearchQuery && (
              <div className="absolute right-0 top-full mt-2 w-full min-w-72 bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl overflow-hidden z-50">
                {isSearchLoading ? (
                  <div className="px-4 py-6 text-center text-neutral-500 text-sm">
                    Buscando...
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="px-4 py-6 text-center text-neutral-500 text-sm">
                    No se encontraron juegos para "{searchValue}"
                  </div>
                ) : (
                  <>
                    <div className="px-3 py-2 border-b border-neutral-800">
                      <p className="text-neutral-500 text-xs uppercase tracking-wider">
                        {searchResults.length} resultado{searchResults.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    {searchResults.map((game) => (
                      <button
                        key={game.id}
                        onMouseDown={() => handleResultClick(game.id, game.name)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-neutral-800 transition-colors text-left"
                      >
                        <div className="flex-none w-9 h-9 rounded-[4px] overflow-hidden flex items-center justify-center">
                          <ImageWithFallback
                            src={game.image}
                            alt={game.name}
                            className="h-full w-auto max-w-full max-h-full rounded-[4px] object-contain"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm truncate">{game.name}</p>
                          {game.altTitle && (
                            <p className="text-neutral-500 text-xs truncate">{game.altTitle}</p>
                          )}
                        </div>
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
          <Link
            to="/search"
            aria-label="Explorar catálogo"
            className="flex-none inline-flex h-9 items-center justify-center gap-2 rounded-md bg-fuchsia-500 px-3 text-sm font-medium text-white transition-colors hover:bg-fuchsia-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-300 sm:px-4 disabled:pointer-events-none disabled:opacity-60"
          >
            <Compass className="h-4 w-4" />
            <span className="hidden sm:inline">Explorar</span>
          </Link>
        </div>
      </div>

      {contextBar ?? (
        <div className="flex items-center gap-0.5 border-b border-white/5 px-2 pb-2 md:gap-1 md:px-6 md:pb-3">
          <button
            onClick={() => scrollGenre("left")}
            aria-label="Desplazar a la izquierda"
            className="flex-none p-1 text-neutral-500 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div
            ref={genreScrollRef}
            className="flex min-w-0 flex-1 items-center gap-4 overflow-x-auto md:gap-7"
            style={{ scrollbarWidth: "none" }}
          >
            {categoryStripItems.map((item) => (
              <Link
                key={item.key}
                to={item.to}
                className="flex-none text-sm whitespace-nowrap text-neutral-400 hover:text-white transition-colors"
              >
                {t(item.label)}
              </Link>
            ))}
          </div>
          <button
            onClick={() => scrollGenre("right")}
            aria-label="Desplazar a la derecha"
            className="flex-none p-1 text-neutral-500 hover:text-white transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </header>
  );
}
