import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { usePrerenderedCatalogPage, type CatalogPageData } from "../PrerenderData";
import { catalogSeoMetadata, parseCatalogDocument } from "../utils/catalogSeo.js";
import { formatStorePrice } from "../utils/priceFormat.js";
import { applyPageMetadata, resetProductMetadata } from "./ProductMetadata";
import { CatalogPagination } from "./CatalogPagination";
import { SiteHeader } from "./SiteHeader";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { Search } from "../pages/Search";

function CatalogMetadata({ model }: { model: CatalogPageData }) {
  const { search } = useLocation();
  useEffect(() => {
    applyPageMetadata({ ...catalogSeoMetadata(model), canonicalPath: model.canonicalPath }, model.indexingEnabled && !search);
    return resetProductMetadata;
  }, [model, search]);
  return null;
}

export function CatalogPage() {
  const embedded = usePrerenderedCatalogPage();
  const location = useLocation();
  const navigate = useNavigate();
  const [model, setModel] = useState<CatalogPageData | undefined>(() => embedded?.canonicalPath === location.pathname ? embedded : undefined);
  const [failedPath, setFailedPath] = useState<string>();
  const current = model?.canonicalPath === location.pathname ? model : undefined;
  useEffect(() => {
    if (model?.canonicalPath === location.pathname) return;
    if (embedded?.canonicalPath === location.pathname) { setModel(embedded); return; }
    const controller = new AbortController();
    setFailedPath(undefined);
    fetch(location.pathname, { signal: controller.signal, cache: "no-store", headers: { Accept: "text/html" } })
      .then(async response => {
        if (!response.ok) throw new Error("Catalog page unavailable");
        const target = new URL(response.url);
        if (target.origin !== window.location.origin) throw new Error("Unexpected catalog origin");
        const next = parseCatalogDocument(await response.text(), target.pathname) as CatalogPageData;
        if (controller.signal.aborted) return;
        setModel(next);
        if (target.pathname !== location.pathname) navigate(target.pathname, { replace: true });
      }).catch(() => { if (!controller.signal.aborted) setFailedPath(location.pathname); });
    return () => controller.abort();
  }, [location.pathname, embedded, navigate]);
  useEffect(() => {
    if (failedPath === location.pathname) applyPageMetadata({ title: "Página no encontrada | Ludo Radar",
      description: "Esta página del catálogo no está disponible.", canonicalPath: location.pathname }, false);
  }, [failedPath, location.pathname]);

  const metadata = current ? catalogSeoMetadata(current) : null;
  if (current?.kind === "category") return <>
    <CatalogMetadata model={current} />
    <Search key={current.canonicalPath} categoryPage={current} />
  </>;
  return <div className="min-h-screen bg-neutral-950 text-white">
    <SiteHeader />
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
      {current && metadata ? <>
        <CatalogMetadata model={current} />
        <h1 className="text-2xl font-bold md:text-3xl">{metadata.heading}</h1>
        <p className="mt-3 max-w-3xl text-neutral-300">{metadata.description}</p>
        {current.kind === "categories" ? <ul className="mt-8 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {current.categories?.map(category => <li key={category.id}>
            <Link className="block rounded-lg border border-neutral-800 bg-neutral-900 p-5 hover:border-fuchsia-400" to={category.canonicalPath}>
              <h2 className="text-fuchsia-300">{category.name}</h2><p className="mt-1 text-sm text-neutral-400">{category.count} juegos</p>
            </Link>
          </li>)}
        </ul> : <>
          <CatalogPagination model={current} />
          <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4" aria-label="Juegos del catálogo">
            {current.items?.map(game => <li key={game.id}>
              <Link className="block h-full rounded-lg border border-neutral-800 bg-neutral-900 p-4 hover:border-fuchsia-400" to={game.canonicalPath}>
                {game.image ? <ImageWithFallback src={game.image} alt={game.name} className="mb-3 h-36 w-full object-contain" />
                  : <div aria-hidden="true" className="mb-3 flex h-36 w-full items-center justify-center rounded bg-neutral-800 text-center text-xs text-neutral-500">Imagen no disponible</div>}
                <h2 className="text-sm font-semibold text-white">{game.name}</h2>
                <p className="mt-2 text-xs text-fuchsia-300">{game.minimumPrice !== null
                  ? `Desde ${formatStorePrice(game.minimumPrice, "MXN")} MXN, sin envío.` : "Sin precio disponible confirmado en MXN."}</p>
              </Link>
            </li>)}
          </ul>
          <CatalogPagination model={current} />
        </>}
      </> : failedPath === location.pathname ? <><h1 className="text-2xl">Página no encontrada</h1>
        <Link className="mt-4 inline-block text-fuchsia-300" to="/juegos-de-mesa">Ver catálogo de juegos</Link></>
        : <p role="status">Cargando catálogo...</p>}
    </main>
  </div>;
}
