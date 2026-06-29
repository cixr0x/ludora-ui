import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { Link } from "react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Game } from "../data/games";
import {
  getBufferedRowImageIds,
  getPendingVisibleImageIds,
  getUnloadedBufferedImageIds,
  getVisibleRowImageIds,
} from "../utils/imageBatch.js";

export type { Game };

interface GameRowProps {
  title: string;
  games: Game[];
}

const CARD_SIZE = 168;
const CARD_GAP = 16;
const ROW_BODY_MIN_HEIGHT = CARD_SIZE + 42;
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

function RowCoverPlaceholder({ game, overlay = false }: { game: Game; overlay?: boolean }) {
  return (
    <div
      className={`game-cover-placeholder rounded-md animate-pulse ${overlay ? "absolute inset-0" : "mb-1.5"}`}
      style={overlay ? undefined : { width: CARD_SIZE, height: CARD_SIZE }}
      data-original-url={game.image}
      data-row-image-placeholder="true"
    />
  );
}

function RowPendingImageCard({ game }: { game: Game }) {
  return (
    <div
      className="flex-none"
      style={{ width: CARD_SIZE }}
      aria-label={game.name}
      data-row-image-placeholder-card="true"
    >
      <RowCoverPlaceholder game={game} />
      <p className="text-gray-300 text-sm text-center truncate px-1 leading-snug">{game.name}</p>
      {game.altTitle && <p className="text-neutral-500 text-xs text-center mt-0.5 truncate px-1">{game.altTitle}</p>}
    </div>
  );
}

function RowCardSpacer({ game }: { game: Game }) {
  return (
    <div
      className="flex-none"
      style={{ width: CARD_SIZE }}
      aria-label={game.name}
      data-row-image-spacer="true"
    />
  );
}

function RowLoadedImageCard({
  game,
  imageId,
  onSettled,
  showPlaceholder,
}: {
  game: Game;
  imageId: string;
  onSettled: (id: string) => void;
  showPlaceholder: boolean;
}) {
  return (
    <Link
      to={`/game/${game.id}`}
      className="flex-none group/card"
      style={{ width: CARD_SIZE }}
    >
      <div
        className="relative rounded-md overflow-hidden mb-1.5"
        style={{ width: CARD_SIZE, height: CARD_SIZE }}
      >
        <RowCoverImage game={game} imageId={imageId} onSettled={onSettled} />
        {showPlaceholder && <RowCoverPlaceholder game={game} overlay />}
        <div className="absolute inset-0 bg-black/0 group-hover/card:bg-black/20 transition-colors duration-300" />
      </div>
      <p className="text-gray-300 text-sm text-center group-hover/card:text-white transition-colors truncate px-1 leading-snug">
        {game.name}
      </p>
      {game.altTitle && (
        <p className="text-neutral-500 text-xs text-center mt-0.5 truncate px-1">{game.altTitle}</p>
      )}
    </Link>
  );
}

function addIds(previous: Set<string>, ids: string[]) {
  let hasChanges = false;
  const next = new Set(previous);

  for (const id of ids) {
    if (next.has(id)) continue;
    next.add(id);
    hasChanges = true;
  }

  return hasChanges ? next : previous;
}

function setBooleanState(setState: Dispatch<SetStateAction<boolean>>, value: boolean) {
  setState((previous) => (previous === value ? previous : value));
}

