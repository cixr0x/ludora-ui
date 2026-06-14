import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { ArrowLeft, Dices } from "lucide-react";
import type { Game } from "../data/games";
import { loadGames } from "../data/catalog";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { t } from "../data/translations";

export function Browse() {
  const { genre } = useParams<{ genre: string }>();
  const navigate = useNavigate();
  const decoded = decodeURIComponent(genre ?? "");
  const [allGames, setAllGames] = useState<Game[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isActive = true;
    setIsLoading(true);

    loadGames()
      .then((nextGames) => {
        if (isActive) setAllGames(nextGames);
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, []);

  const games = allGames.filter((g) => g.genres.includes(decoded));

  return (
    <div
      className="min-h-screen text-white"
      style={{
        background: "radial-gradient(ellipse 130% 38% at 50% -5%, rgba(217, 70, 239, 0.08) 0%, transparent 58%), rgb(10, 10, 10)",
      }}
    >
      {/* Header */}
      <div className="sticky top-0 z-40 bg-neutral-950/80 backdrop-blur-md border-b border-white/5 px-8 h-14 flex items-center gap-4">
        <button
          onClick={() => (window.history.state?.idx > 0 ? navigate(-1) : navigate("/"))}
          className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Volver</span>
        </button>
        <span className="text-neutral-700">|</span>
        <span className="text-white text-sm">{t(decoded)}</span>
        <span className="text-neutral-600 text-sm">
          {isLoading ? "· Cargando" : `· ${games.length} juego${games.length !== 1 ? "s" : ""}`}
        </span>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-10">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Dices className="w-10 h-10 text-neutral-700" />
            <p className="text-neutral-500">Cargando catálogo...</p>
          </div>
        ) : games.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Dices className="w-10 h-10 text-neutral-700" />
            <p className="text-neutral-500">Aún no hay juegos con la etiqueta <span className="text-fuchsia-400">{t(decoded)}</span>.</p>
          </div>
        ) : (
          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}>
            {games.map((game) => (
              <Link
                key={game.id}
                to={`/game/${game.id}`}
                className="group flex flex-col"
              >
                <div className="relative rounded-md overflow-hidden mb-1.5" style={{ aspectRatio: "1" }}>
                  <ImageWithFallback
                    src={game.image}
                    alt={game.name}
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />
                </div>
                <p className="text-neutral-300 text-sm text-center group-hover:text-white transition-colors truncate px-1 leading-snug">
                  {game.name}
                </p>
                {game.altTitle && (
                  <p className="text-neutral-600 text-xs text-center mt-0.5 truncate px-1">{game.altTitle}</p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
