import assert from "node:assert/strict";
import test from "node:test";

import { BGG_LOGO_URL, bggItemUrl } from "./bggLinks.js";

test("BGG_LOGO_URL uses the provided BoardGameGeek logo asset", () => {
  assert.equal(BGG_LOGO_URL, "https://cf.geekdo-static.com/images/logos/navbar-logo-bgg-b2.svg");
});

test("bggItemUrl returns only usable BGG item URLs", () => {
  assert.equal(
    bggItemUrl({ bgg_url: " https://boardgamegeek.com/boardgame/224517 " }),
    "https://boardgamegeek.com/boardgame/224517",
  );
  assert.equal(bggItemUrl({ bgg_url: "" }), undefined);
  assert.equal(bggItemUrl({}), undefined);
  assert.equal(bggItemUrl(undefined), undefined);
});
