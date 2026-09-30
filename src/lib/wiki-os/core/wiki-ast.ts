/**
 * wiki-ast.ts — Canonical IxWiki Abstract Syntax Tree (AST) Document Model (v2).
 * Provides a structured, immutable representation of an article for Plate,
 * CodeMirror, and backend sync pipelines.
 */

export const WIKI_AST_VERSION = 1;

// ─── Source Spans & Diagnostics ─────────────────────────────────────────────

export interface WikiSourceSpan {
  start: number;
  end: number;
}

export interface Diagnostic {
  severity: "info" | "warning" | "error";
  message: string;
  start: number;
  end: number;
  code?: string;
}

export type ParseState = "complete" | "incomplete";

/**
 * Where a top-level block came from, so an untouched block can be saved back byte for byte
 * (plan 414, selective serialisation). For every block of a parsed document,
 * `sepBefore + raw` over all blocks, followed by `WikiDocument.trailing`, reproduces the input.
 */
export interface WikiBlockProvenance {
  /** Half-open offsets of the block in the wikitext it was parsed from. */
  src?: WikiSourceSpan;
  /** The exact text of that slice (for template blocks: the template, as `raw` always was). */
  raw?: string;
  /** The text between the previous block (or the start of the page) and this block. */
  sepBefore?: string;
}

// ─── Inline Text & Marks ───────────────────────────────────────────────────

export interface WikiTextMark {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  code?: boolean;
  superscript?: boolean;
  subscript?: boolean;
}

export interface WikiTextNode extends WikiTextMark {
  text: string;
}

// ─── Inline Entities ───────────────────────────────────────────────────────

/**
 * Bold/italic state at an inline element. MediaWiki quote runs ('''bold''', ''italic'') span links,
 * chips and references, so the state lives on every inline element, not only on text.
 */
export interface WikiInlineMarks {
  bold?: boolean;
  italic?: boolean;
}

export interface WikiLinkInline extends WikiInlineMarks {
  type: "wiki-link";
  target: string;
  label?: string;
  exists?: boolean;
  /** The link exactly as written, so an untouched link is saved back unchanged. */
  raw?: string;
  children: [WikiTextNode] | WikiInlineNode[];
}

export interface WikiExternalLinkInline extends WikiInlineMarks {
  type: "external-link";
  url: string;
  /** The link exactly as written, so an untouched link is saved back unchanged. */
  raw?: string;
  children: [WikiTextNode] | WikiInlineNode[];
}

/**
 * `[[File:…]]` / `[[Image:…]]` (any case or alias of namespace 6): an embedded file. Every pipe
 * parameter is kept in order and untrimmed, so the image is saved back unchanged unless the
 * caption (the last parameter that is not a display option) is edited.
 */
export interface WikiFileInline extends WikiInlineMarks {
  type: "wiki-file";
  /** The file title as written (`File:x.png`). */
  target: string;
  /** Every pipe parameter after the target, in order, exactly as written. */
  params: string[];
  /** The caption text, "" when the image has none. */
  caption: string;
  raw: string;
  children: [{ text: "" }];
}

export interface CoordChipInline extends WikiInlineMarks {
  type: "chip-coord";
  lat?: number;
  lng?: number;
  href?: string;
  title?: string;
  label?: string;
  format?: "dms" | "decimal" | "link";
  wikitext?: string;
  children: [{ text: "" }];
}

export interface EngineDataChipInline extends WikiInlineMarks {
  type: "chip-engine-data";
  connector: "CountryData" | "BusinessData" | "DefenseData" | "MyCountry";
  slug: string;
  metric: string;
  format?: "currency" | "compact" | "number" | "raw";
  fallback?: string;
  label?: string;
  wikitext?: string;
  children: [{ text: "" }];
}

export interface CitationInline extends WikiInlineMarks {
  type: "citation-ref";
  refId?: string;
  name?: string;
  label?: string;
  rawWikitext?: string;
  children: WikiInlineNode[];
}

export interface WikiInlineTemplateNode extends WikiInlineMarks {
  type: "inline-template";
  templateName: string;
  name?: string;
  params: Record<string, string>;
  paramList?: WikiParameter[];
  positional?: string[];
  raw?: string;
  rawWikitext?: string;
  children: [{ text: "" }];
}

export type WikiInlineNode =
  | WikiTextNode
  | WikiLinkInline
  | WikiExternalLinkInline
  | WikiFileInline
  | CoordChipInline
  | EngineDataChipInline
  | CitationInline
  | WikiInlineTemplateNode;

// ─── Template Models ───────────────────────────────────────────────────────

export type TemplateClassification =
  "standard" | "infobox" | "chip-engine" | "chip-coord" | "custom";

export interface WikiParameter {
  key: string;
  value: string;
  isPositional?: boolean;
  index?: number;
  raw?: string;
}

export interface WikiTemplateNode extends WikiBlockProvenance {
  type: "template";
  id?: string;
  templateName: string;
  name?: string;
  params: Record<string, string>;
  paramList?: WikiParameter[];
  positional?: string[];
  classification?: TemplateClassification;
  raw: string;
  rawWikitext?: string;
  source?: WikiSourceSpan;
  parseState?: ParseState;
  dataMw?: string;
  html?: string;
  children: [{ text: "" }];
}

export interface WikiInfoboxBlock extends WikiBlockProvenance {
  type: "infobox";
  id?: string;
  templateName: string;
  title?: string;
  variantId?: string;
  params: Record<string, string>;
  paramList?: WikiParameter[];
  positional?: string[];
  classification?: "infobox";
  raw: string;
  rawWikitext?: string;
  source?: WikiSourceSpan;
  parseState?: ParseState;
  fields?: Array<{ label: string; value: string }>;
  html?: string;
  edited?: boolean;
  children: [{ text: "" }];
}

