import assert from "node:assert/strict";
import test from "node:test";

import {
  dismissHomeLudoscopioCallout,
  isHomeLudoscopioCalloutDismissed,
} from "./homeLudoscopioCalloutSession.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

test("home Ludoscopio callout remains visible until dismissed in the session", () => {
  const storage = memoryStorage();

  assert.equal(isHomeLudoscopioCalloutDismissed(storage), false);

  dismissHomeLudoscopioCallout(storage);

  assert.equal(isHomeLudoscopioCalloutDismissed(storage), true);
});

test("home Ludoscopio callout stays usable when session storage is unavailable", () => {
  const storage = {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
  };

  assert.doesNotThrow(() => dismissHomeLudoscopioCallout(storage));
  assert.equal(isHomeLudoscopioCalloutDismissed(storage), false);
});
