/**
 * wiki-ast-converter.ts — WikiAST ⇄ Wikitext & Plate Node Bidirectional Converter.
 *
 * Invariant 1: Wikitext is the persistence format.
 * Invariant 2: WikiAST is semantic, not persistent.
 * Invariant 3: Plate is not a second source of truth.
 * Invariant 7: HTML is never used as serialization intermediary.
 */

import { parse } from "../wikitext/parser";
import { plateFingerprint } from "./plate-fingerprint";
import type { PlateNode } from "./plate-node";
import {
  astInlinesToPlateLeaves,
  ensureSlateInlineSurroundings,
  keepSource,
  plateLeavesToAstInlines,
} from "./wiki-ast-inlines";
import {
  astToWikitext as coreAstToWikitext,
  serializeBlockNodeToWikitext,
} from "../wikitext/serializer";
import type {
  WikiDocument,
  WikiBlockNode,
  WikiInlineNode,
  WikiHeadingBlock,
  WikiParagraphBlock,
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

export interface WikitextParseResult extends WikiDocument {
  parseConfidence: "full" | "partial";
}

/**
 * Parse wikitext into a canonical WikiAST document using the native tolerant parser.
 */
export function wikitextToAst(wikitext: string, title = "", slug = ""): WikitextParseResult {
  const result = parse(wikitext, { title, slug });
  const hasErrors = result.diagnostics.some((d) => d.severity === "error");

  return {
    ...result.ast,
    parseConfidence: hasErrors ? "partial" : "full",
  };
}

/**
 * Serialize AST blocks back to canonical wikitext.
 */
export function astToWikitext(input: WikiBlockNode[] | WikiDocument): string {
  if (Array.isArray(input)) {
    return input.map(serializeBlockNodeToWikitext).filter(Boolean).join("\n\n") + "\n";
  }
  return coreAstToWikitext(input);
}

// ─── Direct AST ⇄ Plate Nodes (Zero-HTML Isomorphic Mapping) ─────────────────

/**
 * Records where a block came from on its Plate element (plan 414): the exact source text, the
 * separator before it and a fingerprint of the element as loaded. The visual editor's serializer
 * writes the source text back unchanged for as long as the fingerprint still matches.
 */
function withProvenance(
  el: PlateNode,
  node: WikiBlockNode,
  position: { first: boolean; last: boolean },
  trailing: string | undefined
): PlateNode {
  if (node.src === undefined || node.raw === undefined) return el;
  el.wikiRaw = node.raw;
  el.wikiSrc = node.src.start;
  if (position.first) el.wikiLead = node.sepBefore ?? "";
  else el.wikiSep = node.sepBefore ?? "";
  if (position.last) el.wikiTrail = trailing ?? "";
  el.wikiFp = plateFingerprint(el);
  return el;
}

function headingToPlate(node: WikiBlockNode): PlateNode {
  const hNode = node as WikiHeadingBlock;
  return { type: `h${hNode.level ?? 2}`, children: astInlinesToPlateLeaves(hNode.children) };
}

function paragraphToPlate(node: WikiBlockNode): PlateNode {
  return { type: "p", children: astInlinesToPlateLeaves((node as WikiParagraphBlock).children) };
}

function infoboxToPlate(node: WikiBlockNode): PlateNode {
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
  } as PlateNode;
}

function templateToPlate(node: WikiBlockNode): PlateNode {
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
  } as PlateNode;
}

function parserFunctionToPlate(node: WikiBlockNode): PlateNode {
  const pfn = node as WikiParserFunctionBlock;
  return {
    type: "template-block",
    templateName: pfn.functionName,
    name: pfn.functionName,
    positional: pfn.branches || [],
    classification: "standard",
    rawWikitext: pfn.raw || pfn.rawWikitext,
    parseState: pfn.parseState,
    children: [{ text: "" }],
  } as PlateNode;
}

/** Source the editor cannot edit faithfully: shown read-only, saved back verbatim. */
function rawToPlate(node: WikiBlockNode): PlateNode {
  const rawNode = node as WikiRawNode;
  return {
    type: "raw-wikitext",
    rawWikitext: rawNode.raw || rawNode.rawWikitext,
    construct: rawNode.construct,
    tag: rawNode.tag,
    children: [{ text: "" }],
  };
}

