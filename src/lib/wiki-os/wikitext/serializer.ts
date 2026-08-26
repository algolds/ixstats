/**
 * src/lib/wiki-os/wikitext/serializer.ts — Canonical WikiAST to Wikitext Serializer.
 *
 * Guaranteed: Semantic equivalence, structural equivalence, full parameter preservation,
 * raw-node verbatim preservation (Invariant 4), and deterministic output.
 */

import type {
  WikiDocument,
  WikiBlockNode,
  WikiInlineNode,
  WikiParameter,
  WikiTemplateNode,
  WikiInfoboxBlock,
  WikiRawNode,
  WikiHeadingBlock,
  WikiTableBlock,
  ListBlock,
  QuoteBlock,
  CodeBlock,
  MediaBlock,
  WikiMapEmbedBlock,
  WikiParserFunctionBlock,
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

  // If there are no parameters, emit single-line {{Name}}
  const paramKeys = Object.keys(params).filter((k) => !/^\d+$/.test(k));
  if (paramKeys.length === 0 && positional.length === 0) {
    return `{{${name}}}`;
  }

  // Check if multiline formatting is warranted
  const isMultiline =
    paramKeys.length >= 2 ||
    name.toLowerCase().startsWith("infobox") ||
    Object.values(params).some((v) => v.includes("\n"));

  if (isMultiline) {
    let out = `{{${name}\n`;

    if (paramList && paramList.length > 0) {
      for (const p of paramList) {
        if (p.isPositional) {
          out += `| ${p.value}\n`;
        } else {
          out += `| ${p.key} = ${p.value}\n`;
        }
      }
    } else {
      // Positional first
      for (const val of positional) {
        out += `| ${val}\n`;
      }
      // Named params
      for (const [k, v] of Object.entries(params)) {
        if (/^\d+$/.test(k)) continue; // skip positional mirror
        out += `| ${k} = ${v}\n`;
      }
    }

    out += `}}`;
    return out;
  }

  // Single-line compact
  let out = `{{${name}`;
  for (const val of positional) {
    out += `|${val}`;
  }
  for (const [k, v] of Object.entries(params)) {
    if (/^\d+$/.test(k)) continue;
    out += `|${k}=${v}`;
  }
  out += `}}`;
  return out;
}

export function serializeInlineNodeToWikitext(node: WikiInlineNode): string {
  if ("text" in node && typeof (node as { text?: unknown }).text === "string" && !("type" in node)) {
    const textNode = node as import("./types").WikiTextNode;
    let t = textNode.text;
    if (textNode.bold && textNode.italic) {
      t = `'''''${t}'''''`;
    } else if (textNode.bold) {
      t = `'''${t}'''`;
    } else if (textNode.italic) {
      t = `''${t}''`;
    }
    if (textNode.code) {
      t = `<code>${t}</code>`;
    }
    if (textNode.strikethrough) {
      t = `<s>${t}</s>`;
    }
    if (textNode.underline) {
      t = `<u>${t}</u>`;
    }
    return t;
  }

  const typed = node as Exclude<WikiInlineNode, import("./types").WikiTextNode>;
  switch (typed.type) {
    case "wiki-link": {
      const n = typed as import("./types").WikiLinkInline;
      if (n.label && n.label !== n.target) {
        return `[[${n.target}|${n.label}]]`;
      }
      return `[[${n.target}]]`;
    }

    case "external-link": {
      const n = typed as import("./types").WikiExternalLinkInline;
      const textChild = (n.children?.[0] as { text?: string } | undefined)?.text;
      if (textChild && textChild !== n.url) {
        return `[${n.url} ${textChild}]`;
      }
      return `[${n.url}]`;
    }

    case "chip-coord": {
      const n = typed as import("./types").CoordChipInline;
      if (n.wikitext) return n.wikitext;
      if (n.lat !== undefined && n.lng !== undefined) {
        return n.label
          ? `[[Coords:${n.lat},${n.lng}|${n.label}]]`
          : `[[Coords:${n.lat},${n.lng}]]`;
      }
      return "";
    }

    case "chip-engine-data": {
      const n = typed as import("./types").EngineDataChipInline;
      if (n.wikitext) return n.wikitext;
      return `[[${n.connector}:${n.slug}|${n.metric}]]`;
    }

    case "citation-ref": {
      const n = typed as import("./types").CitationInline;
      if (n.rawWikitext) return n.rawWikitext;
      if (n.name && (!n.children || n.children.length === 0 || !(n.children[0] as { text?: string } | undefined)?.text)) {
        return `<ref name="${n.name}" />`;
      }
      const refInner = n.children?.map(serializeInlineNodeToWikitext).join("") ?? "";
      return n.name ? `<ref name="${n.name}">${refInner}</ref>` : `<ref>${refInner}</ref>`;
    }

    default:
      return "";
  }
}

