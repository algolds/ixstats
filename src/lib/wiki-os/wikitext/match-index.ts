/**
 * src/lib/wiki-os/wikitext/match-index.ts — where every `{{` and `[[` closes, in one pass.
 *
 * `findMatchingClosingBraces` / `findMatchingClosingBrackets` scan forward from one opener, so a
 * page with thousands of openers that never close (each scan runs to the end) takes quadratic
 * time. These indexes answer the same question for every opener from one left-to-right pass with a
 * stack. The tokenisation is the one those functions use: comments are skipped, `{{`/`}}` (or
 * `[[`/`]]`) pair up, and for braces a link's own `[[` and `]]` are skipped as two characters.
 */

/** The index has no answer for this position (inside a comment that closes): scan instead. */
export const UNINDEXED = -2;

/** `index[i]` for an opener at `i`: the index of its closing pair, or -1 when it never closes. */
export type MatchIndex = Int32Array;

/**
 * A run of `k` opener characters (`[[[`) is read in pairs from its first character: at `s`, `s+2`, … and a
 * last odd one is plain text. A scan that starts inside the run (`[[` at `s+1`) reads the rest of the run in
 * pairs from there, then the same text as the pass, so it closes where the pass closes the opener `m - shifted`
 * places further on (`m` pairs from `s`, `shifted` from `s+1`): the odd positions are answered from the even ones.
 */
function indexShiftedOpeners(index: MatchIndex, runs: number[]): void {
  for (let r = 0; r < runs.length; r += 2) {
    const start = runs[r]!;
    const length = runs[r + 1]!;
    const pairs = length >> 1;
    const shifted = (length - 1) >> 1;
    for (let j = 0; j < shifted; j++)
      index[start + 1 + 2 * j] = index[start + 2 * (j + pairs - shifted)]!;
  }
}

const unclosedComments = new WeakMap<MatchIndex, number>();

/**
 * Where a comment that never closes starts in the text of `index` (its length when there is none): the rest of
 * the text is comment, in which a reader of links (api-compat/scan) finds none, though the index answers the
 * openers there as a scan from each would.
 */
export const unclosedCommentFrom = (index: MatchIndex): number =>
  unclosedComments.get(index) ?? index.length;

function buildIndex(text: string, open: "{{" | "[[", close: "}}" | "]]"): MatchIndex {
  const index = new Int32Array(text.length).fill(UNINDEXED);
  const stack: number[] = [];
  const runs: number[] = []; // start, length of each run of three or more opener characters
  const skipsLinks = open === "{{";
  const openCode = open.charCodeAt(0);
  let noCommentCloser = false; // no `-->` follows the last `<!--` looked at, so none follows a later one
  let unclosedFrom = -1;
  let i = 0;
  while (i < text.length) {
    if (text.startsWith("<!--", i)) {
      const end = noCommentCloser ? -1 : text.indexOf("-->", i + 4);
      if (end === -1) {
        // A comment that never closes holds the rest of the text for a scan that began before it, so every opener
        // waiting on the stack never closes (it is -1 already). A scan that begins after it reads the rest as text,
        // which is a pass that starts here: the text of a nowiki or a gallery that says `<!--` is no reason
        // to leave every later opener to a scan.
        if (unclosedFrom === -1) unclosedFrom = i;
        noCommentCloser = true;
        stack.length = 0;
        i += 4;
      } else {
        i = end + 3;
      }
    } else if (text.startsWith(open, i)) {
      let length = 2;
      while (text.charCodeAt(i + length) === openCode) length++;
      if (length > 2) runs.push(i, length);
      for (const end = i + (length & ~1); i < end; i += 2) {
        index[i] = -1;
        stack.push(i);
      }
      if (length & 1) i++;
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
  indexShiftedOpeners(index, runs);
  if (unclosedFrom !== -1) unclosedComments.set(index, unclosedFrom);
  return index;
}

/** Index for `findMatchingClosingBraces`: the `}}` of every `{{` in `text`. */
export const matchBraces = (text: string): MatchIndex => buildIndex(text, "{{", "}}");

/** Index for `findMatchingClosingBrackets`: the `]]` of every `[[` in `text`. */
export const matchBrackets = (text: string): MatchIndex => buildIndex(text, "[[", "]]");

/**
 * ponytail: the scans of a text's index, 4 times the length of the text. An opener the pass did not reach (inside
 * a comment that closes) is answered by scanning from it, as before the index; a text of such openers that never
 * close (`<!--`, `[[` a hundred thousand times, `-->`) would read to its end from each. The scans a text's index lets
 * are bounded by this many characters in all, and an opener asked about after that is taken to be unclosed: it differs
 * from the scan only for a comment of that many openers whose closers follow it. A comment that never closes is no
 * such case: the pass goes on after it.
 */
const SCAN_BUDGET_FACTOR = 4;

const scanBudgets = new WeakMap<MatchIndex, number>();

/** Whether `index` may be scanned from an opener it has no answer for. */
export function mayScan(index: MatchIndex): boolean {
  return (scanBudgets.get(index) ?? SCAN_BUDGET_FACTOR * index.length) > 0;
}

/** Counts `chars` characters scanned against the budget of `index`. */
export function chargeScan(index: MatchIndex, chars: number): void {
  scanBudgets.set(index, (scanBudgets.get(index) ?? SCAN_BUDGET_FACTOR * index.length) - chars);
}
