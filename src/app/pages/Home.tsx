import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router";
import { GameRow } from "../components/GameRow";
import { LudoscopioCallout } from "../components/LudoscopioCallout";
import { SiteHeader } from "../components/SiteHeader";
import { loadFrontPageRows, type CatalogRow } from "../data/catalog";
import { usePrerenderedFeaturedGames } from "../PrerenderData";
import {
  dismissHomeLudoscopioCallout,
  isHomeLudoscopioCalloutDismissed,
} from "../utils/homeLudoscopioCalloutSession.js";
import { productPath } from "../utils/productRoutes.js";
import { BGG_FOOTER_LOGO_URL } from "../utils/siteFooter.js";

export function Home() {
  const [rows, setRows] = useState<CatalogRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLudoscopioCalloutVisible, setIsLudoscopioCalloutVisible] = useState(false);
  const featuredGames = usePrerenderedFeaturedGames();
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
        <section className="px-3 pb-6 md:px-14 md:pb-8" aria-labelledby="homepage-title">
          <h1 id="homepage-title" className="text-2xl font-bold tracking-tight md:text-4xl">
            Juegos de mesa en México
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-neutral-300 md:text-base">
            Descubre juegos de mesa, compara precios y encuentra ofertas disponibles en tiendas de México.
          </p>
          <nav aria-label="Explora todos los juegos" className="mt-4 flex gap-5 text-sm text-fuchsia-300">
            <Link to="/juegos-de-mesa" className="hover:underline">Ver todos los juegos</Link>
            <Link to="/categorias" className="hover:underline">Explorar categorías</Link>
          </nav>
          <div className="mt-5">
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
        {isLoading ? (
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
