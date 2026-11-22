import { useEffect, useState } from "react";
import { ArrowLeft, Plus, Search, Shuffle, X } from "lucide-react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router";
import { fetchDiscovery, fetchItem, fetchSearchResults, type DiscoveryMode, type DiscoverySource } from "../api/catalog";
import { mapApiItemToGame } from "../data/catalog";
import type { Game } from "../data/games";
import { discoveryPath, RADAR_PATH, readDiscoveryIds } from "../utils/discoveryRoutes";
import { HOME_SEARCH_DEBOUNCE_MS, HOME_SEARCH_LIMIT, homeSearchQuery } from "../utils/homeSearch.js";
import { productPath } from "../utils/productRoutes.js";
import { ImageWithFallback } from "./figma/ImageWithFallback";

const textLink = "inline-flex min-h-10 items-center gap-2 text-sm text-fuchsia-300 hover:underline";
const primary = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-fuchsia-500 px-4 py-2 font-medium text-white hover:bg-fuchsia-400 disabled:opacity-50";
type Result = Game & { sources: DiscoverySource[] };

function Cover({ game, large = false }: { game: Game; large?: boolean }) {
  return game.image ? <ImageWithFallback src={game.image} alt="" className={`${large ? "size-16 sm:size-20" : "size-10"} shrink-0 rounded object-contain`} /> : null;
}

function GamePicker({ chosen, onChoose }: { chosen: Game[]; onChoose: (game: Game) => void }) {
  const [input, setInput] = useState("");
  const query = homeSearchQuery(input);
  const [lookup, setLookup] = useState<{ query: string; games?: Game[]; error?: boolean }>();
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!query) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetchSearchResults({ query, limit: HOME_SEARCH_LIMIT }, controller.signal)
        .then(items => {
          if (!controller.signal.aborted) setLookup({ query, games: items.map(item => mapApiItemToGame(item)) });
        })
        .catch(() => { if (!controller.signal.aborted) setLookup({ query, error: true }); });
    }, HOME_SEARCH_DEBOUNCE_MS);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, attempt]);
  const games = lookup?.query === query ? lookup.games : undefined;
  return (
    <div>
      <label htmlFor="discovery-game" className="text-sm text-neutral-300">Buscar un juego por nombre</label>
      <div className="mt-2 flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-900 px-3 focus-within:border-fuchsia-400">
        <Search aria-hidden="true" className="size-4 shrink-0 text-neutral-400" />
        <input id="discovery-game" type="search" autoComplete="off" placeholder="Escribe al menos dos letras" value={input}
          onChange={e => setInput(e.target.value)} className="min-h-11 w-full min-w-0 bg-transparent text-white outline-none" />
      </div>
      {query && <div className="mt-2" aria-live="polite">
        {lookup?.query === query && lookup.error ?
          <div role="alert" className="text-sm text-neutral-300">No se pudo buscar el juego. <button onClick={() => { setLookup(undefined); setAttempt(i => i + 1); }} className={textLink}>Reintentar</button></div>
          : !games ? <p className="text-sm text-neutral-400">Buscando juegos…</p>
          : !games.length ? <p className="text-sm text-neutral-400">No encontramos juegos con ese nombre.</p>
          : games.map(game => {
            const included = chosen.some(seed => seed.id === game.id);
            return <button type="button" key={game.id} disabled={included} aria-label={`${included ? "Ya elegiste" : "Elegir"} ${game.name}`}
              onClick={() => { setInput(""); onChoose(game); }}
              className="flex min-h-11 w-full items-center gap-3 border-b border-neutral-800 py-2 text-left hover:bg-neutral-900 disabled:opacity-50">
              <Cover game={game} /><span className="min-w-0 flex-1">{game.name}{game.isExpansion && <small className="ml-2 text-neutral-400">Expansión</small>}</span>
              {included ? <small>Elegido</small> : <Plus aria-hidden="true" className="size-4 text-fuchsia-300" />}
            </button>;
          })}
      </div>}
    </div>
  );
}

function SeedChips({ seeds, onRemove }: { seeds: Game[]; onRemove?: (id: number) => void }) {
  return <ul className="flex flex-wrap gap-2">{seeds.map(seed => (
    <li key={seed.id} className="inline-flex max-w-full items-center gap-2 rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm">
      <Cover game={seed} /><span className="break-words">{seed.name}</span>
      {onRemove && <button type="button" aria-label={`Quitar ${seed.name}`} onClick={() => onRemove(seed.id)} className="grid min-h-10 min-w-10 place-items-center text-neutral-300"><X className="size-4" /></button>}
    </li>
  ))}</ul>;
}

