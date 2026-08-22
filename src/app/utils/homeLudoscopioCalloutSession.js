const HOME_LUDOSCOPIO_CALLOUT_DISMISSED_KEY = "ludora:home-ludoscopio-callout-dismissed:v1";

export function isHomeLudoscopioCalloutDismissed(storage = browserSessionStorage()) {
  try {
    return storage?.getItem(HOME_LUDOSCOPIO_CALLOUT_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function dismissHomeLudoscopioCallout(storage = browserSessionStorage()) {
  try {
    storage?.setItem(HOME_LUDOSCOPIO_CALLOUT_DISMISSED_KEY, "1");
  } catch {
  }
}

function browserSessionStorage() {
  try {
    return typeof window === "undefined" ? undefined : window.sessionStorage;
  } catch {
    return undefined;
  }
}
