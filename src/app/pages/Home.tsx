import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router";
import { GameRow } from "../components/GameRow";
import { HomeEventBanner } from "../components/HomeEventBanner";
import { LudoscopioCallout } from "../components/LudoscopioCallout";
import { SiteHeader } from "../components/SiteHeader";
import { loadFrontPage } from "../data/catalog";
import { usePrerenderedHomepage } from "../PrerenderData";
import {
  dismissHomeLudoscopioCallout,
  isHomeLudoscopioCalloutDismissed,
} from "../utils/homeLudoscopioCalloutSession.js";
import { productPath } from "../utils/productRoutes.js";
import { BGG_FOOTER_LOGO_URL } from "../utils/siteFooter.js";

const formatCount = new Intl.NumberFormat("es-MX");
const STATS_RETRY_DELAY_MS = 500;

export function Home() {
  const [frontPage, setFrontPage] = useState<Awaited<ReturnType<typeof loadFrontPage>>>();
  const [isLudoscopioCalloutVisible, setIsLudoscopioCalloutVisible] = useState(false);
  const prerendered = usePrerenderedHomepage();
  const featuredGames = prerendered?.featuredGames ?? [];
  const publishedStats = prerendered?.stats;
  const rows = frontPage?.rows ?? [];
  const catalogProductCount = publishedStats?.catalogProductCount ?? frontPage?.stats?.catalogProductCount;
  const trackedStoreCount = publishedStats?.trackedStoreCount ?? frontPage?.stats?.trackedStoreCount;
  const navigate = useNavigate();

  const handleLudoscopioOpen = useCallback(() => {
    navigate("/search?ludoscopio=open");
  }, [navigate]);

  const handleLudoscopioDismiss = useCallback(() => {
    dismissHomeLudoscopioCallout();
    setIsLudoscopioCalloutVisible(false);
  }, []);

  useEffect(() => {
    setIsLudoscopioCalloutVisible(!isHomeLudoscopioCalloutDismissed());
  }, []);

  useEffect(() => {
    let isActive = true;
    let retryTimer: number | undefined;
    loadFrontPage().then(next => {
      if (!isActive) return;
      setFrontPage(next);

      const productCountMissing = (publishedStats?.catalogProductCount ?? next.stats?.catalogProductCount) === undefined;
      const storeCountMissing = (publishedStats?.trackedStoreCount ?? next.stats?.trackedStoreCount) === undefined;
      if (!next.rows.length || (!productCountMissing && !storeCountMissing)) return;

      // Give a shared API stats query time to finish before making the second request.
      retryTimer = window.setTimeout(async () => {
        const retry = await loadFrontPage();
        if (!isActive || !retry.stats) return;
        setFrontPage({
          rows: next.rows,
          stats: {
            catalogProductCount: next.stats?.catalogProductCount ?? retry.stats.catalogProductCount,
            trackedStoreCount: next.stats?.trackedStoreCount ?? retry.stats.trackedStoreCount,
          },
        });
      }, STATS_RETRY_DELAY_MS);
    });

    return () => {
      isActive = false;
      window.clearTimeout(retryTimer);
    };
  }, [publishedStats]);


  return (
    <div
      className="min-h-screen text-white"
      style={{
        background: "radial-gradient(ellipse 130% 38% at 50% -5%, rgba(217, 70, 239, 0.08) 0%, transparent 58%), rgb(10, 10, 10)",
      }}
    >
      <SiteHeader intro={
        <>
          <h1 id="homepage-title" className="text-[length:inherit] leading-[inherit] font-semibold">
            Descubre juegos de mesa, compara precios y encuentra ofertas disponibles en tiendas de México.
          </h1>
          {(catalogProductCount !== undefined || trackedStoreCount !== undefined) && (
            <ul aria-label="Cifras del catálogo" className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] leading-tight tracking-tight text-neutral-400 xl:text-xs">
              {catalogProductCount !== undefined && (
                <li>{`${formatCount.format(catalogProductCount)} ${catalogProductCount === 1 ? "producto" : "productos"} en el catálogo`}</li>
              )}
              {trackedStoreCount !== undefined && (
                <li>{`${formatCount.format(trackedStoreCount)} ${trackedStoreCount === 1 ? "tienda monitoreada" : "tiendas monitoreadas"}`}</li>
              )}
            </ul>
          )}
        </>
      } />

      {/* Main content */}
      <main className="pt-4 pb-10 md:pt-8 md:pb-16">
        <div hidden>
          <h2 className="text-lg font-semibold">Juegos destacados</h2>
          {featuredGames.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm text-fuchsia-300">
              {featuredGames.map((game) => (
                <li key={game.id}>
                  <Link to={productPath(game.id, game.name)} className="hover:text-fuchsia-200 hover:underline">
                    {game.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <HomeEventBanner />
        {isLudoscopioCalloutVisible && (
          <div className="px-3 mb-4 md:px-14 md:mb-7">
            <LudoscopioCallout
              className="xl:flex xl:items-center xl:justify-between xl:gap-5"
              messageClassName="xl:whitespace-nowrap"
              onDismiss={handleLudoscopioDismiss}
              onTrigger={handleLudoscopioOpen}
            />
          </div>
        )}
        {!frontPage ? (
          <div className="flex min-h-[60vh] items-center justify-center px-3 py-10 text-center text-neutral-500 text-sm md:px-14 md:py-16">
            <span className="flex flex-col items-center justify-center gap-3">
              <span>Cargando catálogo...</span>
              <img
                src={BGG_FOOTER_LOGO_URL}
                alt="Con tecnología de BGG"
                className="h-[3.25rem] w-auto opacity-80"
                decoding="async"
              />
            </span>
          </div>
        ) : rows.length > 0 ? (
          rows.map((row) => (
            <GameRow key={row.title} title={row.title} games={row.games} />
          ))
        ) : (
          <div className="px-3 py-10 text-neutral-500 text-sm md:px-14 md:py-16">No pudimos cargar el catálogo.</div>
        )}
      </main>
    </div>
  );
}
