import { Loader2, Search as SearchIcon, Sparkles } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";

interface LudoscopioCalloutProps {
  buttonClassName?: string;
  className?: string;
  initialOpen?: boolean;
  messageClassName?: string;
  onSearch?: (prompt: string) => Promise<void>;
  onTrigger?: () => void;
}

export function LudoscopioCallout({
  buttonClassName = "",
  className = "",
  initialOpen = false,
  messageClassName = "",
  onSearch,
  onTrigger,
}: LudoscopioCalloutProps) {
  const [open, setOpen] = useState(initialOpen);
  const [input, setInput] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = async () => {
    const prompt = input.trim();
    if (!prompt || isSearching || !onSearch) return;

    setIsSearching(true);
    setError("");
    try {
      await onSearch(prompt);
      setOpen(false);
    } catch {
      setError("No se pudo consultar el Ludoscopio. Intenta de nuevo.");
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className={`rounded-lg border border-fuchsia-500/20 bg-fuchsia-500/5 p-3 ${className}`}>
      <p className={`text-sm leading-relaxed text-neutral-300 ${messageClassName}`}>
        ¿No sabes qué jugar? Prueba nuestro Ludoscopio y encuentra juegos de mesa que se ajusten al tipo de experiencia que buscas.
      </p>
      {onTrigger ? (
        <button
          type="button"
          onClick={onTrigger}
          className={`mt-3 inline-flex h-9 items-center justify-center gap-2 rounded-md bg-fuchsia-500 px-4 text-sm font-medium text-white transition-colors hover:bg-fuchsia-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-300 disabled:pointer-events-none disabled:opacity-60 ${buttonClassName}`}
        >
          <Sparkles className="h-4 w-4" />
          Ludoscopio
        </button>
      ) : (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <button className={`mt-3 inline-flex h-9 items-center justify-center gap-2 rounded-md bg-fuchsia-500 px-4 text-sm font-medium text-white transition-colors hover:bg-fuchsia-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-300 disabled:pointer-events-none disabled:opacity-60 ${buttonClassName}`}>
            <Sparkles className="h-4 w-4" />
            Ludoscopio
          </button>
        </DialogTrigger>
        <DialogContent className="border-neutral-800 bg-neutral-950 text-white shadow-2xl sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-white">Ludoscopio</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-neutral-400">
              Describe lo que quieres jugar: “un juego cooperativo para dos”, “algo de estrategia con gatos” o “un puzzle familiar rápido”.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSearch();
            }}
          >
            <div>
              <label htmlFor="ludoscopio-input" className="mb-2 block text-xs uppercase tracking-wider text-neutral-500">
                Describe la experiencia
              </label>
              <input
                id="ludoscopio-input"
                type="text"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="“juegos de misterio para 2”, “algo como Catan pero más corto”, “puzzles de gatitos”"
                className="h-11 w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 text-sm text-white outline-none transition-colors placeholder:text-neutral-600 focus:border-fuchsia-500/60"
                autoFocus
              />
            </div>
            {error && <p className="text-sm text-red-300">{error}</p>}
            <button
              type="submit"
              disabled={!input.trim() || isSearching}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-fuchsia-500 px-4 text-sm font-medium text-white transition-colors hover:bg-fuchsia-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-300 disabled:pointer-events-none disabled:opacity-60"
            >
              {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <SearchIcon className="h-4 w-4" />}
              Buscar con Ludoscopio
            </button>
          </form>
        </DialogContent>
      </Dialog>
      )}
    </div>
  );
}
