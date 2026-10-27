/**
 * src/lib/wiki-os/wikitext/types.ts — Parser & Engine Type Definitions.
 */

import type {
  WikiDocument,
  WikiBlockNode,
  WikiInlineNode,
  WikiTextNode,
  WikiLinkInline,
  WikiExternalLinkInline,
  WikiFileInline,
  WikiInlineMarks,
  WikiBlockProvenance,
  WikiRawConstruct,
  CoordChipInline,
  EngineDataChipInline,
  CitationInline,
  WikiInlineTemplateNode,
  WikiTemplateNode,
  WikiInfoboxBlock,
  WikiRawNode,
  WikiParserFunctionBlock,
  WikiParameter,
  TemplateClassification,
  Diagnostic,
  WikiSourceSpan,
  ParseState,
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
  WikiLinkInline,
  WikiExternalLinkInline,
  WikiFileInline,
  WikiInlineMarks,
  WikiBlockProvenance,
  WikiRawConstruct,
  CoordChipInline,
  EngineDataChipInline,
  CitationInline,
  WikiInlineTemplateNode,
  WikiTemplateNode,
  WikiInfoboxBlock,
  WikiRawNode,
  WikiParserFunctionBlock,
  WikiParameter,
  TemplateClassification,
  Diagnostic,
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
