/**
 * The season a league page shows standings for: the one in progress, else the latest completed one, else the newest.
 * `seasons` are newest first (by season number), as `sports.getLeague` returns them.
 */
export function displayedSeason<T extends { status: string }>(
  seasons: readonly T[] | undefined
): T | undefined {
  return (
    seasons?.find((s) => s.status === "in_progress") ??
    seasons?.find((s) => s.status === "completed") ??
    seasons?.[0]
  );
}
