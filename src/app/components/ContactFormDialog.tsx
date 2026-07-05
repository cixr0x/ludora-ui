import { useId, useState, type FormEvent } from "react";

import { submitContactForm } from "../api/catalog";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";

type ContactFormState = {
  email: string;
  message: string;
  name: string;
};

const initialFormState: ContactFormState = {
  email: "",
  message: "",
  name: "",
};

export function ContactFormDialog() {
  const emailId = useId();
  const messageId = useId();
  const nameId = useId();
  const [form, setForm] = useState<ContactFormState>(initialFormState);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submission = {
      email: form.email.trim(),
      message: form.message.trim(),
      name: form.name.trim(),
    };

    if (!submission.name || !validEmail(submission.email) || !submission.message) {
      setSuccessMessage("");
      setError("Completa tu nombre, un email valido y el mensaje.");
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      await submitContactForm(submission);
      setForm(initialFormState);
      setSuccessMessage("Mensaje enviado.");
    } catch {
      setSuccessMessage("");
      setError("No pudimos enviar el mensaje. Intenta de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="text-left text-sm text-neutral-400 transition-colors hover:text-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500"
        >
          Contact
        </button>
      </DialogTrigger>
      <DialogContent className="bg-neutral-950 text-neutral-100 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Contact</DialogTitle>
          <DialogDescription>Tell us what you need from Ludora.</DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor={nameId}>Name</Label>
            <Input
              id={nameId}
              name="name"
              autoComplete="name"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              disabled={isSubmitting}
              aria-invalid={Boolean(error && !form.name.trim())}
              className="bg-neutral-100 text-neutral-950"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor={emailId}>Email</Label>
            <Input
              id={emailId}
              name="email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              disabled={isSubmitting}
              aria-invalid={Boolean(error && !validEmail(form.email.trim()))}
              className="bg-neutral-100 text-neutral-950"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor={messageId}>Message</Label>
            <Textarea
              id={messageId}
              name="message"
              value={form.message}
              onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))}
              disabled={isSubmitting}
              aria-invalid={Boolean(error && !form.message.trim())}
              className="min-h-32 bg-neutral-100 text-neutral-950"
            />
          </div>

          {error ? <p className="text-sm text-red-300">{error}</p> : null}
          {successMessage ? <p className="text-sm text-emerald-300">{successMessage}</p> : null}

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Sending..." : "Send"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
