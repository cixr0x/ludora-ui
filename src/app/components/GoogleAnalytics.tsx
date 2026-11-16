import { useEffect } from "react";

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
  window.gtag("config", GA_MEASUREMENT_ID);

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
  useEffect(() => {
    initializeGoogleAnalytics();
  }, []);

  return null;
}