function DiscoveryContent({ mode, ids, results }: { mode: DiscoveryMode; ids: number[]; results: boolean }) {
  const location = useLocation();
  const navigate = useNavigate();
  const carried = location.state?.radarSeeds as Game[] | undefined;
  const [seeds, setSeeds] = useState<Game[]>(() => !results && Array.isArray(carried) && ids.length === carried.length &&
    ids.every((id, i) => carried[i]?.id === id && typeof carried[i]?.name === "string") ? carried : []);
  const [matches, setMatches] = useState<Result[]>();
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [loadedEditor] = useState(!results && seeds.length === ids.length);
  const idsKey = ids.join(",");
  useEffect(() => {
    if (loadedEditor) return;
    const requested = idsKey.split(",").map(Number);
    const controller = new AbortController();
    setError(false);
    async function load() {
      if (results) {
        const data = await fetchDiscovery(mode, requested, controller.signal);
        if (controller.signal.aborted) return;
        setSeeds(data.seeds.map(item => mapApiItemToGame(item)));
        setMatches(data.results.map(item => ({ ...mapApiItemToGame(item), sources: item.sources })));
      } else {
        const data = await Promise.all(requested.map(id => fetchItem(id, controller.signal)));
        if (controller.signal.aborted) return;
        if (data.some(item => !item.has_approved_listing)) throw new Error("Unavailable game");
        setSeeds(data.map(item => mapApiItemToGame(item)));
      }
    }
    load().catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [mode, idsKey, results, attempt, loadedEditor]);
  const mix = mode === "mix";
  const select = (next: Game[]) => {
    navigate(discoveryPath(mode, next.map(seed => seed.id), !mix), { replace: mix, state: { radarSeeds: next } });
  };
  if (error) return <div role="alert" className="space-y-2"><p>No pudimos consultar los juegos seleccionados.</p>
    <button type="button" className={textLink} onClick={() => setAttempt(i => i + 1)}>Reintentar</button>
    <Link className={textLink + " ml-4"} to={discoveryPath(mode)}>Elegir otros juegos</Link></div>;
  if ((!results && seeds.length !== ids.length) || (results && !matches)) return <p role="status" className="text-neutral-300">Consultando juegos…</p>;
  if (!results) return <>
    <h1 className="mt-3 text-3xl font-bold">{mix ? "La Mezcladora" : "Si te gustó…"}</h1>
    <p className="mt-2 text-neutral-300">{mix ? "Elige dos o tres juegos para descubrir cuáles combinan sus mecánicas." : "Elige un juego que te guste para encontrar otros con rasgos en común."}</p>
    <div className="mt-6 max-w-2xl space-y-4">
      {seeds.length > 0 && <SeedChips seeds={seeds} onRemove={id => select(seeds.filter(seed => seed.id !== id))} />}
      {seeds.length < (mix ? 3 : 1) && <GamePicker chosen={seeds} onChoose={game => select([...seeds, game])} />}
      {mix && <button type="button" disabled={seeds.length < 2} className={primary}
        onClick={() => navigate(discoveryPath(mode, ids, true), { state: { radarSeeds: seeds } })}>
        <Shuffle className="size-4" aria-hidden="true" /> Encontrar la mezcla
      </button>}
    </div>
  </>;
  return <>
    <h1 className="mt-3 text-3xl font-bold">{mix ? "Resultados de tu mezcla" : `Si te gustó ${seeds[0]?.name}…`}</h1>
    <div className="my-5 flex flex-wrap items-center justify-between gap-3">
      <SeedChips seeds={seeds} />
      <div className="flex flex-wrap gap-4">
        <Link className={textLink} state={{ radarSeeds: mix ? seeds : [] }} to={discoveryPath(mode, mix ? ids : [])}>{mix ? "Editar mezcla" : "Cambiar juego"}</Link>
        {!mix && <Link className={textLink} state={{ radarSeeds: seeds }} to={discoveryPath("mix", ids)}><Shuffle className="size-4" />Mezclar con otro juego</Link>}
      </div>
    </div>
    {matches?.length ? <div className="grid gap-3" aria-label="Recomendaciones">
      {matches.map(game => <article key={game.id} className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
        <Link to={productPath(game.id, game.name)} className="inline-flex items-center gap-3 hover:text-fuchsia-300">
          <Cover game={game} large /><h2 className="text-lg font-semibold">{game.name}</h2>
        </Link>
        {mix && <p className="mt-2 text-sm font-medium text-fuchsia-300">Combina {game.sources.length} de {seeds.length} juegos</p>}
        <ul className="mt-2 space-y-1 text-sm text-neutral-300">
          {game.sources.map(source => <li key={source.seed_id}><strong>De {seeds.find(seed => seed.id === Number(source.seed_id))?.name}</strong>
            {" · "}{source.traits.map(trait => trait.name).join(", ")}</li>)}
        </ul>
      </article>)}
    </div> : <p className="text-neutral-300">{mix ? "No encontramos una combinación de mecánicas para esta mezcla. Prueba con otro juego." : "No encontramos otros juegos con rasgos en común."}</p>}
  </>;
}

export function GameDiscovery({ mode }: { mode: DiscoveryMode }) {
  const [params] = useSearchParams();
  const ids = readDiscoveryIds(params.get("ids"), mode);
  const results = params.get("ver") === "resultados" || (mode === "similar" && ids?.length === 1);
  const valid = ids !== null && (!results || ids.length >= (mode === "mix" ? 2 : 1));
  return <>
    <Link to={RADAR_PATH} className={textLink}><ArrowLeft aria-hidden="true" className="size-4" /> Volver a Ludo Radar</Link>
    {valid && ids ? <DiscoveryContent key={`${mode}/${ids.join(",")}/${results}`} mode={mode} ids={ids} results={results} /> :
      <div role="alert"><p>La selección del enlace no es válida.</p><Link className={textLink} to={discoveryPath(mode)}>Elegir juegos</Link></div>}
  </>;
}
