import { productPath } from "./productRoutes.js";
import { DEFAULT_SITE_URL, siteRootUrl } from "./siteSeo.js";
import { productOfferSchema } from "./offerSeo.js";

export { DEFAULT_SITE_URL } from "./siteSeo.js";

export function productSeoMetadata(detail, siteUrl = DEFAULT_SITE_URL, canonicalPath = productPath(detail.id, detail.name)) {
  if (!new RegExp(`^/game/${detail.id}/[a-z0-9-]+$`).test(canonicalPath)) throw new Error("Invalid published product canonical");
  const canonicalUrl = new URL(canonicalPath, siteRootUrl(siteUrl)).href;
  const description = `Compara precios de ${detail.name} en tiendas de México. Consulta ofertas y disponibilidad y encuentra dónde comprarlo.`;
  const offers = productOfferSchema(detail.stores);
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        "@id": `${canonicalUrl}#product`,
        name: detail.name,
        url: canonicalUrl,
        image: detail.image || undefined,
        description: detail.description.join(" ") || description,
        category: detail.categories,
        productID: String(detail.id),
        ...(offers.length ? { offers } : {}),
        additionalProperty: [
          {
            "@type": "PropertyValue",
            name: "Jugadores",
            value: detail.players,
          },
          {
            "@type": "PropertyValue",
            name: "Duración",
            value: detail.playTime,
          },
          {
            "@type": "PropertyValue",
            name: "Complejidad",
            value: detail.complexity > 0 ? `${detail.complexity}/5` : "Sin registrar",
          },
        ],
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${canonicalUrl}#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Ludo Radar",
            item: siteRootUrl(siteUrl),
          },
          {
            "@type": "ListItem",
            position: 2,
            name: detail.name,
            item: canonicalUrl,
          },
        ],
      },
    ],
  };

  return {
    canonicalUrl,
    description,
    imageUrl: detail.image || "",
    structuredData,
    title: `${detail.name}: compara precios en México | Ludo Radar`,
  };
}
