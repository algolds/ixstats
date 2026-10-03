/**
 * Universal tolerant MediaWiki parser.
 *
 * Invariant 5: Malformed user input never crashes the parser.
 * Invariant 6: Parse failure is never silent data loss.
 * Invariant 8: Grammar and semantics stay strictly separate.
 */

import { scanTemplates } from "./template-parser";
import { parseWikitable } from "./table-parser";
import { parseWikiList } from "./list-parser";
import { parseInlineLinksAndFormatting } from "./link-parser";
import type { WikiBlockNode, ParseResult, Diagnostic, ParsedTemplate } from "./types";

function templateToBlock(tmpl: ParsedTemplate): WikiBlockNode {
  const common = {
    raw: tmpl.raw,
    rawWikitext: tmpl.raw,
    source: tmpl.source,
    parseState: tmpl.parseState,
    children: [{ text: "" }] as [{ text: "" }],
  };

  if (tmpl.isParserFunction) {
    return {
      type: "parser-function",
      functionName: tmpl.functionName || tmpl.name,
      expression: tmpl.expression || "",
      branches: tmpl.branches || [],
      ...common,
    };
  }

  const templateFields = {
    templateName: tmpl.name,
    params: tmpl.params,
    paramList: tmpl.paramList,
    positional: tmpl.positional,
  };
  if (tmpl.classification === "infobox") {
    return {
      type: "infobox",
      title: tmpl.params["name"] || tmpl.params["title"] || tmpl.name,
      classification: "infobox",
      ...templateFields,
      ...common,
    };
  }
  return {
    type: "template",
    name: tmpl.name,
    classification: tmpl.classification,
    ...templateFields,
    ...common,
  };
}

export function parse(input: string, options?: { title?: string; slug?: string }): ParseResult {
  const title = options?.title || "";
  const slug = options?.slug || "";
  const diagnostics: Diagnostic[] = [];
  const nodes: WikiBlockNode[] = [];

  if (!input || input.trim() === "") {
    return {
      ast: { title, slug, version: 1, nodes: [], diagnostics: [] },
      diagnostics: [],
    };
  }

  const { templates, diagnostics: tmplDiags } = scanTemplates(input);
  diagnostics.push(...tmplDiags);

  // Inline templates stay inside running text and are parsed as inline nodes by
  // parseInlineLinksAndFormatting; only block-level ones become nodes of their own.
  let cursor = 0;
  for (const tmpl of templates.filter((t) => isBlockTemplate(t, input))) {
    if (tmpl.source.start > cursor) parseTextBlocks(input.slice(cursor, tmpl.source.start), nodes);
    nodes.push(templateToBlock(tmpl));
    cursor = tmpl.source.end;
  }
  if (cursor < input.length) parseTextBlocks(input.slice(cursor), nodes);

  return {
    ast: { title, slug, version: 1, nodes, diagnostics },
    diagnostics,
  };
}