function mediaToPlate(node: WikiBlockNode): PlateNode {
  const mb = node as MediaBlock;
  return {
    type: "media",
    filename: mb.filename,
    align: mb.align || "thumb",
    caption: mb.caption,
    width: mb.width,
    height: mb.height,
    children: [{ text: "" }],
  } as PlateNode;
}

function tableToPlate(node: WikiBlockNode): PlateNode {
  const tb = node as WikiTableBlock;
  const table = {
    type: "table",
    caption: tb.caption,
    attributes: tb.attributes,
    rawWikitext: tb.rawWikitext,
    children: tb.children?.map((row) =>
      keepSource(
        {
          type: "tr",
          attributes: row.attributes,
          children: row.children?.map((cell) => ({
            type: cell.isHeader ? "th" : "td",
            attributes: cell.attributes,
            children: ensureSlateInlineSurroundings(
              astInlinesToPlateLeaves(cell.children as WikiInlineNode[])
            ),
          })),
        } as PlateNode,
        row.raw
      )
    ) || [{ type: "tr", children: [{ type: "td", children: [{ text: "" }] }] }],
  } as PlateNode;
  if (tb.headRaw !== undefined && tb.tailRaw !== undefined) {
    // The table's own markup: valid while its attributes and caption are unchanged; the rows carry their own.
    table.wikiTableHead = tb.headRaw;
    table.wikiTableHeadFp = plateFingerprint({ attributes: tb.attributes, caption: tb.caption });
    table.wikiTableTail = tb.tailRaw;
  }
  return table;
}

function listToPlate(node: WikiBlockNode): PlateNode {
  const lb = node as ListBlock;
  return {
    type: lb.ordered ? "ol" : "ul",
    children: lb.children?.map((li) =>
      keepSource(
        {
          type: "li",
          level: li.level || 1,
          prefix: li.prefix,
          children: ensureSlateInlineSurroundings(
            astInlinesToPlateLeaves(li.children as WikiInlineNode[])
          ),
        } as PlateNode,
        li.raw
      )
    ) || [{ type: "li", children: [{ text: "" }] }],
  } as PlateNode;
}

const dividerToPlate = (): PlateNode => ({ type: "hr", children: [{ text: "" }] });

function quoteToPlate(node: WikiBlockNode): PlateNode {
  const qb = node as QuoteBlock;
  let inlines: any[] = [];
  if (Array.isArray(qb.children)) {
    if (
      qb.children.length > 0 &&
      typeof qb.children[0] === "object" &&
      "type" in qb.children[0] &&
      (qb.children[0] as any).type === "p"
    ) {
      inlines = (qb.children as any[]).flatMap((p) => p.children || []);
    } else {
      inlines = qb.children as any[];
    }
  }
  return {
    type: "blockquote",
    author: qb.author,
    source: qb.source,
    children: astInlinesToPlateLeaves(inlines),
  } as PlateNode;
}

function codeBlockToPlate(node: WikiBlockNode): PlateNode {
  const cb = node as CodeBlock;
  return { type: "code-block", code: cb.code, children: [{ text: cb.code || "" }] } as PlateNode;
}

const BLOCK_CONVERTERS: ReadonlyMap<string, (node: WikiBlockNode) => PlateNode> = new Map([
  ["heading", headingToPlate],
  ["h2", headingToPlate],
  ["h3", headingToPlate],
  ["h4", headingToPlate],
  ["paragraph", paragraphToPlate],
  ["p", paragraphToPlate],
  ["infobox", infoboxToPlate],
  ["template", templateToPlate],
  ["parser-function", parserFunctionToPlate],
  ["raw", rawToPlate],
  ["media", mediaToPlate],
  ["table", tableToPlate],
  ["list", listToPlate],
  ["ul", listToPlate],
  ["ol", listToPlate],
  ["divider", dividerToPlate],
  ["hr", dividerToPlate],
  ["quote", quoteToPlate],
  ["blockquote", quoteToPlate],
  ["code-block", codeBlockToPlate],
]);

/**
 * Converts a WikiAST Document into Slate/Plate compatible node trees. Every element that came from
 * parsed source carries its provenance (`wikiRaw`, `wikiSep`, `wikiFp`, …) so that an untouched
 * block is saved back byte for byte.
 */
