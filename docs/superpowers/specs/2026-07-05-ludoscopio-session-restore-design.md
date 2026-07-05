# Ludoscopio Session Restore Design

## Goal

Preserve Ludoscopio semantic search state when a user opens a product detail page from search results and then returns with the browser or in-page back button. Returning to search must restore the prior prompt and result grid without sending another semantic search request.

## Scope

- Target `src/app/pages/Search.tsx` and small supporting utilities if useful.
- Store only the current browser session's Ludoscopio state in `sessionStorage`.
- Restore the semantic prompt and mapped semantic result rows when the search page mounts again.
- Keep regular catalog search, URL-backed taxonomy filters, infinite scrolling, and product detail behavior unchanged.
- Keep the existing "Borrar todo" action as the way to clear both visible filters and cached Ludoscopio state.

## Architecture

The search page remains the owner of search UI state. A small session cache serializes the Ludoscopio prompt plus the filterable result rows already used by the grid. On successful Ludoscopio search, `Search.tsx` writes the prompt and rows to `sessionStorage` after mapping API details into filterable results. On mount, `Search.tsx` reads the cache once and initializes `semanticQuery` and `semanticGames` from it.

The cache is session-only and not encoded in the URL. This avoids exposing free-form user prompts in browser history or shared links while still fixing back navigation and avoiding repeat embedding calls in the same tab session.

## Data Flow

1. User submits a Ludoscopio prompt.
2. `loadSemanticCatalogGameDetails(prompt, 40)` runs once.
3. Details are mapped with the existing `mapDetailToFilterableSemanticResult` logic.
4. Search state is reset to the semantic result mode.
5. `{ prompt, results }` is written to `sessionStorage`.
6. User opens `/game/:id`.
7. User navigates back to `/search`.
8. `Search.tsx` initializes semantic state from `sessionStorage` and renders the cached results without calling semantic search.

## Failure Handling

If `sessionStorage` is unavailable, malformed, or contains incompatible data, the page should ignore the cache and behave as it does today. A failed Ludoscopio API request should not overwrite the last good cache. Clearing all filters should remove the cached semantic state.

## Testing

- Add source-level regression coverage proving `Search.tsx` reads and writes a Ludoscopio session cache.
- Add source-level regression coverage proving `clearAll` removes the Ludoscopio session cache.
- Run `npm.cmd test`.
- Run `npm.cmd run build`.
