import { useRef, useState, useEffect } from "react";
import { Link } from "react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import type { Game } from "../data/games";

export type { Game };

interface GameRowProps {
  title: string;
  games: Game[];
}

const CARD_SIZE = 168;

export function GameRow({ title, games }: GameRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

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

  const scroll = (dir: "left" | "right") => {
    rowRef.current?.scrollBy({ left: dir === "left" ? -720 : 720, behavior: "smooth" });
  };

  return (
    <div className="mb-5">
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
          className="flex gap-4 overflow-x-auto px-14 pb-1"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          onScroll={updateScrollState}
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
