/**
 * WikiAST ⇄ wikitext and Plate node converter.
 *
 * Invariant 1: Wikitext is the persistence format.
 * Invariant 2: WikiAST is semantic, not persistent.
 * Invariant 3: Plate is not a second source of truth.
 * Invariant 7: HTML is never used as serialization intermediary.
 */

import { parse } from "../wikitext/parser";
import {
  astToWikitext as coreAstToWikitext,
  serializeBlockNodeToWikitext,
} from "../wikitext/serializer";
import type {
  WikiDocument,
  WikiBlockNode,
  WikiInlineNode,
  WikiTextNode,
  WikiParagraphBlock,
  WikiHeadingBlock,
  WikiInfoboxBlock,
  WikiTemplateNode,
  WikiRawNode,
  WikiParserFunctionBlock,
  WikiTableBlock,
  ListBlock,
  QuoteBlock,
  CodeBlock,
  MediaBlock,
} from "../core/wiki-ast";

interface WikitextParseResult extends WikiDocument {
  parseConfidence: "full" | "partial";
}

/** Parse wikitext into a canonical WikiAST document using the native tolerant parser. */
export function wikitextToAst(wikitext: string, title = "", slug = ""): WikitextParseResult {
  const result = parse(wikitext, { title, slug });
  const hasErrors = result.diagnostics.some((d) => d.severity === "error");

  return {
    ...result.ast,
    parseConfidence: hasErrors ? "partial" : "full",
  };
}

/** Serialize AST blocks back to canonical wikitext. */
export function astToWikitext(input: WikiBlockNode[] | WikiDocument): string {
  if (Array.isArray(input)) {
    return input.map(serializeBlockNodeToWikitext).filter(Boolean).join("\n\n") + "\n";
  }
  return coreAstToWikitext(input);
}

/** Maps every type in `types` to the same converter. */
function alias<T>(fn: T, ...types: string[]): Record<string, T> {
  return Object.fromEntries(types.map((type) => [type, fn]));
}

const isInlineElement = (node: any): boolean =>
  Boolean(node && typeof node === "object" && "type" in node);

/**
 * Ensures that all inline nodes within a Slate block are surrounded by text nodes,
 * preserving Slate invariants and preventing caret placement crashes.
 */
function ensureSlateInlineSurroundings(nodes: any[]): any[] {
  if (!nodes || nodes.length === 0) return [{ text: "" }];
  return nodes.flatMap((node, i) => {
    if (!isInlineElement(node)) return [node];
    const before = i === 0 ? [{ text: "" }] : [];
    const after = isInlineElement(nodes[i + 1]) || i === nodes.length - 1 ? [{ text: "" }] : [];
    return [...before, node, ...after];
  });
}

type BlockToPlate = (node: WikiBlockNode) => any;

function headingToPlate(node: WikiBlockNode): any {
  const heading = node as WikiHeadingBlock;
  return { type: `h${heading.level ?? 2}`, children: astInlinesToPlateLeaves(heading.children) };
}

function paragraphToPlate(node: WikiBlockNode): any {
  return { type: "p", children: astInlinesToPlateLeaves((node as WikiParagraphBlock).children) };
}

function infoboxToPlate(node: WikiBlockNode): any {
  const ib = node as WikiInfoboxBlock;
  return {
    type: "infobox-block",
    templateName: ib.templateName,
    title: ib.title,
    params: ib.params || {},
    paramList: ib.paramList || [],
    positional: ib.positional || [],
    classification: "infobox",
    rawWikitext: ib.raw || ib.rawWikitext,
    parseState: ib.parseState,
    children: [{ text: "" }],
  };
}

function templateToPlate(node: WikiBlockNode): any {
  const tmpl = node as WikiTemplateNode;
  return {
    type: "template-block",
    templateName: tmpl.templateName || tmpl.name,
    name: tmpl.templateName || tmpl.name,
    params: tmpl.params || {},
    paramList: tmpl.paramList || [],
    positional: tmpl.positional || [],
    classification: tmpl.classification || "standard",
    rawWikitext: tmpl.raw || tmpl.rawWikitext,
    parseState: tmpl.parseState,
    children: [{ text: "" }],
  };
}

function parserFunctionToPlate(node: WikiBlockNode): any {
  const pfn = node as WikiParserFunctionBlock;
  return {
    type: "template-block",
    templateName: pfn.functionName,
    name: pfn.functionName,
    params: {},
    positional: pfn.branches || [],
    classification: "standard",
    rawWikitext: pfn.raw || pfn.rawWikitext,
    parseState: pfn.parseState,
    children: [{ text: "" }],
  };
}

