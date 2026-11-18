import { useState, type Dispatch, type SetStateAction } from "react";
import { Outlet, useLocation } from "react-router";
import { FeedbackDialog, type FeedbackGame } from "./components/FeedbackDialog";
import { GoogleAnalytics } from "./components/GoogleAnalytics";
import { ScrollToTop } from "./components/ScrollToTop";
import { SiteFooter } from "./components/SiteFooter";
import { RouteMetadata } from "./components/ProductMetadata";

type RouteFeedbackGame = FeedbackGame & { locationKey: string };
export type FeedbackOutletContext = Dispatch<SetStateAction<RouteFeedbackGame | undefined>>;

export function Root() {
  const { key } = useLocation();
  const [feedbackGame, setFeedbackGame] = useState<RouteFeedbackGame>();

  return (
    <>
      <GoogleAnalytics />
      <RouteMetadata />
      <ScrollToTop />
      <Outlet context={setFeedbackGame} />
      <SiteFooter />
      <FeedbackDialog game={feedbackGame?.locationKey === key ? feedbackGame : undefined} />
    </>
  );
}
