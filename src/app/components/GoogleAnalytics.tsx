import { useEffect } from "react";
import { useLocation } from "react-router";

const GA_MEASUREMENT_ID = "G-QGR5CKL5S4";
const GA_SCRIPT_ID = "google-analytics-gtag";

declare global {
  interface Window {
    dataLayer?: Array<IArguments | unknown[]>;
    gtag?: (...args: unknown[]) => void;
  }
}

function initializeGoogleAnalytics() {
  if (!import.meta.env.PROD) return;
  if (document.getElementById(GA_SCRIPT_ID)) return window.gtag;

  window.dataLayer = window.dataLayer ?? [];
  window.gtag =
    window.gtag ??
    function gtag() {
      window.dataLayer?.push(arguments);
    };
  window.gtag("js", new Date());
  window.gtag("config", GA_MEASUREMENT_ID, { send_page_view: false });

  const script = document.createElement("script");
  script.id = GA_SCRIPT_ID;
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);
  return window.gtag;
}

export function trackGoogleAnalyticsEvent(eventName: string, parameters: Record<string, unknown>) {
  initializeGoogleAnalytics()?.("event", eventName, parameters);
}

export function GoogleAnalytics() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    // Queue each route as it is visited, even while the Google tag is loading.
    trackGoogleAnalyticsEvent("page_view", {
      page_title: document.title,
      page_location: window.location.href,
      page_path: `${pathname}${search}`,
    });
  }, [pathname, search]);

  return null;
}
