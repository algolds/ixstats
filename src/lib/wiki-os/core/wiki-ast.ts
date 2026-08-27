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

export interface WikiLinkInline {
  type: "wiki-link";
  target: string;
  label?: string;
  exists?: boolean;
  children: [WikiTextNode] | WikiInlineNode[];
}

export interface WikiExternalLinkInline {
  type: "external-link";
  url: string;
  children: [WikiTextNode] | WikiInlineNode[];
}

export interface CoordChipInline {
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

export interface EngineDataChipInline {
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

export interface CitationInline {
  type: "citation-ref";
  refId?: string;
  name?: string;
  label?: string;
  rawWikitext?: string;
  children: WikiInlineNode[];
}

export type WikiInlineNode =
  | WikiTextNode
  | WikiLinkInline
  | WikiExternalLinkInline
  | CoordChipInline
  | EngineDataChipInline
  | CitationInline;

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

export interface WikiTemplateNode {
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

export interface WikiInfoboxBlock {
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

export interface TemplateBlock {
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

export interface WikiParserFunctionBlock {
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

export interface WikiRawNode {
  type: "raw";
  id?: string;
  raw: string;
  rawWikitext?: string;
  reason?: "unrecognized" | "malformed";
  source?: WikiSourceSpan;
  kind?: "infobox" | "generic";
  name?: string;
  params?: Record<string, string>;
  dataMw?: string;
  html?: string;
  children: [{ text: "" }];
}

// ─── Content Block Elements ─────────────────────────────────────────────────

export interface WikiParagraphBlock {
  type: "paragraph" | "p";
  id?: string;
  children: WikiInlineNode[];
}

export interface WikiHeadingBlock {
  type: "heading" | "h2" | "h3" | "h4";
  id?: string;
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  children: WikiInlineNode[];
}

export interface MediaBlock {
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
  children: (WikiParagraphBlock | WikiInlineNode)[];
}

export interface TableRowNode {
  type: "table-row" | "tr";
  children: TableCellNode[];
}

export interface WikiTableBlock {
  type: "table";
  id?: string;
  caption?: string;
  rawWikitext?: string;
  children: TableRowNode[];
}

export interface ListBlock {
  type: "list" | "ul" | "ol";
  id?: string;
  ordered?: boolean;
  children: Array<{
    type: "list-item" | "li";
    children: (WikiParagraphBlock | WikiInlineNode)[];
  }>;
}

export interface QuoteBlock {
  type: "quote" | "blockquote";
  id?: string;
  author?: string;
  source?: string;
  children: WikiParagraphBlock[] | WikiInlineNode[];
}

export interface CodeBlock {
  type: "code-block";
  id?: string;
  language?: string;
  code?: string;
  children: [{ text: string }];
}

export interface DividerBlock {
  type: "divider" | "hr";
  id?: string;
  children: [{ text: "" }];
}

export interface WikiMapEmbedBlock {
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
  diagnostics?: Diagnostic[];
  metadata?: {
    categories?: string[];
    lastModified?: string;
    wordCount?: number;
  };
}