function rawToPlate(node: WikiBlockNode): any {
  const rawNode = node as WikiRawNode;
  return {
    type: "template-block",
    templateName: "raw",
    name: "raw",
    params: {},
    classification: "custom",
    rawWikitext: rawNode.raw || rawNode.rawWikitext,
    children: [{ text: "" }],
  };
}

function mediaToPlate(node: WikiBlockNode): any {
  const mb = node as MediaBlock;
  return {
    type: "media",
    filename: mb.filename,
    align: mb.align || "thumb",
    caption: mb.caption,
    width: mb.width,
    height: mb.height,
    children: [{ text: "" }],
  };
}

function tableToPlate(node: WikiBlockNode): any {
  const tb = node as WikiTableBlock;
  return {
    type: "table",
    caption: tb.caption,
    attributes: tb.attributes,
    rawWikitext: tb.rawWikitext,
    children: tb.children?.map((row) => ({
      type: "tr",
      attributes: row.attributes,
      children: row.children?.map((cell) => ({
        type: cell.isHeader ? "th" : "td",
        attributes: cell.attributes,
        children: ensureSlateInlineSurroundings(
          astInlinesToPlateLeaves(cell.children as WikiInlineNode[])
        ),
      })),
    })) || [{ type: "tr", children: [{ type: "td", children: [{ text: "" }] }] }],
  };
}

function listToPlate(node: WikiBlockNode): any {
  const lb = node as ListBlock;
  return {
    type: lb.ordered ? "ol" : "ul",
    children: lb.children?.map((li) => ({
      type: "li",
      level: li.level || 1,
      prefix: li.prefix,
      children: ensureSlateInlineSurroundings(
        astInlinesToPlateLeaves(li.children as WikiInlineNode[])
      ),
    })) || [{ type: "li", children: [{ text: "" }] }],
  };
}

function quoteToPlate(node: WikiBlockNode): any {
  const qb = node as QuoteBlock;
  const children: any[] = Array.isArray(qb.children) ? qb.children : [];
  // A quote holds either paragraph blocks (flattened to their inlines) or bare inlines.
  const inlines = children[0]?.type === "p" ? children.flatMap((p) => p.children || []) : children;
  return {
    type: "blockquote",
    author: qb.author,
    source: qb.source,
    children: astInlinesToPlateLeaves(inlines),
  };
}

function codeBlockToPlate(node: WikiBlockNode): any {
  const cb = node as CodeBlock;
  return { type: "code-block", code: cb.code, children: [{ text: cb.code || "" }] };
}

const BLOCK_TO_PLATE: Record<string, BlockToPlate> = {
  ...alias(headingToPlate, "heading", "h2", "h3", "h4"),
  ...alias(paragraphToPlate, "paragraph", "p"),
  infobox: infoboxToPlate,
  template: templateToPlate,
  "parser-function": parserFunctionToPlate,
  raw: rawToPlate,
  media: mediaToPlate,
  table: tableToPlate,
  ...alias(listToPlate, "list", "ul", "ol"),
  ...alias(() => ({ type: "hr", children: [{ text: "" }] }), "divider", "hr"),
  ...alias(quoteToPlate, "quote", "blockquote"),
  "code-block": codeBlockToPlate,
};

/** Converts a WikiAST Document into Slate/Plate compatible node trees. */
export function astToPlateNodes(doc: WikiDocument): any[] {
  const plateNodes = (doc.nodes ?? []).flatMap((node) => {
    const convert = BLOCK_TO_PLATE[node.type];
    return convert ? [convert(node)] : [];
  });
  return plateNodes.length > 0 ? plateNodes : [{ type: "p", children: [{ text: "" }] }];
}

type PlateToBlock = (node: any) => WikiBlockNode;

const plateHeadingToAst: PlateToBlock = (node) => ({
  type: "heading",
  level: parseInt(node.type.slice(1), 10) as 1 | 2 | 3 | 4 | 5 | 6,
  children: plateLeavesToAstInlines(node.children),
});

const plateParagraphToAst: PlateToBlock = (node) => ({
  type: "paragraph",
  children: plateLeavesToAstInlines(node.children),
});

const plateInfoboxToAst: PlateToBlock = (node) => ({
  type: "infobox",
  templateName: node.templateName || "Infobox",
  title: node.title || node.templateName,
  params: node.params || {},
  paramList: node.paramList,
  positional: node.positional,
  classification: "infobox",
  raw: node.rawWikitext || "",
  rawWikitext: node.rawWikitext,
  parseState: node.parseState,
  children: [{ text: "" }],
});

