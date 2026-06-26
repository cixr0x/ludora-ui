import { BGG_FOOTER_LOGO_URL } from "../utils/siteFooter.js";

export function SiteFooter() {
  return (
    <footer className="bg-neutral-950 text-neutral-400">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-6 py-8 sm:flex-row sm:items-center sm:justify-between lg:px-8">
        <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
          <span>Contact</span>
          <span>Aviso de Privacidad</span>
        </nav>

        <a
          href="https://boardgamegeek.com"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Powered by BoardGameGeek"
          className="inline-flex w-fit items-center opacity-85 transition-opacity hover:opacity-100"
        >
          <img
            src={BGG_FOOTER_LOGO_URL}
            alt="Powered by BoardGameGeek"
            className="h-10 w-auto"
            loading="lazy"
            decoding="async"
          />
        </a>
      </div>
    </footer>
  );
}
