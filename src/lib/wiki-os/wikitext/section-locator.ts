// src/lib/wiki-os/wikitext/section-locator.ts
// Finds the wikitext heading for a section title as the reader shows it (section edit links).

const HEADING_LINE_REGEX = /^(={2,6})\s*(.+?)\s*\1\s*$/u;

/** Reduce heading markup to its visible text: [[Target|Label]] → Label, '''bold''' → bold. */
function visibleHeadingText(text: string): string {
  return text
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/gu, "$1")
    .replace(/'{2,}/gu, "")
    .replace(/<[^>]+>/gu, "")
    .replace(/\s+/gu, " ")
    .trim()
    .toLowerCase();
}

/**
 * 1-based line number of the first heading whose visible text matches `section`, or null.
 */
export function findSectionLine(wikitext: string, section: string): number | null {
  const target = visibleHeadingText(section);
  if (!target) return null;
  const index = wikitext.split("\n").findIndex((line) => {
    const heading = HEADING_LINE_REGEX.exec(line)?.[2];
    return heading !== undefined && visibleHeadingText(heading) === target;
  });
  return index >= 0 ? index + 1 : null;
}
