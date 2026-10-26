/**
 * srcset.ts: rewrite the URLs of a `srcset` attribute, one candidate at a time.
 *
 * `srcset="/images/a.png 1.5x, /images/b.png 2x"` is a list of candidates, each a URL and an optional
 * descriptor. A URL can hold a comma (MediaWiki leaves `,` in file names), so the list is read the way the
 * HTML standard reads it: a URL is the next run of non-space characters, and a comma at its end ends the
 * candidate; otherwise the descriptor runs to the next comma. Rewriting the whole attribute with global
 * replacements (what this replaced) rewrote a URL that was already absolute a second time
 * (`<origin>/images<origin>/images/...`) and broke the candidate.
 */

const SPACE = /\s/;
const COMMA = 44;

/** One candidate as read: the separators before it, its URL, the commas that end the URL, its descriptor. */
interface Candidate {
  gap: string;
  url: string;
  urlCommas: string;
  descriptor: string;
}

/** The candidates of `srcset`, and what follows the last one (separators); together they spell `srcset` exactly. */
function readSrcset(srcset: string): { candidates: Candidate[]; trailer: string } {
  const candidates: Candidate[] = [];
  let i = 0;
  for (;;) {
    // whitespace and commas between candidates
    const gapStart = i;
    while (i < srcset.length && (SPACE.test(srcset.charAt(i)) || srcset.charAt(i) === ",")) i++;
    const gap = srcset.slice(gapStart, i);
    if (i >= srcset.length) return { candidates, trailer: gap };

    // the URL: the next run of non-space characters, less the commas that end it
    const urlStart = i;
    while (i < srcset.length && !SPACE.test(srcset.charAt(i))) i++;
    let urlEnd = i;
    while (urlEnd > urlStart && srcset.charCodeAt(urlEnd - 1) === COMMA) urlEnd--; // the commas that end the URL
    const candidate = {
      gap,
      url: srcset.slice(urlStart, urlEnd),
      urlCommas: srcset.slice(urlEnd, i),
      descriptor: "",
    };
    candidates.push(candidate);
    if (urlEnd !== i) continue; // a comma ended the candidate: it has no descriptor

    // the descriptor: up to the next comma
    const descriptorStart = i;
    while (i < srcset.length && srcset.charAt(i) !== ",") i++;
    candidate.descriptor = srcset.slice(descriptorStart, i);
  }
}

/** `srcset` with every candidate URL passed through `map`; the descriptors and the separators are untouched. */
export function mapSrcsetUrls(srcset: string, map: (url: string) => string): string {
  const { candidates, trailer } = readSrcset(srcset);
  return (
    candidates.map((c) => `${c.gap}${map(c.url)}${c.urlCommas}${c.descriptor}`).join("") + trailer
  );
}

/**
 * `srcset` with only the candidates whose URL `map` gives a replacement for, each as that replacement and its
 * descriptor, joined by `, `: an empty string when none is left.
 */
export function filterSrcset(srcset: string, map: (url: string) => string | null): string {
  const kept: string[] = [];
  for (const candidate of readSrcset(srcset).candidates) {
    const url = map(candidate.url);
    if (url !== null) kept.push(`${url}${candidate.descriptor.trimEnd()}`);
  }
  return kept.join(", ");
}