export interface TemplateBlock extends WikiBlockProvenance {
  type: "template";
  id?: string;
  templateName: string;
  format?: "inline" | "block";
  params: Record<string, string>;
  paramList?: WikiParameter[];
  raw?: string;
  rawWikitext?: string;
  source?: WikiSourceSpan;
  parseState?: ParseState;
  classification?: TemplateClassification;
  children: [{ text: "" }];
}

export interface WikiParserFunctionBlock extends WikiBlockProvenance {
  type: "parser-function";
  id?: string;
  functionName: string;
  expression: string;
  branches: string[];
  raw: string;
  rawWikitext?: string;
  source?: WikiSourceSpan;
  parseState?: ParseState;
  children: [{ text: "" }];
}

/** Why a block is kept as source text the visual editor cannot edit (an atomic raw block). */
export type WikiRawConstruct =
  | "redirect"
  | "comment"
  | "magic-word"
  | "tag"
  | "nested-table"
  | "table-template"
  | "table-orphan-line"
  | "malformed";

export interface WikiRawNode extends WikiBlockProvenance {
  type: "raw";
  id?: string;
  raw: string;
  rawWikitext?: string;
  reason?: "unrecognized" | "malformed";
  /** What kind of source this block holds; absent for a table the table parser rejected. */
  construct?: WikiRawConstruct;
  /** The tag name when `construct` is "tag" (`pre`, `nowiki`, `gallery`, …). */
  tag?: string;
  source?: WikiSourceSpan;
  kind?: "infobox" | "generic";
  name?: string;
  params?: Record<string, string>;
  dataMw?: string;
  html?: string;
  children: [{ text: "" }];
}

// ─── Content Block Elements ─────────────────────────────────────────────────

export interface WikiParagraphBlock extends WikiBlockProvenance {
  type: "paragraph" | "p";
  id?: string;
  children: WikiInlineNode[];
}

export interface WikiHeadingBlock extends WikiBlockProvenance {
  type: "heading" | "h2" | "h3" | "h4";
  id?: string;
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  children: WikiInlineNode[];
}

export interface MediaBlock extends WikiBlockProvenance {
  type: "media";
  id?: string;
  filename: string;
  caption?: string;
  align?: "left" | "center" | "right" | "thumb" | "frameless";
  width?: number;
  height?: number;
  html?: string;
  wikitext?: string;
  children: [{ text: "" }];
}

export interface TableCellNode {
  type: "table-cell" | "th" | "td";
  isHeader?: boolean;
  attributes?: string;
  children: (WikiParagraphBlock | WikiInlineNode)[];
}

export interface TableRowNode {
  type: "table-row" | "tr";
  attributes?: string;
  /** The row's lines exactly as written (from its `|-` line to its last cell line). */
  raw?: string;
  children: TableCellNode[];
}

export interface WikiTableBlock extends WikiBlockProvenance {
  type: "table";
  id?: string;
  caption?: string;
  attributes?: string;
  rawWikitext?: string;
  /** The `{|` line and the caption lines after it, exactly as written. */
  headRaw?: string;
  /** What follows the last row (empty rows, the `|}` line), exactly as written. */
  tailRaw?: string;
  children: TableRowNode[];
}

export interface ListBlock extends WikiBlockProvenance {
  type: "list" | "ul" | "ol";
  id?: string;
  ordered?: boolean;
  children: Array<{
    type: "list-item" | "li";
    level?: number;
    prefix?: string;
    /** The item's line exactly as written. */
    raw?: string;
    children: (WikiParagraphBlock | WikiInlineNode)[];
  }>;
}

export interface QuoteBlock extends WikiBlockProvenance {
  type: "quote" | "blockquote";
  id?: string;
  author?: string;
  source?: string;
  children: WikiParagraphBlock[] | WikiInlineNode[];
}

export interface CodeBlock extends WikiBlockProvenance {
  type: "code-block";
  id?: string;
  language?: string;
  code?: string;
  children: [{ text: string }];
}

export interface DividerBlock extends WikiBlockProvenance {
  type: "divider" | "hr";
  id?: string;
  children: [{ text: "" }];
}

export interface WikiMapEmbedBlock extends WikiBlockProvenance {
  type: "map-embed" | "chip-mapembed";
  id?: string;
  lat?: number;
  lng?: number;
  zoom?: number;
  layer?: string;
  href?: string;
  title?: string;
  wikitext?: string;
  children: [{ text: "" }];
}

// ─── Union Types & Document Root ───────────────────────────────────────────

export type WikiBlockNode =
  | WikiParagraphBlock
  | WikiHeadingBlock
  | WikiInfoboxBlock
  | WikiTemplateNode
  | TemplateBlock
  | WikiParserFunctionBlock
  | WikiRawNode
  | MediaBlock
  | WikiTableBlock
  | ListBlock
  | QuoteBlock
  | CodeBlock
  | DividerBlock
  | WikiMapEmbedBlock;

export type WikiNode = WikiBlockNode | WikiInlineNode;

export interface WikiDocument {
  title: string;
  slug: string;
  version: number;
  nodes: WikiBlockNode[];
  /** The text after the last block (whitespace only); with `sepBefore` + `raw` per block it rebuilds the input. */
  trailing?: string;
  diagnostics?: Diagnostic[];
  metadata?: {
    categories?: string[];
    lastModified?: string;
    wordCount?: number;
  };
}
