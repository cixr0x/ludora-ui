import { useState, useRef, useEffect, useCallback } from "react";
import { Search, Bell, User, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate, Link } from "react-router";
import { GameRow } from "../components/GameRow";
import { LudoscopioCallout } from "../components/LudoscopioCallout";
import { loadCatalogFilterOptions, loadCatalogGameSummaries, loadFrontPageRows, type CatalogRow } from "../data/catalog";
import type { Game } from "../data/games";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { t } from "../data/translations";
import { buildExploreTaxonomyPath } from "../utils/catalogSearch.js";
import { HOME_SEARCH_DEBOUNCE_MS, HOME_SEARCH_LIMIT, homeSearchQuery } from "../utils/homeSearch.js";

interface CategoryStripItem {
  key: string;
  label: string;
  to: string;
}

export function Home() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [searchResults, setSearchResults] = useState<Game[]>([]);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [rows, setRows] = useState<CatalogRow[]>([]);
  const [categoryStripItems, setCategoryStripItems] = useState<CategoryStripItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const genreScrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const activeSearchQuery = homeSearchQuery(searchValue);

  const openSearch = () => {
    setSearchOpen(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchValue("");
  };

  const handleSearchBlur = useCallback(() => {
    setTimeout(() => setSearchOpen(false), 150);
  }, []);

  const handleResultClick = (id: number) => {
    closeSearch();
    navigate(`/game/${id}`);
  };

  const handleLudoscopioOpen = useCallback(() => {
    navigate("/search?ludoscopio=open");
  }, [navigate]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSearch();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    let isActive = true;
    setIsLoading(true);

    loadFrontPageRows()
      .then((nextRows) => {
        if (!isActive) return;
        setRows(nextRows);
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    if (!searchOpen || !activeSearchQuery) {
      setSearchResults([]);
      setIsSearchLoading(false);
      return undefined;
    }

    let isActive = true;
    setIsSearchLoading(true);

    const timeoutId = window.setTimeout(() => {
      loadCatalogGameSummaries({ query: activeSearchQuery, limit: HOME_SEARCH_LIMIT })
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
  }, [activeSearchQuery, searchOpen]);

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
    <div
      className="min-h-screen text-white"
      style={{
        background: "radial-gradient(ellipse 130% 38% at 50% -5%, rgba(217, 70, 239, 0.08) 0%, transparent 58%), rgb(10, 10, 10)",
      }}
    >
      {/* Navbar */}
      <header className="sticky top-0 z-50 bg-neutral-950/85 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center justify-between px-8 h-16">
          {/* Brand */}
          <div className="flex items-center">
            <span className="ludora-wordmark">
              Ludora
            </span>
          </div>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-7">
            <Link to="/search" className="text-sm text-neutral-400 hover:text-white transition-colors">Explorar</Link>
            {["Novedades", "Mejor Valorados", "Colecciones"].map((link) => (
              <button key={link} className="text-sm text-neutral-400 hover:text-white transition-colors">
                {link}
              </button>
            ))}
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <div
                className={`flex items-center gap-2 rounded-full border transition-all duration-200 ${
                  searchOpen
                    ? "bg-neutral-800 border-neutral-600 px-3 py-1.5"
                    : "border-transparent px-2 py-1.5"
                }`}
              >
                <button onClick={searchOpen ? undefined : openSearch} className="flex-none">
                  <Search className="w-4 h-4 text-neutral-400" />
                </button>
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Buscar juegos…"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  onBlur={handleSearchBlur}
                  className={`bg-transparent text-sm text-white placeholder:text-neutral-500 outline-none transition-all duration-200 ${
                    searchOpen ? "w-44" : "w-0 opacity-0 pointer-events-none"
                  }`}
                />
                {searchOpen && (
                  <button
                    onMouseDown={(e) => { e.preventDefault(); closeSearch(); }}
                    className="flex-none text-neutral-500 hover:text-neutral-300 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {searchOpen && activeSearchQuery && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl overflow-hidden z-50">
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
                          onMouseDown={() => handleResultClick(game.id)}
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

            <button className="relative p-2 rounded-full hover:bg-white/10 transition-colors">
              <Bell className="w-4 h-4 text-neutral-400" />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-fuchsia-400 rounded-full" />
            </button>
            <button className="flex items-center justify-center w-8 h-8 rounded-full bg-fuchsia-500/20 text-fuchsia-400 hover:bg-fuchsia-500/30 transition-colors">
              <User className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Genre stripe */}
        <div className="flex items-center px-6 pb-3 gap-1 border-b border-white/5">
          <button
            onClick={() => scrollGenre("left")}
            aria-label="Scroll left"
            className="flex-none p-1 text-neutral-500 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div
            ref={genreScrollRef}
            className="flex items-center gap-7 overflow-x-auto min-w-0 flex-1"
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
            aria-label="Scroll right"
            className="flex-none p-1 text-neutral-500 hover:text-white transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="pt-8 pb-16">
        <div className="px-14 mb-7">
          <LudoscopioCallout
            buttonClassName="xl:mt-0 xl:flex-none"
            className="xl:flex xl:items-center xl:justify-between xl:gap-5"
            messageClassName="xl:whitespace-nowrap"
            onTrigger={handleLudoscopioOpen}
          />
        </div>
        {isLoading ? (
          <div className="px-14 py-16 text-neutral-500 text-sm">Cargando catálogo...</div>
        ) : rows.length > 0 ? (
          rows.map((row) => (
            <GameRow key={row.title} title={row.title} games={row.games} />
          ))
        ) : (
          <div className="px-14 py-16 text-neutral-500 text-sm">No pudimos cargar el catálogo.</div>
        )}
      </main>
    </div>
  );
}
