import { useEffect } from "react";

import type { GameDetail } from "../data/games";
import { productSeoMetadata } from "../utils/productSeo.js";
import {
  DEFAULT_SITE_URL,
  HOME_DESCRIPTION,
  HOME_TITLE,
  siteRootUrl,
} from "../utils/siteSeo.js";

const STRUCTURED_DATA_ID = "product-structured-data";
const SITE_URL = (import.meta.env.VITE_LUDORA_SITE_URL as string | undefined) ?? DEFAULT_SITE_URL;

export function ProductMetadata({ detail }: { detail: GameDetail }) {
  useEffect(() => {
    const metadata = productSeoMetadata(detail, SITE_URL);
    document.title = metadata.title;
    setMeta("name", "description", metadata.description);
    setMeta("property", "og:title", metadata.title);
    setMeta("property", "og:description", metadata.description);
    setMeta("property", "og:type", "product");
    setMeta("property", "og:url", metadata.canonicalUrl);
    setMeta("name", "twitter:card", metadata.imageUrl ? "summary_large_image" : "summary");
    setMeta("name", "twitter:title", metadata.title);
    setMeta("name", "twitter:description", metadata.description);
    setOptionalMeta("property", "og:image", metadata.imageUrl);
    setOptionalMeta("name", "twitter:image", metadata.imageUrl);
    setCanonical(metadata.canonicalUrl);
    setStructuredData(metadata.structuredData);

    return resetProductMetadata;
  }, [detail]);

  return null;
}

function resetProductMetadata() {
  const homeUrl = siteRootUrl(SITE_URL);
  document.title = HOME_TITLE;
  setMeta("name", "description", HOME_DESCRIPTION);
  setMeta("property", "og:title", HOME_TITLE);
  setMeta("property", "og:description", HOME_DESCRIPTION);
  setMeta("property", "og:type", "website");
  setMeta("property", "og:url", homeUrl);
  setMeta("name", "twitter:card", "summary");
  setMeta("name", "twitter:title", HOME_TITLE);
  setMeta("name", "twitter:description", HOME_DESCRIPTION);
  setCanonical(homeUrl);
  removeHeadElement('meta[property="og:image"]');
  removeHeadElement('meta[name="twitter:image"]');
  document.getElementById(STRUCTURED_DATA_ID)?.remove();
}

function setMeta(attribute: "name" | "property", key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.content = content;
}

function setOptionalMeta(attribute: "name" | "property", key: string, content: string) {
  if (content) setMeta(attribute, key, content);
  else removeHeadElement(`meta[${attribute}="${key}"]`);
}

function setCanonical(href: string) {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!element) {
    element = document.createElement("link");
    element.rel = "canonical";
    document.head.appendChild(element);
  }
  element.href = href;
}

function setStructuredData(value: unknown) {
  let element = document.getElementById(STRUCTURED_DATA_ID) as HTMLScriptElement | null;
  if (!element) {
    element = document.createElement("script");
    element.id = STRUCTURED_DATA_ID;
    element.type = "application/ld+json";
    document.head.appendChild(element);
  }
  element.textContent = JSON.stringify(value);
}

function removeHeadElement(selector: string) {
  document.head.querySelector(selector)?.remove();
}
