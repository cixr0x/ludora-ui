import assert from "node:assert/strict";
import test from "node:test";

import { tiktokTutorialFromUrl, youtubeIdFromUrl } from "./tutorialLinks.js";

test("extracts TikTok tutorial id and user from canonical video URLs", () => {
  assert.deepEqual(
    tiktokTutorialFromUrl("https://www.tiktok.com/@lacaravanacdmx/video/7296316474635963653"),
    {
      id: "7296316474635963653",
      user: "lacaravanacdmx",
    },
  );
});

test("extracts YouTube video ids from watch URLs", () => {
  assert.equal(youtubeIdFromUrl("https://www.youtube.com/watch?v=zFHqkHhpVSc"), "zFHqkHhpVSc");
});
