import { Link } from "react-router";
import { BGG_FOOTER_LOGO_URL } from "../utils/siteFooter.js";
import { ContactFormDialog } from "./ContactFormDialog";

export function SiteFooter() {
  return (
    <footer className="bg-neutral-950 text-neutral-400">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 md:flex-row md:items-center md:justify-between md:gap-5 md:px-6 md:py-8 lg:px-8">
        <nav aria-label="Pie de página" className="flex flex-wrap items-center gap-x-4 gap-y-2.5 text-sm md:gap-x-6 md:gap-y-3">
          <ContactFormDialog />
          <Link to="/privacidad" className="transition-colors hover:text-white">
            Aviso de Privacidad
          </Link>
          <Link to="/terminos" className="transition-colors hover:text-white">
            Términos de Servicio
          </Link>
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
            className="h-[2.6rem] w-auto md:h-[3.25rem]"
            loading="lazy"
            decoding="async"
          />
        </a>
      </div>
    </footer>
  );
}
