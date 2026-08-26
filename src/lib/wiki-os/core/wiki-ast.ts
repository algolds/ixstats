/**
 * wiki-ast.ts — Canonical IxWiki Abstract Syntax Tree (AST) Document Model.
 * Provides a structured, immutable representation of an article for Plate,
 * CodeMirror, and backend sync pipelines.
 */

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
  children: [WikiTextNode];
}

export interface WikiExternalLinkInline {
  type: "external-link";
  url: string;
  children: [WikiTextNode];
}

export interface CoordChipInline {
  type: "chip-coord";
  lat: number;
  lng: number;
  label?: string;
  children: [{ text: "" }];
}

export interface EngineDataChipInline {
  type: "chip-engine-data";
  connector: "CountryData" | "BusinessData" | "DefenseData";
  slug: string;
  metric: string;
  format?: "currency" | "compact" | "number" | "raw";
  fallback?: string;
  children: [{ text: "" }];
}

export interface CitationInline {
  type: "citation-ref";
  refId?: string;
  name?: string;
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

// ─── Block Elements ────────────────────────────────────────────────────────

export interface WikiParagraphBlock {
  type: "paragraph";
  id?: string;
  children: WikiInlineNode[];
}

export interface WikiHeadingBlock {
  type: "heading";
  id?: string;
  level: 1 | 2 | 3 | 4 | 5 | 6;
  children: WikiInlineNode[];
}

export interface WikiInfoboxBlock {
  type: "infobox";
  id?: string;
  templateName: string;
  variantId?: string;
  params: Record<string, string>;
  rawWikitext?: string;
  children: [{ text: "" }];
}

export interface TemplateBlock {
  type: "template";
  id?: string;
  templateName: string;
  format: "inline" | "block";
  params: Record<string, string>;
  rawWikitext?: string;
  children: [{ text: "" }];
}

export interface MediaBlock {
  type: "media";
  id?: string;
  filename: string;
  caption?: string;
  align?: "left" | "center" | "right" | "thumb" | "frameless";
  width?: number;
  height?: number;
  children: [{ text: "" }];
}

export interface TableCellNode {
  type: "table-cell";
  isHeader?: boolean;
  children: (WikiParagraphBlock | WikiInlineNode)[];
}

export interface TableRowNode {
  type: "table-row";
  children: TableCellNode[];
}

export interface WikiTableBlock {
  type: "table";
  id?: string;
  caption?: string;
  children: TableRowNode[];
}

export interface ListBlock {
  type: "list";
  id?: string;
  ordered: boolean;
  children: Array<{
    type: "list-item";
    children: (WikiParagraphBlock | WikiInlineNode)[];
  }>;
}

export interface QuoteBlock {
  type: "quote";
  id?: string;
  author?: string;
  source?: string;
  children: WikiParagraphBlock[];
}

export interface CodeBlock {
  type: "code-block";
  id?: string;
  language?: string;
  code: string;
  children: [{ text: "" }];
}

export interface DividerBlock {
  type: "divider";
  id?: string;
  children: [{ text: "" }];
}

export interface WikiMapEmbedBlock {
  type: "map-embed";
  id?: string;
  lat: number;
  lng: number;
  zoom?: number;
  layer?: string;
  children: [{ text: "" }];
}

// ─── Union Types & Document Root ───────────────────────────────────────────

export type WikiBlockNode =
  | WikiParagraphBlock
  | WikiHeadingBlock
  | WikiInfoboxBlock
  | TemplateBlock
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
  metadata?: {
    categories?: string[];
    lastModified?: string;
    wordCount?: number;
  };
}
