import { forwardFinder } from "../wikitext/forward-finder";

/**
 * The passes of `cleanWikiMarkup` that were regular expressions a text of openers that never close makes
 * quadratic (`<!--`, `<ref`, `[[Category:`, `[http://a `, `{{flag|a`, `<` repeated: each opener rescans the
 * rest of the text for a closer that is not there). Each pass here answers what the expression answered, in
 * one left-to-right scan: a search for a closer that found nothing answers every later opener too, and one
 * that found a closer answers every opener before it, so the work is the length of the text, not the
 * length times the number of openers. tests/lib/wiki-os/clean-markup-linear.test.ts holds a copy of each
 * expression and fuzzes the two against each other.
 */

/** `[start, end)` of a stretch to cut, and (when given) what to put in its place. */
export type Span = readonly [start: number, end: number, replacement?: string];

/** The text with every span `next(from)` finds cut or replaced; `next` returns null when none starts at or after `from`. */
export function rewriteSpans(text: string, next: (from: number) => Span | null): string {
  const pieces: string[] = [];
  let copied = 0;
  for (;;) {
    const span = next(copied);
    if (!span) break;
    pieces.push(text.slice(copied, span[0]), span[2] ?? "");
    copied = span[1];
  }
  pieces.push(text.slice(copied));
  return pieces.join("");
}

const WORD_CHAR = /\w/;
const NON_ASCII = /[^\x00-\x7f]/;

/** `text` lower-cased in ASCII only (what `/i` without the `u` flag folds), so indexes into it are indexes into `text`. */
export function lowerAscii(text: string): string {
  return NON_ASCII.test(text)
    ? text.replace(/[A-Z]+/g, (run) => run.toLowerCase())
    : text.toLowerCase();
}

/** `<!-- ... -->` (what `/<!--[\s\S]*?-->/g` cuts). */
export function stripComments(text: string): string {
  return rewriteSpans(text, (from) => {
    const open = text.indexOf("<!--", from);
    if (open === -1) return null;
    const close = text.indexOf("-->", open + 4);
    return close === -1 ? null : [open, close + 3];
  });
}

/** The first `<tag` at or after `from` that is not the start of a longer name (`<refx`), in the lower-cased text. */
function nextOpener(lower: string, tag: string, from: number): number {
  const opener = `<${tag}`;
  for (let at = lower.indexOf(opener, from); at !== -1; at = lower.indexOf(opener, at + 1)) {
    if (!WORD_CHAR.test(lower.charAt(at + opener.length))) return at;
  }
  return -1;
}

/**
 * `<tag ...>inside</tag>` as `render(inside)` (what `/<tag\b[^>]*>([\s\S]*?)<\/tag>/gi` finds): the opening tag ends at the
 * first `>`. Without `wholeWord` the name may go on (`<refx>`), as when the expression had no `\b` after it.
 */
export function replaceTagBlocks(
  text: string,
  tag: string,
  render: (inside: string) => string,
  wholeWord = true
): string {
  const lower = lowerAscii(text);
  const nextGreater = forwardFinder(text, ">");
  const closer = `</${tag}>`;
  return rewriteSpans(text, (from) => {
    const open = wholeWord ? nextOpener(lower, tag, from) : lower.indexOf(`<${tag}`, from);
    if (open === -1) return null;
    const greater = nextGreater(open + tag.length + 1);
    if (greater === -1) return null; // no `>` after this one means none after any later opener either
    const close = lower.indexOf(closer, greater + 1);
    return close === -1
      ? null
      : [open, close + closer.length, render(text.slice(greater + 1, close))];
  });
}

/** `<tag ...>...</tag>` (what `/<tag\b[^>]*>[\s\S]*?<\/tag>/gi` cuts): the opening tag ends at the first `>`. */
export const stripTagBlocks = (text: string, tag: string): string =>
  replaceTagBlocks(text, tag, () => "");

/** `<ref .../>` (what `/<ref\b[^>]*\/>/gi` cuts): the first `>` after the name has a `/` before it. */
export function stripSelfClosingRefs(text: string): string {
  const lower = lowerAscii(text);
  const nextGreater = forwardFinder(text, ">");
  return rewriteSpans(text, (from) => {
    let open = nextOpener(lower, "ref", from);
    while (open !== -1) {
      const greater = nextGreater(open + 4);
      if (greater === -1) return null;
      if (text.charAt(greater - 1) === "/") return [open, greater + 1];
      open = nextOpener(lower, "ref", open + 1);
    }
    return null;
  });
}

