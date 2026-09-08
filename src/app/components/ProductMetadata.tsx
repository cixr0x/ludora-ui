import { useEffect } from "react";
import { useLocation } from "react-router";

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
const INDEXING_ENABLED = typeof document !== "undefined" && document.querySelector('meta[name="robots"]')?.getAttribute("content")?.startsWith("index") === true;

export function ProductMetadata({ detail, canonicalPath }: { detail: GameDetail; canonicalPath?: string }) {
  useEffect(() => resetProductMetadata, []);
  useEffect(() => {
    const metadata = productSeoMetadata(detail, SITE_URL, canonicalPath);
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
    setMeta("name", "robots", INDEXING_ENABLED ? "index, follow" : "noindex, nofollow");

  }, [detail, canonicalPath]);

  return null;
}

export function resetProductMetadata() {
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
  setMeta("name", "robots", INDEXING_ENABLED ? "index, follow" : "noindex, nofollow");
}

export function applyPageMetadata(metadata: { title: string; description: string; canonicalPath: string }, indexingEnabled: boolean) {
  resetProductMetadata();
  const url = new URL(metadata.canonicalPath, siteRootUrl(SITE_URL)).href;
  document.title = metadata.title;
  for (const key of ["description", "twitter:description"]) setMeta("name", key, metadata.description);
  setMeta("name", "twitter:title", metadata.title);
  setMeta("property", "og:title", metadata.title);
  setMeta("property", "og:description", metadata.description);
  setMeta("property", "og:url", url);
  setCanonical(url);
  setMeta("name", "robots", !INDEXING_ENABLED ? "noindex, nofollow" : indexingEnabled ? "index, follow" : "noindex, follow");
}

export function RouteMetadata() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (/^\/(?:game|juegos-de-mesa|categorias|categoria)(?:\/|$)/.test(pathname)) return;
    if (pathname === "/") resetProductMetadata();
    else applyPageMetadata({ title: HOME_TITLE, description: HOME_DESCRIPTION, canonicalPath: "/" }, false);
  }, [pathname]);
  return null;
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
