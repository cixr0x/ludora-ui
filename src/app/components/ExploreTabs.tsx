import { Radar, Search } from "lucide-react";
import { Link } from "react-router";
import { RADAR_PATH } from "../utils/discoveryRoutes";

export function ExploreTabs({ radarActive }: { radarActive: boolean }) {
  const baseClass = "flex min-h-11 items-center justify-center gap-2 rounded-full px-3 text-sm font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-fuchsia-200";
  const selected = "bg-fuchsia-700 text-white hover:bg-fuchsia-600";
  const idle = "text-neutral-300 hover:bg-neutral-800 hover:text-white";

  return (
    <nav aria-label="Secciones de Explorar" className="flex justify-center border-y border-white/5 bg-neutral-950 px-4 py-2">
      <div className="grid w-full max-w-72 grid-cols-2 gap-1 rounded-full border border-white/10 bg-neutral-900 p-1">
        <Link
          to="/search"
          state={{ exploreResultMode: "ordinary" }}
          aria-current={radarActive ? undefined : "page"}
          className={`${baseClass} ${radarActive ? idle : selected}`}
        >
          <Search aria-hidden="true" className="size-4 shrink-0" />
          Búsqueda
        </Link>
        <Link
          to={RADAR_PATH}
          aria-current={radarActive ? "page" : undefined}
          className={`${baseClass} ${radarActive ? selected : idle}`}
        >
          <Radar aria-hidden="true" className="size-4 shrink-0" />
          Ludo Radar
        </Link>
      </div>
    </nav>
  );
}