/** `[[prefix...]]` with `prefix` in lower case, `category:` (what `/\[\[(?:Category|category):[^\]]+\]\]/gi` cuts). */
export function stripNamespacedLinks(text: string, prefix: string): string {
  const lower = lowerAscii(text);
  const nextClose = forwardFinder(text, "]");
  const opener = `[[${prefix}`;
  return rewriteSpans(text, (from) => {
    for (
      let open = lower.indexOf(opener, from);
      open !== -1;
      open = lower.indexOf(opener, open + 1)
    ) {
      const bodyStart = open + opener.length;
      const close = nextClose(bodyStart);
      if (close === -1) return null;
      // A name of at least one character, closed by `]]` at the first `]`.
      if (close > bodyStart && text.charAt(close + 1) === "]") return [open, close + 2];
    }
    return null;
  });
}

/**
 * Replaces each `{{name|...}}` that `pattern` (written to end in `\}\}`, with no `}` before it) matches.
 * The first `}` after a `{{` is the only place its template can close, so a `{{` without `}}` there is
 * passed over without running the expression, which would otherwise read on to the end of the text.
 */
export function replaceInlineTemplates(
  text: string,
  pattern: RegExp,
  replace: (match: RegExpExecArray) => string
): string {
  const sticky = new RegExp(pattern.source, "iy");
  const nextBrace = forwardFinder(text, "}");
  return rewriteSpans(text, (from) => {
    for (let open = text.indexOf("{{", from); open !== -1; open = text.indexOf("{{", open + 1)) {
      const close = nextBrace(open + 2);
      if (close === -1) return null;
      if (text.charAt(close + 1) !== "}") continue;
      sticky.lastIndex = open;
      const match = sticky.exec(text);
      if (match) return [open, open + match[0].length, replace(match)];
    }
    return null;
  });
}

/** `{{` with no `}` after it to the end of the text (what `/\{\{[^}]*$/` cuts, from that `{{` on). */
export function stripUnclosedTemplateTail(text: string): string {
  const open = text.indexOf("{{", text.lastIndexOf("}") + 1);
  return open === -1 ? text : text.slice(0, open);
}

/** `<...>` of one or more characters, closed by the first `>` (what `/<[^>]+>/g` cuts). */
export function stripHtmlTags(text: string): string {
  const nextGreater = forwardFinder(text, ">");
  return rewriteSpans(text, (from) => {
    for (let open = text.indexOf("<", from); open !== -1; open = text.indexOf("<", open + 1)) {
      const greater = nextGreater(open + 1);
      if (greater === -1) return null;
      if (greater > open + 1) return [open, greater + 1];
    }
    return null;
  });
}

const URL_END = /[\s\]]/g;

/** Just past `[http://` or `[https://` at `open`, or -1. */
function urlStart(text: string, open: number): number {
  const scheme = open + (text.charAt(open + 5) === "s" ? 6 : 5);
  return text.startsWith("://", scheme) ? scheme + 3 : -1;
}

/** The end of the address that starts at `from`: the first whitespace or `]`, or -1 when it runs to the end of the text. */
function urlEnd(text: string, from: number): number {
  URL_END.lastIndex = from;
  const hit = URL_END.exec(text);
  return hit ? hit.index : -1;
}

/**
 * `[http://address label]` as `render(address, label)` (what `/\[(https?:\/\/[^\s\]]+)\s+([^\]]+)\]/g` captures).
 * The label is what follows the whitespace after the address; when only whitespace is left before the `]`,
 * the last of it.
 */
export function replaceLabelledExternalLinks(
  text: string,
  render: (address: string, label: string) => string
): string {
  return rewriteSpans(text, (from) => {
    let at = from;
    for (;;) {
      const open = text.indexOf("[http", at);
      if (open === -1) return null;
      at = open + 1;
      const start = urlStart(text, open);
      if (start === -1) continue;
      const end = urlEnd(text, start);
      if (end === -1) return null; // the address runs to the end of the text, for every later link too
      if (text.charAt(end) === "]") {
        at = end; // every opener before this `]` has the same address end
        continue;
      }
      if (end === start) continue;
      const close = text.indexOf("]", end);
      if (close === -1) return null;
      if (close - end < 2) continue; // the one blank is the separator: no label
      let labelStart = end;
      while (labelStart < close && /\s/.test(text.charAt(labelStart))) labelStart++;
      const label = labelStart < close ? text.slice(labelStart, close) : text.charAt(close - 1);
      return [open, close + 1, render(text.slice(open + 1, end), label)];
    }
  });
}

/** `[http://address label]` becomes `label` (what `/\[https?:\/\/[^\s\]]+\s+([^\]]+)\]/g` answers with `$1`). */
export const unpackExternalLinks = (text: string): string =>
  replaceLabelledExternalLinks(text, (_address, label) => label);

