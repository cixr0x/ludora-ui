import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { ArrowLeft, Users, Clock, Dices, ChevronLeft, ChevronRight, Youtube, ShoppingCart, ExternalLink } from "lucide-react";
import { ExpansionBadge } from "../components/ExpansionBadge";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import type { StoreEntry, Game, GameDetail as GameDetailData } from "../data/games";
import { loadGameDetail, loadGames } from "../data/catalog";
import { EXPANSION_BADGE_CORNER_CLASS } from "../utils/expansionDisplay.js";
import { hasStoreOfferLinks } from "../utils/storeLinks.js";
import { Link } from "react-router";
import { t } from "../data/translations";

function ComplexityBar({ value }: { value: number }) {
  if (value <= 0) {
    return <span className="text-neutral-500 text-xs">Sin registrar</span>;
  }

  return (
    <div className="flex gap-1.5 items-center">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className={`h-1.5 w-5 rounded-full ${i < value ? "bg-fuchsia-400" : "bg-neutral-700"}`} />
      ))}
      <span className="text-neutral-400 text-xs ml-1">{value}/5</span>
    </div>
  );
}

function TagPills({ items, color }: { items: string[]; color: "fuchsia" | "neutral" }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span
          key={item}
          className={`text-xs px-2.5 py-1 rounded-full border ${
            color === "fuchsia"
              ? "border-fuchsia-500/40 text-fuchsia-300 bg-fuchsia-500/10"
              : "border-neutral-700 text-neutral-400 bg-neutral-800/60"
          }`}
        >
          {item}
        </span>
      ))}
    </div>
  );
}

