// A LISTED, non-bundle association is the existing reviewed product identity.
// Language alone never establishes an edition and no aggregate range is emitted.
export function pricingOffers(stores) {
  return eligibleOffers(stores).filter(store => store.availabilityStatus === "available" && store.inStock === true);
}

export function productOfferSchema(stores) {
  return eligibleOffers(stores).map(store => {
    const offer = {
      "@type": "Offer",
      price: store.priceValue,
      priceCurrency: store.currency,
      url: listingUrl(store),
      seller: { "@type": "Organization", name: store.name.trim() },
    };
    if (store.availabilityStatus === "available" && store.inStock === true) {
      offer.availability = "https://schema.org/InStock";
    } else if (store.availabilityStatus === "out_of_stock") {
      offer.availability = "https://schema.org/OutOfStock";
    }
    return offer;
  });
}

function eligibleOffers(stores) {
  return (Array.isArray(stores) ? stores : []).filter(store =>
    store && store.storeActive === true && store.listingStatus === "LISTED" && store.isBundle === false &&
    typeof store.name === "string" && store.name.trim() &&
    typeof store.priceValue === "number" && Number.isFinite(store.priceValue) && store.priceValue > 0 &&
    store.currency === "MXN" && publicListingUrl(listingUrl(store))
  );
}

function listingUrl(store) {
  // Mapped offers always carry this property, even when only a store-homepage URL exists.
  return Object.hasOwn(store, "listingUrl") ? store.listingUrl : store.url;
}

function publicListingUrl(value) {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return false;
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    // Listings use public hostnames; reject IP literals and local-only domains.
    return host.includes(".") && !host.includes(":") && !/^\d+\.\d+\.\d+\.\d+$/.test(host) &&
      !host.endsWith(".localhost") && !host.endsWith(".local") && !host.endsWith(".internal");
  } catch { return false; }
}