/** `[http://address]` with no label as `render(address)` (what `/\[(https?:\/\/[^\s\]]+)\]/g` captures). */
export function replaceBareExternalLinks(
  text: string,
  render: (address: string) => string
): string {
  return rewriteSpans(text, (from) => {
    let at = from;
    for (;;) {
      const open = text.indexOf("[http", at);
      if (open === -1) return null;
      at = open + 1;
      const start = urlStart(text, open);
      if (start === -1) continue;
      const end = urlEnd(text, start);
      if (end === -1) return null;
      if (end > start && text.charAt(end) === "]")
        return [open, end + 1, render(text.slice(open + 1, end))];
      if (end > start) at = end; // whitespace ends the address: no opener before it closes either
    }
  });
}

/** `[http://address]` with no label is cut (what `/\[https?:\/\/[^\s\]]+\]/g` cuts). */
export const stripBareExternalLinks = (text: string): string =>
  replaceBareExternalLinks(text, () => "");

/**
 * `[[Target|Label]]` becomes `Label` and `[[Target]]` becomes `Target`, in one pass. It answers what
 * `text.replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, "$1")` answers, which rescans the rest of the text from every
 * `[[` that never closes (quadratic on 100,000 of them).
 */
export function unpackInternalLinks(text: string): string {
  const nextClose = forwardFinder(text, "]");
  const pieces: string[] = [];
  let copied = 0;
  let from = 0;
  for (;;) {
    const open = text.indexOf("[[", from);
    if (open === -1) break;
    const start = open + 2;
    const close = nextClose(start);
    if (close === -1) break; // nothing closes any later link either
    if (close === start) {
      from = open + 1; // nothing between the brackets
    } else if (text.charAt(close + 1) !== "]") {
      from = close; // every opener before this `]` is closed by the same one
    } else {
      let bar = start;
      while (bar < close && text.charAt(bar) !== "|") bar++;
      // The label follows the first bar, unless the bar is the last character before the closing brackets.
      const labelStart = bar < close && bar + 1 < close ? bar + 1 : start;
      pieces.push(text.slice(copied, open), text.slice(labelStart, close));
      copied = close + 2;
      from = copied;
    }
  }
  pieces.push(text.slice(copied));
  return pieces.join("");
}

/**
 * `[[Target|Label]]` as `render(Target, Label)`: a target of at least one character without `|` or `]`, a label of
 * at least one character without `]`, and `]]` (what `/\[\[([^|\]]+)\|([^\]]+)\]\]/g` finds). The first `]` after
 * an opener is the only place its link can close, and the first `|` the only place its label can start, so each is
 * looked for once however many openers come before it.
 */
export function replacePipedLinks(
  text: string,
  render: (target: string, label: string) => string
): string {
  const nextClose = forwardFinder(text, "]");
  const nextBar = forwardFinder(text, "|");
  return rewriteSpans(text, (from) => {
    for (let open = text.indexOf("[[", from); open !== -1; open = text.indexOf("[[", open + 1)) {
      const start = open + 2;
      const close = nextClose(start);
      if (close === -1) return null; // nothing closes any later link either
      if (text.charAt(close + 1) !== "]") {
        open = close - 1; // every opener before this `]` is closed by the same one
        continue;
      }
      const bar = nextBar(start);
      if (bar > start && bar < close && bar + 1 < close) {
        return [open, close + 2, render(text.slice(start, bar), text.slice(bar + 1, close))];
      }
    }
    return null;
  });
}

/** `[[Target]]` as `render(Target)`: a target of at least one character without `]` (what `/\[\[([^\]]+)\]\]/g` finds). */
export function replaceSimpleLinks(text: string, render: (target: string) => string): string {
  const nextClose = forwardFinder(text, "]");
  return rewriteSpans(text, (from) => {
    for (let open = text.indexOf("[[", from); open !== -1; open = text.indexOf("[[", open + 1)) {
      const start = open + 2;
      const close = nextClose(start);
      if (close === -1) return null; // nothing closes any later link either
      if (close === start) continue; // nothing between the brackets
      if (text.charAt(close + 1) !== "]") {
        open = close - 1; // every opener before this `]` is closed by the same one
        continue;
      }
      return [open, close + 2, render(text.slice(start, close))];
    }
    return null;
  });
}

/** `[[File:...]]`, `[[Image:...]]` and `[[Media:...]]` open at `at`. */
const FILE_OPENER = /\[\[(?:file|image|media):/iy;

/** The index of the first file link opener at or after `from`, or -1. */
export function nextFileOpener(text: string, from: number): number {
  for (let open = text.indexOf("[[", from); open !== -1; open = text.indexOf("[[", open + 1)) {
    FILE_OPENER.lastIndex = open;
    if (FILE_OPENER.test(text)) return open;
  }
  return -1;
}