export function GameRow({ title, games }: GameRowProps) {
  const rowContainerRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const mountedImageIdsRef = useRef<Set<string>>(new Set());
  const settledImageIdsRef = useRef<Set<string>>(new Set());
  const bufferedImageIdsRef = useRef<string[]>([]);
  const visibleImageIdsRef = useRef<string[]>([]);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [shouldLoadRow, setShouldLoadRow] = useState(false);
  const [isRowReady, setIsRowReady] = useState(false);
  const [isRowVisible, setIsRowVisible] = useState(false);
  const [mountedImageIds, setMountedImageIds] = useState<Set<string>>(() => new Set());
  const [settledImageIds, setSettledImageIds] = useState<Set<string>>(() => new Set());
  const [bufferedImageIds, setBufferedImageIds] = useState<string[]>([]);
  const [visibleImageIds, setVisibleImageIds] = useState<string[]>([]);
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
  const pendingVisibleImageIds = useMemo(
    () => getPendingVisibleImageIds(visibleImageIds, settledImageIds),
    [settledImageIds, visibleImageIds],
  );
  const pendingVisibleImageIdSet = useMemo(
    () => new Set(pendingVisibleImageIds),
    [pendingVisibleImageIds],
  );

  useEffect(() => {
    mountedImageIdsRef.current = mountedImageIds;
  }, [mountedImageIds]);

  useEffect(() => {
    settledImageIdsRef.current = settledImageIds;
  }, [settledImageIds]);

  useEffect(() => {
    mountedImageIdsRef.current = new Set();
    settledImageIdsRef.current = new Set();
    bufferedImageIdsRef.current = [];
    visibleImageIdsRef.current = [];
    setMountedImageIds(new Set());
    setSettledImageIds(new Set());
    setBufferedImageIds([]);
    setVisibleImageIds([]);
    setShouldLoadRow(false);
    setIsRowReady(false);
    setIsRowVisible(false);
  }, [rowImageSignature]);

  const updateBufferedImageIds = useCallback((ids: string[]) => {
    if (areIdListsEqual(bufferedImageIdsRef.current, ids)) return;

    bufferedImageIdsRef.current = ids;
    setBufferedImageIds(ids);
  }, []);

  const updateVisibleImageIds = useCallback((ids: string[]) => {
    if (areIdListsEqual(visibleImageIdsRef.current, ids)) return;

    visibleImageIdsRef.current = ids;
    setVisibleImageIds(ids);
  }, []);

  const markImageSettled = useCallback((id: string) => {
    if (settledImageIdsRef.current.has(id)) return;

    setSettledImageIds((previous) => {
      if (previous.has(id)) return previous;

      const next = addIds(previous, [id]);
      settledImageIdsRef.current = next;
      return next;
    });
  }, []);

  const loadCurrentWindow = useCallback(() => {
    if (!shouldLoadRow) {
      updateBufferedImageIds([]);
      updateVisibleImageIds([]);
      return;
    }

    const el = rowRef.current;
    if (!el || rowItems.length === 0) {
      updateBufferedImageIds([]);
      updateVisibleImageIds([]);
      setIsRowReady(true);
      return;
    }

    const visibleIds = getVisibleRowImageIds(rowItems, el.scrollLeft, el.clientWidth);
    const bufferedIds = getBufferedRowImageIds(
      rowItems,
      el.scrollLeft,
      el.clientWidth,
      HORIZONTAL_PRELOAD_PX,
    );
    updateVisibleImageIds(visibleIds);
    updateBufferedImageIds(bufferedIds);

    const unloadedIds = getUnloadedBufferedImageIds(bufferedIds, mountedImageIdsRef.current);

    if (unloadedIds.length === 0) {
      setBooleanState(setIsRowReady, true);
      return;
    }

    setMountedImageIds((previous) => {
      const next = addIds(previous, unloadedIds);
      mountedImageIdsRef.current = next;
      return next;
    });
    setBooleanState(setIsRowReady, true);
  }, [rowItems, shouldLoadRow, updateBufferedImageIds, updateVisibleImageIds]);

  const updateScrollState = useCallback(() => {
    const el = rowRef.current;
    if (!el) return;
    setBooleanState(setCanScrollLeft, el.scrollLeft > 4);
    setBooleanState(setCanScrollRight, el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
    loadCurrentWindow();
  }, [loadCurrentWindow]);

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
    loadCurrentWindow();
  }, [loadCurrentWindow]);

  useEffect(() => {
    if (!isRowReady || isRowVisible) return;

    const frame = requestAnimationFrame(() => setIsRowVisible(true));
    return () => cancelAnimationFrame(frame);
  }, [isRowReady, isRowVisible]);

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
        {isRowReady && canScrollLeft && (
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
        >
          <div
            className="relative"
            style={{
              width: isRowReady ? "max-content" : "100%",
              minWidth: "100%",
              minHeight: ROW_BODY_MIN_HEIGHT,
            }}
          >
            {isRowReady && (
              <div
                className={`game-row-content flex gap-4 ${isRowVisible ? "game-row-content--visible" : ""}`}
                data-row-image-status={isRowVisible ? "visible" : "hidden"}
                data-row-mounted-count={mountedImageIds.size}
                data-row-buffered-count={bufferedImageIds.length}
                data-row-visible-count={visibleImageIds.length}
                data-row-pending-visible-count={pendingVisibleImageIds.length}
                data-row-dom-settled-count={settledImageIds.size}
              >
                {rowItems.map(({ game, id }) => {
                  const shouldMountImage = mountedImageIds.has(id);
                  const shouldRenderPlaceholder = pendingVisibleImageIdSet.has(id);

                  return shouldMountImage ? (
                    <RowLoadedImageCard
                      key={game.id}
                      game={game}
                      imageId={id}
                      onSettled={markImageSettled}
                      showPlaceholder={shouldRenderPlaceholder}
                    />
                  ) : shouldRenderPlaceholder ? (
                    <RowPendingImageCard
                      key={game.id}
                      game={game}
                    />
                  ) : (
                    <RowCardSpacer key={game.id} game={game} />
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right arrow */}
        {isRowReady && canScrollRight && (
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
