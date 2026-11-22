import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { fetchGuide, type GuideAnswers, type GuideGame } from "../api/catalog";
import { mapApiItemToGame } from "../data/catalog";
import { RADAR_PATH } from "../utils/discoveryRoutes";
import { productPath } from "../utils/productRoutes.js";
import { ImageWithFallback } from "./figma/ImageWithFallback";

export const GUIDE_PATH = RADAR_PATH + "&tool=brujula";
const durations = {
  any: "Sin límite de tiempo", "15": "Hasta 15 minutos", "30": "Hasta 30 minutos", "45": "Hasta 45 minutos",
  "60": "Hasta una hora", "90": "Hasta hora y media", "120": "Hasta dos horas", "180": "Hasta tres horas",
};
const levels = {
  any: "Nos da igual", light: "Ligera · fácil de aprender", medium: "Media · algo de estrategia", heavy: "Alta · queremos un reto",
};
const styles = { any: "Nos da igual", cooperative: "Cooperar", teams: "Jugar por equipos", negotiation: "Negociar" };
const styleReasons: Record<string, string> = { cooperative: "Juego cooperativo", teams: "Juego por equipos", negotiation: "Incluye negociación" };
const fieldClass = "mt-2 block min-h-11 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-white";
const textLink = "inline-flex min-h-10 items-center gap-2 text-sm text-fuchsia-300 hover:underline";

function guidePath(answers: GuideAnswers, results: boolean) {
  return `${GUIDE_PATH}&${new URLSearchParams(answers)}${results ? "&ver=resultados" : ""}`;
}

function AnswersForm({ initial }: { initial: GuideAnswers }) {
  const [answers, setAnswers] = useState(initial);
  const navigate = useNavigate();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = { ...answers, players: String(Number(answers.players)) };
    await navigate(guidePath(normalized, false), { replace: true });
    navigate(guidePath(normalized, true));
  }
  return <>
    <h1 className="mt-3 text-3xl font-bold">Brújula de mesa</h1>
    <p className="mt-2 text-neutral-300">Cuéntanos cómo será la próxima partida y te sugeriremos hasta tres juegos para tu grupo.</p>
    <form onSubmit={submit} className="mt-6 grid max-w-2xl gap-4 sm:grid-cols-2">
      <label className="text-sm text-neutral-300">¿Cuántas personas van a jugar?
        <input className={fieldClass} type="number" required min={1} max={99} value={answers.players}
          onChange={e => setAnswers({ ...answers, players: e.target.value })} />
      </label>
      {([
        ["minutes", "¿Cuánto tiempo tienen?", durations],
        ["complexity", "¿Qué complejidad prefieren?", levels],
        ["style", "¿Cómo quieren jugar?", styles],
      ] as const).map(([name, label, choices]) => <label key={name} className="text-sm text-neutral-300">{label}
        <select className={fieldClass} value={answers[name]} onChange={e => setAnswers({ ...answers, [name]: e.target.value })}>
          <option value="any">{choices.any}</option>
          {Object.entries(choices).filter(([value]) => value !== "any").map(([value, text]) => <option key={value} value={value}>{text}</option>)}
        </select>
      </label>)}
      <button type="submit" className="min-h-11 justify-self-start rounded-lg bg-fuchsia-500 px-4 py-2 font-medium text-white hover:bg-fuchsia-400">Encontrar juegos</button>
    </form>
  </>;
}

function GuideResults({ answers }: { answers: GuideAnswers }) {
  const [games, setGames] = useState<GuideGame[]>();
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const { players, minutes, complexity, style } = answers;
  useEffect(() => {
    const controller = new AbortController();
    setError(false);
    fetchGuide({ players, minutes, complexity, style }, controller.signal)
      .then(items => { if (!controller.signal.aborted) setGames(items); })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [players, minutes, complexity, style, attempt]);
  const summary = [`${players} ${players === "1" ? "persona" : "personas"}`];
  if (minutes !== "any") summary.push(`hasta ${minutes} minutos`);
  if (complexity !== "any") summary.push(levels[complexity as keyof typeof levels].split(" · ")[0]);
  if (style !== "any") summary.push(styles[style as keyof typeof styles]);
  return <>
    <h1 className="mt-3 text-3xl font-bold">Juegos para tu mesa</h1>
    <div className="mb-5 mt-2 flex flex-wrap items-center justify-between gap-2">
      <p className="text-neutral-300">{summary.join(" · ")}</p>
      <Link className={textLink} to={guidePath(answers, false)}>Cambiar respuestas</Link>
    </div>
    {error ? <div role="alert">No pudimos consultar las sugerencias. <button className={textLink} onClick={() => setAttempt(i => i + 1)}>Reintentar</button></div>
      : !games ? <p role="status">Buscando juegos…</p>
      : !games.length ? <p className="text-neutral-300">No encontramos juegos que cumplan todas tus preferencias. Puedes cambiar las respuestas para ampliar la búsqueda.</p>
      : <div className="grid gap-3">{games.map(item => {
        const game = mapApiItemToGame(item);
        const reasons = [`Admite ${players} ${players === "1" ? "persona" : "personas"} (${item.min_players}–${item.max_players} jugadores)`];
        if (minutes !== "any") reasons.push(`Hasta ${item.max_minutes} min`);
        if (complexity !== "any") reasons.push(`Complejidad ${Number(item.complexity).toLocaleString("es-MX", { maximumFractionDigits: 2 })}/5`);
        if (style !== "any") reasons.push(styleReasons[style]);
        return <article key={game.id} className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <Link to={productPath(game.id, game.name)} className="inline-flex items-center gap-3 hover:text-fuchsia-300">
            {game.image && <ImageWithFallback src={game.image} alt="" className="size-16 rounded object-contain" />}
            <h2 className="text-lg font-semibold">{game.name}</h2>
          </Link>
          <p className="mt-2 text-sm text-neutral-300">{reasons.join(" · ")}</p>
        </article>;
      })}</div>}
  </>;
}

export function GameGuide() {
  const [params] = useSearchParams();
  const answers = {
    players: params.get("players") ?? "2", minutes: params.get("minutes") ?? "any",
    complexity: params.get("complexity") ?? "any", style: params.get("style") ?? "any",
  };
  const valid = /^[1-9]\d?$/.test(answers.players) && Object.hasOwn(durations, answers.minutes) &&
    Object.hasOwn(levels, answers.complexity) && Object.hasOwn(styles, answers.style);
  return <>
    <Link className={textLink} to={RADAR_PATH}><ArrowLeft aria-hidden="true" className="size-4" /> Volver a Ludo Radar</Link>
    {!valid ? <div role="alert">Las respuestas del enlace no son válidas. <Link className={textLink} to={GUIDE_PATH}>Responder de nuevo</Link></div>
      : params.get("ver") === "resultados" ? <GuideResults key={params.toString()} answers={answers} /> : <AnswersForm key={params.toString()} initial={answers} />}
  </>;
}
