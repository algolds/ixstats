import { splitBalancedPipes, parseParameterList } from "./parameter-parser";
import { classifyTemplate } from "./resolver";
import type { WikiInlineNode } from "./types";

interface ParsedMediaLink {
  filename: string;
  caption?: string;
  align?: "left" | "center" | "right" | "thumb" | "frameless";
  width?: number;
  height?: number;
  raw: string;
}

/**
 * Index of the delimiter closing the `open` that starts at startIndex, balancing nested pairs and
 * ignoring `<!-- comments -->`. Tokens in `skip` are stepped over without affecting depth.
 */
function findMatchingClose(
  text: string,
  startIndex: number,
  open: string,
  close: string,
  skip: string[] = []
): number {
  if (!text.startsWith(open, startIndex)) return -1;
  let depth = 0;
  let j = startIndex;
  while (j < text.length) {
    if (text.startsWith("<!--", j)) {
      const commentEnd = text.indexOf("-->", j + 4);
      if (commentEnd === -1) return -1;
      j = commentEnd + 3;
    } else if (text.startsWith(open, j)) {
      depth++;
      j += 2;
    } else if (text.startsWith(close, j)) {
      if (--depth === 0) return j;
      j += 2;
    } else {
      j += skip.some((token) => text.startsWith(token, j)) ? 2 : 1;
    }
  }
  return -1;
}

/**
 * Finds the index of the matching closing "]]" for a "[[" starting at startIndex.
 * Balances nested "[[" and "]]" pairs so that media captions with wikilinks like
 * [[File:Flag.png|thumb|Flag of [[Urcea]]]] are captured in their entirety.
 */
export function findMatchingClosingBrackets(text: string, startIndex: number): number {
  return findMatchingClose(text, startIndex, "[[", "]]");
}

/**
 * Finds the index of the matching closing "}}" for a "{{" starting at startIndex.
 * Balances nested braces and comments; wikilink brackets are stepped over.
 */
export function findMatchingClosingBraces(text: string, startIndex: number): number {
  return findMatchingClose(text, startIndex, "{{", "}}", ["[[", "]]"]);
}

