/**
 * srcset.ts: rewrite the URLs of a `srcset` attribute, one candidate at a time.
 *
 * `srcset="/images/a.png 1.5x, /images/b.png 2x"` is a list of candidates, each a URL and an optional
 * descriptor. A URL can hold a comma (MediaWiki leaves `,` in file names), so the list is read the way the
 * HTML standard reads it: a URL is the next run of non-space characters, and a comma at its end ends the
 * candidate; otherwise the descriptor runs to the next comma. Rewriting the whole attribute with global
 * replacements (what this replaced) rewrote a URL that was already absolute a second time
 * (`https://ixwiki.com/imageshttps://ixwiki.com/images/...`) and broke the candidate.
 */

const SPACE = /\s/;

/** `srcset` with every candidate URL passed through `map`; the descriptors and the separators are untouched. */
export function mapSrcsetUrls(srcset: string, map: (url: string) => string): string {
  let out = "";
  let i = 0;
  while (i < srcset.length) {
    // whitespace and commas between candidates
    const gapStart = i;
    while (i < srcset.length && (SPACE.test(srcset.charAt(i)) || srcset.charAt(i) === ",")) i++;
    out += srcset.slice(gapStart, i);
    if (i >= srcset.length) break;

    // the URL: the next run of non-space characters, less the commas that end it
    const urlStart = i;
    while (i < srcset.length && !SPACE.test(srcset.charAt(i))) i++;
    const token = srcset.slice(urlStart, i);
    const url = token.replace(/,+$/, "");
    out += map(url) + token.slice(url.length);
    if (url.length !== token.length) continue; // a comma ended the candidate: it has no descriptor

    // the descriptor: up to the next comma
    const descriptorStart = i;
    while (i < srcset.length && srcset.charAt(i) !== ",") i++;
    out += srcset.slice(descriptorStart, i);
  }
  return out;
}
