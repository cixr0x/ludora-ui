import { BGG_FOOTER_LOGO_URL } from "../utils/siteFooter.js";
import { ContactFormDialog } from "./ContactFormDialog";

export function SiteFooter() {
  return (
    <footer className="bg-neutral-950 text-neutral-400">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-6 py-8 sm:flex-row sm:items-center sm:justify-between lg:px-8">
        <nav aria-label="Pie de página" className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
          <ContactFormDialog />
          <span>Aviso de Privacidad</span>
        </nav>

        <a
          href="https://boardgamegeek.com"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Con tecnología de BoardGameGeek"
          className="inline-flex w-fit items-center opacity-85 transition-opacity hover:opacity-100"
        >
          <img
            src={BGG_FOOTER_LOGO_URL}
            alt="Con tecnología de BoardGameGeek"
            className="h-10 w-auto"
            loading="lazy"
            decoding="async"
          />
        </a>
      </div>
    </footer>
  );
}
