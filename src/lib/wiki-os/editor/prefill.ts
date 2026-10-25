/**
 * The text a new page's editor may open on: `?prefill=` on an edit URL (CreatePageModal's template), or a host's
 * `prefillWikitext` (the lore writer). It is only ever plain text handed to the editor as its starting wikitext, and
 * only for a page the load reports as missing, so it can never replace a page's text.
 * Pure: no React, no network.
 */

/** The longest prefill an edit URL may carry (a template is a few hundred characters; a URL is bounded anyway). */
export const PREFILL_MAX_LENGTH = 16_000;

/** C0 controls and DEL, except tab (\u0009) and newline (\u000A); carriage returns are normalised first. */
// oxlint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B-\u001F\u007F]/g;

/**
 * The `?prefill=` value (already percent-decoded by `URLSearchParams`) as the editor may open on it: newlines
 * normalised, control characters dropped. Null when absent, empty, or longer than `PREFILL_MAX_LENGTH`: a text over
 * the limit is refused whole, never cut mid-markup.
 */
export function readPrefillParam(raw: string | null): string | null {
  if (!raw || raw.length > PREFILL_MAX_LENGTH) return null;
  const text = raw.replace(/\r\n?/g, "\n").replace(CONTROL_CHARS, "");
  return text === "" ? null : text;
}

/** The editor's load of a page (`wikios.getWikitext`), as far as it says whether the page exists. */
export interface LoadedPageProbe {
  wikitext: string;
  revid?: number | null;
  revisionRef: string | null;
  revisionRefs?: readonly string[];
}

/**
 * The load answered with no text and no revision: the page does not exist. On ixwiki the text is what decides:
 * `getWikitext` answers `revisionRef: null` for an existing page whose head lookup failed, `revid` is always null
 * there, and a page with a stored row always has text (`getArticleWikitextShadow` returns nothing for an empty row).
 * The revision checks hold for a blanked page that still has a head; `revid` is another wiki's page id.
 */
function isMissingPage(page: LoadedPageProbe): boolean {
  return (
    page.wikitext === "" &&
    page.revisionRef === null &&
    (page.revisionRefs ?? []).length === 0 &&
    (page.revid ?? null) === null
  );
}

/**
 * The text the editor opens on in place of the loaded page: the prefill, only for a page that does not exist. A
 * failed load, or one with no answer, is not a missing page: it gets null, as does any page with a revision or text.
 */
export function openingPrefill(
  prefill: string | null | undefined,
  page: LoadedPageProbe | undefined,
  loadFailed: boolean
): string | null {
  if (!prefill || loadFailed || page === undefined) return null;
  return isMissingPage(page) ? prefill : null;
}
