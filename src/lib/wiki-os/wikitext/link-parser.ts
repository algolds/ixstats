/**
 * src/lib/wiki-os/wikitext/link-parser.ts — MediaWiki Link & Media Tokenizer.
 */

import { canonicalizeTitle } from "../core/title";
import { parseFileLinkInner } from "./file-params";
import { splitBalancedPipes, parseParameterList } from "./parameter-parser";
import { UNINDEXED, matchBraces, matchBrackets, type MatchIndex } from "./match-index";
import { findTagClose, matchOpenTag, skipProtectedAt } from "./protected-regions";
import { classifyTemplate } from "./resolver";
import type { WikiInlineNode, WikiTextNode } from "./types";

export interface ParsedMediaLink {
  filename: string;
  caption?: string;
  align?: "left" | "center" | "right" | "thumb" | "frameless";
  width?: number;
  height?: number;
  raw: string;
}

/**
 * Finds the index of the matching closing "]]" for a "[[" starting at startIndex.
 * Balances nested "[[" and "]]" pairs so that media captions with wikilinks like
 * [[File:Flag.png|thumb|Flag of [[Urcea]]]] are captured in their entirety.
 */
export function findMatchingClosingBrackets(
  text: string,
  startIndex: number,
  index?: MatchIndex
): number {
  if (!text.startsWith("[[", startIndex)) return -1;
  if (index && index[startIndex] !== UNINDEXED) return index[startIndex]!;
  let depth = 0;
  let inComment = false;
  let j = startIndex;
  while (j < text.length) {
    if (!inComment && text.startsWith("<!--", j)) {
      inComment = true;
      j += 4;
      continue;
    }
    if (inComment) {
      if (text.startsWith("-->", j)) {
        inComment = false;
        j += 3;
        continue;
      }
      j++;
      continue;
    }
    if (text.startsWith("[[", j)) {
      depth++;
      j += 2;
      continue;
    }
    if (text.startsWith("]]", j)) {
      depth--;
      if (depth === 0) {
        return j;
      }
      j += 2;
      continue;
    }
    j++;
  }
  return -1;
}

/**
 * Finds the index of the matching closing "}}" for a "{{" starting at startIndex.
 * Balances nested braces, wikilinks, and comments.
 */
export function findMatchingClosingBraces(
  text: string,
  startIndex: number,
  index?: MatchIndex
): number {
  if (!text.startsWith("{{", startIndex)) return -1;
  if (index && index[startIndex] !== UNINDEXED) return index[startIndex]!;
  let depth = 0;
  let linkDepth = 0;
  let inComment = false;
  let j = startIndex;
  while (j < text.length) {
    if (!inComment && text.startsWith("<!--", j)) {
      inComment = true;
      j += 4;
      continue;
    }
    if (inComment) {
      if (text.startsWith("-->", j)) {
        inComment = false;
        j += 3;
        continue;
      }
      j++;
      continue;
    }
    if (text.startsWith("[[", j)) {
      linkDepth++;
      j += 2;
      continue;
    }
    if (text.startsWith("]]", j)) {
      linkDepth = Math.max(0, linkDepth - 1);
      j += 2;
      continue;
    }
    if (text.startsWith("{{", j)) {
      depth++;
      j += 2;
      continue;
    }
    if (text.startsWith("}}", j)) {
      depth--;
      if (depth === 0) {
        return j;
      }
      j += 2;
      continue;
    }
    j++;
  }
  return -1;
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

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i]!;
    if (/^(left|right|center|none)$/i.test(part)) {
      align = part.toLowerCase() as ParsedMediaLink["align"];
    } else if (/^(thumb|thumbnail|frameless|frame)$/i.test(part)) {
      align = "thumb";
    } else if (/^(\d+)px$/i.test(part)) {
      width = parseInt(part, 10);
    } else if (/^(\d+)x(\d+)px$/i.test(part)) {
      const dim = /^(\d+)x(\d+)px$/i.exec(part);
      if (dim) {
        width = parseInt(dim[1]!, 10);
        height = parseInt(dim[2]!, 10);
      }
    } else {
      caption = part;
    }
  }

  return { filename, caption, align, width, height, raw };
}

type InlinePart =
  | { kind: "text"; text: string; literal: boolean }
  | { kind: "node"; node: WikiInlineNode };