const plateTemplateToAst: PlateToBlock = (node) => ({
  type: "template",
  templateName: node.templateName || node.name || "Template",
  name: node.templateName || node.name,
  params: node.params || {},
  paramList: node.paramList,
  positional: node.positional,
  classification: node.classification || "standard",
  raw: node.rawWikitext || "",
  rawWikitext: node.rawWikitext,
  parseState: node.parseState,
  children: [{ text: "" }],
});

const plateRawHtmlToAst: PlateToBlock = (node) => ({
  type: "raw",
  raw: node.wikitext || node.rawWikitext || "",
  rawWikitext: node.wikitext || node.rawWikitext,
  children: [{ text: "" }],
});

const plateMediaToAst: PlateToBlock = (node) => ({
  type: "media",
  filename: node.filename,
  align: node.align,
  caption: node.caption,
  width: node.width,
  height: node.height,
  children: [{ text: "" }],
});

const plateListToAst: PlateToBlock = (node) => ({
  type: "list",
  ordered: node.type === "ol",
  children: (node.children || []).map((li: any) => {
    let inlineLeaves = li.children || [];
    if (inlineLeaves.length === 1 && inlineLeaves[0]?.type === "lic") {
      inlineLeaves = inlineLeaves[0].children || [];
    } else if (typeof li.text === "string") {
      inlineLeaves = [li];
    }
    return {
      type: "list-item" as const,
      level: li.level || 1,
      prefix: li.prefix,
      children: plateLeavesToAstInlines(inlineLeaves),
    };
  }),
});

const plateQuoteToAst: PlateToBlock = (node) => ({
  type: "quote",
  author: node.author,
  source: node.source,
  children: plateLeavesToAstInlines(node.children),
});

const plateTableToAst: PlateToBlock = (node) => ({
  type: "table",
  caption: node.caption,
  attributes: node.attributes,
  rawWikitext: node.rawWikitext,
  children: (node.children || []).map((tr: any) => ({
    type: "table-row" as const,
    attributes: tr.attributes,
    children: (tr.children || []).map((cell: any) => ({
      type: "table-cell" as const,
      isHeader: cell.type === "th",
      attributes: cell.attributes,
      children: plateLeavesToAstInlines(cell.children || []),
    })),
  })),
});

const plateCodeBlockToAst: PlateToBlock = (node) => ({
  type: "code-block",
  code: node.code || node.children?.[0]?.text || "",
  children: [{ text: node.code || "" }],
});

const PLATE_TO_BLOCK: Record<string, PlateToBlock> = {
  ...alias(plateHeadingToAst, "h1", "h2", "h3", "h4", "h5", "h6"),
  ...alias(plateParagraphToAst, "p", "paragraph"),
  ...alias(plateInfoboxToAst, "infobox-block", "infobox"),
  ...alias(plateTemplateToAst, "template-block", "template"),
  "raw-html": plateRawHtmlToAst,
  media: plateMediaToAst,
  ...alias(plateListToAst, "ul", "ol"),
  hr: () => ({ type: "divider", children: [{ text: "" }] }),
  blockquote: plateQuoteToAst,
  table: plateTableToAst,
  "code-block": plateCodeBlockToAst,
};

/** Converts Plate/Slate nodes back to a canonical WikiAST Document. */
export function plateNodesToAst(nodes: any[], title = "", slug = ""): WikiDocument {
  const astNodes = nodes.flatMap((node): WikiBlockNode[] => {
    const convert = PLATE_TO_BLOCK[node.type];
    if (convert) return [convert(node)];
    // Unrecognized nodes pass through as paragraphs.
    return node.children ? [plateParagraphToAst(node)] : [];
  });

  return { title, slug, version: 1, nodes: astNodes };
}

const TEXT_MARKS = [
  "bold",
  "italic",
  "code",
  "strikethrough",
  "underline",
  "superscript",
  "subscript",
] as const;

/** First child's text when it has a string `text`, else `fallback`. */
function firstChildText(children: readonly unknown[] | undefined, fallback: string): string {
  const first = children?.[0];
  return first && typeof first === "object" && "text" in first && typeof first.text === "string"
    ? first.text
    : fallback;
}

