import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import { GameRow } from "../components/GameRow";
import { LudoscopioCallout } from "../components/LudoscopioCallout";
import { SiteHeader } from "../components/SiteHeader";
import { loadFrontPageRows, type CatalogRow } from "../data/catalog";
import {
  dismissHomeLudoscopioCallout,
  isHomeLudoscopioCalloutDismissed,
} from "../utils/homeLudoscopioCalloutSession.js";
import { BGG_FOOTER_LOGO_URL } from "../utils/siteFooter.js";

export function Home() {
  const [rows, setRows] = useState<CatalogRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLudoscopioCalloutVisible, setIsLudoscopioCalloutVisible] = useState(
    () => !isHomeLudoscopioCalloutDismissed(),
  );
  const navigate = useNavigate();

  const handleLudoscopioOpen = useCallback(() => {
    navigate("/search?ludoscopio=open");
  }, [navigate]);

  const handleLudoscopioDismiss = useCallback(() => {
    dismissHomeLudoscopioCallout();
    setIsLudoscopioCalloutVisible(false);
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
                className="h-20 w-auto opacity-80"
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
