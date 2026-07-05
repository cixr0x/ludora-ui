# Ludoscopio Session Restore Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore Ludoscopio prompt and semantic result rows from session storage when users return from a product detail page.

**Architecture:** Add a small `sessionStorage` utility for Ludoscopio cache reads, writes, validation, and clearing. Wire `Search.tsx` to initialize semantic state from the utility, write the cache after successful semantic searches, and clear it from the existing clear-all action.

**Tech Stack:** React 18, React Router 7, Vite, Node test runner, browser `sessionStorage`.

---

### Task 1: Add Ludoscopio Session Cache Utility

**Files:**
- Create: `src/app/utils/ludoscopioSessionCache.js`
- Test: `src/app/utils/ludoscopioSessionCache.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `src/app/utils/ludoscopioSessionCache.test.mjs`:

```js
import assert from "node:assert/strict";
import test from "node:test";

import {
  clearLudoscopioSessionCache,
  readLudoscopioSessionCache,
  writeLudoscopioSessionCache,
} from "./ludoscopioSessionCache.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, String(value)),
  };
}

const validResult = {
  id: 7,
  name: "Cascadia",
  altTitle: "Cascadia EN",
  image: "cascadia.webp",
  isExpansion: false,
  genres: ["Animals"],
  categories: [{ id: 1, name: "Animals" }],
  mechanics: [{ id: 2, name: "Tile Placement" }],
  categoryNames: ["Animals"],
  mechanicNames: ["Tile Placement"],
  minPlayers: 1,
  maxPlayers: 4,
  minMinutes: 30,
  maxMinutes: 45,
  complexity: 2,
};

test("ludoscopio session cache stores and restores prompt plus semantic results", () => {
  const storage = memoryStorage();

  writeLudoscopioSessionCache(" juegos familiares con animales ", [validResult], storage);

  assert.deepEqual(readLudoscopioSessionCache(storage), {
    prompt: "juegos familiares con animales",
    results: [validResult],
  });
});

test("ludoscopio session cache ignores malformed payloads", () => {
  const storage = memoryStorage();
  storage.setItem("ludora:ludoscopio:session:v1", JSON.stringify({ prompt: "", results: [{ id: "bad" }] }));

  assert.equal(readLudoscopioSessionCache(storage), null);
});

