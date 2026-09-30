import { productSeoMetadata } from "./productSeo.js";

export function productShareData(detail, siteUrl, canonicalPath) {
  const { canonicalUrl } = productSeoMetadata(detail, siteUrl, canonicalPath);
  return {
    title: `${detail.name} | Ludo Radar`,
    text: `Consulta ${detail.name} en Ludo Radar.`,
    url: canonicalUrl,
  };
}

export function socialShareLinks({ url, title, text }) {
  return [
    { label: "Facebook", endpoint: "https://www.facebook.com/sharer/sharer.php", parameters: { u: url } },
    { label: "X / Twitter", endpoint: "https://twitter.com/intent/tweet", parameters: { url, text } },
    { label: "Reddit", endpoint: "https://www.reddit.com/submit", parameters: { url, title } },
    { label: "WhatsApp", endpoint: "https://wa.me/", parameters: { text: `${text} ${url}` } },
    { label: "Telegram", endpoint: "https://t.me/share/url", parameters: { url, text } },
  ].map(({ label, endpoint, parameters }) => {
    const destination = new URL(endpoint);
    destination.search = new URLSearchParams(parameters).toString();
    return { label, href: destination.href };
  });
}

export async function copyProductLink(url, browser) {
  if (typeof browser?.clipboard?.writeText !== "function") return "manual";
  try {
    await browser.clipboard.writeText(url);
    return "copied";
  } catch {
    return "manual";
  }
}

export function canNativeShare(data, browser) {
  if (typeof browser?.share !== "function") return false;
  try {
    return typeof browser.canShare !== "function" || browser.canShare(data);
  } catch {
    return false;
  }
}

export async function shareProduct(data, browser) {
  if (!canNativeShare(data, browser)) return "unavailable";
  try {
    // Call before awaiting anything so a button click retains user activation.
    await browser.share(data);
    return "shared";
  } catch (error) {
    return error?.name === "AbortError" ? "cancelled" : "error";
  }
}