function TikTokEmbed({ tiktokId, tiktokUser, gameName }: { tiktokId?: string; tiktokUser?: string; gameName: string }) {
  return (
    <div
      className="relative flex-none bg-neutral-900 rounded-xl overflow-hidden border border-neutral-800"
      style={{ width: 260, height: 462 }}
    >
      {tiktokId ? (
        <iframe
          src={`https://www.tiktok.com/embed/v2/${tiktokId}?lang=en-US&autoplay=1`}
          className="w-full h-full"
          allow="autoplay; encrypted-media"
          allowFullScreen
          title={`${gameName} tutorial`}
          style={{ border: "none" }}
        />
      ) : (
        <div className="absolute inset-0 flex flex-col">
          <div className="flex-1 bg-gradient-to-b from-neutral-800 to-neutral-950 flex flex-col items-center justify-center gap-4 p-6">
            <div className="w-14 h-14 rounded-full bg-fuchsia-500/20 flex items-center justify-center">
              <Dices className="w-7 h-7 text-fuchsia-400" />
            </div>
            <p className="text-white text-center text-sm leading-snug">
              Cómo jugar {gameName} en 60 segundos
            </p>
            <p className="text-neutral-500 text-xs">@ludora</p>
          </div>
          <div className="bg-black px-4 py-3 flex items-center gap-2">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-white flex-none">
              <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.79 1.54V6.79a4.85 4.85 0 01-1.02-.1z" />
            </svg>
            <span className="text-neutral-500 text-xs">
              {tiktokUser ? `@${tiktokUser}` : "Tutorial en TikTok"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function StoreCard({ store }: { store: StoreEntry }) {
  const content = (
    <>
      <div className="flex-none w-12 h-12 rounded-md overflow-hidden">
        <ImageWithFallback
          src={store.image}
          alt={store.gameTitle}
          className="w-full h-full object-contain"
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm truncate">{store.name}</p>
        <p className="text-neutral-500 text-xs truncate">{store.gameTitle}</p>
      </div>
      <div className="flex-none flex items-center gap-2">
        <p className="text-fuchsia-400 text-sm">{store.price}</p>
        {store.url && <ExternalLink className="w-3.5 h-3.5 text-neutral-500 group-hover:text-fuchsia-300 transition-colors" />}
      </div>
    </>
  );
  const cardClassName = "flex items-center gap-4 px-4 py-3 rounded-lg bg-neutral-900 border border-neutral-800 transition-colors group";

  if (!store.url) {
    return <div className={`${cardClassName} opacity-80`}>{content}</div>;
  }

  return (
    <a
      href={store.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Ver oferta de ${store.gameTitle} en ${store.name}`}
      className={`${cardClassName} hover:border-fuchsia-500/40 hover:bg-neutral-800/60`}
    >
      {content}
    </a>
  );
}

function RelatedRow({ games }: { games: Game[] }) {
  const rowRef = useRef<HTMLDivElement>(null);
  const scroll = (dir: "left" | "right") => {
    rowRef.current?.scrollBy({ left: dir === "left" ? -600 : 600, behavior: "smooth" });
  };

  return (
    <div className="relative group/row">
      <button
        onClick={() => scroll("left")}
        aria-label="Scroll left"
        className="absolute left-0 top-0 bottom-0 z-10 w-10 flex items-center justify-center bg-gradient-to-r from-neutral-950 to-transparent opacity-0 group-hover/row:opacity-100 transition-opacity"
      >
        <ChevronLeft className="w-6 h-6 text-white drop-shadow-lg" />
      </button>
      <div
        ref={rowRef}
        className="flex gap-3 overflow-x-auto"
        style={{ scrollbarWidth: "none" }}
      >
        {games.map((game) => (
          <Link
            key={game.id}
            to={`/game/${game.id}`}
            className="flex-none group/card"
            style={{ width: 120 }}
          >
            <div className="relative rounded-md overflow-hidden mb-1.5" style={{ width: 120, height: 120 }}>
              <ImageWithFallback
                src={game.image}
                alt={game.name}
                className="w-full h-full object-contain"
              />
              <div className="absolute inset-0 bg-black/0 group-hover/card:bg-black/20 transition-colors duration-300" />
            </div>
            <p className="text-neutral-400 text-xs text-center group-hover/card:text-white transition-colors truncate px-1 leading-snug">
              {game.name}
            </p>
          </Link>
        ))}
      </div>
      <button
        onClick={() => scroll("right")}
        aria-label="Scroll right"
        className="absolute right-0 top-0 bottom-0 z-10 w-10 flex items-center justify-center bg-gradient-to-l from-neutral-950 to-transparent opacity-0 group-hover/row:opacity-100 transition-opacity"
      >
        <ChevronRight className="w-6 h-6 text-white drop-shadow-lg" />
      </button>
    </div>
  );
}

export function GameDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const itemId = Number(id);
  const [detail, setDetail] = useState<GameDetailData | undefined>();
  const [parentGame, setParentGame] = useState<Game | undefined>();
  const [allGames, setAllGames] = useState<Game[]>([]);
  const [isLoading, setIsLoading] = useState(() => Number.isInteger(itemId) && itemId > 0);
  const storesSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!Number.isInteger(itemId) || itemId <= 0) {
      setDetail(undefined);
      setIsLoading(false);
      return;
    }

    let isActive = true;
    setDetail(undefined);
    setParentGame(undefined);
    setIsLoading(true);

    const gamesPromise = loadGames();
    loadGameDetail(itemId).then(async (nextDetail) => {
      const parentPromise =
        nextDetail?.isExpansion && nextDetail.parentItemId ? loadGameDetail(nextDetail.parentItemId).catch(() => undefined) : undefined;
      const [nextGames, nextParent] = await Promise.all([gamesPromise, parentPromise]);
      if (!isActive) return;
      setDetail(nextDetail);
      setParentGame(nextParent);
      setAllGames(nextGames);
      setIsLoading(false);
    }).finally(() => {
      if (isActive) setIsLoading(false);
    });

    return () => {
      isActive = false;
    };
  }, [itemId]);

  if (isLoading && !detail) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center">
        <p className="text-neutral-500 text-sm">Cargando juego...</p>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-neutral-400 mb-4">Juego no encontrado.</p>
          <button onClick={() => navigate("/")} className="text-fuchsia-400 hover:text-fuchsia-300 text-sm">
            ← Volver al catálogo
          </button>
        </div>
      </div>
    );
  }

  const relatedGames = allGames
    .filter((g) => g.id !== detail.id && g.genres.some((genre) => detail.genres.includes(genre)))
    .slice(0, 18);
  const hasLinkedStoreOffers = hasStoreOfferLinks(detail.stores);
  const scrollToStores = () => {
    storesSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div
      className="min-h-screen bg-neutral-950 text-white"
      style={{
        background: "radial-gradient(ellipse 120% 35% at 50% 0%, rgba(217, 70, 239, 0.06) 0%, transparent 55%), rgb(10, 10, 10)",
      }}
    >
      {/* Back header */}
      <div className="sticky top-0 z-40 bg-neutral-950/80 backdrop-blur-md border-b border-white/5 px-8 h-14 flex items-center gap-4">
        <button
          onClick={() => (window.history.state?.idx > 0 ? navigate(-1) : navigate("/"))}
          className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Volver</span>
        </button>
        <span className="text-neutral-700">|</span>
        <span className="text-neutral-400 text-sm truncate">{detail.name}</span>
      </div>

      {/* ── Blurred backdrop hero ─────────────────────────────────────── */}
      <div className="relative w-full overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={detail.image}
            alt=""
            aria-hidden
            className="w-full h-full object-cover"
            style={{ filter: "blur(72px)", transform: "scale(1.4)", opacity: 0.5 }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-neutral-950/30 via-neutral-950/60 to-neutral-950" />
          <div className="absolute inset-0 bg-gradient-to-r from-neutral-950/50 via-transparent to-neutral-950/50" />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-8 pt-10 pb-10">
          <div className="flex gap-8 items-start">
          {/* Cover image + Buy now */}
          <div className="flex-none flex flex-col items-stretch gap-3 self-start" style={{ width: 176 }}>
            <div className="flex w-full items-center justify-center rounded-md overflow-hidden" style={{ height: 176 }}>
              <div className="relative inline-flex max-h-full max-w-full">
                <ImageWithFallback
                  src={detail.image}
                  alt={detail.name}
                  className="block max-h-full max-w-full object-contain"
                />
                {detail.isExpansion && <ExpansionBadge className={EXPANSION_BADGE_CORNER_CLASS} />}
              </div>
            </div>
            {hasLinkedStoreOffers ? (
              <button
                type="button"
                onClick={scrollToStores}
                className="w-full flex items-center justify-center gap-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 hover:border-neutral-600 text-neutral-300 hover:text-white text-sm py-2 rounded-lg transition-colors"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                Comprar ahora
              </button>
            ) : (
              <button
                type="button"
                disabled
                className="w-full flex items-center justify-center gap-2 bg-neutral-900 border border-neutral-800 text-neutral-600 text-sm py-2 rounded-lg cursor-not-allowed"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                Comprar ahora
              </button>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 flex flex-col gap-4 min-w-0">
            {/* Title + rating */}
            <div>
              <div className="flex items-start justify-between gap-4 mb-1">
                <h1 className="text-white leading-tight">{detail.name}</h1>
                <span className="flex-none mt-1" style={{ fontSize: "1.35rem" }}>
                  {detail.rating > 0 ? (
                    <>
                      <span className="text-fuchsia-400 font-bold">{detail.rating.toFixed(1)}</span>
                      <span className="text-neutral-600 text-base"> / 10</span>
                    </>
                  ) : (
                    <span className="text-neutral-500 text-sm">Sin calificar</span>
                  )}
                </span>
              </div>
              {detail.altTitle && (
                <p className="text-neutral-400">{detail.altTitle}</p>
              )}
            </div>

            {detail.isExpansion && parentGame && (
              <div>
                <p className="text-neutral-500 text-xs uppercase tracking-wider mb-1">Expansión para</p>
                <Link to={`/game/${parentGame.id}`} className="text-white text-sm hover:text-fuchsia-300 transition-colors">
                  {parentGame.name}
                </Link>
              </div>
            )}

            {/* Categories */}
            <div>
              <p className="text-neutral-500 text-xs uppercase tracking-wider mb-1.5">Categorías</p>
              <TagPills items={detail.categories.map(t)} color="fuchsia" />
            </div>

            {/* Mechanics */}
            <div>
              <p className="text-neutral-500 text-xs uppercase tracking-wider mb-1.5">Mecánicas</p>
              <TagPills items={detail.mechanics.map(t)} color="neutral" />
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-3 pt-1">
              <div>
                <p className="text-neutral-500 text-xs uppercase tracking-wider mb-1">Jugadores</p>
                <p className="text-white text-sm flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-fuchsia-400 flex-none" />
                  {detail.players}
                </p>
              </div>
              <div>
                <p className="text-neutral-500 text-xs uppercase tracking-wider mb-1">Duración</p>
                <p className="text-white text-sm flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-fuchsia-400 flex-none" />
                  {detail.playTime}
                </p>
              </div>
              <div>
                <p className="text-neutral-500 text-xs uppercase tracking-wider mb-1">Complejidad</p>
                <ComplexityBar value={detail.complexity} />
              </div>
              <div>
                <p className="text-neutral-500 text-xs uppercase tracking-wider mb-1">Diseñador</p>
                <p className="text-white text-sm">{detail.designer}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-neutral-500 text-xs uppercase tracking-wider mb-1">Editorial</p>
                <p className="text-white text-sm">{detail.publisher}</p>
              </div>
            </div>
          </div>
        </div>{/* end flex gap-8 */}
        </div>{/* end relative z-10 */}
      </div>{/* end backdrop */}

      <div className="max-w-5xl mx-auto px-8 pb-10 flex flex-col gap-10">

        {/* ── Description + Tutorial side by side ──────────────────────── */}
        <div className="flex gap-10 items-start">
          <div className="flex-1 min-w-0">
            <h2 className="text-white mb-4">Acerca de</h2>
            <div className="space-y-5">
              {detail.description.map((para, i) => (
                <p key={i} className="text-neutral-300 leading-loose">{para}</p>
              ))}
            </div>
            <a
              href={
                detail.youtubeId
                  ? `https://www.youtube.com/watch?v=${detail.youtubeId}`
                  : `https://www.youtube.com/results?search_query=${encodeURIComponent(detail.name + " board game tutorial")}`
              }
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2.5 mt-5 px-4 py-2.5 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-red-500/50 hover:bg-neutral-800 transition-colors group"
            >
              <Youtube className="w-4 h-4 text-red-500 flex-none" />
              <span className="text-neutral-300 text-sm group-hover:text-white transition-colors">Ver tutorial completo en YouTube</span>
            </a>
          </div>

          <div className="flex-none">
            <TikTokEmbed tiktokId={detail.tiktokId} tiktokUser={detail.tiktokUser} gameName={detail.name} />
            <div className="mt-2 flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-neutral-500 flex-none">
                <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.79 1.54V6.79a4.85 4.85 0 01-1.02-.1z" />
              </svg>
              <span className="text-neutral-500 text-xs">
                {detail.tiktokUser ? `@${detail.tiktokUser}` : "Tutorial en TikTok"}
              </span>
            </div>
          </div>
        </div>

        {/* ── Stores ───────────────────────────────────────────────────── */}
        <div ref={storesSectionRef} id="store-offers" style={{ scrollMarginTop: 80 }}>
          <h2 className="text-white mb-4">Disponible en Tiendas</h2>
          <div className="flex flex-col gap-2 max-w-2xl">
            {detail.stores.map((store) => (
              <StoreCard key={store.id} store={store} />
            ))}
          </div>
        </div>

        {/* ── You might also like ──────────────────────────────────────── */}
        {relatedGames.length > 0 && (
          <div>
            <h2 className="text-white mb-4">También te puede gustar</h2>
            <RelatedRow games={relatedGames} />
          </div>
        )}

      </div>
    </div>
  );
}
