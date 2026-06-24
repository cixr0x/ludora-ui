import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import type { Game } from "../data/games";
import { preloadImageRow } from "../utils/imageBatch.js";

export type { Game };

interface GameRowProps {
  title: string;
  games: Game[];
}

const CARD_SIZE = 168;
const ROW_PRELOAD_ROOT_MARGIN = "220px 0px";

export function GameRow({ title, games }: GameRowProps) {
  const rowContainerRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [shouldLoadRow, setShouldLoadRow] = useState(false);
  const [isRowReady, setIsRowReady] = useState(false);
  const [isRowVisible, setIsRowVisible] = useState(false);
  const rowImageSources = useMemo(() => games.map((game) => game.image).filter(Boolean), [games]);
  const rowImageSignature = rowImageSources.join("\n");

  const updateScrollState = () => {
    const el = rowRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  };

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateScrollState, { passive: true });
    updateScrollState();
    return () => el.removeEventListener("scroll", updateScrollState);
  }, []);

  useEffect(() => {
    setShouldLoadRow(false);
    setIsRowReady(false);
    setIsRowVisible(false);
  }, [rowImageSignature]);

  useEffect(() => {
    if (shouldLoadRow) return;

    const node = rowContainerRef.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setShouldLoadRow(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldLoadRow(true);
          observer.disconnect();
        }
      },
      {
        root: null,
        rootMargin: ROW_PRELOAD_ROOT_MARGIN,
        threshold: 0.01,
      },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [rowImageSignature, shouldLoadRow]);

  useEffect(() => {
    if (!shouldLoadRow) return;

    let isActive = true;
    setIsRowReady(false);
    setIsRowVisible(false);

    preloadImageRow(rowImageSources).then(() => {
      if (isActive) setIsRowReady(true);
    });

    return () => {
      isActive = false;
    };
  }, [rowImageSignature, rowImageSources, shouldLoadRow]);

  useEffect(() => {
    if (!isRowReady) return;

    const frame = requestAnimationFrame(() => setIsRowVisible(true));
    return () => cancelAnimationFrame(frame);
  }, [isRowReady]);

  const scroll = (dir: "left" | "right") => {
    rowRef.current?.scrollBy({ left: dir === "left" ? -720 : 720, behavior: "smooth" });
  };

  return (
    <div ref={rowContainerRef} className="mb-5">
      <h2 className="px-14 mb-1.5 text-white tracking-wide">{title}</h2>

      <div className="relative group/row">
        {/* Left arrow */}
        {canScrollLeft && (
          <button
            onClick={() => scroll("left")}
            aria-label="Scroll left"
            className="absolute left-0 top-0 bottom-1 z-20 w-14 flex items-center justify-center bg-gradient-to-r from-neutral-950/95 to-transparent opacity-0 group-hover/row:opacity-100 transition-opacity duration-200"
          >
            <ChevronLeft className="w-9 h-9 text-white drop-shadow-lg" strokeWidth={2.5} />
          </button>
        )}

        {/* Scrollable row */}
        <div
          ref={rowRef}
          className="overflow-x-auto px-14 pb-1"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          onScroll={updateScrollState}
        >
          {isRowReady ? (
            <div
              className={`game-row-content flex gap-4 ${isRowVisible ? "game-row-content--visible" : ""}`}
              data-row-image-status={isRowVisible ? "visible" : "hidden"}
            >
              {games.map((game) => (
                <Link
                  key={game.id}
                  to={`/game/${game.id}`}
                  className="flex-none group/card"
                  style={{ width: CARD_SIZE }}
                >
                  <div
                    className="relative rounded-md overflow-hidden mb-1.5"
                    style={{ width: CARD_SIZE, height: CARD_SIZE }}
                  >
                    <ImageWithFallback
                      src={game.image}
                      alt={game.name}
                      className="w-full h-full object-contain"
                      decoding="async"
                      loading="eager"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover/card:bg-black/20 transition-colors duration-300" />
                  </div>
                  <p className="text-gray-300 text-sm text-center group-hover/card:text-white transition-colors truncate px-1 leading-snug">
                    {game.name}
                  </p>
                  {game.altTitle && (
                    <p className="text-neutral-500 text-xs text-center mt-0.5 truncate px-1">{game.altTitle}</p>
                  )}
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex gap-4" data-row-image-status="loading">
              {games.map((game) => (
                <div
                  key={game.id}
                  className="flex-none"
                  style={{ width: CARD_SIZE }}
                  aria-label={game.name}
                  data-row-image-placeholder="true"
                >
                  <div
                    className="game-cover-placeholder rounded-md mb-1.5 animate-pulse"
                    style={{ width: CARD_SIZE, height: CARD_SIZE }}
                    data-original-url={game.image}
                  />
                  <div className="mx-auto h-4 w-28 rounded bg-neutral-800/80 animate-pulse" />
                  {game.altTitle && (
                    <div className="mx-auto mt-1 h-3 w-20 rounded bg-neutral-900 animate-pulse" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right arrow */}
        {canScrollRight && (
          <button
            onClick={() => scroll("right")}
            aria-label="Scroll right"
            className="absolute right-0 top-0 bottom-1 z-20 w-14 flex items-center justify-center bg-gradient-to-l from-neutral-950/95 to-transparent opacity-0 group-hover/row:opacity-100 transition-opacity duration-200"
          >
            <ChevronRight className="w-9 h-9 text-white drop-shadow-lg" strokeWidth={2.5} />
          </button>
        )}
      </div>
    </div>
  );
}