export function parseMediaLink(raw: string): ParsedMediaLink | null {
  const trimmed = raw.trim();
  if (!/^\[\[(File|Image):/i.test(trimmed) || !trimmed.endsWith("]]")) {
    return null;
  }

  const content = trimmed.slice(2, -2);
  const parts = splitBalancedPipes(content).map((p) => p.trim());
  if (parts.length === 0) return null;

  const colonIdx = parts[0]!.indexOf(":");
  if (colonIdx === -1) return null;
  const filename = parts[0]!.slice(colonIdx + 1).trim();

  let caption: string | undefined;
  let align: ParsedMediaLink["align"] = "thumb";
  let width: number | undefined;
  let height: number | undefined;

  for (const part of parts.slice(1)) {
    const size = /^(\d+)(?:x(\d+))?px$/i.exec(part);
    if (/^(left|right|center|none)$/i.test(part)) {
      align = part.toLowerCase() as ParsedMediaLink["align"];
    } else if (/^(thumb|thumbnail|frameless|frame)$/i.test(part)) {
      align = "thumb";
    } else if (size) {
      width = parseInt(size[1]!, 10);
      if (size[2]) height = parseInt(size[2], 10);
    } else {
      caption = part;
    }
  }

  return { filename, caption, align, width, height, raw };
}

interface InlineMatch {
  node: WikiInlineNode;
  end: number;
}

type InlineMatcher = (text: string, i: number) => InlineMatch | null;

/** The `[[...]]` span at i when it opens with one of `prefixes`: its raw text and end index. */
function bracketSpan(
  text: string,
  i: number,
  prefixes: string[]
): { raw: string; end: number } | null {
  if (!prefixes.some((prefix) => text.startsWith(prefix, i))) return null;
  const closeIdx = findMatchingClosingBrackets(text, i);
  return closeIdx === -1 ? null : { raw: text.slice(i, closeIdx + 2), end: closeIdx + 2 };
}

/** Splits `Head:value|extra` (the inside of `[[...]]`) at its first colon and pipe. */
function splitTypedLink(inner: string): { head: string; value: string; extra?: string } {
  const colonIdx = inner.indexOf(":");
  const pipeIdx = inner.indexOf("|");
  return {
    head: inner.slice(0, colonIdx),
    value: inner.slice(colonIdx + 1, pipeIdx !== -1 ? pipeIdx : undefined),
    extra: pipeIdx !== -1 ? inner.slice(pipeIdx + 1) : undefined,
  };
}

function parseLatLng(coords: string): { lat?: number; lng?: number } {
  const [latStr, lngStr] = coords.split(",");
  return {
    lat: latStr ? parseFloat(latStr) : undefined,
    lng: lngStr ? parseFloat(lngStr) : undefined,
  };
}

/** [[File:...]] or [[Image:...]] */
const matchMedia: InlineMatcher = (text, i) => {
  const span = bracketSpan(text, i, ["[[File:", "[[Image:"]);
  const media = span && parseMediaLink(span.raw);
  if (!span || !media) return null;
  const label = media.caption || media.filename;
  return {
    node: {
      type: "wiki-link",
      target: `File:${media.filename}`,
      label,
      children: [{ text: label }],
    },
    end: span.end,
  };
};

/** Engine data chips: [[CountryData:slug|metric]] */
const matchEngineData: InlineMatcher = (text, i) => {
  const span = bracketSpan(text, i, ["[[CountryData:", "[[BusinessData:", "[[DefenseData:"]);
  if (!span) return null;
  const { head, value, extra } = splitTypedLink(span.raw.slice(2, -2));
  return {
    node: {
      type: "chip-engine-data",
      connector: head as "CountryData" | "BusinessData" | "DefenseData",
      slug: value,
      metric: extra ?? "name",
      wikitext: span.raw,
      children: [{ text: "" }],
    },
    end: span.end,
  };
};

/** Coordinate chips: [[Coords:lat,lng|label]] or [[Coord:...]] */
const matchCoords: InlineMatcher = (text, i) => {
  const span = bracketSpan(text, i, ["[[Coords:", "[[Coord:"]);
  if (!span) return null;
  const { value: coords, extra } = splitTypedLink(span.raw.slice(2, -2));
  return {
    node: {
      type: "chip-coord",
      ...parseLatLng(coords),
      label: extra || coords,
      wikitext: span.raw,
      children: [{ text: "" }],
    },
    end: span.end,
  };
};

/** Standard wiki link: [[Target|Label]] or [[Target]] */
const matchWikiLink: InlineMatcher = (text, i) => {
  const span = bracketSpan(text, i, ["[["]);
  if (!span) return null;
  const raw = span.raw.slice(2, -2);
  const pipeIdx = raw.indexOf("|");
  const target = (pipeIdx !== -1 ? raw.slice(0, pipeIdx) : raw).trim();
  const label = pipeIdx !== -1 ? raw.slice(pipeIdx + 1).trim() : target;
  return {
    node: {
      type: "wiki-link",
      target,
      label: label !== target ? label : undefined,
      children: [{ text: label }],
    },
    end: span.end,
  };
};

/** External link: [URL Title] or [URL] */
const matchExternalLink: InlineMatcher = (text, i) => {
  if (!text.startsWith("[", i) || text.startsWith("[[", i)) return null;
  const closeIdx = text.indexOf("]", i);
  if (closeIdx === -1 || !/^https?:\/\//i.test(text.slice(i + 1))) return null;
  const inner = text.slice(i + 1, closeIdx).trim();
  const spaceIdx = inner.indexOf(" ");
  const url = spaceIdx !== -1 ? inner.slice(0, spaceIdx) : inner;
  const label = spaceIdx !== -1 ? inner.slice(spaceIdx + 1) : url;
  return {
    node: { type: "external-link", url, children: [{ text: label }] },
    end: closeIdx + 1,
  };
};

/** Citations: <ref>...</ref> or <ref name="foo" /> */
const matchCitation: InlineMatcher = (text, i) => {
  if (!text.startsWith("<ref", i)) return null;
  const closeTagIdx = text.indexOf("</ref>", i);
  const selfCloseIdx = text.indexOf("/>", i);
  const hasBody = closeTagIdx !== -1 && (selfCloseIdx === -1 || closeTagIdx < selfCloseIdx);
  if (!hasBody && selfCloseIdx === -1) return null;

  const end = hasBody ? closeTagIdx + 6 : selfCloseIdx + 2;
  const rawRef = text.slice(i, end);
  const openTagEnd = rawRef.indexOf(">");
  const openTag = hasBody ? rawRef.slice(0, openTagEnd) : rawRef;
  const nameMatch = /name=["']([^"']+)["']/i.exec(openTag);
  return {
    node: {
      type: "citation-ref",
      name: nameMatch ? nameMatch[1] : undefined,
      rawWikitext: rawRef,
      children: [{ text: hasBody ? rawRef.slice(openTagEnd + 1, -6) : "" }],
    },
    end,
  };
};

/** Inline templates and chips: {{TemplateName|...}} */
const matchTemplate: InlineMatcher = (text, i) => {
  if (!text.startsWith("{{", i)) return null;
  const closeIdx = findMatchingClosingBraces(text, i);
  if (closeIdx === -1) return null;

  const raw = text.slice(i, closeIdx + 2);
  const parts = splitBalancedPipes(text.slice(i + 2, closeIdx));
  const rawHead = parts[0]?.trim();
  if (!rawHead) return null;

  const { params, paramList, positional } = parseParameterList(parts);
  const classification = classifyTemplate(rawHead, params);
  const end = closeIdx + 2;

  if (classification === "chip-coord") {
    return {
      node: {
        type: "chip-coord",
        ...parseLatLng(positional[0] || ""),
        label: positional[1] || positional[0],
        wikitext: raw,
        children: [{ text: "" }],
      },
      end,
    };
  }
  if (classification === "chip-engine") {
    return {
      node: {
        type: "chip-engine-data",
        connector: "CountryData",
        slug: positional[0] || "",
        metric: positional[1] || "name",
        wikitext: raw,
        children: [{ text: "" }],
      },
      end,
    };
  }
  return {
    node: {
      type: "inline-template",
      templateName: rawHead,
      name: rawHead,
      params,
      paramList,
      positional,
      raw,
      rawWikitext: raw,
      children: [{ text: "" }],
    },
    end,
  };
};

const INLINE_MATCHERS: InlineMatcher[] = [
  matchMedia,
  matchEngineData,
  matchCoords,
  matchWikiLink,
  matchExternalLink,
  matchCitation,
  matchTemplate,
];

const SPECIAL_SYNTAX = ["[[", "[", "<ref", "{{", "'''", "''"];

export function parseInlineLinksAndFormatting(text: string): WikiInlineNode[] {
  const nodes: WikiInlineNode[] = [];
  let i = 0;

  while (i < text.length) {
    let match: InlineMatch | null = null;
    for (const matcher of INLINE_MATCHERS) {
      match = matcher(text, i);
      if (match) break;
    }
    if (match) {
      nodes.push(match.node);
      i = match.end;
      continue;
    }

    // Plain text up to the next special syntax; bold/italic marks are parsed inside it.
    const candidates = SPECIAL_SYNTAX.map((token) => text.indexOf(token, i)).filter(
      (pos) => pos > i
    );
    const nextSpecial = candidates.length > 0 ? Math.min(...candidates) : text.length;
    parseFormattedText(text.slice(i, nextSpecial), nodes);
    i = nextSpecial;
  }

  return nodes.length > 0 ? nodes : [{ text: "" }];
}

/** Pushes text nodes for `text`, toggling bold (''') and italic ('') at each mark. */
function parseFormattedText(text: string, nodes: WikiInlineNode[]): void {
  let bold = false;
  let italic = false;
  // The capture group makes split() keep the marks, so odd indexes are marks and even are text.
  text.split(/('''''|'''|'')/).forEach((piece, idx) => {
    if (idx % 2 === 1) {
      if (piece !== "''") bold = !bold;
      if (piece !== "'''") italic = !italic;
    } else if (piece) {
      nodes.push({ text: piece, ...(bold && { bold: true }), ...(italic && { italic: true }) });
    }
  });
}