const DIVIDER = /^----+$/;
const LIST_START = /^[*#:;]/;
const BLOCKQUOTE_START = /^<blockquote[\s>]/i;

/** Lines from `from` through the first one `isLast` accepts (or the end of the text). */
function takeThrough(lines: string[], from: number, isLast: (line: string) => boolean): string[] {
  let end = from;
  while (end < lines.length) {
    const last = isLast(lines[end]!);
    end++;
    if (last) break;
  }
  return lines.slice(from, end);
}

interface BlockMatch {
  nodes: WikiBlockNode[];
  /** Index of the first line after the block. */
  next: number;
}

type BlockMatcher = (lines: string[], i: number, trimmed: string) => BlockMatch | null;

const paragraph = (text: string): WikiBlockNode => ({
  type: "paragraph",
  children: parseInlineLinksAndFormatting(text),
});

const matchDivider: BlockMatcher = (_lines, i, trimmed) =>
  DIVIDER.test(trimmed)
    ? { nodes: [{ type: "divider", children: [{ text: "" }] }], next: i + 1 }
    : null;

// = ... = to ====== ... ======
const matchHeading: BlockMatcher = (_lines, i, trimmed) => {
  const match = /^(={1,6})\s*(.+?)\s*\1$/.exec(trimmed);
  if (!match) return null;
  const level = match[1]!.length as 1 | 2 | 3 | 4 | 5 | 6;
  return {
    nodes: [{ type: "heading", level, children: parseInlineLinksAndFormatting(match[2]!) }],
    next: i + 1,
  };
};

// {| ... |}, with nested tables balanced
const matchTable: BlockMatcher = (lines, i, trimmed) => {
  if (!trimmed.startsWith("{|")) return null;
  let depth = 1;
  const tableLines = [
    lines[i]!,
    ...takeThrough(lines, i + 1, (line) => {
      const t = line.trim();
      if (t.startsWith("{|")) {
        depth++;
        return false;
      }
      return t.startsWith("|}") && --depth <= 0;
    }),
  ];
  const rawTable = tableLines.join("\n");
  let node: WikiBlockNode;
  try {
    node = parseWikitable(rawTable);
  } catch {
    node = {
      type: "raw",
      raw: rawTable,
      rawWikitext: rawTable,
      reason: "malformed",
      children: [{ text: "" }],
    };
  }
  return { nodes: [node], next: i + tableLines.length };
};

// Lists: * or # or : or ;. A switch between bullet and numbered lists starts a new list.
const matchList: BlockMatcher = (lines, i, trimmed) => {
  if (!LIST_START.test(trimmed)) return null;
  const firstChar = trimmed[0]!;
  const switchesKind = (next: string) =>
    (firstChar === "*" && next === "#") || (firstChar === "#" && next === "*");

  let end = i + 1;
  while (end < lines.length) {
    const next = lines[end]!.trim();
    if (!LIST_START.test(next) || switchesKind(next[0]!)) break;
    end++;
  }
  return { nodes: [parseWikiList(lines.slice(i, end))], next: end };
};

// <pre>...</pre>. The first line is not checked for the closing tag.
const matchPre: BlockMatcher = (lines, i, trimmed) => {
  if (!trimmed.startsWith("<pre")) return null;
  const preLines = [lines[i]!, ...takeThrough(lines, i + 1, (line) => line.includes("</pre>"))];
  const rawPre = preLines.join("\n");
  const code = /<pre[^>]*>([\s\S]*?)<\/pre>/i.exec(rawPre)?.[1] ?? rawPre;
  return {
    nodes: [{ type: "code-block", code, children: [{ text: code }] }],
    next: i + preLines.length,
  };
};

// <blockquote>...</blockquote>, the serializer's output for quote blocks
const matchBlockquote: BlockMatcher = (lines, i, trimmed) => {
  if (!BLOCKQUOTE_START.test(trimmed)) return null;
  const closes = (line: string) => /<\/blockquote>/i.test(line);
  const quoteLines = [lines[i]!, ...(closes(lines[i]!) ? [] : takeThrough(lines, i + 1, closes))];
  const rawQuote = quoteLines.join("\n");
  const next = i + quoteLines.length;

  const quoteMatch = /^\s*<blockquote[^>]*>([\s\S]*?)<\/blockquote>([\s\S]*)$/i.exec(rawQuote);
  // Unclosed tag: keep the text verbatim rather than drop it
  if (!quoteMatch) return { nodes: [paragraph(rawQuote)], next };

  const nodes: WikiBlockNode[] = [
    { type: "blockquote", children: parseInlineLinksAndFormatting(quoteMatch[1]!.trim()) },
  ];
  const trailing = quoteMatch[2]!.trim();
  if (trailing) nodes.push(paragraph(trailing));
  return { nodes, next };
};

const BLOCK_MATCHERS = [
  matchDivider,
  matchHeading,
  matchTable,
  matchList,
  matchPre,
  matchBlockquote,
];

/** True when a trimmed line begins a block of its own, ending any paragraph before it. */
function startsNewBlock(trimmed: string): boolean {
  return (
    trimmed === "" ||
    /^={1,6}\s/.test(trimmed) ||
    trimmed.startsWith("{|") ||
    LIST_START.test(trimmed) ||
    DIVIDER.test(trimmed) ||
    trimmed.startsWith("<pre") ||
    BLOCKQUOTE_START.test(trimmed)
  );
}

function parseTextBlocks(text: string, nodes: WikiBlockNode[]): void {
  const lines = text.split("\n");
  let i = 0;

  while (i < lines.length) {
    const trimmed = lines[i]!.trim();
    if (trimmed === "") {
      i++;
      continue;
    }

    let match: BlockMatch | null = null;
    for (const matcher of BLOCK_MATCHERS) {
      match = matcher(lines, i, trimmed);
      if (match) break;
    }
    if (match) {
      nodes.push(...match.nodes);
      i = match.next;
      continue;
    }

    // Regular paragraph: consecutive lines up to the next block start
    let end = i + 1;
    while (end < lines.length && !startsNewBlock(lines[end]!.trim())) end++;
    nodes.push(paragraph(lines.slice(i, end).join("\n")));
    i = end;
  }
}

/** A template is block-level when it is alone on its lines (infoboxes always are). */
function isBlockTemplate(tmpl: ParsedTemplate, fullText: string): boolean {
  if (tmpl.classification === "infobox") return true;

  const lineStart = fullText.lastIndexOf("\n", tmpl.source.start - 1);
  const beforeOnLine = fullText.slice(lineStart === -1 ? 0 : lineStart + 1, tmpl.source.start);

  const nextNewline = fullText.indexOf("\n", tmpl.source.end);
  const afterOnLine = fullText.slice(
    tmpl.source.end,
    nextNewline === -1 ? fullText.length : nextNewline
  );

  // Text before or after it on the same line means it is embedded in a paragraph, heading or list item.
  return beforeOnLine.trim() === "" && afterOnLine.trim() === "";
}
