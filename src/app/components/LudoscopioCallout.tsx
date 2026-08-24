import { Loader2, Search as SearchIcon, X } from "lucide-react";
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
  onDismiss?: () => void;
  onSearch?: (prompt: string) => Promise<void>;
  onTrigger?: () => void;
}

export function LudoscopioCallout({
  buttonClassName = "",
  className = "",
  initialOpen = false,
  messageClassName = "",
  onDismiss,
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
      setError("No se pudo consultar LudoRadar. Intenta de nuevo.");
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className={`rounded-lg border border-fuchsia-500/20 bg-fuchsia-500/5 p-3 ${className}`}>
      <p className={`text-sm leading-relaxed text-neutral-300 ${messageClassName}`}>
        ¿Buscas algo nuevo para jugar? Prueba nuestro LudoRadar y encuentra juegos de mesa que se ajusten al tipo de experiencia que buscas.
      </p>
      {onTrigger ? (
        <div className="mt-3 flex items-center gap-2 xl:mt-0 xl:flex-none">
          <button
            type="button"
            onClick={onTrigger}
            className={`inline-flex h-9 items-center justify-center gap-2 rounded-md bg-fuchsia-500 px-4 text-sm font-medium text-white transition-colors hover:bg-fuchsia-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-300 disabled:pointer-events-none disabled:opacity-60 ${buttonClassName}`}
          >
            <SearchIcon className="h-4 w-4" />
            LudoRadar
          </button>
          {onDismiss && (
            <button
              type="button"
              aria-label="Cerrar sugerencia de LudoRadar"
              onClick={onDismiss}
              className="flex h-9 w-9 flex-none items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-fuchsia-500/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-fuchsia-300"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      ) : (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <button className={`mt-3 inline-flex h-9 items-center justify-center gap-2 rounded-md bg-fuchsia-500 px-4 text-sm font-medium text-white transition-colors hover:bg-fuchsia-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-300 disabled:pointer-events-none disabled:opacity-60 ${buttonClassName}`}>
            <SearchIcon className="h-4 w-4" />
            LudoRadar
          </button>
        </DialogTrigger>
        <DialogContent className="border-neutral-800 bg-neutral-950 text-white shadow-2xl sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-white">LudoRadar</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-neutral-400">
              Describe lo que quieres jugar: “juegos de estrategia con gatitos”, “juegos cooperativos de misterio”.
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
              Buscar con LudoRadar
            </button>
          </form>
        </DialogContent>
      </Dialog>
      )}
    </div>
  );
}
