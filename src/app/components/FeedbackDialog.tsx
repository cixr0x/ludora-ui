import { ArrowLeft, ChevronRight, Flag, Lightbulb, MessageCircle, MessageSquareHeart } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";

import { submitContactForm } from "../api/catalog";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Label } from "./ui/label";

export type FeedbackGame = { id: number; name: string };

const feedbackOptions = [
  {
    email: "correccion@ludoradar.mx",
    title: "Reportar información incorrecta",
    subtitle: "Datos de juegos, precios, tiendas o enlaces.",
    starter: (game?: FeedbackGame) => game
      ? `Encontré el siguiente error sobre el juego «${game.name}» (ID ${game.id}): `
      : "La información que encontré incorrecta es…",
    icon: Flag,
  },
  {
    email: "sugerencia@ludoradar.mx",
    title: "Sugerir una funcionalidad",
    subtitle: "Comparte tus ideas para mejorar la plataforma.",
    starter: () => "Me gustaría que Ludo Radar pudiera…",
    icon: Lightbulb,
  },
  {
    email: "comentario@ludoradar.mx",
    title: "Enviar un comentario",
    subtitle: "Cuéntanos tu experiencia con Ludo Radar.",
    starter: () => "Quiero compartir que…",
    icon: MessageCircle,
  },
];

type FeedbackOption = (typeof feedbackOptions)[number];
type FeedbackSelection = { option: FeedbackOption; starter: string };

export function FeedbackDialog({ game }: { game?: FeedbackGame }) {
  const [selection, setSelection] = useState<FeedbackSelection | null>(null);
  const returnFocusTo = useRef<FeedbackOption>();

  return (
    <Dialog onOpenChange={(open) => {
      if (open) {
        returnFocusTo.current = undefined;
        setSelection(null);
      }
    }}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="fixed right-[calc(1rem+env(safe-area-inset-right))] bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-fuchsia-700 px-4 py-2 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-fuchsia-600 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-fuchsia-400"
        >
          <MessageSquareHeart className="size-4" aria-hidden="true" />
          Ayúdanos a mejorar
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border-neutral-700 bg-neutral-950 p-4 text-neutral-100 sm:max-w-lg sm:p-6">
        <DialogHeader className="pr-7 text-left">
          <DialogTitle className="flex items-start gap-2 text-base leading-snug sm:text-lg">
            <MessageSquareHeart className="mt-0.5 size-4 shrink-0 text-fuchsia-400" aria-hidden="true" />
            {selection?.option.title ?? "Ayúdanos a mejorar"}
          </DialogTitle>
          <DialogDescription className="text-neutral-300">
            {selection?.option.subtitle ?? "¿Encontraste información incorrecta o tienes una idea para mejorar Ludo Radar? ¡Queremos escucharte!"}
          </DialogDescription>
        </DialogHeader>

        {selection ? (
          <FeedbackForm selection={selection} onBack={() => setSelection(null)} />
        ) : (
          <div className="grid gap-3">
            {feedbackOptions.map((option) => (
              <button
                key={option.email}
                type="button"
                autoFocus={returnFocusTo.current === option}
                className="grid cursor-pointer grid-cols-[1rem_minmax(0,1fr)_1rem] items-start gap-x-2.5 rounded-xl border border-neutral-700 bg-neutral-900 p-3 text-left transition-colors hover:border-fuchsia-500 hover:bg-neutral-800/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fuchsia-400"
                onClick={() => {
                  returnFocusTo.current = option;
                  setSelection({ option, starter: option.starter(game) });
                }}
              >
                <option.icon className="mt-0.5 size-4 text-neutral-300" aria-hidden="true" />
                <span className="text-sm leading-snug font-semibold sm:text-base">{option.title}</span>
                <ChevronRight className="mt-0.5 size-4 text-neutral-400" aria-hidden="true" />
                <span className="col-span-3 mt-1.5 text-sm font-normal text-neutral-300">{option.subtitle}</span>
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function FeedbackForm({ selection, onBack }: { selection: FeedbackSelection; onBack: () => void }) {
  const messageId = useId();
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const [message, setMessage] = useState(selection.starter);
  const [status, setStatus] = useState<"idle" | "empty" | "submitting" | "failed" | "success">("idle");
  const isSubmitting = status === "submitting";

  useEffect(() => {
    const field = messageRef.current;
    if (!field) return;
    field.focus();
    field.setSelectionRange(field.value.length, field.value.length);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    if (!message.trim()) {
      setStatus("empty");
      messageRef.current?.focus();
      return;
    }

    setStatus("submitting");
    try {
      await submitContactForm({ name: "Ludo Radar", email: selection.option.email, message });
      setStatus("success");
    } catch {
      setStatus("failed");
    }
  }

  if (status === "success") {
    return (
      <>
        <p role="status" className="text-sm text-emerald-300">Mensaje enviado.</p>
        <DialogFooter>
          <DialogClose autoFocus className="min-h-9 cursor-pointer rounded-md bg-fuchsia-700 px-4 py-2 text-sm text-white hover:bg-fuchsia-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fuchsia-400">
            Listo
          </DialogClose>
        </DialogFooter>
      </>
    );
  }

  return (
    <form className="grid gap-3" onSubmit={handleSubmit}>
      <div className="grid gap-2">
        <Label htmlFor={messageId}>Mensaje</Label>
        <textarea
          ref={messageRef}
          id={messageId}
          name="message"
          rows={5}
          value={message}
          onChange={(event) => {
            setMessage(event.target.value);
            if (status === "empty") setStatus("idle");
          }}
          readOnly={isSubmitting}
          aria-invalid={status === "empty"}
          className="w-full resize-y rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-base text-neutral-100 focus-visible:outline-2 focus-visible:outline-fuchsia-400"
        />
      </div>
      {status === "empty" && (
        <p role="alert" className="text-sm text-red-300">Escribe un mensaje antes de enviarlo.</p>
      )}
      {status === "failed" && (
        <p role="alert" className="text-sm text-red-300">No pudimos enviar el mensaje. Intenta de nuevo.</p>
      )}
      <DialogFooter className="flex-row justify-between sm:justify-between">
        <Button type="button" variant="ghost" onClick={onBack} className="cursor-pointer text-neutral-300 hover:bg-neutral-800 hover:text-white focus-visible:ring-fuchsia-400/70">
          <ArrowLeft aria-hidden="true" />
          Volver
        </Button>
        <Button type="submit" disabled={isSubmitting} className="cursor-pointer bg-fuchsia-700 text-white hover:bg-fuchsia-600 focus-visible:ring-fuchsia-400/70">
          {isSubmitting ? "Enviando…" : "Enviar"}
        </Button>
      </DialogFooter>
    </form>
  );
}