/** The text being tokenised and where each of its `[[` and `{{` closes (built once, so the scan stays linear). */
interface InlineContext {
  text: string;
  brackets?: MatchIndex;
  braces?: MatchIndex;
}

interface InlineSpan {
  part: InlinePart;
  /** Index just after the construct. */
  end: number;
}

const nodeSpan = (node: WikiInlineNode, end: number): InlineSpan => ({
  part: { kind: "node", node },
  end,
});

/** Whether `target` names a file (namespace 6 under any alias or case) and is not a `[[:File:…]]` link to its page. */
function isFileTarget(target: string): boolean {
  if (!target.includes(":") || target.startsWith(":")) return false;
  try {
    return canonicalizeTitle(target)?.namespaceId === 6;
  } catch {
    // Text that is not valid Unicode (a lone surrogate) is no title; it must not stop the parse.
    return false;
  }
}

/** `[[File:…]]` and its aliases (`Image:`, any case): an embedded file, every parameter kept. */
function tryFileLink(ctx: InlineContext, i: number): InlineSpan | null {
  const { text } = ctx;
  const closeIdx = findMatchingClosingBrackets(text, i, ctx.brackets);
  if (closeIdx === -1) return null;
  const parsed = parseFileLinkInner(text.slice(i + 2, closeIdx));
  if (!isFileTarget(parsed.target)) return null;
  return nodeSpan(
    {
      type: "wiki-file",
      target: parsed.target,
      params: parsed.params,
      caption: parsed.caption,
      raw: text.slice(i, closeIdx + 2),
      children: [{ text: "" }],
    },
    closeIdx + 2
  );
}

const ENGINE_CONNECTORS = ["[[CountryData:", "[[BusinessData:", "[[DefenseData:"];

/** `[[CountryData:slug|metric]]` engine data chips. */
function tryEngineChip(ctx: InlineContext, i: number): InlineSpan | null {
  const { text } = ctx;
  if (!ENGINE_CONNECTORS.some((prefix) => text.startsWith(prefix, i))) return null;
  const closeIdx = findMatchingClosingBrackets(text, i, ctx.brackets);
  if (closeIdx === -1) return null;
  const raw = text.slice(i, closeIdx + 2);
  const inner = raw.slice(2, -2);
  const colonIdx = inner.indexOf(":");
  const pipeIdx = inner.indexOf("|");
  const connector = inner.slice(0, colonIdx) as "CountryData" | "BusinessData" | "DefenseData";
  const slug = pipeIdx !== -1 ? inner.slice(colonIdx + 1, pipeIdx) : inner.slice(colonIdx + 1);
  const metric = pipeIdx !== -1 ? inner.slice(pipeIdx + 1) : "name";
  return nodeSpan(
    { type: "chip-engine-data", connector, slug, metric, wikitext: raw, children: [{ text: "" }] },
    closeIdx + 2
  );
}

/** `[[Coords:lat,lng|label]]` coordinate chips. */
function tryCoordChip(ctx: InlineContext, i: number): InlineSpan | null {
  const { text } = ctx;
  if (!text.startsWith("[[Coords:", i) && !text.startsWith("[[Coord:", i)) return null;
  const closeIdx = findMatchingClosingBrackets(text, i, ctx.brackets);
  if (closeIdx === -1) return null;
  const raw = text.slice(i, closeIdx + 2);
  const inner = raw.slice(2, -2);
  const colonIdx = inner.indexOf(":");
  const pipeIdx = inner.indexOf("|");
  const coords = pipeIdx !== -1 ? inner.slice(colonIdx + 1, pipeIdx) : inner.slice(colonIdx + 1);
  const label = pipeIdx !== -1 ? inner.slice(pipeIdx + 1) : undefined;
  const [latStr, lngStr] = coords.split(",");
  return nodeSpan(
    {
      type: "chip-coord",
      lat: latStr ? parseFloat(latStr) : undefined,
      lng: lngStr ? parseFloat(lngStr) : undefined,
      label: label || coords,
      wikitext: raw,
      children: [{ text: "" }],
    },
    closeIdx + 2
  );
}

/** The label of a link as text with its own quote marks: `[[A|''b'']]` has the italic text "b". */
function labelNodes(label: string): WikiInlineNode[] {
  return applyQuoteMarks([{ kind: "text", text: label, literal: false }]);
}

