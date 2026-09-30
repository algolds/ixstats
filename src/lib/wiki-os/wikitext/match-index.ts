/**
 * src/lib/wiki-os/wikitext/match-index.ts — where every `{{` and `[[` closes, in one pass.
 *
 * `findMatchingClosingBraces` / `findMatchingClosingBrackets` scan forward from one opener, so a
 * page with thousands of openers that never close (each scan runs to the end) takes quadratic
 * time. These indexes answer the same question for every opener from one left-to-right pass with a
 * stack. The tokenisation is the one those functions use: comments are skipped, `{{`/`}}` (or
 * `[[`/`]]`) pair up, and for braces a link's own `[[` and `]]` are skipped as two characters.
 */

/** The index has no answer for this position (it is not an opener the pass reached): scan instead. */
export const UNINDEXED = -2;

/** `index[i]` for an opener at `i`: the index of its closing pair, or -1 when it never closes. */
export type MatchIndex = Int32Array;

function buildIndex(text: string, open: "{{" | "[[", close: "}}" | "]]"): MatchIndex {
  const index = new Int32Array(text.length).fill(UNINDEXED);
  const stack: number[] = [];
  const skipsLinks = open === "{{";
  let i = 0;
  while (i < text.length) {
    if (text.startsWith("<!--", i)) {
      const end = text.indexOf("-->", i + 4);
      if (end === -1) break;
      i = end + 3;
    } else if (text.startsWith(open, i)) {
      index[i] = -1;
      stack.push(i);
      i += 2;
    } else if (text.startsWith(close, i)) {
      const opener = stack.pop();
      if (opener !== undefined) index[opener] = i;
      i += 2;
    } else if (skipsLinks && (text.startsWith("[[", i) || text.startsWith("]]", i))) {
      i += 2;
    } else {
      i++;
    }
  }
  return index;
}

/** Index for `findMatchingClosingBraces`: the `}}` of every `{{` in `text`. */
export const matchBraces = (text: string): MatchIndex => buildIndex(text, "{{", "}}");

/** Index for `findMatchingClosingBrackets`: the `]]` of every `[[` in `text`. */
export const matchBrackets = (text: string): MatchIndex => buildIndex(text, "[[", "]]");
