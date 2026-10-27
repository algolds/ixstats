/** The highest season the field accepts, as the server does; it also bounds a range's loop. */
const MAX_SEASON = 100;

/** "1-3, 5" → [1, 2, 3, 5]. Unreadable parts are left out; an empty list means every season. */
export function parseSeasonList(text: string): number[] {
  const seasons = new Set<number>();
  for (const part of text.split(",").map((piece) => piece.trim())) {
    const match = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(part);
    if (!match) continue;
    const from = Math.max(Number(match[1]), 1);
    const to = Math.min(Number(match[2] ?? match[1]), MAX_SEASON);
    for (let season = from; season <= to; season++) seasons.add(season);
  }
  return [...seasons].sort((a, b) => a - b);
}