/** Standard wiki link: `[[Target|Label]]` or `[[Target]]`. */
function tryWikiLink(ctx: InlineContext, i: number): InlineSpan | null {
  const { text } = ctx;
  const closeIdx = findMatchingClosingBrackets(text, i, ctx.brackets);
  if (closeIdx === -1) return null;
  const inner = text.slice(i + 2, closeIdx);
  const pipeIdx = inner.indexOf("|");
  const target = pipeIdx !== -1 ? inner.slice(0, pipeIdx).trim() : inner.trim();
  // `[[|120px|center]]` has no page to link to: MediaWiki shows it as the text it is, and so do we,
  // so that regenerating its block never strips the brackets.
  if (target === "") return null;
  const label = pipeIdx !== -1 ? inner.slice(pipeIdx + 1).trim() : target;
  return nodeSpan(
    {
      type: "wiki-link",
      target,
      label: label !== target ? label : undefined,
      raw: text.slice(i, closeIdx + 2),
      children: labelNodes(label),
    },
    closeIdx + 2
  );
}

/** External link: `[https://url Title]` or `[https://url]`. */
function tryExternalLink(text: string, i: number): InlineSpan | null {
  const closeIdx = text.indexOf("]", i);
  if (closeIdx === -1 || !/^https?:\/\//i.test(text.slice(i + 1, i + 9))) return null;
  const inner = text.slice(i + 1, closeIdx).trim();
  const spaceIdx = inner.indexOf(" ");
  const url = spaceIdx !== -1 ? inner.slice(0, spaceIdx) : inner;
  const label = spaceIdx !== -1 ? inner.slice(spaceIdx + 1) : url;
  return nodeSpan(
    {
      type: "external-link",
      url,
      raw: text.slice(i, closeIdx + 1),
      children: labelNodes(label),
    },
    closeIdx + 1
  );
}

const REF_NAME = /name\s*=\s*["']?([^"'\s>/]+)/i;

/** `<ref>…</ref>` and `<ref name="a" />`; an unclosed `<ref>` is left as text. */
function tryRef(text: string, i: number): InlineSpan | null {
  const tag = matchOpenTag(text, i);
  if (tag?.name !== "ref") return null;
  const end = findTagClose(text, tag);
  if (end === -1) return null;
  const rawRef = text.slice(i, end);
  const nameMatch = REF_NAME.exec(text.slice(i, tag.openEnd));
  const content = tag.selfClosing ? "" : rawRef.slice(tag.openEnd - i, rawRef.lastIndexOf("</"));
  return nodeSpan(
    {
      type: "citation-ref",
      name: nameMatch ? nameMatch[1] : undefined,
      rawWikitext: rawRef,
      children: [{ text: content }],
    },
    end
  );
}

/** Inline template or chip: `{{TemplateName|…}}`. */
function tryInlineTemplate(ctx: InlineContext, i: number): InlineSpan | null {
  const { text } = ctx;
  const closeIdx = findMatchingClosingBraces(text, i, ctx.braces);
  if (closeIdx === -1) return null;
  const raw = text.slice(i, closeIdx + 2);
  const parts = splitBalancedPipes(text.slice(i + 2, closeIdx));
  const rawHead = parts[0]?.trim() ?? "";
  if (!rawHead) return null;

  const { params, paramList, positional } = parseParameterList(parts);
  const classification = classifyTemplate(rawHead, params);
  const end = closeIdx + 2;

  if (classification === "chip-coord") {
    const [latStr, lngStr] = (positional[0] || "").split(",");
    return nodeSpan(
      {
        type: "chip-coord",
        lat: latStr ? parseFloat(latStr) : undefined,
        lng: lngStr ? parseFloat(lngStr) : undefined,
        label: positional[1] || positional[0],
        wikitext: raw,
        children: [{ text: "" }],
      },
      end
    );
  }
  if (classification === "chip-engine") {
    return nodeSpan(
      {
        type: "chip-engine-data",
        connector: "CountryData",
        slug: positional[0] || "",
        metric: positional[1] || "name",
        wikitext: raw,
        children: [{ text: "" }],
      },
      end
    );
  }
  return nodeSpan(
    {
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
    end
  );
}

/** The inline construct that starts at `text[i]`, or null when `text[i]` is ordinary text. */
function tryInlineConstruct(ctx: InlineContext, i: number): InlineSpan | null {
  const { text } = ctx;
  switch (text[i]) {
    case "[":
      if (text.startsWith("[[", i)) {
        return (
          tryFileLink(ctx, i) ??
          tryEngineChip(ctx, i) ??
          tryCoordChip(ctx, i) ??
          tryWikiLink(ctx, i)
        );
      }
      return tryExternalLink(text, i);
    case "<": {
      // Comments and literal tags are copied as they are: nothing inside them is wikitext.
      const end = skipProtectedAt(text, i);
      if (end !== null) {
        return { part: { kind: "text", text: text.slice(i, end), literal: true }, end };
      }
      return tryRef(text, i);
    }
    case "{":
      return text.startsWith("{{", i) ? tryInlineTemplate(ctx, i) : null;
    default:
      return null;
  }
}

/** Splits `text` into inline nodes and the plain text between them (quote marks still in the text). */
function tokenizeInline(text: string): InlinePart[] {
  const parts: InlinePart[] = [];
  const ctx: InlineContext = {
    text,
    brackets: text.includes("[[") ? matchBrackets(text) : undefined,
    braces: text.includes("{{") ? matchBraces(text) : undefined,
  };
  const special = /[[<{]/g;
  let i = 0;
  while (i < text.length) {
    const span = tryInlineConstruct(ctx, i);
    if (span) {
      parts.push(span.part);
      i = span.end;
      continue;
    }
    // Plain text up to the next character that may start a construct (this one failed to).
    special.lastIndex = i + 1;
    const next = special.exec(text);
    const end = next ? next.index : text.length;
    parts.push({ kind: "text", text: text.slice(i, end), literal: false });
    i = end;
  }
  return parts;
}

function withMarks(node: WikiInlineNode, bold: boolean, italic: boolean): WikiInlineNode {
  if (!bold && !italic) return node;
  return { ...node, ...(bold ? { bold: true } : {}), ...(italic ? { italic: true } : {}) };
}

const isPlainText = (node: WikiInlineNode): node is WikiTextNode => !("type" in node);

function pushMarkedText(out: WikiInlineNode[], text: string, bold: boolean, italic: boolean): void {
  if (text === "") return;
  const prev = out[out.length - 1];
  if (prev && isPlainText(prev) && Boolean(prev.bold) === bold && Boolean(prev.italic) === italic) {
    prev.text += text;
    return;
  }
  out.push({ text, ...(bold ? { bold: true } : {}), ...(italic ? { italic: true } : {}) });
}

/**
 * MediaWiki quote marks over a whole inline sequence: two quotes toggle italic, three bold, five both
 * (four are an apostrophe and bold; more than five leave the extra apostrophes as text). The state
 * runs across links, chips and references and is reset at every line break.
 */
function applyQuoteMarks(parts: InlinePart[]): WikiInlineNode[] {
  const out: WikiInlineNode[] = [];
  let bold = false;
  let italic = false;

  for (const part of parts) {
    if (part.kind === "node") {
      out.push(withMarks(part.node, bold, italic));
      continue;
    }
    if (part.literal) {
      pushMarkedText(out, part.text, bold, italic);
      continue;
    }
    const runs = /'{2,}|\n/g;
    let last = 0;
    let match: RegExpExecArray | null;
    while ((match = runs.exec(part.text)) !== null) {
      pushMarkedText(out, part.text.slice(last, match.index), bold, italic);
      if (match[0] === "\n") {
        // The marks end before the line break; the break itself belongs to the next slice.
        bold = false;
        italic = false;
        last = match.index;
        continue;
      }
      const quotes = match[0].length;
      if (quotes === 2) {
        italic = !italic;
      } else if (quotes === 3) {
        bold = !bold;
      } else {
        pushMarkedText(out, "'".repeat(quotes === 4 ? 1 : quotes - 5), bold, italic);
        bold = !bold;
        italic = quotes === 4 ? italic : !italic;
      }
      last = match.index + quotes;
    }
    pushMarkedText(out, part.text.slice(last), bold, italic);
  }

  return out.length > 0 ? out : [{ text: "" }];
}

export function parseInlineLinksAndFormatting(text: string): WikiInlineNode[] {
  return applyQuoteMarks(tokenizeInline(text));
}
