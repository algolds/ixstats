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

import { isTemplateOnlyLine, logicalLineEnd } from "./block-lines";
import { parseInlineLinksAndFormatting } from "./link-parser";
import { parseWikiList } from "./list-parser";
import { findTagClose, isCommentOnly, matchOpenTag, type OpenTag } from "./protected-regions";
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
  /** `input.lastIndexOf("}}")`, computed once for the whole scan. */
  lastClose: number;
}

/** A block found at a line start: its node and the index of the line break that ends its last line. */
interface Scanned {
  node: WikiBlockNode;
  lineEnd: number;
}

const HEADING = /^(={1,6})\s*(.+?)\s*\1$/;
const DIVIDER = /^----+$/;
const LIST_LINE = /^[*#:;]/;
const BLOCKQUOTE_OPEN = /^<blockquote[\s>]/i;
const BLOCKQUOTE_CLOSE = /<\/blockquote>/i;
/** A line that opens a table: `{|`, or a cell whose content starts one (`| {|`). */
const OPENS_TABLE = /^(?:[|!]\s*)?\{\|/;
const MAGIC_WORD_LINE = /^(?:__[A-Za-z0-9_]+__[ \t]*)+$/;
const REDIRECT_LINE = /^#redirect\s*:?\s*\[\[/i;

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

  const ctx: ScanContext = { input, diagnostics, lastClose: input.lastIndexOf("}}") };
  let cursor = 0; // end of the previous block
  let pos = 0; // start of the line being scanned

  while (pos < input.length) {
    const firstLineEnd = logicalLineEnd(input, pos, ctx.lastClose);
    const firstLine = input.slice(pos, firstLineEnd);
    if (firstLine.trim() === "") {
      pos = firstLineEnd + 1;
      continue;
    }

    const start = pos + (firstLine.length - firstLine.trimStart().length);
    const { node, lineEnd } = scanBlock(ctx, start, firstLineEnd, nodes.length === 0);
    const end = contentEnd(input, start, lineEnd);
    node.src = { start, end };
    node.raw = input.slice(start, end);
    if (node.type === "template" || node.type === "infobox" || node.type === "parser-function") {
      node.rawWikitext = node.raw;
    }
    node.sepBefore = input.slice(cursor, start);
    nodes.push(node);
    cursor = end;
    pos = lineEnd + 1;
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
  return isFirst && REDIRECT_LINE.test(line) ? rawBlock(ctx, start, lineEnd, "redirect") : null;
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
  return MAGIC_WORD_LINE.test(line) ? rawBlock(ctx, start, lineEnd, "magic-word") : null;
}

/**
 * The literal or extension tag (`<pre>`, `<nowiki>`, `<gallery>`, …) that is the whole logical
 * line starting at `start`, when it is closed and nothing follows its closing tag.
 */
function standaloneOpaqueTag(input: string, start: number, lineEnd: number): OpenTag | null {
  const tag = matchOpenTag(input, start);
  if (!tag || tag.name === "ref" || tag.selfClosing) return null;
  const close = findTagClose(input, tag);
  return close !== -1 && input.slice(close, lineEnd).trim() === "" ? tag : null;
}

function scanOpaqueTag(ctx: ScanContext, start: number, lineEnd: number): Scanned | null {
  const tag = standaloneOpaqueTag(ctx.input, start, lineEnd);
  if (tag) return rawBlock(ctx, start, lineEnd, "tag", tag.name);

  const open = matchOpenTag(ctx.input, start);
  if (open && open.name !== "ref" && !open.selfClosing && findTagClose(ctx.input, open) === -1) {
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

  const { parsed, end, closed } = scanTemplateAt(input, start);
  if (!parsed) return null;
  if (!closed) {
    ctx.diagnostics.push(unclosedTemplateDiagnostic(parsed, start, input.length));
    return { node: templateNode(parsed), lineEnd: input.length };
  }
  const lineEnd = Math.max(firstLineEnd, logicalLineEnd(input, end, ctx.lastClose));
  if (input.slice(end, lineEnd).trim() !== "") return null;
  return { node: templateNode(parsed), lineEnd };
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
    lineEnd = logicalLineEnd(input, pos, ctx.lastClose);
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
  const match = HEADING.exec(line);
  if (!match) return null;
  const level = Math.min(6, Math.max(1, match[1]!.length)) as 1 | 2 | 3 | 4 | 5 | 6;
  return {
    node: { type: "heading", level, children: parseInlineLinksAndFormatting(match[2]!) },
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
    const nextEnd = logicalLineEnd(input, lineEnd + 1, ctx.lastClose);
    const next = input.slice(lineEnd + 1, nextEnd);
    const nextChar = next.trim()[0];
    if (!nextChar || !LIST_LINE.test(nextChar)) break;
    if ((firstChar === "*" && nextChar === "#") || (firstChar === "#" && nextChar === "*")) break;
    lines.push(next);
    lineEnd = nextEnd;
  }
  return { node: parseWikiList(lines), lineEnd };
}

/** `<blockquote>…</blockquote>` that ends its line; anything else stays an ordinary paragraph. */
function scanBlockquote(
  ctx: ScanContext,
  line: string,
  start: number,
  firstLineEnd: number
): Scanned | null {
  if (!BLOCKQUOTE_OPEN.test(line)) return null;
  const { input } = ctx;
  let lineEnd = firstLineEnd;
  let segmentStart = start;
  while (!BLOCKQUOTE_CLOSE.test(input.slice(segmentStart, lineEnd))) {
    if (lineEnd >= input.length) return null;
    segmentStart = lineEnd + 1;
    lineEnd = logicalLineEnd(input, segmentStart, ctx.lastClose);
  }
  const raw = input.slice(start, contentEnd(input, start, lineEnd));
  const match = /^<blockquote[^>]*>([\s\S]*?)<\/blockquote>([\s\S]*)$/i.exec(raw);
  if (!match || match[2]!.trim() !== "") return null;
  return {
    node: { type: "blockquote", children: parseInlineLinksAndFormatting(match[1]!.trim()) },
    lineEnd,
  };
}

/** Whether the logical line `[start, lineEnd)` starts a block of its own, ending a paragraph. */
function startsNewBlock(input: string, start: number, lineEnd: number): boolean {
  const line = input.slice(start, lineEnd);
  const text = line.trim();
  return (
    text === "" ||
    HEADING.test(text) ||
    DIVIDER.test(text) ||
    LIST_LINE.test(text) ||
    text.startsWith("{|") ||
    BLOCKQUOTE_OPEN.test(text) ||
    MAGIC_WORD_LINE.test(text) ||
    isCommentOnly(text) ||
    isTemplateOnlyLine(text) ||
    standaloneOpaqueTag(input, start + line.length - line.trimStart().length, lineEnd) !== null
  );
}

/** Consecutive lines that start no other block. */
function scanParagraph(ctx: ScanContext, start: number, firstLineEnd: number): Scanned {
  const { input } = ctx;
  let lineEnd = firstLineEnd;
  while (lineEnd < input.length) {
    const nextEnd = logicalLineEnd(input, lineEnd + 1, ctx.lastClose);
    if (startsNewBlock(input, lineEnd + 1, nextEnd)) break;
    lineEnd = nextEnd;
  }
  const text = input.slice(start, contentEnd(input, start, lineEnd));
  return { node: { type: "paragraph", children: parseInlineLinksAndFormatting(text) }, lineEnd };
}
