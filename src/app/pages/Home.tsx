import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import { GameRow } from "../components/GameRow";
import { LudoscopioCallout } from "../components/LudoscopioCallout";
import { SiteHeader } from "../components/SiteHeader";
import { loadFrontPageRows, type CatalogRow } from "../data/catalog";
import { BGG_FOOTER_LOGO_URL } from "../utils/siteFooter.js";

export function Home() {
  const [rows, setRows] = useState<CatalogRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  const handleLudoscopioOpen = useCallback(() => {
    navigate("/search?ludoscopio=open");
  }, [navigate]);

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
          <div className="flex min-h-[60vh] items-center justify-center px-14 py-16 text-center text-neutral-500 text-sm">
            <span className="flex flex-col items-center justify-center gap-3">
              <span>Cargando catálogo...</span>
              <img
                src={BGG_FOOTER_LOGO_URL}
                alt="Con tecnología de BGG"
                className="h-10 w-auto opacity-80"
                decoding="async"
              />
            </span>
          </div>
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
