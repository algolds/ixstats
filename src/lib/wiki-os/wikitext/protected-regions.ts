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

const OPEN_TAG = new RegExp(`<(${STEP_OVER_TAG_NAMES.join("|")})(?=[\\s/>])[^>]*>`, "iy");

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

/** The opaque (or `<ref>`) opening tag that starts at `text[i]`, or null. */
export function matchOpenTag(text: string, i: number): OpenTag | null {
  if (text.charCodeAt(i) !== 60) return null;
  OPEN_TAG.lastIndex = i;
  const match = OPEN_TAG.exec(text);
  if (!match) return null;
  const openEnd = i + match[0].length;
  return {
    name: match[1]!.toLowerCase(),
    start: i,
    openEnd,
    selfClosing: match[0].endsWith("/>"),
  };
}

interface CloseTags {
  starts: number[];
  ends: number[];
}

/**
 * Where every `</name>` of a text starts and ends, found in one scan and kept for the last few texts
 * asked about. Looking for the closing tag of each opening tag by scanning forward is quadratic when
 * thousands of tags never close (every scan runs to the end).
 */
const closeTagCache: Array<{ text: string; byName: Map<string, CloseTags> }> = [];
const CLOSE_TAG_CACHE_SIZE = 4;

function closeTagsOf(text: string, name: string): CloseTags {
  let entry = closeTagCache.find((candidate) => candidate.text === text);
  if (!entry) {
    entry = { text, byName: new Map() };
    closeTagCache.unshift(entry);
    closeTagCache.length = Math.min(closeTagCache.length, CLOSE_TAG_CACHE_SIZE);
  }
  let tags = entry.byName.get(name);
  if (!tags) {
    tags = { starts: [], ends: [] };
    const close = new RegExp(`</${name}\\s*>`, "gi");
    let match: RegExpExecArray | null;
    while ((match = close.exec(text)) !== null) {
      tags.starts.push(match.index);
      tags.ends.push(match.index + match[0].length);
    }
    entry.byName.set(name, tags);
  }
  return tags;
}

/** Index just after the closing tag that matches `tag`, or -1 when it is never closed. */
export function findTagClose(text: string, tag: OpenTag): number {
  if (tag.selfClosing) return tag.openEnd;
  const { starts, ends } = closeTagsOf(text, tag.name);
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
export function skipProtectedAt(text: string, i: number, includeRef = false): number | null {
  if (text.charCodeAt(i) !== 60) return null;
  if (text.startsWith("<!--", i)) return findCommentEnd(text, i);
  const tag = matchOpenTag(text, i);
  if (!tag || (tag.name === "ref" && !includeRef)) return null;
  const end = findTagClose(text, tag);
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
