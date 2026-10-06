/**
 * src/lib/wiki-os/wikitext/forward-finder.ts — one search that answers every opener before its closer.
 */

/**
 * `search` for calls whose `from` only grows, remembered: a search that found `at` also answers every later
 * `from` up to `at`, and one that found nothing answers all of them. Scanning for the same closer from each of
 * many openers costs one scan, not one each. `search(from)` is the first index at or after `from` (or -1).
 */
export function forwardSearch(search: (from: number) => number): (from: number) => number {
  let searchedFrom = -1;
  let foundAt = -2;
  return (from) => {
    if (foundAt === -1 && from >= searchedFrom) return -1;
    if (from >= searchedFrom && from <= foundAt) return foundAt;
    searchedFrom = from;
    foundAt = search(from);
    return foundAt;
  };
}

/**
 * The first index at or after `from` where `needle` occurs (a string, or a match of a global expression), for
 * calls whose `from` only grows (see `forwardSearch`).
 */
export function forwardFinder(text: string, needle: string | RegExp): (from: number) => number {
  if (typeof needle === "string") return forwardSearch((from) => text.indexOf(needle, from));
  return forwardSearch((from) => {
    needle.lastIndex = from;
    return needle.exec(text)?.index ?? -1;
  });
}
