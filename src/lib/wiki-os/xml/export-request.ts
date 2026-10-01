/**
 * export-request.ts — what an XML export request looks like, shared by the export route (which
 * enforces it) and the export page (which builds it). No server imports: it runs in the browser.
 */

/** Titles per export. */
export const MAX_XML_PAGES = 500;
/** Titles per export with full history (every revision is read and written). */
export const MAX_HISTORY_PAGES = 50;
/** Longest request URL the export page sends: proxies refuse request lines near 8 KB. */
export const MAX_EXPORT_URL_LENGTH = 7000;

/** The distinct, non-empty titles in `text`, separated by `|` or line breaks, in order. */
export function parseTitleList(text: string): string[] {
  const titles = text
    .split(/[|\n]/)
    .map((title) => title.trim())
    .filter(Boolean);
  return [...new Set(titles)];
}

/** The page limit for an export with or without history. */
export const pageLimit = (history: boolean): number =>
  history ? MAX_HISTORY_PAGES : MAX_XML_PAGES;

/** The query string of an XML export of `titles`. */
export function exportQuery(titles: string[], history: boolean): string {
  const params = new URLSearchParams({ format: "xml", pages: titles.join("|") });
  if (history) params.set("history", "1");
  return params.toString();
}
