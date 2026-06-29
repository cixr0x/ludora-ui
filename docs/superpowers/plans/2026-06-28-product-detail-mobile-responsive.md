# Product Detail Mobile Responsive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the product details page use a stacked mobile layout while preserving the existing desktop layout.

**Architecture:** Apply Tailwind responsive utility classes directly in `GameDetail.tsx`. Base classes define mobile stacking; `md:` classes restore the existing desktop row layouts, spacing, alignment, and widths.

**Tech Stack:** React, React Router, Tailwind CSS v4, Vite, Node test runner.

---

### Task 1: Add Responsive Layout Regression Tests

**Files:**
- Modify: `src/app/utils/expansionDisplay.test.mjs`

- [ ] **Step 1: Add failing source-level tests**

Add assertions that `GameDetail.tsx` contains:

```js
assert.match(source, /flex flex-col md:flex-row gap-6 md:gap-8 items-stretch md:items-start/);
assert.match(source, /px-4 sm:px-6 md:px-8 pt-6 md:pt-10 pb-8 md:pb-10/);
assert.match(source, /flex flex-col md:flex-row md:items-start md:justify-between gap-2 md:gap-4/);
assert.match(source, /flex flex-col md:flex-row gap-8 md:gap-10 items-stretch md:items-start/);
assert.match(source, /w-full md:w-\[260px\]/);
assert.match(source, /h-\[70vh\] w-\[calc\(100vw-2rem\)\] md:h-\[50vh\] md:w-\[50vw\]/);
```

- [ ] **Step 2: Verify the tests fail**

Run: `npm.cmd test -- src/app/utils/expansionDisplay.test.mjs`

Expected: failure because the mobile stacked classes are not present yet.

### Task 2: Implement Mobile-Only Stacking

**Files:**
- Modify: `src/app/pages/GameDetail.tsx`

- [ ] **Step 1: Update hero shell**

Use mobile-first classes on the hero content wrapper:

```tsx
<div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 md:px-8 pt-6 md:pt-10 pb-8 md:pb-10">
  <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-stretch md:items-start">
```

- [ ] **Step 2: Keep the cover centered only on mobile**

Use:

```tsx
<div className="flex-none flex flex-col items-stretch gap-3 self-center md:self-start" style={{ width: 176 }}>
```

- [ ] **Step 3: Stack title and rating on mobile**

Use:

```tsx
<div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2 md:gap-4 mb-1">
```

- [ ] **Step 4: Update below-hero content spacing**

Use:

```tsx
<div className="max-w-5xl mx-auto px-4 sm:px-6 md:px-8 pb-10 flex flex-col gap-8 md:gap-10">
```

- [ ] **Step 5: Stack description and tutorial on mobile**

Use:

```tsx
<div className="flex flex-col md:flex-row gap-8 md:gap-10 items-stretch md:items-start">
```

- [ ] **Step 6: Make the TikTok embed responsive**

Change the wrapper to use `className="relative flex-none w-full md:w-[260px] bg-neutral-900 rounded-xl overflow-hidden border border-neutral-800"` and `style={{ aspectRatio: "260 / 462" }}`.

- [ ] **Step 7: Make the image overlay fit mobile**

Use:

```tsx
<div className="flex h-[70vh] w-[calc(100vw-2rem)] md:h-[50vh] md:w-[50vw] max-h-[calc(100vh-4rem)] max-w-[calc(100vw-3rem)] items-center justify-center">
```

### Task 3: Verify

**Files:**
- No code files expected beyond Task 2.

- [ ] **Step 1: Run unit tests**

Run: `npm.cmd test`

Expected: all source-level tests pass.

- [ ] **Step 2: Run production build**

Run: `npm.cmd run build`

Expected: Vite build exits 0.

- [ ] **Step 3: Browser QA**

Run the public API on `http://127.0.0.1:4000` and the public UI on `http://127.0.0.1:5175`, then verify `/game/1471` at desktop and mobile widths.

Expected:
- Desktop screenshot keeps the existing two-column hero and side-by-side description/tutorial layout.
- Mobile screenshot shows the cover centered above the product information with no horizontal overflow.
- Cover overlay opens and closes.
- Buy button scrolls to store offers when offers exist.
