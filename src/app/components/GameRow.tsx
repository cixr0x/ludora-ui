import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Game } from "../data/games";
import {
  areBufferedImagesSettled,
  getBufferedRowImageIds,
  preloadImageRow,
} from "../utils/imageBatch.js";

export type { Game };

interface GameRowProps {
  title: string;
  games: Game[];
}

const CARD_SIZE = 168;
const CARD_GAP = 16;
const HORIZONTAL_PRELOAD_PX = 720;
const ROW_VERTICAL_PRELOAD_PX = 520;
const ROW_PRELOAD_ROOT_MARGIN = `0px 0px ${ROW_VERTICAL_PRELOAD_PX}px 0px`;

interface RowItem {
  game: Game;
  id: string;
  left: number;
  right: number;
  src: string;
}

interface RowCoverImageProps {
  game: Game;
  imageId: string;
  onSettled: (id: string) => void;
}

function areIdListsEqual(left: string[], right: string[]) {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

function RowCoverImage({ game, imageId, onSettled }: RowCoverImageProps) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [didError, setDidError] = useState(false);

  const markSettled = useCallback(() => {
    onSettled(imageId);
  }, [imageId, onSettled]);

  const settleAfterDecode = useCallback(() => {
    const image = imageRef.current;

    if (!image || typeof image.decode !== "function") {
      markSettled();
      return;
    }

    image.decode().then(markSettled, markSettled);
  }, [markSettled]);

  const handleLoad = useCallback(() => {
    settleAfterDecode();
  }, [settleAfterDecode]);

  const handleError = useCallback(() => {
    setDidError(true);
    markSettled();
  }, [markSettled]);

  useEffect(() => {
    setDidError(false);
  }, [game.image]);

  useEffect(() => {
    const image = imageRef.current;
    if (!image || !image.complete || didError) return;

    if (image.naturalWidth === 0) {
      setDidError(true);
      markSettled();
      return;
    }

    settleAfterDecode();
  }, [didError, game.image, markSettled, settleAfterDecode]);

  if (didError) {
    return (
      <div
        className="w-full h-full object-contain"
        aria-label="Image failed to load"
        data-original-url={game.image}
        data-row-cover-settled="error"
      />
    );
  }

  return (
    <img
      ref={imageRef}
      src={game.image}
      alt={game.name}
      className="w-full h-full object-contain"
      decoding="async"
      loading="eager"
      onLoad={handleLoad}
      onError={handleError}
      data-row-cover-settled="pending"
    />
  );
}

