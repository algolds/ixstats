/**
 * src/lib/wiki-os/wikitext/parser.ts — Universal Tolerant MediaWiki Parser.
 *
 * Invariant 5: Malformed user input never crashes the parser.
 * Invariant 6: Parse failure is never silent data loss.
 * Invariant 8: Grammar and semantics stay strictly separate.
 *
 * Every top-level block records its exact slice of the input (`src`, `raw`) and the text before it
 * (`sepBefore`); with `trailing` they rebuild the input byte for byte, which lets the visual editor
 * save untouched blocks unchanged. Constructs the editable model cannot represent faithfully
 * (nested tables, `<pre>`, `<nowiki>`, top-level comments, magic words, a redirect, a block with a
 * parse diagnostic) become atomic `raw` blocks.
 */

import { isBlank } from "./blank";
import { isTemplateOnlyLine, logicalLineEnd } from "./block-lines";
import { forwardFinder } from "./forward-finder";
import { isMagicWordLine, matchHeading, startsRedirect } from "./line-patterns";
import { parseInlineLinksAndFormatting } from "./link-parser";
import { parseWikiList } from "./list-parser";
import { matchBraces, type MatchIndex } from "./match-index";
import {
  findTagClose,
  isCommentOnly,
  matchOpenTag,
  ProtectedScanner,
  type OpenTag,
} from "./protected-regions";
import { parseWikitable } from "./table-parser";
import { scanTemplateAt, unclosedTemplateDiagnostic } from "./template-parser";
import type {
  WikiBlockNode,
  ParseResult,
  Diagnostic,
  WikiInfoboxBlock,
  WikiRawConstruct,
  WikiRawNode,
  WikiTemplateNode,
  WikiParserFunctionBlock,
  ParsedTemplate,
} from "./types";

interface ScanContext {
  input: string;
  diagnostics: Diagnostic[];
  /** Where every `{{` of the input closes, computed once for the whole scan. */
  braces: MatchIndex;
  /** What the scan of the input keeps about its tags, built once so the scan stays linear. */
  scanner: ProtectedScanner;
  /** The first `</blockquote>` at or after a position: blocks only ever start further on. */
  nextBlockquoteClose: (from: number) => number;
  /** The last walk to the line with a `</blockquote>`, which a block that starts after it finds the same. */
  blockquoteEnd?: BlockquoteEnd;
  /** Whether what follows the last `</blockquote>` looked at is blank on its line. */
  blockquoteTail?: { from: number; to: number; blank: boolean };
}

/** Where the first `</blockquote>` at or after a block's start is, and where its logical line (and the text of it) ends. */
interface BlockquoteEnd {
  /** The block the walk began at: any block from here to `at` finds the same closer. */
  from: number;
  /** The closer's index (-1: there is none in the rest of the input). */
  at: number;
  lineEnd: number;
  contentEnd: number;
}

/** A block found at a line start: its node and the index of the line break that ends its last line. */
interface Scanned {
  node: WikiBlockNode;
  lineEnd: number;
  /** Where the next block starts when this one ends before the end of its line (an infobox followed by text). */
  resumeAt?: number;
}

