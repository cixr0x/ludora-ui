import { ArrowLeft } from "lucide-react";
import { Link } from "react-router";
import { SiteHeader } from "../components/SiteHeader";

const termsSections = [
  "Aceptación del servicio",
  "Uso permitido",
  "Contenido y disponibilidad",
  "Enlaces a tiendas externas",
  "Limitación de responsabilidad",
];

export function TermsOfService() {
  return (
    <div
      className="min-h-screen text-white"
      style={{
        background: "radial-gradient(ellipse 130% 38% at 50% -5%, rgba(217, 70, 239, 0.08) 0%, transparent 58%), rgb(10, 10, 10)",
      }}
    >
      <SiteHeader
        contextBar={
          <div className="flex h-12 items-center gap-4 border-t border-white/5 px-4 sm:px-8">
            <Link to="/" className="flex items-center gap-2 text-neutral-400 transition-colors hover:text-white">
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm">Inicio</span>
            </Link>
            <span className="text-neutral-700">|</span>
            <span className="text-sm text-white">Términos de Servicio</span>
          </div>
        }
      />

      <main className="mx-auto max-w-3xl px-6 py-12 lg:px-8">
        <p className="text-sm font-medium uppercase text-fuchsia-300">Documento legal</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-normal text-white sm:text-4xl">
          Términos de Servicio
        </h1>
        <p className="mt-5 text-base leading-7 text-neutral-300">
          Contenido pendiente de revisión legal.
        </p>

        <div className="mt-10 space-y-7">
          {termsSections.map((section) => (
            <section key={section} className="border-t border-white/10 pt-6">
              <h2 className="text-lg font-semibold text-white">{section}</h2>
              <p className="mt-3 text-sm leading-6 text-neutral-400">
                Contenido pendiente de revisión legal.
              </p>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
