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

export function Home() {
  const [frontPage, setFrontPage] = useState<Awaited<ReturnType<typeof loadFrontPage>>>();
  const [isLudoscopioCalloutVisible, setIsLudoscopioCalloutVisible] = useState(false);
  const prerendered = usePrerenderedHomepage();
  const featuredGames = prerendered?.featuredGames ?? [];
  const rows = frontPage?.rows ?? [];
  const catalogProductCount = prerendered?.stats?.catalogProductCount ?? frontPage?.stats?.catalogProductCount;
  const trackedStoreCount = prerendered?.stats?.trackedStoreCount ?? frontPage?.stats?.trackedStoreCount;
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
    loadFrontPage().then(next => {
      if (isActive) setFrontPage(next);
    });

    return () => {
      isActive = false;
    };
  }, []);


  return (
    <div
      className="min-h-screen text-white"
      style={{
        background: "radial-gradient(ellipse 130% 38% at 50% -5%, rgba(217, 70, 239, 0.08) 0%, transparent 58%), rgb(10, 10, 10)",
      }}
    >
      <SiteHeader />

      {/* Main content */}
      <main className="pt-4 pb-10 md:pt-8 md:pb-16">
        <section className="px-3 pb-5 md:px-14 md:pb-7" aria-labelledby="homepage-title">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
            <div>
              <h1 id="homepage-title" className="text-2xl font-bold tracking-tight md:text-4xl">
                Compara precios de juegos de mesa en México
              </h1>
              {(catalogProductCount !== undefined || trackedStoreCount !== undefined) && (
                <ul aria-label="Cifras del catálogo" className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-neutral-300">
                  {catalogProductCount !== undefined && (
                    <li>{`${formatCount.format(catalogProductCount)} ${catalogProductCount === 1 ? "producto" : "productos"} en el catálogo`}</li>
                  )}
                  {trackedStoreCount !== undefined && (
                    <li>{`${formatCount.format(trackedStoreCount)} ${trackedStoreCount === 1 ? "tienda monitoreada" : "tiendas monitoreadas"}`}</li>
                  )}
                </ul>
              )}
            </div>
            <nav aria-label="Explora todos los juegos" className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-fuchsia-300">
              <Link to="/juegos-de-mesa" className="inline-flex min-h-11 items-center rounded-md bg-fuchsia-700 px-4 font-semibold text-white transition-colors hover:bg-fuchsia-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fuchsia-300">
                Ver catálogo
              </Link>
              <Link to="/categorias" className="hover:underline">Explorar categorías</Link>
            </nav>
          </div>
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
        </section>
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