const DIVIDER = /^----+$/;
const LIST_LINE = /^[*#:;]/;
const BLOCKQUOTE_OPEN = /^<blockquote[\s>]/i;
const BLOCKQUOTE_CLOSE = /<\/blockquote>/i;
/** A line that opens a table: `{|`, or a cell whose content starts one (`| {|`). */
const OPENS_TABLE = /^(?:[|!]\s*)?\{\|/;

export function parse(input: string, options?: { title?: string; slug?: string }): ParseResult {
  const title = options?.title || "";
  const slug = options?.slug || "";
  const diagnostics: Diagnostic[] = [];
  const nodes: WikiBlockNode[] = [];

  if (!input || input.trim() === "") {
    return {
      ast: { title, slug, version: 1, nodes: [], trailing: input, diagnostics: [] },
      diagnostics: [],
    };
  }

  const ctx: ScanContext = {
    input,
    diagnostics,
    braces: matchBraces(input),
    scanner: new ProtectedScanner(input),
    nextBlockquoteClose: forwardFinder(input, /<\/blockquote>/gi),
  };
  let cursor = 0; // end of the previous block
  let pos = 0; // start of the line being scanned

  while (pos < input.length) {
    const firstLineEnd = logicalLineEnd(input, pos, ctx.braces, ctx.scanner);
    const firstLine = input.slice(pos, firstLineEnd);
    if (firstLine.trim() === "") {
      pos = firstLineEnd + 1;
      continue;
    }

    const start = pos + (firstLine.length - firstLine.trimStart().length);
    const { node, lineEnd, resumeAt } = scanBlock(ctx, start, firstLineEnd, nodes.length === 0);
    const end = contentEnd(input, start, resumeAt ?? lineEnd);
    node.src = { start, end };
    node.raw = input.slice(start, end);
    if (node.type === "template" || node.type === "infobox" || node.type === "parser-function") {
      node.rawWikitext = node.raw;
    }
    node.sepBefore = input.slice(cursor, start);
    nodes.push(node);
    cursor = end;
    pos = resumeAt ?? lineEnd + 1;
  }

  return {
    ast: { title, slug, version: 1, nodes, trailing: input.slice(cursor), diagnostics },
    diagnostics,
  };
}

/** End of the block's last character: `lineEnd` without the whitespace that trails its last line. */
function contentEnd(input: string, start: number, lineEnd: number): number {
  let end = lineEnd;
  while (end > start && /\s/.test(input[end - 1]!)) end--;
  return end;
}

function scanBlock(
  ctx: ScanContext,
  start: number,
  firstLineEnd: number,
  isFirst: boolean
): Scanned {
  const line = ctx.input.slice(start, firstLineEnd).trimEnd();
  return (
    scanRedirect(ctx, line, start, firstLineEnd, isFirst) ??
    scanCommentOrMagicWord(ctx, line, start, firstLineEnd) ??
    scanOpaqueTag(ctx, start, firstLineEnd) ??
    scanTemplateBlock(ctx, start, firstLineEnd) ??
    scanTable(ctx, line, start, firstLineEnd) ??
    scanHeadingOrDivider(line, firstLineEnd) ??
    scanList(ctx, line, start, firstLineEnd) ??
    scanBlockquote(ctx, line, start, firstLineEnd) ??
    scanParagraph(ctx, start, firstLineEnd)
  );
}

function rawBlock(
  ctx: ScanContext,
  start: number,
  lineEnd: number,
  construct: WikiRawConstruct,
  tag?: string
): Scanned {
  const raw = ctx.input.slice(start, contentEnd(ctx.input, start, lineEnd));
  const node: WikiRawNode = {
    type: "raw",
    raw,
    rawWikitext: raw,
    reason: construct === "malformed" ? "malformed" : "unrecognized",
    construct,
    ...(tag ? { tag } : {}),
    children: [{ text: "" }],
  };
  return { node, lineEnd };
}

function warn(ctx: ScanContext, code: string, message: string, start: number, end: number): void {
  ctx.diagnostics.push({ severity: "warning", message, start, end, code });
}

/** `#REDIRECT [[Target]]` at the very start of a page: not a numbered list. */
function scanRedirect(
  ctx: ScanContext,
  line: string,
  start: number,
  lineEnd: number,
  isFirst: boolean
): Scanned | null {
  return isFirst && startsRedirect(line) ? rawBlock(ctx, start, lineEnd, "redirect") : null;
}

/** A line of comments only, or of `__NOTOC__`-style magic words. */
function scanCommentOrMagicWord(
  ctx: ScanContext,
  line: string,
  start: number,
  lineEnd: number
): Scanned | null {
  if (line.startsWith("<!--")) {
    if (!line.includes("-->")) {
      warn(ctx, "UNCLOSED_COMMENT", "Unclosed HTML comment", start, ctx.input.length);
      return rawBlock(ctx, start, lineEnd, "malformed");
    }
    if (isCommentOnly(line)) return rawBlock(ctx, start, lineEnd, "comment");
  }
  return isMagicWordLine(line) ? rawBlock(ctx, start, lineEnd, "magic-word") : null;
}

/**
 * The literal or extension tag (`<pre>`, `<nowiki>`, `<gallery>`, …) that is the whole logical
 * line starting at `start`, when it is closed and nothing follows its closing tag.
 */
function standaloneOpaqueTag(ctx: ScanContext, start: number, lineEnd: number): OpenTag | null {
  const { input, scanner } = ctx;
  const tag = matchOpenTag(input, start, scanner);
  if (!tag || tag.name === "ref" || tag.selfClosing) return null;
  const close = findTagClose(tag, scanner);
  return close !== -1 && input.slice(close, lineEnd).trim() === "" ? tag : null;
}

function scanOpaqueTag(ctx: ScanContext, start: number, lineEnd: number): Scanned | null {
  const tag = standaloneOpaqueTag(ctx, start, lineEnd);
  if (tag) return rawBlock(ctx, start, lineEnd, "tag", tag.name);

  const open = matchOpenTag(ctx.input, start, ctx.scanner);
  if (open && open.name !== "ref" && !open.selfClosing && findTagClose(open, ctx.scanner) === -1) {
    // MediaWiki shows an unclosed tag as text, so the block is the paragraph that holds it.
    warn(ctx, "UNCLOSED_TAG", `Unclosed <${open.name}> tag`, start, lineEnd);
    return rawBlock(ctx, start, scanParagraph(ctx, start, lineEnd).lineEnd, "malformed", open.name);
  }
  return null;
}

/** A template (or parser function) that is alone on its line. */
function scanTemplateBlock(ctx: ScanContext, start: number, firstLineEnd: number): Scanned | null {
  const { input } = ctx;
  if (!input.startsWith("{{", start)) return null;

  const { parsed, end, closed } = scanTemplateAt(input, start, ctx.scanner);
  if (!parsed) return null;
  if (!closed) {
    ctx.diagnostics.push(unclosedTemplateDiagnostic(parsed, start, input.length));
    return { node: templateNode(parsed), lineEnd: input.length };
  }
  const lineEnd = Math.max(firstLineEnd, logicalLineEnd(input, end, ctx.braces, ctx.scanner));
  if (input.slice(end, lineEnd).trim() === "") return { node: templateNode(parsed), lineEnd };
  // An infobox is a block even when text follows it on its line; the text is the next block.
  if (parsed.classification === "infobox" && !parsed.isParserFunction) {
    return { node: templateNode(parsed), lineEnd: end, resumeAt: end };
  }
  return null;
}

function templateNode(tmpl: ParsedTemplate): WikiBlockNode {
  if (tmpl.isParserFunction) {
    const pfnNode: WikiParserFunctionBlock = {
      type: "parser-function",
      functionName: tmpl.functionName || tmpl.name,
      expression: tmpl.expression || "",
      branches: tmpl.branches || [],
      raw: tmpl.raw,
      rawWikitext: tmpl.raw,
      source: tmpl.source,
      parseState: tmpl.parseState,
      children: [{ text: "" }],
    };
    return pfnNode;
  }
  if (tmpl.classification === "infobox") {
    const infoboxNode: WikiInfoboxBlock = {
      type: "infobox",
      templateName: tmpl.name,
      title: tmpl.params["name"] || tmpl.params["title"] || tmpl.name,
      params: tmpl.params,
      paramList: tmpl.paramList,
      positional: tmpl.positional,
      classification: "infobox",
      raw: tmpl.raw,
      rawWikitext: tmpl.raw,
      source: tmpl.source,
      parseState: tmpl.parseState,
      children: [{ text: "" }],
    };
    return infoboxNode;
  }
  const tmplNode: WikiTemplateNode = {
    type: "template",
    templateName: tmpl.name,
    name: tmpl.name,
    params: tmpl.params,
    paramList: tmpl.paramList,
    positional: tmpl.positional,
    classification: tmpl.classification,
    raw: tmpl.raw,
    rawWikitext: tmpl.raw,
    source: tmpl.source,
    parseState: tmpl.parseState,
    children: [{ text: "" }],
  };
  return tmplNode;
}

interface TableScan {
  lineEnd: number;
  closed: boolean;
  construct: WikiRawConstruct | null;
}

/** Walks a table's logical lines to its matching `|}` and notes what the editable model cannot hold. */
function walkTable(ctx: ScanContext, firstLineEnd: number): TableScan {
  const { input } = ctx;
  let depth = 1;
  let lineEnd = firstLineEnd;
  let cellActive = false;
  let construct: WikiRawConstruct | null = null;
  let pos = firstLineEnd + 1;

  while (depth > 0 && pos < input.length) {
    lineEnd = logicalLineEnd(input, pos, ctx.braces, ctx.scanner);
    const text = input.slice(pos, lineEnd).trim();
    pos = lineEnd + 1;
    if (OPENS_TABLE.test(text)) {
      depth++;
      construct ??= "nested-table";
    } else if (text.startsWith("|}")) {
      depth--;
    } else if (text.startsWith("|-")) {
      cellActive = false;
    } else if (text.startsWith("|") || text.startsWith("!")) {
      cellActive = text.startsWith("|+") ? cellActive : true;
    } else if (text !== "") {
      // Neither row nor cell syntax: a template on its own line, or text with no cell to hold it.
      if (isTemplateOnlyLine(text)) construct ??= "table-template";
      else if (!cellActive) construct ??= "table-orphan-line";
    }
  }
  return { lineEnd, closed: depth === 0, construct };
}

function scanTable(
  ctx: ScanContext,
  line: string,
  start: number,
  firstLineEnd: number
): Scanned | null {
  if (!line.startsWith("{|")) return null;
  const walked = walkTable(ctx, firstLineEnd);
  if (!walked.closed) {
    warn(ctx, "UNCLOSED_TABLE", "Unclosed table", start, ctx.input.length);
    return rawBlock(ctx, start, walked.lineEnd, "malformed");
  }
  if (walked.construct) return rawBlock(ctx, start, walked.lineEnd, walked.construct);

  const raw = ctx.input.slice(start, contentEnd(ctx.input, start, walked.lineEnd));
  try {
    return { node: parseWikitable(raw), lineEnd: walked.lineEnd };
  } catch {
    return rawBlock(ctx, start, walked.lineEnd, "malformed");
  }
}

/** `== Heading ==` and `----`, each a single line. */
function scanHeadingOrDivider(line: string, lineEnd: number): Scanned | null {
  if (DIVIDER.test(line)) return { node: { type: "divider", children: [{ text: "" }] }, lineEnd };
  const heading = matchHeading(line);
  if (!heading) return null;
  const level = heading.level as 1 | 2 | 3 | 4 | 5 | 6;
  return {
    node: { type: "heading", level, children: parseInlineLinksAndFormatting(heading.title) },
    lineEnd,
  };
}

/** Consecutive `*`, `#`, `:` and `;` lines; a switch between bullets and numbers starts a new list. */
function scanList(
  ctx: ScanContext,
  line: string,
  start: number,
  firstLineEnd: number
): Scanned | null {
  if (!LIST_LINE.test(line)) return null;
  const { input } = ctx;
  const firstChar = line[0]!;
  const lines = [input.slice(start, firstLineEnd)];
  let lineEnd = firstLineEnd;

  while (lineEnd < input.length) {
    const nextEnd = logicalLineEnd(input, lineEnd + 1, ctx.braces, ctx.scanner);
    const next = input.slice(lineEnd + 1, nextEnd);
    const nextChar = next.trim()[0];
    if (!nextChar || !LIST_LINE.test(nextChar)) break;
    if ((firstChar === "*" && nextChar === "#") || (firstChar === "#" && nextChar === "*")) break;
    lines.push(next);
    lineEnd = nextEnd;
  }
  // The whitespace after the last item belongs to the page, not to the block.
  lines[lines.length - 1] = lines[lines.length - 1]!.trimEnd();
  return { node: parseWikiList(lines), lineEnd };
}

/** `<blockquote>…</blockquote>` that ends its line; anything else stays an ordinary paragraph. */
/**
 * The walk, line by line, from the block at `start` to the logical line that holds the first `</blockquote>` (null
 * when none follows). Once a walk has found it, every block from there to that closer finds the same line without
 * walking: a page of `<blockquote>` lines that never close, or that close once with text after, is one walk.
 */
function blockquoteEnd(
  ctx: ScanContext,
  start: number,
  firstLineEnd: number
): BlockquoteEnd | null {
  const known = ctx.blockquoteEnd;
  if (known && start >= known.from && (known.at === -1 || start <= known.at)) {
    return known.at === -1 ? null : known;
  }
  const { input } = ctx;
  let segmentStart = start;
  let lineEnd = firstLineEnd;
  for (;;) {
    const closer = BLOCKQUOTE_CLOSE.exec(input.slice(segmentStart, lineEnd));
    if (closer) {
      const found = {
        from: start,
        at: segmentStart + closer.index,
        lineEnd,
        contentEnd: contentEnd(input, start, lineEnd),
      };
      ctx.blockquoteEnd = found;
      return found;
    }
    if (lineEnd >= input.length) {
      ctx.blockquoteEnd = { from: start, at: -1, lineEnd, contentEnd: lineEnd };
      return null;
    }
    segmentStart = lineEnd + 1;
    lineEnd = logicalLineEnd(input, segmentStart, ctx.braces, ctx.scanner);
  }
}

/** Whether `[from, to)` is blank: asked of the same text by every block that ends at one closer, so remembered. */
function isBlankRange(ctx: ScanContext, from: number, to: number): boolean {
  const known = ctx.blockquoteTail;
  if (known?.from === from && known.to === to) return known.blank;
  let at = from;
  while (at < to && isBlank(ctx.input.charCodeAt(at))) at++;
  ctx.blockquoteTail = { from, to, blank: at === to };
  return at === to;
}

const BLOCKQUOTE_CLOSE_LENGTH = "</blockquote>".length;
const BLOCKQUOTE_OPEN_LENGTH = "<blockquote".length;

function scanBlockquote(
  ctx: ScanContext,
  line: string,
  start: number,
  firstLineEnd: number
): Scanned | null {
  if (!BLOCKQUOTE_OPEN.test(line)) return null;
  const end = blockquoteEnd(ctx, start, firstLineEnd);
  if (!end) return null;
  // What `/^<blockquote[^>]*>([\s\S]*?)<\/blockquote>([\s\S]*)$/i` read from the block's text: the opening tag to its
  // first `>`, the text up to the first `</blockquote>` after it, and nothing but blanks after that.
  const tagEnd = ctx.scanner.nextGreaterThan(start + BLOCKQUOTE_OPEN_LENGTH);
  if (tagEnd === -1 || tagEnd >= end.contentEnd) return null;
  const closeAt = ctx.nextBlockquoteClose(tagEnd + 1);
  const closeEnd = closeAt + BLOCKQUOTE_CLOSE_LENGTH;
  if (closeAt === -1 || closeEnd > end.contentEnd || !isBlankRange(ctx, closeEnd, end.contentEnd)) {
    return null;
  }
  const inner = ctx.input.slice(tagEnd + 1, closeAt).trim();
  return {
    node: { type: "blockquote", children: parseInlineLinksAndFormatting(inner) },
    lineEnd: end.lineEnd,
  };
}

/** Whether the logical line `[start, lineEnd)` starts a block of its own, ending a paragraph. */
function startsNewBlock(ctx: ScanContext, start: number, lineEnd: number): boolean {
  const line = ctx.input.slice(start, lineEnd);
  const text = line.trim();
  return (
    text === "" ||
    matchHeading(text) !== null ||
    DIVIDER.test(text) ||
    LIST_LINE.test(text) ||
    text.startsWith("{|") ||
    BLOCKQUOTE_OPEN.test(text) ||
    isMagicWordLine(text) ||
    isCommentOnly(text) ||
    isTemplateOnlyLine(text) ||
    standaloneOpaqueTag(ctx, start + line.length - line.trimStart().length, lineEnd) !== null
  );
}

/** Consecutive lines that start no other block. */
function scanParagraph(ctx: ScanContext, start: number, firstLineEnd: number): Scanned {
  const { input } = ctx;
  let lineEnd = firstLineEnd;
  while (lineEnd < input.length) {
    const nextEnd = logicalLineEnd(input, lineEnd + 1, ctx.braces, ctx.scanner);
    if (startsNewBlock(ctx, lineEnd + 1, nextEnd)) break;
    lineEnd = nextEnd;
  }
  const text = input.slice(start, contentEnd(input, start, lineEnd));
  return { node: { type: "paragraph", children: parseInlineLinksAndFormatting(text) }, lineEnd };
}
