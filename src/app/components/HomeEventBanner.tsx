import { Info, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { fetchBannerEvent, reportBannerEventAction, type ApiBannerEvent } from "../api/catalog";
import { trackGoogleAnalyticsEvent } from "./GoogleAnalytics";

type BannerEvent = ApiBannerEvent & { endsAt: number; dates: string };
type Vote = "yes" | "no";

const MAX_TIMEOUT_MS = 2_147_483_647;
const DISMISSED_BANNER_KEY = "ludora:home-event-banner-dismissed:v1";
const votesInCurrentDocument = new Set<string>();
let dismissedInCurrentDocument = false;

export function HomeEventBanner() {
  const [event, setEvent] = useState<BannerEvent | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (isDismissed || wasEventBannerDismissed()) return;

    const controller = new AbortController();
    let activeEvent: BannerEvent | null = null;
    let expirationTimer: number | undefined;

    function checkExpiration() {
      if (wasEventBannerDismissed()) {
        setIsDismissed(true);
        return;
      }
      if (!activeEvent) return;
      window.clearTimeout(expirationTimer);
      const remaining = activeEvent.endsAt - Date.now();
      if (remaining > 0) {
        expirationTimer = window.setTimeout(checkExpiration, Math.min(remaining, MAX_TIMEOUT_MS));
        return;
      }
      activeEvent = null;
      setEvent(null);
      void loadEvent();
    }

    async function loadEvent() {
      try {
        const data = await fetchBannerEvent(controller.signal);
        if (controller.signal.aborted || !data) return;
        const startsAt = Date.parse(data.starts_at);
        const endsAt = Date.parse(data.ends_at);
        if (!Number.isFinite(startsAt) || !(endsAt > Math.max(startsAt, Date.now()))) return;
        const link = new URL(data.link);
        if (link.protocol !== "https:" && link.protocol !== "http:") return;
        activeEvent = { ...data, endsAt, dates: formatEventDates(startsAt, endsAt, data.time_zone) };
        setEvent(activeEvent);
        checkExpiration();
      } catch {
        // The homepage can still display the catalog when events are unavailable.
      }
    }

    document.addEventListener("visibilitychange", checkExpiration);
    window.addEventListener("pageshow", checkExpiration);
    void loadEvent();
    return () => {
      controller.abort();
      window.clearTimeout(expirationTimer);
      document.removeEventListener("visibilitychange", checkExpiration);
      window.removeEventListener("pageshow", checkExpiration);
    };
  }, [isDismissed]);

  function dismissBanner() {
    if (!event || dismissedInCurrentDocument) return;
    dismissedInCurrentDocument = true;
    try {
      window.sessionStorage.setItem(DISMISSED_BANNER_KEY, "1");
    } catch {
      // The dismissal still applies across navigation within this document.
    }
    setIsDismissed(true);
    void reportBannerEventAction(event.id, "dismiss");
  }

  return !isDismissed && event && <EventNotice key={event.id} event={event} onDismiss={dismissBanner} />;
}

