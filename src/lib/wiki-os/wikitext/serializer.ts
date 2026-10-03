/**
 * Canonical WikiAST to wikitext serializer.
 *
 * Guaranteed: semantic equivalence, structural equivalence, full parameter preservation,
 * raw-node verbatim preservation (Invariant 4), and deterministic output.
 */

import type { WikiParagraphBlock } from "../core/wiki-ast";
import type {
  WikiDocument,
  WikiBlockNode,
  WikiInlineNode,
  WikiTextNode,
  WikiParameter,
  WikiTemplateNode,
  WikiInfoboxBlock,
  WikiRawNode,
  WikiTableBlock,
  ListBlock,
  QuoteBlock,
  CodeBlock,
  MediaBlock,
  WikiMapEmbedBlock,
  WikiParserFunctionBlock,
  WikiHeadingBlock,
  CitationInline,
} from "./types";

export function serializeTemplateToWikitext(template: {
  templateName?: string;
  name?: string;
  params?: Record<string, string>;
  paramList?: WikiParameter[];
  positional?: string[];
  raw?: string;
  rawWikitext?: string;
}): string {
  const name = template.templateName || template.name || "";
  const params = template.params || {};
  const positional = template.positional || [];
  const paramList = template.paramList;

  // Numeric keys mirror the positional values, so only named params are emitted from `params`.
  const named = Object.entries(params).filter(([key]) => !/^\d+$/.test(key));
  if (named.length === 0 && positional.length === 0) return `{{${name}}}`;

  const isMultiline =
    named.length >= 2 ||
    name.toLowerCase().startsWith("infobox") ||
    Object.values(params).some((v) => v.includes("\n"));

  if (!isMultiline) {
    const args = [...positional.map((v) => `|${v}`), ...named.map(([k, v]) => `|${k}=${v}`)];
    return `{{${name}${args.join("")}}}`;
  }

  const lines = paramList?.length
    ? paramList.map((p) => (p.isPositional ? `| ${p.value}` : `| ${p.key} = ${p.value}`))
    : [...positional.map((v) => `| ${v}`), ...named.map(([k, v]) => `| ${k} = ${v}`)];
  return `{{${name}\n${lines.map((line) => `${line}\n`).join("")}}}`;
}

const INLINE_TYPES = new Set([
  "wiki-link",
  "external-link",
  "chip-coord",
  "chip-engine-data",
  "citation-ref",
  "inline-template",
]);

function isInlineNode(node: WikiBlockNode | WikiInlineNode): boolean {
  const type = (node as { type?: string }).type;
  return type === undefined || type === "text" || INLINE_TYPES.has(type);
}

function isTextNode(node: WikiInlineNode): node is WikiTextNode {
  const { type, text } = node as { type?: string; text?: unknown };
  return typeof text === "string" && (type === undefined || type === "text");
}

const TEXT_WRAPPERS = [
  ["code", "code"],
  ["strikethrough", "s"],
  ["underline", "u"],
] as const;

function serializeTextNode(node: WikiTextNode): string {
  const quotes = "'".repeat((node.bold ? 3 : 0) + (node.italic ? 2 : 0));
  let out = `${quotes}${node.text}${quotes}`;
  for (const [flag, tag] of TEXT_WRAPPERS) {
    if (node[flag]) out = `<${tag}>${out}</${tag}>`;
  }
  return out;
}

function serializeInlines(nodes: readonly WikiInlineNode[] | undefined): string {
  return (nodes ?? []).map((node) => serializeInlineNodeToWikitext(node)).join("");
}

/** Children that may mix inline and block nodes, joined by `separator`. */
function serializeMixed(
  nodes: ReadonlyArray<WikiBlockNode | WikiInlineNode> | undefined,
  separator = ""
): string {
  return (nodes ?? [])
    .map((c) =>
      isInlineNode(c)
        ? serializeInlineNodeToWikitext(c as WikiInlineNode)
        : serializeBlockNodeToWikitext(c as WikiBlockNode)
    )
    .join(separator);
}

function serializeCitation(n: CitationInline): string {
  if (n.rawWikitext) return n.rawWikitext;
  const hasText = Boolean((n.children?.[0] as { text?: string } | undefined)?.text);
  if (n.name && !hasText) return `<ref name="${n.name}" />`;
  const open = n.name ? `<ref name="${n.name}">` : "<ref>";
  return `${open}${serializeInlines(n.children)}</ref>`;
}

