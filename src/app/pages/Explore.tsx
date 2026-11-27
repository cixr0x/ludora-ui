import { useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router";
import { ExploreTabs } from "../components/ExploreTabs";
import { discoveryPath, RADAR_PATH } from "../utils/discoveryRoutes";
import { GameDiscovery } from "../components/GameDiscovery";
import { GameGuide, GUIDE_PATH } from "../components/GameGuide";
import { SiteHeader } from "../components/SiteHeader";
import { Search } from "./Search";

function FreeTextSearch() {
  const location = useLocation();
  const [prompt, setPrompt] = useState(() => String(location.state?.radarDraft ?? ""));
  const navigate = useNavigate();
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!prompt.trim()) return;
    await navigate(location.pathname + location.search, { replace: true, state: { radarDraft: prompt } });
    navigate(`/search?${new URLSearchParams({ ludoscopioPrompt: prompt.trim() })}`);
  };
  return (
    <>
      <Link to={RADAR_PATH} className="inline-flex items-center gap-2 text-sm text-fuchsia-300 hover:underline">
        <ArrowLeft aria-hidden="true" className="size-4" /> Volver a Ludo Radar
      </Link>
      <h1 className="mt-5 text-3xl font-bold">En tus palabras</h1>
      <form className="mt-5 max-w-xl space-y-3" onSubmit={submit}>
        <label htmlFor="radar-prompt" className="block text-sm text-neutral-300">Describe la experiencia</label>
        <textarea id="radar-prompt" maxLength={500} rows={3} value={prompt} onChange={e => setPrompt(e.target.value)}
          placeholder="Un juego cooperativo para dos que dure media hora"
          className="w-full rounded-lg border border-neutral-700 bg-neutral-900 p-3 text-white focus:border-fuchsia-400" />
        <button type="submit" disabled={!prompt.trim()} className="rounded-md bg-fuchsia-500 px-4 py-2 font-medium text-white hover:bg-fuchsia-400 disabled:opacity-50">Buscar juegos</button>
      </form>
    </>
  );
}

export function Explore() {
  const [params] = useSearchParams();
  if (params.get("tab") !== "radar") return <Search />;
  const tool = params.get("tool");
  let content = <DiscoveryHub />;
  if (tool === "palabras") content = <FreeTextSearch />;
  if (tool === "brujula") content = <GameGuide />;
  if (tool === "mezcla" || tool === "similares") content = <GameDiscovery mode={tool === "mezcla" ? "mix" : "similar"} />;
  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <SiteHeader contextBar={<ExploreTabs radarActive />} />
      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-8 sm:py-10">
        {content}
      </main>
    </div>
  );
}

function DiscoveryHub() {
  const tools = [
    {
      to: RADAR_PATH + "&tool=palabras",
      image: "/discovery-tools/palabras.webp",
      name: "En tus palabras",
      description: "Describe lo que se te antoja jugar.",
    },
    {
      to: discoveryPath("similar"),
      image: "/discovery-tools/similares.webp",
      name: "Si te gustó…",
      description: "Encuentra otro juego como tu favorito.",
    },
    {
      to: discoveryPath("mix"),
      image: "/discovery-tools/mezcladora.webp",
      name: "La Mezcladora",
      description: "Combina las mecánicas de dos o tres juegos.",
    },
    {
      to: GUIDE_PATH,
      image: "/discovery-tools/brujula.webp",
      name: "Brújula de mesa",
      description: "Responde cuatro preguntas sobre tu próxima partida.",
    },
  ];
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Ludo Radar</h1>
      <h2 className="sr-only text-lg text-neutral-300 sm:not-sr-only sm:mt-5">¿Por dónde quieres empezar?</h2>
      <ul className="mt-2 space-y-2 sm:mt-4 sm:space-y-3">
        {tools.map(({ to, image, name, description }) => (
          <li key={to}>
            <Link
              to={to}
              className="flex items-center gap-3 rounded-2xl border border-neutral-800 bg-neutral-900 p-2 transition-colors hover:border-fuchsia-400/70 hover:bg-neutral-800/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fuchsia-400 sm:gap-5 sm:p-3"
            >
              <img src={image} alt="" className="size-18 shrink-0 rounded-xl object-cover sm:size-24 lg:size-28" />
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-semibold leading-tight sm:text-xl">{name}</h3>
                <p className="mt-1 text-sm text-neutral-300 sm:text-base">{description}</p>
              </div>
              <ArrowRight className="mr-2 hidden size-5 shrink-0 text-neutral-400 sm:block" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
