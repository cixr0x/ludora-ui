import { LayoutGrid, Radar } from "lucide-react";
import { Link } from "react-router";
import { RADAR_PATH } from "../utils/discoveryRoutes";

export function ExploreTabs({ radarActive }: { radarActive: boolean }) {
  const baseClass = "inline-flex min-h-11 items-center gap-2 border-b-2 px-1 text-sm font-medium transition-colors";
  const selected = "border-fuchsia-400 text-fuchsia-300";
  const idle = "border-transparent text-neutral-400 hover:text-white";

  return (
    <nav aria-label="Secciones de Explorar" className="flex gap-6 border-y border-white/5 bg-neutral-950 px-4 sm:px-8">
      <Link to="/search" state={{ exploreResultMode: "ordinary" }}
        aria-current={radarActive ? undefined : "page"} className={`${baseClass} ${radarActive ? idle : selected}`}>
        <LayoutGrid aria-hidden="true" className="size-4" /> Catálogo
      </Link>
      <Link to={RADAR_PATH} aria-current={radarActive ? "page" : undefined}
        className={`${baseClass} ${radarActive ? selected : idle}`}>
        <Radar aria-hidden="true" className="size-4" /> Ludo Radar
      </Link>
    </nav>
  );
}
