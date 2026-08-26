/**
 * wiki-ast-converter.ts — WikiAST ⇄ Wikitext & Plate Node Bidirectional Converter.
 *
 * Invariant 1: Wikitext is the persistence format.
 * Invariant 2: WikiAST is semantic, not persistent.
 * Invariant 3: Plate is not a second source of truth.
 * Invariant 7: HTML is never used as serialization intermediary.
 */

import { parse } from "../wikitext/parser";
import { astToWikitext as coreAstToWikitext, serializeBlockNodeToWikitext } from "../wikitext/serializer";
import type {
  WikiDocument,
  WikiBlockNode,
  WikiInlineNode,
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
  DividerBlock,
  MediaBlock,
  WikiMapEmbedBlock,
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
 * Converts a WikiAST Document into Slate/Plate compatible node trees.
 */
export function astToPlateNodes(doc: WikiDocument): any[] {
  if (!doc.nodes || doc.nodes.length === 0) {
    return [{ type: "p", children: [{ text: "" }] }];
  }

  const plateNodes: any[] = [];

  for (const node of doc.nodes) {
    switch (node.type) {
      case "heading":
      case "h2":
      case "h3":
      case "h4": {
        const hNode = node as WikiHeadingBlock;
        const level = hNode.level ?? 2;
        plateNodes.push({
          type: `h${level}`,
          children: astInlinesToPlateLeaves(hNode.children),
        });
        break;
      }

      case "paragraph":
      case "p": {
        plateNodes.push({
          type: "p",
          children: astInlinesToPlateLeaves(node.children),
        });
        break;
      }

      case "infobox": {
        const ib = node as WikiInfoboxBlock;
        plateNodes.push({
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
        });
        break;
      }

      case "template": {
        const tmpl = node as WikiTemplateNode;
        plateNodes.push({
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
        });
        break;
      }

      case "parser-function": {
        const pfn = node as WikiParserFunctionBlock;
        plateNodes.push({
          type: "template-block",
          templateName: pfn.functionName,
          name: pfn.functionName,
          params: {},
          positional: pfn.branches || [],
          classification: "standard",
          rawWikitext: pfn.raw || pfn.rawWikitext,
          parseState: pfn.parseState,
          children: [{ text: "" }],
        });
        break;
      }

      case "raw": {
        const rawNode = node as WikiRawNode;
        plateNodes.push({
          type: "template-block",
          templateName: "raw",
          name: "raw",
          params: {},
          classification: "custom",
          rawWikitext: rawNode.raw || rawNode.rawWikitext,
          children: [{ text: "" }],
        });
        break;
      }

      case "media": {
        const mb = node as MediaBlock;
        plateNodes.push({
          type: "media",
          filename: mb.filename,
          align: mb.align || "thumb",
          caption: mb.caption,
          width: mb.width,
          height: mb.height,
          children: [{ text: "" }],
        });
        break;
      }

      case "table": {
        const tb = node as WikiTableBlock;
        plateNodes.push({
          type: "table",
          caption: tb.caption,
          rawWikitext: tb.rawWikitext,
          children: tb.children?.map((row) => ({
            type: "tr",
            children: row.children?.map((cell) => ({
              type: cell.isHeader ? "th" : "td",
              children: [{ text: cell.children.map((c) => ("text" in c ? c.text : "")).join("") }],
            })),
          })) || [{ type: "tr", children: [{ type: "td", children: [{ text: "" }] }] }],
        });
        break;
      }

      case "list":
      case "ul":
      case "ol": {
        const lb = node as ListBlock;
        plateNodes.push({
          type: lb.ordered ? "ol" : "ul",
          children: lb.children?.map((li) => ({
            type: "li",
            children: [{ type: "lic", children: astInlinesToPlateLeaves(li.children as WikiInlineNode[]) }],
          })) || [{ type: "li", children: [{ type: "lic", children: [{ text: "" }] }] }],
        });
        break;
      }

      case "divider":
      case "hr": {
        plateNodes.push({
          type: "hr",
          children: [{ text: "" }],
        });
        break;
      }

      case "quote":
      case "blockquote": {
        const qb = node as QuoteBlock;
        plateNodes.push({
          type: "blockquote",
          author: qb.author,
          source: qb.source,
          children: [{ text: "" }],
        });
        break;
      }

      case "code-block": {
        const cb = node as CodeBlock;
        plateNodes.push({
          type: "code-block",
          code: cb.code,
          children: [{ text: cb.code || "" }],
        });
        break;
      }

      default:
        break;
    }
  }

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

      case "raw-html": {
        astNodes.push({
          type: "raw",
          raw: node.wikitext || node.rawWikitext || "",
          rawWikitext: node.wikitext || node.rawWikitext,
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
          const lic = li.children?.[0] || li;
          return {
            type: "list-item" as const,
            children: plateLeavesToAstInlines(lic.children || []),
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

function astInlinesToPlateLeaves(inlines?: WikiInlineNode[]): any[] {
  if (!inlines || inlines.length === 0) {
    return [{ text: "" }];
  }

  const leaves: any[] = [];

  for (const inline of inlines) {
    if (!("type" in inline)) {
      leaves.push({
        text: inline.text,
        bold: inline.bold,
        italic: inline.italic,
        code: inline.code,
        strikethrough: inline.strikethrough,
        underline: inline.underline,
      });
    } else {
      switch (inline.type) {
        case "wiki-link":
          leaves.push({
            type: "a",
            url: `/wiki/${encodeURIComponent(inline.target)}`,
            target: inline.target,
            children: [{ text: inline.label || inline.target }],
          });
          break;
        case "external-link": {
          const firstChild = inline.children?.[0];
          const textVal = firstChild && "text" in firstChild && typeof firstChild.text === "string" ? firstChild.text : inline.url;
          leaves.push({
            type: "a",
            url: inline.url,
            children: [{ text: textVal }],
          });
          break;
        }
        case "chip-coord":
          leaves.push({
            type: "chip-coord",
            lat: inline.lat,
            lng: inline.lng,
            label: inline.label,
            wikitext: inline.wikitext,
            children: [{ text: "" }],
          });
          break;
        case "chip-engine-data":
          leaves.push({
            type: "chip-engine",
            connector: inline.connector,
            slug: inline.slug,
            metric: inline.metric,
            wikitext: inline.wikitext,
            children: [{ text: "" }],
          });
          break;
        case "citation-ref": {
          const firstChild = inline.children?.[0];
          const textVal = firstChild && "text" in firstChild && typeof firstChild.text === "string" ? firstChild.text : "";
          leaves.push({
            type: "citation-ref",
            name: inline.name,
            rawWikitext: inline.rawWikitext,
            children: [{ text: textVal }],
          });
          break;
        }
      }
    }
  }

  if (leaves.length === 0) {
    leaves.push({ text: "" });
  }

  return leaves;
}

function plateLeavesToAstInlines(leaves?: any[]): WikiInlineNode[] {
  if (!leaves || leaves.length === 0) {
    return [{ text: "" }];
  }

  const inlines: WikiInlineNode[] = [];

  for (const leaf of leaves) {
    if (typeof leaf.text === "string") {
      inlines.push({
        text: leaf.text,
        bold: leaf.bold,
        italic: leaf.italic,
        code: leaf.code,
        strikethrough: leaf.strikethrough,
        underline: leaf.underline,
      });
    } else if (leaf.type === "a") {
      if (leaf.target) {
        inlines.push({
          type: "wiki-link",
          target: leaf.target,
          label: leaf.children?.[0]?.text || leaf.target,
          children: [{ text: leaf.children?.[0]?.text || leaf.target }],
        });
      } else {
        inlines.push({
          type: "external-link",
          url: leaf.url || "",
          children: [{ text: leaf.children?.[0]?.text || leaf.url || "" }],
        });
      }
    } else if (leaf.type === "chip-coord") {
      inlines.push({
        type: "chip-coord",
        lat: leaf.lat,
        lng: leaf.lng,
        label: leaf.label,
        wikitext: leaf.wikitext,
        children: [{ text: "" }],
      });
    } else if (leaf.type === "chip-engine") {
      inlines.push({
        type: "chip-engine-data",
        connector: leaf.connector || "CountryData",
        slug: leaf.slug || "",
        metric: leaf.metric || "",
        wikitext: leaf.wikitext,
        children: [{ text: "" }],
      });
    } else if (leaf.type === "citation-ref") {
      inlines.push({
        type: "citation-ref",
        name: leaf.name,
        rawWikitext: leaf.rawWikitext,
        children: [{ text: leaf.children?.[0]?.text || "" }],
      });
    }
  }

  if (inlines.length === 0) {
    inlines.push({ text: "" });
  }

  return inlines;
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
        parts.push(`<h${node.level || 2}>${serializeBlockNodeToWikitext(node)}</h${node.level || 2}>`);
        break;
      case "paragraph":
      case "p":
        parts.push(`<p>${serializeBlockNodeToWikitext(node)}</p>`);
        break;
      case "infobox":
      case "template":
        parts.push(`<div class="wikios-template-preview"><em>${serializeBlockNodeToWikitext(node)}</em></div>`);
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
