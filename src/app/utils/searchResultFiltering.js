export function parseRangeText(text, emptyFallback = [0, 0]) {
  const numbers = String(text ?? "").match(/\d+/g)?.map(Number) ?? [];
  if (numbers.length === 0) return emptyFallback;
  if (numbers.length === 1) return [numbers[0], numbers[0]];
  return [numbers[0], numbers[1]];
}

export function rangesOverlap([minA, maxA], [minB, maxB]) {
  return maxA >= minB && minA <= maxB;
}

export function filterSemanticSearchResults(sourceGames, request) {
  const q = String(request.query ?? "").trim().toLowerCase();
  const categoryIds = Array.isArray(request.categoryIds) ? request.categoryIds : [];
  const mechanicIds = Array.isArray(request.mechanicIds) ? request.mechanicIds : [];
  const playtimeRanges = Array.isArray(request.playtimeRanges) ? request.playtimeRanges : [];
  const complexity = Array.isArray(request.complexity) ? request.complexity : [1, 5];
  const players = request.players ?? null;

  return (sourceGames ?? []).filter((game) => {
    if (q.length > 0) {
      const haystack = [
        game.name,
        game.altTitle,
        ...(game.categoryNames ?? []),
        ...(game.mechanicNames ?? []),
        ...(game.genres ?? []),
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    if (categoryIds.length > 0) {
      const gameCategoryIds = new Set((game.categories ?? []).map((entry) => entry.id));
      for (const id of categoryIds) if (!gameCategoryIds.has(id)) return false;
    }

    if (mechanicIds.length > 0) {
      const gameMechanicIds = new Set((game.mechanics ?? []).map((entry) => entry.id));
      for (const id of mechanicIds) if (!gameMechanicIds.has(id)) return false;
    }

    if (players !== null) {
      if (players < game.minPlayers || players > game.maxPlayers) return false;
    }

    if (playtimeRanges.length > 0) {
      const minMinutes = game.minMinutes;
      const maxMinutes = game.maxMinutes;
      if (
        !Number.isFinite(minMinutes) ||
        !Number.isFinite(maxMinutes) ||
        minMinutes <= 0 ||
        maxMinutes <= 0 ||
        minMinutes > maxMinutes
      ) {
        return false;
      }

      const gameRange = [minMinutes, maxMinutes];
      if (!playtimeRanges.some((range) => rangesOverlap(gameRange, range))) return false;
    }

    if (
      (complexity[0] !== 1 || complexity[1] !== 5) &&
      (game.complexity < complexity[0] || game.complexity > complexity[1])
    ) {
      return false;
    }

    return true;
  });
}