function astInlineToPlateLeaf(inline: WikiInlineNode): any {
  if (!("type" in inline) || (inline as { type: string }).type === "text") {
    const textNode = inline as WikiTextNode;
    return {
      text: textNode.text ?? "",
      ...Object.fromEntries(TEXT_MARKS.map((mark) => [mark, textNode[mark]])),
    };
  }

  switch (inline.type) {
    case "wiki-link":
      return {
        type: "link",
        url: `/wiki/${encodeURIComponent(inline.target)}`,
        target: inline.target,
        internal: true,
        children: [{ text: inline.label || inline.target }],
      };
    case "external-link":
      return {
        type: "link",
        url: inline.url,
        internal: false,
        children: [{ text: firstChildText(inline.children, inline.url) }],
      };
    case "chip-coord":
      return {
        type: "chip-coord",
        lat: inline.lat,
        lng: inline.lng,
        label: inline.label,
        wikitext: inline.wikitext,
        children: [{ text: "" }],
      };
    case "chip-engine-data":
      return {
        type: "chip-engine",
        connector: inline.connector,
        slug: inline.slug,
        metric: inline.metric,
        wikitext: inline.wikitext,
        children: [{ text: "" }],
      };
    case "citation-ref":
      return {
        type: "citation-ref",
        name: inline.name,
        rawWikitext: inline.rawWikitext,
        children: [{ text: firstChildText(inline.children, "") }],
      };
    case "inline-template":
      return {
        type: "chip-template",
        templateName: inline.templateName || inline.name,
        params: inline.params || {},
        paramList: inline.paramList || [],
        positional: inline.positional || [],
        rawWikitext: inline.raw || inline.rawWikitext,
        children: [{ text: "" }],
      };
    default:
      return undefined;
  }
}

function astInlinesToPlateLeaves(inlines?: WikiInlineNode[]): any[] {
  if (!inlines || inlines.length === 0) return [{ text: "" }];

  const leaves = inlines.map(astInlineToPlateLeaf).filter(Boolean);
  return ensureSlateInlineSurroundings(leaves.length > 0 ? leaves : [{ text: "" }]);
}

function plateTextToAst(leaf: any): WikiInlineNode {
  return {
    text: leaf.text,
    bold: leaf.bold,
    italic: leaf.italic,
    code: leaf.code || leaf.codeMark,
    strikethrough: leaf.strikethrough || leaf.strike,
    underline: leaf.underline,
    superscript: leaf.superscript || leaf.sup,
    subscript: leaf.subscript || leaf.sub,
  };
}

function plateLinkToAst(leaf: any): WikiInlineNode {
  const isInternal =
    leaf.internal ?? Boolean(leaf.target || (leaf.url ? !/^https?:/i.test(leaf.url) : true));
  const target =
    leaf.target ||
    (leaf.url ? decodeURIComponent(leaf.url.replace(/^\/wiki\//, "").replace(/_/g, " ")) : "");
  const label = leaf.children?.[0]?.text || target;
  if (isInternal && target) {
    return {
      type: "wiki-link",
      target,
      label: label !== target ? label : undefined,
      children: [{ text: label }],
    };
  }
  return {
    type: "external-link",
    url: leaf.url || "",
    children: [{ text: leaf.children?.[0]?.text || leaf.url || "" }],
  };
}

const PLATE_LEAF_TO_INLINE: Record<string, (leaf: any) => WikiInlineNode> = {
  ...alias(plateLinkToAst, "a", "link"),
  "chip-coord": (leaf) => ({
    type: "chip-coord",
    lat: leaf.lat,
    lng: leaf.lng,
    label: leaf.label,
    wikitext: leaf.wikitext,
    children: [{ text: "" }],
  }),
  "chip-engine": (leaf) => ({
    type: "chip-engine-data",
    connector: leaf.connector || "CountryData",
    slug: leaf.slug || "",
    metric: leaf.metric || "",
    wikitext: leaf.wikitext,
    children: [{ text: "" }],
  }),
  "citation-ref": (leaf) => ({
    type: "citation-ref",
    name: leaf.name,
    rawWikitext: leaf.rawWikitext,
    children: [{ text: leaf.children?.[0]?.text || "" }],
  }),
  ...alias(
    (leaf: any): WikiInlineNode => ({
      type: "inline-template",
      templateName: leaf.templateName || leaf.name || "template",
      name: leaf.templateName || leaf.name || "template",
      params: leaf.params || {},
      paramList: leaf.paramList,
      positional: leaf.positional,
      raw: leaf.rawWikitext || "",
      rawWikitext: leaf.rawWikitext,
      children: [{ text: "" }],
    }),
    "chip-template",
    "inline-template"
  ),
};

function plateLeavesToAstInlines(leaves?: any[]): WikiInlineNode[] {
  if (!leaves || leaves.length === 0) return [{ text: "" }];

  const inlines = leaves.flatMap((leaf): WikiInlineNode[] => {
    if (typeof leaf.text === "string") return [plateTextToAst(leaf)];
    const convert = PLATE_LEAF_TO_INLINE[leaf.type];
    return convert ? [convert(leaf)] : [];
  });
  return inlines.length > 0 ? inlines : [{ text: "" }];
}