export function astToPlateNodes(doc: WikiDocument): any[] {
  if (!doc.nodes || doc.nodes.length === 0) {
    return [{ type: "p", children: [{ text: "" }] }];
  }

  const plateNodes: PlateNode[] = [];
  doc.nodes.forEach((node, index) => {
    const el = BLOCK_CONVERTERS.get(node.type)?.(node);
    if (!el) return;
    const last = index === doc.nodes.length - 1;
    plateNodes.push(
      withProvenance(el, node, { first: plateNodes.length === 0, last }, doc.trailing)
    );
  });

  if (plateNodes.length === 0) {
    plateNodes.push({ type: "p", children: [{ text: "" }] });
  }

  return plateNodes;
}

/**
 * Converts Plate/Slate nodes back to a canonical WikiAST Document.
 */
export function plateNodesToAst(nodes: any[], title = "", slug = ""): WikiDocument {
  const astNodes: WikiBlockNode[] = [];

  for (const node of nodes) {
    switch (node.type) {
      case "h1":
      case "h2":
      case "h3":
      case "h4":
      case "h5":
      case "h6": {
        const level = parseInt(node.type.slice(1), 10) as 1 | 2 | 3 | 4 | 5 | 6;
        astNodes.push({
          type: "heading",
          level,
          children: plateLeavesToAstInlines(node.children),
        });
        break;
      }

      case "p":
      case "paragraph": {
        astNodes.push({
          type: "paragraph",
          children: plateLeavesToAstInlines(node.children),
        });
        break;
      }

      case "infobox-block":
      case "infobox": {
        astNodes.push({
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
        break;
      }

      case "template-block":
      case "template": {
        astNodes.push({
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
        break;
      }

      case "raw-html":
      case "raw-wikitext": {
        astNodes.push({
          type: "raw",
          raw: node.wikitext || node.rawWikitext || "",
          rawWikitext: node.wikitext || node.rawWikitext,
          construct: node.construct,
          tag: node.tag,
          children: [{ text: "" }],
        });
        break;
      }

      case "media": {
        astNodes.push({
          type: "media",
          filename: node.filename,
          align: node.align,
          caption: node.caption,
          width: node.width,
          height: node.height,
          children: [{ text: "" }],
        });
        break;
      }

      case "ul":
      case "ol": {
        const ordered = node.type === "ol";
        const items = (node.children || []).map((li: any) => {
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
        });
        astNodes.push({
          type: "list",
          ordered,
          children: items,
        });
        break;
      }

      case "hr": {
        astNodes.push({
          type: "divider",
          children: [{ text: "" }],
        });
        break;
      }

      case "blockquote": {
        astNodes.push({
          type: "quote",
          author: node.author,
          source: node.source,
          children: plateLeavesToAstInlines(node.children),
        });
        break;
      }

      case "table": {
        const rows = (node.children || []).map((tr: any) => ({
          type: "table-row" as const,
          attributes: tr.attributes,
          children: (tr.children || []).map((cell: any) => ({
            type: "table-cell" as const,
            isHeader: cell.type === "th",
            attributes: cell.attributes,
            children: plateLeavesToAstInlines(cell.children || []),
          })),
        }));
        astNodes.push({
          type: "table",
          caption: node.caption,
          attributes: node.attributes,
          rawWikitext: node.rawWikitext,
          children: rows,
        });
        break;
      }

      case "code-block": {
        astNodes.push({
          type: "code-block",
          code: node.code || node.children?.[0]?.text || "",
          children: [{ text: node.code || "" }],
        });
        break;
      }

      default:
        // Pass-through unrecognized nodes as paragraph
        if (node.children) {
          astNodes.push({
            type: "paragraph",
            children: plateLeavesToAstInlines(node.children),
          });
        }
        break;
    }
  }

  return {
    title,
    slug,
    version: 1,
    nodes: astNodes,
  };
}

// ─── Legacy HTML Fallback (For Explicit Visual Previews Only) ─────────────────

export function astToHtml(doc: WikiDocument): string {
  const parts: string[] = [];
  for (const node of doc.nodes) {
    switch (node.type) {
      case "heading":
      case "h2":
      case "h3":
      case "h4":
        parts.push(
          `<h${node.level || 2}>${serializeBlockNodeToWikitext(node)}</h${node.level || 2}>`
        );
        break;
      case "paragraph":
      case "p":
        parts.push(`<p>${serializeBlockNodeToWikitext(node)}</p>`);
        break;
      case "infobox":
      case "template":
        parts.push(
          `<div class="wikios-template-preview"><em>${serializeBlockNodeToWikitext(node)}</em></div>`
        );
        break;
      case "divider":
        parts.push("<hr>");
        break;
      default:
        break;
    }
  }
  return parts.join("\n");
}
