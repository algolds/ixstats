/**
 * src/lib/wiki-os/wikitext/types.ts — Parser & Engine Type Definitions.
 */

import type {
  WikiDocument,
  WikiBlockNode,
  WikiInlineNode,
  WikiTextNode,
  WikiTextMark,
  WikiLinkInline,
  WikiExternalLinkInline,
  CoordChipInline,
  EngineDataChipInline,
  CitationInline,
  WikiTemplateNode,
  WikiInfoboxBlock,
  WikiRawNode,
  WikiParserFunctionBlock,
  WikiParameter,
  TemplateClassification,
  Diagnostic,
  WikiSourceSpan,
  ParseState,
  WikiParagraphBlock,
  WikiHeadingBlock,
  MediaBlock,
  WikiTableBlock,
  TableRowNode,
  TableCellNode,
  ListBlock,
  QuoteBlock,
  CodeBlock,
  DividerBlock,
  WikiMapEmbedBlock,
} from "../core/wiki-ast";

export type {
  WikiDocument,
  WikiBlockNode,
  WikiInlineNode,
  WikiTextNode,
  WikiTextMark,
  WikiLinkInline,
  WikiExternalLinkInline,
  CoordChipInline,
  EngineDataChipInline,
  CitationInline,
  WikiTemplateNode,
  WikiInfoboxBlock,
  WikiRawNode,
  WikiParserFunctionBlock,
  WikiParameter,
  TemplateClassification,
  Diagnostic,
  WikiSourceSpan,
  ParseState,
  WikiParagraphBlock,
  WikiHeadingBlock,
  MediaBlock,
  WikiTableBlock,
  TableRowNode,
  TableCellNode,
  ListBlock,
  QuoteBlock,
  CodeBlock,
  DividerBlock,
  WikiMapEmbedBlock,
};

export interface ParseResult {
  ast: WikiDocument;
  diagnostics: Diagnostic[];
}

export interface ParsedTemplate {
  name: string;
  params: Record<string, string>;
  paramList: WikiParameter[];
  positional: string[];
  raw: string;
  source: WikiSourceSpan;
  classification: TemplateClassification;
  parseState: ParseState;
  isParserFunction?: boolean;
  functionName?: string;
  expression?: string;
  branches?: string[];
}

export interface Token {
  type:
    | "TEXT"
    | "TEMPLATE_OPEN"
    | "TEMPLATE_CLOSE"
    | "LINK_OPEN"
    | "LINK_CLOSE"
    | "TABLE_OPEN"
    | "TABLE_CLOSE"
    | "PIPE"
    | "EQUALS"
    | "HEADING_MARK"
    | "COMMENT";
  value: string;
  start: number;
  end: number;
}