function GameRowSkeleton({ rowItems, overlay = false }: { rowItems: RowItem[]; overlay?: boolean }) {
  return (
    <div
      className={`flex gap-4 ${overlay ? "absolute inset-x-0 top-0 pointer-events-none" : ""}`}
      data-row-image-status="loading"
    >
      {rowItems.map(({ game }) => (
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
  );
}

export function GameRow({ title, games }: GameRowProps) {
  const rowContainerRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const loadingImageIdsRef = useRef<Set<string>>(new Set());
  const preloadedImageIdsRef = useRef<Set<string>>(new Set());
  const settledImageIdsRef = useRef<Set<string>>(new Set());
  const bufferedImageIdsRef = useRef<string[]>([]);
  const preloadGenerationRef = useRef(0);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [shouldLoadRow, setShouldLoadRow] = useState(false);
  const [isRowReady, setIsRowReady] = useState(false);
  const [isRowVisible, setIsRowVisible] = useState(false);
  const [preloadedImageIds, setPreloadedImageIds] = useState<Set<string>>(() => new Set());
  const [settledImageIds, setSettledImageIds] = useState<Set<string>>(() => new Set());
  const [bufferedImageIds, setBufferedImageIds] = useState<string[]>([]);
  const rowItems = useMemo(
    () =>
      games.map((game, index) => {
        const left = index * (CARD_SIZE + CARD_GAP);
        return {
          game,
          id: String(game.id),
          left,
          right: left + CARD_SIZE,
          src: game.image,
        };
      }),
    [games],
  );
  const rowImageSignature = rowItems.map((item) => `${item.id}:${item.src}`).join("\n");

  useEffect(() => {
    preloadedImageIdsRef.current = preloadedImageIds;
  }, [preloadedImageIds]);

  useEffect(() => {
    settledImageIdsRef.current = settledImageIds;
  }, [settledImageIds]);

  useEffect(() => {
    preloadGenerationRef.current += 1;
    loadingImageIdsRef.current.clear();
    preloadedImageIdsRef.current = new Set();
    settledImageIdsRef.current = new Set();
    bufferedImageIdsRef.current = [];
    setPreloadedImageIds(new Set());
    setSettledImageIds(new Set());
    setBufferedImageIds([]);
    setShouldLoadRow(false);
    setIsRowReady(false);
    setIsRowVisible(false);
  }, [rowImageSignature]);

  const updateBufferedImageIds = useCallback((ids: string[]) => {
    if (areIdListsEqual(bufferedImageIdsRef.current, ids)) return;

    bufferedImageIdsRef.current = ids;
    setBufferedImageIds(ids);
  }, []);

  const markImageSettled = useCallback((id: string) => {
    if (settledImageIdsRef.current.has(id)) return;

    setSettledImageIds((previous) => {
      if (previous.has(id)) return previous;

      const next = new Set(previous);
      next.add(id);
      settledImageIdsRef.current = next;
      return next;
    });
  }, []);

  const preloadCurrentWindow = useCallback(() => {
    if (!shouldLoadRow) return;

    const el = rowRef.current;
    if (!el || rowItems.length === 0) {
      updateBufferedImageIds([]);
      setIsRowReady(true);
      return;
    }

    const bufferedIds = getBufferedRowImageIds(
      rowItems,
      el.scrollLeft,
      el.clientWidth,
      HORIZONTAL_PRELOAD_PX,
    );
    updateBufferedImageIds(bufferedIds);
    const bufferedIdSet = new Set(bufferedIds);
    const windowItems = rowItems.filter((item) => bufferedIdSet.has(item.id));
    const missingItems = windowItems.filter(
      (item) => !preloadedImageIdsRef.current.has(item.id) && !loadingImageIdsRef.current.has(item.id),
    );

    if (missingItems.length === 0) {
      if (bufferedIds.length === 0 || bufferedIds.every((id) => preloadedImageIdsRef.current.has(id))) {
        setIsRowReady(true);
      }
      return;
    }

    const generation = preloadGenerationRef.current;
    for (const item of missingItems) {
      loadingImageIdsRef.current.add(item.id);
    }

    preloadImageRow(missingItems.map((item) => item.src)).then(() => {
      if (generation !== preloadGenerationRef.current) return;

      for (const item of missingItems) {
        loadingImageIdsRef.current.delete(item.id);
      }

      setPreloadedImageIds((previous) => {
        const next = new Set(previous);
        for (const item of missingItems) {
          next.add(item.id);
        }
        preloadedImageIdsRef.current = next;
        return next;
      });
      setIsRowReady(true);
    });
  }, [rowItems, shouldLoadRow, updateBufferedImageIds]);

  const updateScrollState = useCallback(() => {
    const el = rowRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
    preloadCurrentWindow();
  }, [preloadCurrentWindow]);

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateScrollState, { passive: true });
    updateScrollState();
    return () => el.removeEventListener("scroll", updateScrollState);
  }, [updateScrollState]);

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
    preloadCurrentWindow();
  }, [preloadCurrentWindow]);

  useEffect(() => {
    if (!isRowReady || isRowVisible) return;
    if (!areBufferedImagesSettled(bufferedImageIds, preloadedImageIds, settledImageIds)) return;

    const frame = requestAnimationFrame(() => setIsRowVisible(true));
    return () => cancelAnimationFrame(frame);
  }, [bufferedImageIds, isRowReady, isRowVisible, preloadedImageIds, settledImageIds]);

  const scroll = (dir: "left" | "right") => {
    rowRef.current?.scrollBy({
      left: dir === "left" ? -HORIZONTAL_PRELOAD_PX : HORIZONTAL_PRELOAD_PX,
      behavior: "smooth",
    });
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
          <div className="relative" style={{ width: "max-content", minWidth: "100%" }}>
            {isRowReady && (
              <div
                className={`game-row-content flex gap-4 ${isRowVisible ? "game-row-content--visible" : ""}`}
                data-row-image-status={isRowVisible ? "visible" : "hidden"}
                data-row-preloaded-count={preloadedImageIds.size}
                data-row-buffered-count={bufferedImageIds.length}
                data-row-dom-settled-count={settledImageIds.size}
              >
                {rowItems.map(({ game, id }) => {
                  const isImageReady = preloadedImageIds.has(id);

                  return isImageReady ? (
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
                        <RowCoverImage game={game} imageId={id} onSettled={markImageSettled} />
                        <div className="absolute inset-0 bg-black/0 group-hover/card:bg-black/20 transition-colors duration-300" />
                      </div>
                      <p className="text-gray-300 text-sm text-center group-hover/card:text-white transition-colors truncate px-1 leading-snug">
                        {game.name}
                      </p>
                      {game.altTitle && (
                        <p className="text-neutral-500 text-xs text-center mt-0.5 truncate px-1">{game.altTitle}</p>
                      )}
                    </Link>
                  ) : (
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
                  );
                })}
              </div>
            )}
            {!isRowVisible && <GameRowSkeleton rowItems={rowItems} overlay={isRowReady} />}
          </div>
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