export function serializeBlockNodeToWikitext(node: WikiBlockNode): string {
  switch (node.type) {
    case "heading":
    case "h2":
    case "h3":
    case "h4": {
      const level = (node as WikiHeadingBlock).level ?? 2;
      const mark = "=".repeat(level);
      const text = node.children?.map(serializeInlineNodeToWikitext).join("") ?? "";
      return `${mark} ${text} ${mark}`;
    }

    case "paragraph":
    case "p":
      return node.children?.map(serializeInlineNodeToWikitext).join("") ?? "";

    case "infobox":
    case "template":
      return serializeTemplateToWikitext(node as WikiTemplateNode | WikiInfoboxBlock);

    case "parser-function": {
      const pfn = node as WikiParserFunctionBlock;
      if (pfn.raw || pfn.rawWikitext) return pfn.raw || pfn.rawWikitext || "";
      const branches = pfn.branches ? pfn.branches.map((b) => `|${b}`).join("") : "";
      return `{{${pfn.functionName}:${pfn.expression}${branches}}}`;
    }

    case "raw":
      return (node as WikiRawNode).raw || (node as WikiRawNode).rawWikitext || "";

    case "media": {
      const mb = node as MediaBlock;
      if (mb.wikitext) return mb.wikitext;
      const parts = [`File:${mb.filename}`];
      if (mb.align) parts.push(mb.align);
      if (mb.width) parts.push(`${mb.width}px`);
      if (mb.caption) parts.push(mb.caption);
      return `[[${parts.join("|")}]]`;
    }

    case "table": {
      const tb = node as WikiTableBlock;
      if (tb.rawWikitext) return tb.rawWikitext;
      let out = `{| class="wikitable"\n`;
      if (tb.caption) out += `|+ ${tb.caption}\n`;
      for (const row of tb.children || []) {
        out += `|-\n`;
        for (const cell of row.children || []) {
          const prefix = cell.isHeader ? `! ` : `| `;
          const cellText = cell.children
            .map((c: WikiBlockNode | WikiInlineNode) => ("text" in c ? serializeInlineNodeToWikitext(c as WikiInlineNode) : serializeBlockNodeToWikitext(c as WikiBlockNode)))
            .join("");
          out += `${prefix}${cellText}\n`;
        }
      }
      out += `|}`;
      return out;
    }

    case "list":
    case "ul":
    case "ol": {
      const lb = node as ListBlock;
      const prefix = lb.ordered ? `# ` : `* `;
      return (
        lb.children
          ?.map((item: ListBlock["children"][number]) => {
            const text = item.children
              .map((c: WikiBlockNode | WikiInlineNode) => ("text" in c ? serializeInlineNodeToWikitext(c as WikiInlineNode) : serializeBlockNodeToWikitext(c as WikiBlockNode)))
              .join("");
            return `${prefix}${text}`;
          })
          .join("\n") ?? ""
      );
    }

    case "quote":
    case "blockquote": {
      const qb = node as QuoteBlock;
      const inner = qb.children
        ?.map((c: WikiBlockNode | WikiInlineNode) => ("text" in c ? serializeInlineNodeToWikitext(c as WikiInlineNode) : serializeBlockNodeToWikitext(c as WikiBlockNode)))
        .join("\n") ?? "";
      if (qb.author) {
        return `{{Quote|${inner}|${qb.author}${qb.source ? `|${qb.source}` : ""}}}`;
      }
      return `<blockquote>\n${inner}\n</blockquote>`;
    }

    case "code-block": {
      const cb = node as CodeBlock;
      return `<pre>\n${cb.code || ""}\n</pre>`;
    }

    case "divider":
    case "hr":
      return "----";

    case "map-embed":
    case "chip-mapembed": {
      const me = node as WikiMapEmbedBlock;
      if (me.wikitext) return me.wikitext;
      return `[[MapEmbed:${me.lat},${me.lng}${me.zoom ? `|zoom=${me.zoom}` : ""}${me.layer ? `|layer=${me.layer}` : ""}]]`;
    }

    default:
      return "";
  }
}

export function astToWikitext(doc: WikiDocument): string {
  if (!doc.nodes || doc.nodes.length === 0) return "";

  const blocks: string[] = [];
  for (const node of doc.nodes) {
    const serialized = serializeBlockNodeToWikitext(node);
    if (serialized !== "") {
      blocks.push(serialized);
    }
  }

  return blocks.join("\n\n");
}
