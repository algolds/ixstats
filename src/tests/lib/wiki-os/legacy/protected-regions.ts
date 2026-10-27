// The protected-region scanner as the integration branch had it before the regex-DoS sweep (plan F15, 224bd6dcd),
// verbatim: regex-dos-wikitext.test.ts holds the memoized scanner against it. Not used by any code.

/**
 * src/lib/wiki-os/wikitext/protected-regions.ts — text MediaWiki never parses as wikitext.
 *
 * HTML comments and the tags whose content is literal (`<pre>`, `<nowiki>`) or belongs to an
 * extension (`<gallery>`, `<math>`, `<syntaxhighlight>`, …). `{{` inside one of them is not a
 * template, `''` is not italic, and a blank line inside one does not end a paragraph. Pure string
 * helpers with no imports, shared by the block parser, the template scanner and the inline parser.
 */

/** Tags whose content is literal text or extension input: never wikitext, never a block boundary. */
const OPAQUE_TAG_NAMES = [
  "nowiki",
  "pre",
  "math",
  "syntaxhighlight",
  "source",
  "gallery",
  "poem",
  "references",
  "timeline",
  "score",
  "imagemap",
  "templatedata",
  "charinsert",
  "hiero",
  "mapframe",
  "maplink",
  "graph",
  "inputbox",
  "categorytree",
  "indicator",
] as const;

/** `<ref>` content is wikitext, but it may hold blank lines, so a block scan steps over it whole. */
const STEP_OVER_TAG_NAMES = [...OPAQUE_TAG_NAMES, "ref"] as const;

const STEP_OVER_NAMES: ReadonlySet<string> = new Set(STEP_OVER_TAG_NAMES);
/** The longest name in `STEP_OVER_TAG_NAMES`, with a little room: a longer run of letters is no such tag. */
const MAX_TAG_NAME_LENGTH = 16;

export interface OpenTag {
  /** Lower-case tag name. */
  name: string;
  /** Index of the `<`. */
  start: number;
  /** Index just after the `>` of the opening tag. */
  openEnd: number;
  /** `<name … />`. */
  selfClosing: boolean;
}

const isAsciiLetter = (code: number) => (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
const WHITESPACE = /\s/;

interface CloseTags {
  starts: number[];
  ends: number[];
}

/**
 * What a scan of one text keeps so that a text full of `<nowiki ` openers that never close is read
 * in linear time (each opener would otherwise scan to the end of the text for its `>` and for its
 * closing tag). It belongs to ONE scan: make it with `new ProtectedScanner(text)` where the scan
 * starts and pass it to every call about that text. Nothing is kept between scans, and nothing is
 * compared against a text (a cache keyed on the text's content costs a comparison per lookup).
 * The functions below require one, so a loop over a text cannot go quadratic by forgetting it.
 */
export class ProtectedScanner {
  /** The first `>` at or after `gtFrom` is `gtAt` (-1: there is none); so it is for every later position up to it. */
  private gtFrom = 0;
  private gtAt = -2;
  private readonly closeTags = new Map<string, CloseTags>();

  constructor(readonly text: string) {}

  nextGreaterThan(from: number): number {
    if (this.gtAt !== -2 && from >= this.gtFrom && (this.gtAt === -1 || from <= this.gtAt)) return this.gtAt;
    this.gtFrom = from;
    this.gtAt = this.text.indexOf(">", from);
    return this.gtAt;
  }

  /** Where every `</name>` of the text starts and ends, found in one scan. */
  closingTags(name: string): CloseTags {
    let tags = this.closeTags.get(name);
    if (!tags) {
      tags = { starts: [], ends: [] };
      const close = closeTagPattern(name);
      close.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = close.exec(this.text)) !== null) {
        tags.starts.push(match.index);
        tags.ends.push(match.index + match[0].length);
      }
      this.closeTags.set(name, tags);
    }
    return tags;
  }
}

const closePatterns = new Map<string, RegExp>();
/** The shared global pattern for `</name>`; the caller sets `lastIndex` and uses it at once. */
function closeTagPattern(name: string): RegExp {
  let pattern = closePatterns.get(name);
  if (!pattern) {
    pattern = new RegExp(`</${name}\\s*>`, "gi");
    closePatterns.set(name, pattern);
  }
  return pattern;
}

/** The opaque (or `<ref>`) opening tag that starts at `text[i]`, or null. */
export function matchOpenTag(text: string, i: number, scanner: ProtectedScanner): OpenTag | null {
  if (text.charCodeAt(i) !== 60) return null;
  let nameEnd = i + 1;
  while (nameEnd - i <= MAX_TAG_NAME_LENGTH && isAsciiLetter(text.charCodeAt(nameEnd))) nameEnd++;
  const name = text.slice(i + 1, nameEnd).toLowerCase();
  if (!STEP_OVER_NAMES.has(name)) return null;
  // The name must end at whitespace, "/" or ">" (`<referencesfoo>` is no `<references>`).
  const next = text[nameEnd];
  if (next === undefined || !(next === "/" || next === ">" || WHITESPACE.test(next))) return null;
  const close = scanner.nextGreaterThan(nameEnd);
  if (close === -1) return null;
  return { name, start: i, openEnd: close + 1, selfClosing: text[close - 1] === "/" };
}

/** Index just after the closing tag that matches `tag`, or -1 when it is never closed. */
export function findTagClose(tag: OpenTag, scanner: ProtectedScanner): number {
  if (tag.selfClosing) return tag.openEnd;
  const { starts, ends } = scanner.closingTags(tag.name);
  // the first closing tag that starts at or after the end of the opening tag
  let low = 0;
  let high = starts.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (starts[mid]! < tag.openEnd) low = mid + 1;
    else high = mid;
  }
  return low < ends.length ? ends[low]! : -1;
}

/** Index just after the `-->` of the comment that starts at `text[i]`; the end of text when unclosed. */
function findCommentEnd(text: string, i: number): number {
  const close = text.indexOf("-->", i + 4);
  return close === -1 ? text.length : close + 3;
}

/**
 * If a comment or an opaque element (a closed `<nowiki>…</nowiki>`, `<pre>…</pre>`, `<gallery>…`,
 * a `<ref>…</ref>` when `includeRef`, or a self-closing tag) starts at `text[i]`, the index just after
 * it; otherwise null. An unclosed tag is not a region: MediaWiki shows it as text.
 */
export function skipProtectedAt(
  text: string,
  i: number,
  includeRef: boolean,
  scanner: ProtectedScanner
): number | null {
  if (text.charCodeAt(i) !== 60) return null;
  if (text.startsWith("<!--", i)) return findCommentEnd(text, i);
  const tag = matchOpenTag(text, i, scanner);
  if (!tag || (tag.name === "ref" && !includeRef)) return null;
  const end = findTagClose(tag, scanner);
  return end === -1 ? null : end;
}

/** Whether `line` holds nothing but HTML comments (and whitespace). */
export function isCommentOnly(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.startsWith("<!--")) return false;
  let i = 0;
  while (i < trimmed.length) {
    if (trimmed.startsWith("<!--", i)) {
      i = findCommentEnd(trimmed, i);
    } else if (/\s/.test(trimmed[i]!)) {
      i++;
    } else {
      return false;
    }
  }
  return true;
}
