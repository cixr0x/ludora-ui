# Product Detail Mobile Responsive Design

## Goal

Make the product details page read cleanly on mobile using the selected stacked detail layout, without changing the current desktop layout or functionality.

## Scope

- Target `src/app/pages/GameDetail.tsx`.
- Keep desktop behavior and visual structure unchanged at `md` and wider breakpoints.
- On mobile, stack the hero content vertically: cover image, buy button, title/rating, expansion parent, categories, mechanics, and stats.
- Stack the description/tutorial area vertically on mobile while restoring the current side-by-side layout at `md` and wider.
- Keep existing interactions: back navigation, cover image overlay, buy button scroll, store links, tutorial link/embed, related row scrolling, and expansion parent link.

## Constraints

- No backend changes.
- No new dependencies.
- Preserve the desktop classes through `md:` responsive overrides wherever existing desktop layout values need to remain exact.
- Avoid mobile-only tabs or hidden content; the chosen layout is a normal scrollable page.

## Testing

- Add source-level regression tests for the mobile-only responsive classes in `GameDetail.tsx`.
- Run `npm.cmd test`.
- Run `npm.cmd run build`.
- Validate rendered desktop and mobile layouts in a browser, including opening the cover overlay and using the buy button when store offers exist.
