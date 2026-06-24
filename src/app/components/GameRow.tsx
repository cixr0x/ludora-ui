import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import type { Game } from "../data/games";
import { preloadImageBatch } from "../utils/imageBatch.js";

export type { Game };

interface GameRowProps {
  title: string;
  games: Game[];
}

const CARD_SIZE = 168;
const IMAGE_BATCH_DELAY_MS = 75;
const IMAGE_BATCH_ROOT_MARGIN = "180px 320px";

export function GameRow({ title, games }: GameRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const batchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const imageSourcesRef = useRef<Map<string, string>>(new Map());
  const cardNodesRef = useRef<Map<string, HTMLElement>>(new Map());
  const pendingImageIdsRef = useRef<Set<string>>(new Set());
  const loadingImageIdsRef = useRef<Set<string>>(new Set());
  const isMountedRef = useRef(true);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [revealedImageIds, setRevealedImageIds] = useState<Set<string>>(() => new Set());
  const revealedImageIdsRef = useRef(revealedImageIds);

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
    revealedImageIdsRef.current = revealedImageIds;
  }, [revealedImageIds]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      observerRef.current?.disconnect();
      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const currentIds = new Set(games.map((game) => String(game.id)));

    for (const id of imageSourcesRef.current.keys()) {
      if (!currentIds.has(id)) imageSourcesRef.current.delete(id);
    }
    for (const id of pendingImageIdsRef.current) {
      if (!currentIds.has(id)) pendingImageIdsRef.current.delete(id);
    }
    for (const id of loadingImageIdsRef.current) {
      if (!currentIds.has(id)) loadingImageIdsRef.current.delete(id);
    }

    setRevealedImageIds((previous) => {
      const next = new Set<string>();
      for (const id of previous) {
        if (currentIds.has(id)) next.add(id);
      }
      return next.size === previous.size ? previous : next;
    });
  }, [games]);

  const flushImageBatch = useCallback(() => {
    if (batchTimerRef.current) {
      clearTimeout(batchTimerRef.current);
      batchTimerRef.current = null;
    }

    const batchIds = [...pendingImageIdsRef.current].filter(
      (id) => !loadingImageIdsRef.current.has(id) && !revealedImageIdsRef.current.has(id),
    );
    pendingImageIdsRef.current.clear();

    if (batchIds.length === 0) return;

    for (const id of batchIds) {
      loadingImageIdsRef.current.add(id);
    }

    const sources = batchIds
      .map((id) => imageSourcesRef.current.get(id))
      .filter((src): src is string => Boolean(src));

    preloadImageBatch(sources).then(() => {
      if (!isMountedRef.current) return;

      for (const id of batchIds) {
        loadingImageIdsRef.current.delete(id);
      }

      setRevealedImageIds((previous) => {
        const next = new Set(previous);
        for (const id of batchIds) {
          next.add(id);
        }
        revealedImageIdsRef.current = next;
        return next;
      });
    });
  }, []);

  const queueImageBatch = useCallback(
    (ids: string[]) => {
      let queuedAny = false;

      for (const id of ids) {
        if (loadingImageIdsRef.current.has(id) || revealedImageIdsRef.current.has(id)) {
          continue;
        }
        pendingImageIdsRef.current.add(id);
        queuedAny = true;
      }

      if (!queuedAny || batchTimerRef.current) return;

      batchTimerRef.current = setTimeout(flushImageBatch, IMAGE_BATCH_DELAY_MS);
    },
    [flushImageBatch],
  );

  const setCoverNode = useCallback(
    (id: string, src: string, node: HTMLElement | null) => {
      const existingNode = cardNodesRef.current.get(id);
      if (existingNode && existingNode !== node) {
        observerRef.current?.unobserve(existingNode);
      }

      if (!node) {
        cardNodesRef.current.delete(id);
        return;
      }

      imageSourcesRef.current.set(id, src);
      cardNodesRef.current.set(id, node);

      if (loadingImageIdsRef.current.has(id) || revealedImageIdsRef.current.has(id)) {
        return;
      }

      if (typeof IntersectionObserver === "undefined") {
        queueImageBatch([id]);
        return;
      }

      if (!observerRef.current) {
        observerRef.current = new IntersectionObserver(
          (entries) => {
            const visibleIds: string[] = [];

            for (const entry of entries) {
              if (!entry.isIntersecting) continue;

              const visibleId = (entry.target as HTMLElement).dataset.batchImageId;
              if (!visibleId) continue;

              observerRef.current?.unobserve(entry.target);
              visibleIds.push(visibleId);
            }

            if (visibleIds.length > 0) {
              queueImageBatch(visibleIds);
            }
          },
          {
            root: null,
            rootMargin: IMAGE_BATCH_ROOT_MARGIN,
            threshold: 0.01,
          },
        );
      }

      observerRef.current.observe(node);
    },
    [queueImageBatch],
  );

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
          {games.map((game) => {
            const imageId = String(game.id);
            const isCoverReady = revealedImageIds.has(imageId);

            return (
              <Link
                key={game.id}
                to={`/game/${game.id}`}
                className="flex-none group/card"
                style={{ width: CARD_SIZE }}
              >
                <div
                  ref={(node) => setCoverNode(imageId, game.image, node)}
                  className="relative rounded-md overflow-hidden mb-1.5"
                  style={{ width: CARD_SIZE, height: CARD_SIZE }}
                  data-batch-image-id={imageId}
                  data-batch-image-status={isCoverReady ? "ready" : "pending"}
                >
                  {isCoverReady ? (
                    <ImageWithFallback
                      src={game.image}
                      alt={game.name}
                      className="game-cover-image w-full h-full object-contain"
                      decoding="async"
                      loading="eager"
                    />
                  ) : (
                    <div
                      className="game-cover-placeholder w-full h-full animate-pulse"
                      aria-label={game.name}
                      data-batched-image-placeholder="true"
                      data-original-url={game.image}
                    />
                  )}
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
          })}
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
