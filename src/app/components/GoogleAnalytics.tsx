import { useEffect } from "react";
import { useLocation } from "react-router";

const GA_MEASUREMENT_ID = "G-5F9KFSSE0M";
const GA_SCRIPT_ID = "google-analytics-gtag";

declare global {
  interface Window {
    dataLayer?: unknown[][];
    gtag?: (...args: unknown[]) => void;
  }
}

function installGtag() {
  window.dataLayer = window.dataLayer ?? [];
  window.gtag =
    window.gtag ??
    ((...args: unknown[]) => {
      window.dataLayer?.push(args);
    });
}

function loadGtagScript() {
  if (document.getElementById(GA_SCRIPT_ID)) return;

  const script = document.createElement("script");
  script.id = GA_SCRIPT_ID;
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);
}

export function GoogleAnalytics() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    if (!import.meta.env.PROD) return;

    installGtag();
    loadGtagScript();
    window.gtag?.("js", new Date());
    window.gtag?.("config", GA_MEASUREMENT_ID, { send_page_view: false });
  }, []);

  useEffect(() => {
    if (!import.meta.env.PROD) return;

    installGtag();
    window.gtag?.("event", "page_view", {
      page_title: document.title,
      page_location: window.location.href,
      page_path: `${pathname}${search}`,
    });
  }, [pathname, search]);

  return null;
}
