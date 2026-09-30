import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Copy, ExternalLink, Share2 } from "lucide-react";

import type { GameDetail } from "../data/games";
import { DEFAULT_SITE_URL } from "../utils/siteSeo.js";
import { canNativeShare, copyProductLink, productShareData, shareProduct, socialShareLinks } from "../utils/productShare.js";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";

const SITE_URL = (import.meta.env.VITE_LUDORA_SITE_URL as string | undefined) ?? DEFAULT_SITE_URL;
const OPTION_CLASS = "flex min-h-10 items-center justify-center gap-2 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 transition-colors hover:border-fuchsia-400/60 hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400 disabled:cursor-wait disabled:opacity-60";

export function ProductShare({ detail, canonicalPath }: { detail: GameDetail; canonicalPath?: string }) {
  const urlId = useId();
  const urlInput = useRef<HTMLInputElement>(null);
  const data = useMemo(() => productShareData(detail, SITE_URL, canonicalPath), [detail, canonicalPath]);
  const [open, setOpen] = useState(false);
  const [nativeShareAvailable, setNativeShareAvailable] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    setNativeShareAvailable(canNativeShare(data, navigator));
  }, [data]);

  function changeOpen(nextOpen: boolean) {
    setOpen(nextOpen);
    setFeedback("");
  }

  async function handleCopy() {
    setFeedback("");
    setIsCopying(true);
    const result = await copyProductLink(data.url, navigator);
    setIsCopying(false);
    if (result === "copied") {
      setFeedback("Enlace copiado");
    } else {
      setFeedback("No pudimos copiar el enlace. Selecciónalo y cópialo manualmente.");
      urlInput.current?.focus();
      urlInput.current?.select();
    }
  }

  async function handleNativeShare() {
    setFeedback("");
    setIsSharing(true);
    const result = await shareProduct(data, navigator);
    setIsSharing(false);
    if (result === "error") {
      setFeedback("No pudimos abrir las opciones para compartir. Copia el enlace o elige una red social.");
    } else if (result === "unavailable") {
      setFeedback("Este dispositivo no ofrece más opciones. Copia el enlace o elige una red social.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={`Compartir ${detail.name}`}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-700 bg-neutral-900 py-2 text-sm text-neutral-200 transition-colors hover:border-fuchsia-400/60 hover:bg-neutral-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400"
        >
          <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
          Compartir
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto border-neutral-800 bg-neutral-950 text-neutral-100 sm:max-w-sm">
        <DialogHeader className="pr-6">
          <DialogTitle>Compartir juego</DialogTitle>
          <DialogDescription className="break-words text-neutral-400">
            {detail.name} en Ludo Radar. Elige dónde compartirlo.
          </DialogDescription>
        </DialogHeader>

        <button type="button" className={OPTION_CLASS} disabled={isCopying || isSharing} onClick={handleCopy}>
          <Copy className="h-4 w-4" aria-hidden="true" />
          {isCopying ? "Copiando…" : "Copiar enlace"}
        </button>

        <div className="grid grid-cols-2 gap-2">
          {socialShareLinks(data).map(({ label, href }) => (
            <a key={label} href={href} target="_blank" rel="noopener noreferrer" className={OPTION_CLASS} aria-label={`Compartir en ${label} (se abre en una pestaña nueva)`}>
              {label}
              <ExternalLink className="h-3.5 w-3.5 shrink-0 text-neutral-400" aria-hidden="true" />
            </a>
          ))}
        </div>

        {nativeShareAvailable && (
          <button type="button" className={OPTION_CLASS} disabled={isCopying || isSharing} onClick={handleNativeShare}>
            <Share2 className="h-4 w-4" aria-hidden="true" />
            Más opciones
          </button>
        )}

        <div className="flex min-w-0 flex-col gap-2">
          <label htmlFor={urlId} className="text-sm text-neutral-400">Enlace del juego</label>
          <input
            ref={urlInput}
            id={urlId}
            type="text"
            readOnly
            value={data.url}
            onFocus={(event) => event.currentTarget.select()}
            className="w-full min-w-0 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400"
          />
        </div>
        <p role="status" aria-live="polite" className="min-h-5 text-sm text-neutral-300">{feedback}</p>
      </DialogContent>
    </Dialog>
  );
}