test("ludoscopio session cache can be cleared", () => {
  const storage = memoryStorage();
  writeLudoscopioSessionCache("party games", [validResult], storage);

  clearLudoscopioSessionCache(storage);

  assert.equal(readLudoscopioSessionCache(storage), null);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm.cmd test -- src/app/utils/ludoscopioSessionCache.test.mjs`

Expected: FAIL because `src/app/utils/ludoscopioSessionCache.js` does not exist.

- [ ] **Step 3: Write the minimal implementation**

Create `src/app/utils/ludoscopioSessionCache.js`:

```js
const LUDOSCOPIO_SESSION_CACHE_KEY = "ludora:ludoscopio:session:v1";

export function readLudoscopioSessionCache(storage = browserSessionStorage()) {
  try {
    const raw = storage?.getItem(LUDOSCOPIO_SESSION_CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!isValidSessionCache(parsed)) return null;

    return parsed;
  } catch {
    return null;
  }
}

export function writeLudoscopioSessionCache(prompt, results, storage = browserSessionStorage()) {
  const normalizedPrompt = typeof prompt === "string" ? prompt.trim() : "";
  if (!normalizedPrompt || !Array.isArray(results) || !storage) return;

  try {
    storage.setItem(
      LUDOSCOPIO_SESSION_CACHE_KEY,
      JSON.stringify({ prompt: normalizedPrompt, results }),
    );
  } catch {
  }
}

export function clearLudoscopioSessionCache(storage = browserSessionStorage()) {
  try {
    storage?.removeItem(LUDOSCOPIO_SESSION_CACHE_KEY);
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

function isValidSessionCache(value) {
  return (
    value &&
    typeof value.prompt === "string" &&
    value.prompt.trim().length > 0 &&
    Array.isArray(value.results) &&
    value.results.every(isValidSemanticResult)
  );
}

function isValidSemanticResult(value) {
  return (
    value &&
    Number.isInteger(value.id) &&
    typeof value.name === "string" &&
    Array.isArray(value.genres) &&
    Array.isArray(value.categories) &&
    Array.isArray(value.mechanics) &&
    Array.isArray(value.categoryNames) &&
    Array.isArray(value.mechanicNames) &&
    typeof value.minPlayers === "number" &&
    typeof value.maxPlayers === "number" &&
    nullableNumber(value.minMinutes) &&
    nullableNumber(value.maxMinutes) &&
    typeof value.complexity === "number"
  );
}

function nullableNumber(value) {
  return value === null || typeof value === "number";
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm.cmd test -- src/app/utils/ludoscopioSessionCache.test.mjs`

Expected: PASS.

### Task 2: Wire Search Page to Session Cache

**Files:**
- Modify: `src/app/pages/Search.tsx`
- Modify: `src/app/utils/lightweightCatalogSource.test.mjs`

- [ ] **Step 1: Write the failing source-level regression test**

Append to `src/app/utils/lightweightCatalogSource.test.mjs`:

```js
test("search page persists Ludoscopio semantic results in session storage", () => {
  const searchSource = source("../pages/Search.tsx");

  assert.match(searchSource, /readLudoscopioSessionCache/);
  assert.match(searchSource, /writeLudoscopioSessionCache\(\s*prompt,\s*semanticResults\s*\)/);
  assert.match(searchSource, /clearLudoscopioSessionCache\(\s*\)/);
  assert.match(searchSource, /cachedLudoscopioSession\?\.prompt/);
  assert.match(searchSource, /cachedLudoscopioSession\?\.results/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm.cmd test -- src/app/utils/lightweightCatalogSource.test.mjs`

Expected: FAIL because `Search.tsx` does not import or call the session cache utility.

- [ ] **Step 3: Write the minimal Search.tsx wiring**

Modify `src/app/pages/Search.tsx`:

```ts
import {
  clearLudoscopioSessionCache,
  readLudoscopioSessionCache,
  writeLudoscopioSessionCache,
} from "../utils/ludoscopioSessionCache.js";
```

Add before the semantic state initializers:

```ts
const cachedLudoscopioSession = useMemo(() => readLudoscopioSessionCache(), []);
```

Replace:

```ts
const [semanticQuery, setSemanticQuery] = useState("");
const [semanticGames, setSemanticGames] = useState<FilterableSemanticResult[] | null>(null);
```

With:

```ts
const [semanticQuery, setSemanticQuery] = useState(() => cachedLudoscopioSession?.prompt ?? "");
const [semanticGames, setSemanticGames] = useState<FilterableSemanticResult[] | null>(
  () => cachedLudoscopioSession?.results ?? null,
);
```

Add to `clearAll` after clearing `semanticGames`:

```ts
clearLudoscopioSessionCache();
```

Replace the successful semantic search mapping with:

```ts
const details = await loadSemanticCatalogGameDetails(prompt, 40);
const semanticResults = details.map(mapDetailToFilterableSemanticResult);
setSemanticGames(semanticResults);
setSemanticQuery(prompt);
writeLudoscopioSessionCache(prompt, semanticResults);
```

- [ ] **Step 4: Run the source-level test**

Run: `npm.cmd test -- src/app/utils/lightweightCatalogSource.test.mjs`

Expected: PASS.

### Task 3: Full Verification

**Files:**
- Verify all changed files.

- [ ] **Step 1: Run all UI tests**

Run: `npm.cmd test`

Expected: PASS.

- [ ] **Step 2: Run production build**

Run: `npm.cmd run build`

Expected: PASS.

- [ ] **Step 3: Commit and push**

Run:

```bash
git add docs/superpowers/specs/2026-07-05-ludoscopio-session-restore-design.md docs/superpowers/plans/2026-07-05-ludoscopio-session-restore.md src/app/pages/Search.tsx src/app/utils/lightweightCatalogSource.test.mjs src/app/utils/ludoscopioSessionCache.js src/app/utils/ludoscopioSessionCache.test.mjs
git commit -m "fix: restore ludoscopio search session"
git push
```