function EventNotice({ event, onDismiss }: { event: BannerEvent; onDismiss: () => void }) {
  const { id, name, dates, venue, city, country, link, endsAt } = event;
  const voteKey = `ludora:event-banner-vote:${id}`;
  const [hasVoted, setHasVoted] = useState(() => hasRecordedVote(voteKey));
  const voteRecorded = useRef(hasVoted);
  const hasImpression = useRef(false);
  const shouldFocusStatus = useRef(false);
  const bannerRef = useRef<HTMLElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const headingId = useId();
  const linkHintId = useId();
  const questionId = useId();

  useEffect(() => {
    const banner = bannerRef.current;
    if (!banner || typeof IntersectionObserver === "undefined" || hasImpression.current) return;
    const observer = new IntersectionObserver(entries => {
      if (hasImpression.current || document.visibilityState !== "visible" || Date.now() >= endsAt) return;
      if (!entries.some(entry => entry.isIntersecting && entry.intersectionRatio > 0)) return;
      hasImpression.current = true;
      observer.disconnect();
      trackGoogleAnalyticsEvent("event_banner_impression", { promoted_event_id: id });
    });
    const observeWhenVisible = () => {
      observer.disconnect();
      observer.takeRecords();
      if (!hasImpression.current && document.visibilityState === "visible") observer.observe(banner);
    };
    observeWhenVisible();
    document.addEventListener("visibilitychange", observeWhenVisible);
    return () => {
      document.removeEventListener("visibilitychange", observeWhenVisible);
      observer.disconnect();
    };
  }, [id, endsAt]);

  useEffect(() => {
    if (hasVoted && shouldFocusStatus.current) {
      shouldFocusStatus.current = false;
      statusRef.current?.focus({ preventScroll: true });
    }
  }, [hasVoted]);

  function trackClick() {
    if (Date.now() < endsAt) {
      void reportBannerEventAction(id, "click");
      trackGoogleAnalyticsEvent("event_banner_click", { promoted_event_id: id });
    }
  }

  function vote(response: Vote) {
    if (voteRecorded.current || Date.now() >= endsAt) return;
    voteRecorded.current = true;
    shouldFocusStatus.current = true;
    setHasVoted(true);
    if (hasRecordedVote(voteKey)) return;
    votesInCurrentDocument.add(voteKey);
    try {
      window.localStorage.setItem(voteKey, "1");
    } catch {
      // The in-memory vote survives client-side navigation.
    }
    const isPositive = response === "yes";
    void reportBannerEventAction(id, isPositive ? "positive" : "negative");
    trackGoogleAnalyticsEvent(isPositive ? "event_banner_vote_yes" : "event_banner_vote_no", {
      promoted_event_id: id,
    });
  }

  return (
    <div className="mb-4 px-3 md:mb-7 md:px-14">
      <section
        ref={bannerRef}
        aria-labelledby={headingId}
        className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2 rounded-lg border border-sky-400/30 bg-sky-500/10 px-3 py-2.5 text-sm md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center md:gap-x-4"
      >
        <div className="col-start-1 row-start-1 flex min-w-0 items-start gap-2">
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-sky-300" />
          <div className="min-w-0 [overflow-wrap:anywhere]">
            <p className="font-medium text-sky-100">Encontramos un evento próximo que podría interesarte:</p>
            <h2 id={headingId} className="mt-0.5 text-[0.8125rem]/4 font-semibold">
              <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                aria-describedby={linkHintId}
                onClick={trackClick}
                onAuxClick={click => { if (click.button === 1) trackClick(); }}
                className="rounded-sm text-sky-200 underline underline-offset-2 hover:text-white focus-visible:ring-2 focus-visible:ring-sky-200"
              >
                {name}
              </a>
            </h2>
            <span id={linkHintId} className="sr-only">Abre en una pestaña nueva</span>
            <p className="mt-0.5 text-xs text-sky-100/80">{dates} · {venue}, {city}, {country}</p>
          </div>
        </div>
        <div className="col-span-2 col-start-1 row-start-2 min-w-0 pl-6 md:col-span-1 md:col-start-2 md:row-start-1 md:justify-self-end md:pl-0">
          {!hasVoted && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 md:flex-nowrap">
              <p id={questionId} className="font-medium text-sky-100">¿Te parece útil esta información?</p>
              <div role="group" aria-labelledby={questionId} className="flex shrink-0 gap-2">
                <button type="button" aria-label="Me parece útil" onClick={() => vote("yes")} className={voteButtonClass}>
                  <ThumbsUp aria-hidden="true" className="size-4" />
                </button>
                <button type="button" aria-label="No me parece útil" onClick={() => vote("no")} className={voteButtonClass}>
                  <ThumbsDown aria-hidden="true" className="size-4" />
                </button>
              </div>
            </div>
          )}
          <p ref={statusRef} role="status" tabIndex={-1} className="text-sky-100">
            {hasVoted ? "Gracias por tu opinión" : null}
          </p>
        </div>
        <button
          type="button"
          aria-label="Cerrar aviso del evento"
          onClick={onDismiss}
          className="col-start-2 row-start-1 grid size-11 place-items-center rounded-md text-sky-200/80 hover:bg-sky-400/20 hover:text-white focus-visible:ring-2 focus-visible:ring-sky-200 md:col-start-3"
        >
          <X aria-hidden="true" className="size-5" />
        </button>
      </section>
    </div>
  );
}

const voteButtonClass = "grid size-11 place-items-center rounded-md border border-sky-400/40 bg-sky-500/10 text-sky-100 hover:bg-sky-400/20 focus-visible:ring-2 focus-visible:ring-sky-200";

function wasEventBannerDismissed(): boolean {
  if (dismissedInCurrentDocument) return true;
  try {
    return window.sessionStorage.getItem(DISMISSED_BANNER_KEY) === "1";
  } catch {
    return false;
  }
}

function hasRecordedVote(key: string): boolean {
  if (votesInCurrentDocument.has(key)) return true;
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function formatEventDates(startsAt: number, endsAt: number, timeZone: string): string {
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat("es-MX", { dateStyle: "long", timeZone });
  } catch {
    formatter = new Intl.DateTimeFormat("es-MX", { dateStyle: "long", timeZone: "UTC" });
  }
  return formatter.formatRange(startsAt, endsAt);
}