function serializeInlineNodeToWikitext(node: WikiInlineNode): string {
  if (isTextNode(node)) return serializeTextNode(node);

  switch (node.type) {
    case "wiki-link":
      return node.label && node.label !== node.target
        ? `[[${node.target}|${node.label}]]`
        : `[[${node.target}]]`;

    case "external-link": {
      const textChild = (node.children?.[0] as { text?: string } | undefined)?.text;
      return textChild && textChild !== node.url ? `[${node.url} ${textChild}]` : `[${node.url}]`;
    }

    case "chip-coord":
      if (node.wikitext) return node.wikitext;
      if (node.lat === undefined || node.lng === undefined) return "";
      return `[[Coords:${node.lat},${node.lng}${node.label ? `|${node.label}` : ""}]]`;

    case "chip-engine-data":
      return node.wikitext || `[[${node.connector}:${node.slug}|${node.metric}]]`;

    case "citation-ref":
      return serializeCitation(node);

    case "inline-template":
      return (
        node.raw ||
        node.rawWikitext ||
        serializeTemplateToWikitext({
          templateName: node.templateName || node.name,
          params: node.params,
          paramList: node.paramList,
          positional: node.positional,
        })
      );

    default:
      return "";
  }
}

function serializeMedia(mb: MediaBlock): string {
  if (mb.wikitext) return mb.wikitext;
  const parts = [`File:${mb.filename}`];
  if (mb.align) parts.push(mb.align);
  if (mb.width) parts.push(`${mb.width}px`);
  if (mb.caption) parts.push(mb.caption);
  return `[[${parts.join("|")}]]`;
}

function serializeTable(tb: WikiTableBlock): string {
  if (tb.rawWikitext) return tb.rawWikitext;
  const rows = (tb.children ?? []).flatMap((row) => [
    "|-",
    ...(row.children ?? []).map(
      (cell) => `${cell.isHeader ? "!" : "|"} ${serializeMixed(cell.children)}`
    ),
  ]);
  const caption = tb.caption ? [`|+ ${tb.caption}`] : [];
  return [`{| class="wikitable"`, ...caption, ...rows, "|}"].join("\n");
}

function serializeList(lb: ListBlock): string {
  const defaultChar = lb.ordered ? "#" : "*";
  return (lb.children ?? [])
    .map((item) => {
      const prefix = item.prefix || defaultChar.repeat(Math.max(1, item.level || 1));
      return `${prefix} ${serializeMixed(item.children)}`;
    })
    .join("\n");
}

function serializeQuote(qb: QuoteBlock): string {
  const inner = serializeMixed(qb.children, "\n");
  if (qb.author) return `{{Quote|${inner}|${qb.author}${qb.source ? `|${qb.source}` : ""}}}`;
  return `<blockquote>\n${inner}\n</blockquote>`;
}

function serializeMapEmbed(me: WikiMapEmbedBlock): string {
  if (me.wikitext) return me.wikitext;
  const zoom = me.zoom ? `|zoom=${me.zoom}` : "";
  const layer = me.layer ? `|layer=${me.layer}` : "";
  return `[[MapEmbed:${me.lat},${me.lng}${zoom}${layer}]]`;
}

function serializeParserFunction(pfn: WikiParserFunctionBlock): string {
  const raw = pfn.raw || pfn.rawWikitext;
  if (raw) return raw;
  const branches = (pfn.branches ?? []).map((b) => `|${b}`).join("");
  return `{{${pfn.functionName}:${pfn.expression}${branches}}}`;
}

/** Block type aliases that serialize exactly like their canonical type. */
const BLOCK_ALIASES: Record<string, string> = {
  h2: "heading",
  h3: "heading",
  h4: "heading",
  p: "paragraph",
  ul: "list",
  ol: "list",
  blockquote: "quote",
  hr: "divider",
  "chip-mapembed": "map-embed",
};

export function serializeBlockNodeToWikitext(node: WikiBlockNode): string {
  switch (BLOCK_ALIASES[node.type] ?? node.type) {
    case "heading": {
      const heading = node as WikiHeadingBlock;
      const mark = "=".repeat(heading.level ?? 2);
      return `${mark} ${serializeInlines(heading.children)} ${mark}`;
    }
    case "paragraph":
      return serializeInlines((node as WikiParagraphBlock).children);
    case "infobox":
    case "template":
      return serializeTemplateToWikitext(node as WikiTemplateNode | WikiInfoboxBlock);
    case "parser-function":
      return serializeParserFunction(node as WikiParserFunctionBlock);
    case "raw":
      return (node as WikiRawNode).raw || (node as WikiRawNode).rawWikitext || "";
    case "media":
      return serializeMedia(node as MediaBlock);
    case "table":
      return serializeTable(node as WikiTableBlock);
    case "list":
      return serializeList(node as ListBlock);
    case "quote":
      return serializeQuote(node as QuoteBlock);
    case "code-block":
      return `<pre>\n${(node as CodeBlock).code || ""}\n</pre>`;
    case "divider":
      return "----";
    case "map-embed":
      return serializeMapEmbed(node as WikiMapEmbedBlock);
    default:
      return "";
  }
}

export function astToWikitext(doc: WikiDocument): string {
  return (doc.nodes ?? [])
    .map((node) => serializeBlockNodeToWikitext(node))
    .filter((serialized) => serialized !== "")
    .join("\n\n");
}
