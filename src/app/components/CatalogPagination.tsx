import { Link } from "react-router";
import type { CatalogPageData } from "../PrerenderData";

export function CatalogPagination({ model }: { model: CatalogPageData }) {
  if ((model.pageCount ?? 0) < 2) return null;
  return <nav aria-label="Paginación del catálogo" className="my-8 flex flex-wrap items-center gap-2 text-sm">
    {model.previousPath && <Link className="rounded border border-neutral-700 px-3 py-2 hover:border-fuchsia-400" to={model.previousPath}>Anterior</Link>}
    {model.pageLinks?.map((link, index) => link.path ? <Link key={link.page} to={link.path} aria-current={link.page === model.page ? "page" : undefined}
      className={`rounded border px-3 py-2 ${link.page === model.page ? "border-fuchsia-400 text-fuchsia-300" : "border-neutral-700 hover:border-fuchsia-400"}`}>
      {link.page}
    </Link> : <span key={`gap-${index}`} aria-hidden="true" className="px-1 text-neutral-500">…</span>)}
    {model.nextPath && <Link className="rounded border border-neutral-700 px-3 py-2 hover:border-fuchsia-400" to={model.nextPath}>Siguiente</Link>}
  </nav>;
}
