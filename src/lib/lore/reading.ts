/** Pure reading measures for the Lore tab's at-a-glance rail: how long a page takes and how far in the reader is. */

/** An unhurried reading pace for encyclopedic prose. */
const WORDS_PER_MINUTE = 230;

/** Minutes to read an article's text (its markup stripped), at least 1 when there is any text. */
export function readingMinutes(html: string): number {
  const words = html
    .replace(/<[^>]+>/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  return words === 0 ? 0 : Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

/**
 * How far through an article the reader is, 0 to 1: 0 until its top reaches the viewport's top, 1 once its end is in
 * view. `rect` is the article's box relative to the viewport.
 */
export function readingProgress(rect: { top: number; height: number }, viewport: number): number {
  const travel = rect.height - viewport;
  if (travel <= 0) return rect.top <= viewport ? 1 : 0;
  return Math.min(1, Math.max(0, -rect.top / travel));
}
