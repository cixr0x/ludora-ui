import { ArrowUpRight } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { fetchBannerEvent, type ApiBannerEvent } from "../api/catalog";
import { trackGoogleAnalyticsEvent } from "./GoogleAnalytics";

type BannerEvent = ApiBannerEvent & { endsAt: number; dates: string };
type Vote = "yes" | "no";

const MAX_TIMEOUT_MS = 2_147_483_647;
const votesInCurrentDocument = new Set<string>();

export function HomeEventBanner() {
  const [event, setEvent] = useState<BannerEvent | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let activeEvent: BannerEvent | null = null;
    let expirationTimer: number | undefined;

    function checkExpiration() {
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
  }, []);

  return event && <EventNotice key={event.id} event={event} />;
}

function EventNotice({ event }: { event: BannerEvent }) {
  const { id, name, dates, venue, city, country, link, endsAt } = event;
  const voteKey = `ludora:event-banner-vote:${id}`;
  const [hasVoted, setHasVoted] = useState(() => hasRecordedVote(voteKey));
  const voteRecorded = useRef(hasVoted);
  const hasImpression = useRef(false);
  const shouldFocusStatus = useRef(false);
  const bannerRef = useRef<HTMLElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const headingId = useId();
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
    trackGoogleAnalyticsEvent(response === "yes" ? "event_banner_vote_yes" : "event_banner_vote_no", {
      promoted_event_id: id,
    });
  }

  return (
    <div className="mb-4 px-3 md:mb-7 md:px-14">
      <section
        ref={bannerRef}
        aria-labelledby={headingId}
        className="rounded-lg border border-fuchsia-500/20 bg-fuchsia-500/5 px-3 py-2.5 text-sm"
      >
        <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-1">
          <div>
            <p className="text-xs text-neutral-400">Un evento de juegos de mesa que podría interesarte</p>
            <h2 id={headingId} className="font-semibold text-white">{name}</h2>
            <p className="mt-0.5 text-neutral-300">{dates} · {venue}, {city}, {country}</p>
          </div>
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={trackClick}
            onAuxClick={click => { if (click.button === 1) trackClick(); }}
            className="inline-flex min-h-9 items-center gap-1 rounded text-fuchsia-300 underline underline-offset-4 hover:text-fuchsia-200 focus-visible:ring-2 focus-visible:ring-fuchsia-300"
          >
            Ver detalles del evento
            <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
            <span className="sr-only"> (abre en una pestaña nueva)</span>
          </a>
        </div>
        <div className="mt-1.5 border-t border-fuchsia-500/15 pt-1.5">
          {!hasVoted && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <p id={questionId} className="text-neutral-400">¿Te gustaría ver más avisos de eventos como este?</p>
              <div role="group" aria-labelledby={questionId} className="flex gap-2">
                <button type="button" onClick={() => vote("yes")} className={voteButtonClass}>Sí</button>
                <button type="button" onClick={() => vote("no")} className={voteButtonClass}>No</button>
              </div>
            </div>
          )}
          <p ref={statusRef} role="status" tabIndex={-1} className="text-neutral-300">
            {hasVoted ? "Gracias por tu opinión" : null}
          </p>
        </div>
      </section>
    </div>
  );
}

const voteButtonClass = "min-h-8 min-w-11 rounded border border-neutral-700 px-2 font-medium text-neutral-200 hover:border-fuchsia-300 hover:text-white focus-visible:ring-2 focus-visible:ring-fuchsia-300";

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
