import { productPath } from "./productRoutes.js";

export const DEFAULT_SITE_URL = "https://ludora.bobbycrimson.com";

export function productSeoMetadata(detail, siteUrl = DEFAULT_SITE_URL) {
  const canonicalUrl = new URL(productPath(detail.id, detail.name), normalizedSiteUrl(siteUrl)).href;
  const description = `${detail.name}: información para ${detail.players} jugadores, duración ${detail.playTime}, complejidad, descripción y disponibilidad en tiendas de México.`;
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
            item: normalizedSiteUrl(siteUrl),
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
    title: `${detail.name}: información y precios en México | Ludo Radar`,
  };
}

function normalizedSiteUrl(value) {
  return `${String(value || DEFAULT_SITE_URL).replace(/\/+$/, "")}/`;
}
