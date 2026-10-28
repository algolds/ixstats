/**
 * src/lib/wiki-os/wikitext/quote-balance.ts — the quote runs of one line, read as MediaWiki's doQuotes reads them.
 *
 * Before it toggles anything MediaWiki rewrites the runs of a line: four apostrophes are one apostrophe and a bold
 * run, more than five are the extra apostrophes and a bold-italic run, and when the line has an odd number of italic
 * runs AND an odd number of bold runs, one bold run becomes an apostrophe and an italic run. That last rule is what
 * makes `''Unicorn'''s name` the italic "Unicorn'" followed by plain "s name", not an unclosed bold. The run it picks
 * is the first one after a single-letter word (`l'''amour`), else the first after a longer word, else the first after
 * a space.
 */

/** A piece of one line: text, something opaque (a link, a template, a comment) or a run of two or more apostrophes. */
export type QuoteToken<T> =
  { kind: "text"; text: string } | { kind: "item"; item: T } | { kind: "quotes"; length: number };

/** Four apostrophes are `'` and bold; more than five are the extra `'` and bold italic. */
function normalizeRuns<T>(line: readonly QuoteToken<T>[]): QuoteToken<T>[] {
  const out: QuoteToken<T>[] = [];
  for (const token of line) {
    if (token.kind !== "quotes" || token.length === 2 || token.length === 3 || token.length === 5) {
      out.push(token);
      continue;
    }
    const extra = token.length === 4 ? 1 : token.length - 5;
    out.push(
      { kind: "text", text: "'".repeat(extra) },
      { kind: "quotes", length: token.length === 4 ? 3 : 5 }
    );
  }
  return out;
}

/** Whether the line has an odd number of italic runs and an odd number of bold runs. */
function bothOdd<T>(line: readonly QuoteToken<T>[]): boolean {
  let italics = 0;
  let bolds = 0;
  for (const token of line) {
    if (token.kind !== "quotes") continue;
    if (token.length !== 3) italics++;
    if (token.length !== 2) bolds++;
  }
  return italics % 2 === 1 && bolds % 2 === 1;
}

/**
 * The bold run doQuotes turns into an apostrophe and italics. `seen` is what MediaWiki has in front of a run for an
 * opaque item (a link is a placeholder there, a comment is gone).
 */
function runToSplit<T>(line: readonly QuoteToken<T>[], seen: (item: T) => string): number {
  let firstSpace = -1;
  let firstMultiLetter = -1;
  let before = "";
  for (const [index, token] of line.entries()) {
    if (token.kind === "text") before += token.text;
    else if (token.kind === "item") before += seen(token.item);
    else {
      if (token.length === 3) {
        // PHP's substr($s, -1) and substr($s, -2, 1): a one-character text is both.
        const x1 = before.slice(-1);
        const x2 = before.length >= 2 ? before[before.length - 2] : before;
        if (x1 === " ") firstSpace = firstSpace === -1 ? index : firstSpace;
        else if (x2 === " ") return index;
        else if (firstMultiLetter === -1) firstMultiLetter = index;
      }
      before = "";
    }
  }
  return firstMultiLetter !== -1 ? firstMultiLetter : firstSpace;
}

/** The tokens of one line (no line break in it) as doQuotes will toggle them. */
export function balanceQuoteLine<T>(
  line: readonly QuoteToken<T>[],
  seen: (item: T) => string
): QuoteToken<T>[] {
  const runs = normalizeRuns(line);
  if (!bothOdd(runs)) return runs;
  const at = runToSplit(runs, seen);
  if (at === -1) return runs;
  return [
    ...runs.slice(0, at),
    { kind: "text", text: "'" },
    { kind: "quotes", length: 2 },
    ...runs.slice(at + 1),
  ];
}
