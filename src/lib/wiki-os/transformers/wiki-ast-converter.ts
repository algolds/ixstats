/**
 * wiki-ast-converter.ts — WikiAST ⇄ Wikitext bidirectional converter.
 *
 * Deterministic, typed conversion between MediaWiki wikitext and the IxWiki
 * AST (src/lib/wiki-os/core/wiki-ast). Used for instant editor mode switching;
 * callers should fall back to server-side Parsoid when `parseConfidence`
 * indicates the input exceeded this grammar.
 */

import type {
  WikiDocument,
  WikiBlockNode,
  WikiInlineNode,
  WikiParagraphBlock,
  WikiHeadingBlock,
  WikiInfoboxBlock,
} from "../core/wiki-ast";

// ─── Public surface ─────────────────────────────────────────────────────────

export interface WikitextParseResult extends WikiDocument {
  parseConfidence: "full" | "partial";
}

/**
 * Parse wikitext into a WikiAST document.
 * Handles: headings (=..=), infoboxes/block templates ({{...}}), media
 * ([[File:...]]), tables ({| |}), lists (* / #), quotes, inline links,
 * bold/italic marks. Unparsable lines are preserved as plain paragraphs and
 * flagged via parseConfidence.
 */
export function wikitextToAst(wikitext: string, title = "", slug = ""): WikitextParseResult {
  const nodes: WikiBlockNode[] = [];
  const lines = wikitext.replace(/\r\n/g, "\n").split("\n");
  let confidence: "full" | "partial" = "full";

  let i = 0;
  let paragraphBuffer: InlineChunk[] = [];

  const flushParagraph = () => {
    if (paragraphBuffer.length > 0) {
      nodes.push({
        type: "paragraph",
        children: inlineChunksToNodes(paragraphBuffer),
      } as WikiParagraphBlock);
      paragraphBuffer = [];
    }
  };

  while (i < lines.length) {
    const line = lines[i]!;

    // Blank line → paragraph break
    if (line.trim() === "") {
      flushParagraph();
      i++;
      continue;
    }

    // Headings: == H2 ==
    const headingMatch = line.match(/^(={2,4})\s*(.+?)\s*\1\s*$/);
    if (headingMatch) {
      flushParagraph();
      nodes.push({
        type: "heading",
        level: headingMatch[1]!.length as 2 | 3 | 4,
        children: [{ text: headingMatch[2]! }],
      } as WikiHeadingBlock);
      i++;
      continue;
    }

    // Infobox / block template at line start
    if (/^\{\{[^|}]*\}\}\s*$/.test(line.trim()) || /^\{\{[Ii]nfobox\b/.test(line.trim())) {
      flushParagraph();
      const parsed = parseMultilineTemplate(lines, i);
      if (parsed) {
        nodes.push({
          type: "infobox",
          templateName: parsed.name,
          params: parsed.params,
          rawWikitext: parsed.raw,
        } as WikiInfoboxBlock);
        i = parsed.nextIndex;
        continue;
      }
    }

    // Tables
    if (line.trim().startsWith("{|")) {
      flushParagraph();
      const tableLines: string[] = [];
      while (i < lines.length && !lines[i]!.trim().startsWith("|}")) {
        tableLines.push(lines[i]!);
        i++;
      }
      if (i < lines.length) tableLines.push(lines[i]!); // include |}
      i++;
      nodes.push(parseTable(tableLines.join("\n")));
      continue;
    }

    // Lists (* or #)
    if (/^[*#]/.test(line)) {
      flushParagraph();
      const ordered = line.trim().startsWith("#");
      const items: Array<{ type: "list-item"; children: ReturnType<typeof inlineWikitextToNodes> }> = [];
      while (i < lines.length && /^[*#]/.test(lines[i]!)) {
        const itemText = lines[i]!.replace(/^[*#]+\s*/, "");
        items.push({
          type: "list-item",
          children: inlineWikitextToNodes(itemText),
        });
        i++;
      }
      nodes.push({ type: "list", ordered, children: items } as unknown as WikiBlockNode);
      continue;
    }

    // Media
    const mediaMatch = line.trim().match(/^\[\[(File|Image):([^\]|]+)((?:\|[^\]]*)?)\]\]\s*$/i);
    if (mediaMatch) {
      flushParagraph();
      const filename = mediaMatch[2]!.trim();
      const flags = (mediaMatch[3] ?? "").split("|").map((s) => s.trim()).filter(Boolean);
      const caption = flags.filter((f) => !/^(thumb|thumbnail|frameless|left|right|center|\d+px)$/.test(f)).join(" ");
      nodes.push({
        type: "media",
        filename: `File:${filename}`,
        align: (flags.find((f) => ["thumb", "frameless", "left", "right", "center"].includes(f)) as never) ?? "thumb",
        caption: caption || undefined,
        children: [{ text: "" }],
      });
      i++;
      continue;
    }

    // Horizontal rule
    if (/^-{4,}\s*$/.test(line.trim())) {
      flushParagraph();
      nodes.push({ type: "divider", children: [{ text: "" }] });
      i++;
      continue;
    }

    // Paragraph text — accumulate inline chunks
    paragraphBuffer.push(...parseInlineWikitext(line));
    i++;
  }
  flushParagraph();

  if (confidence !== "full" && /\{\{#|<ref|<[a-z]+[\s>]/i.test(wikitext)) {
    confidence = "partial";
  }
  if (/\{\{#\s*\w+:|<ref[\s>]/i.test(wikitext)) confidence = "partial";

  return { title, slug, version: 1, nodes, parseConfidence: confidence };
}

/** Serialize AST blocks back to clean wikitext. */
export function astToWikitext(input: WikiBlockNode[] | WikiDocument): string {
  const nodes = Array.isArray(input) ? input : input.nodes;
  return nodes.map(serializeBlock).filter((s) => s.length > 0).join("\n\n") + "\n";
}

// ─── Inline parsing ─────────────────────────────────────────────────────────

interface InlineChunk {
  kind: "text" | "bold" | "italic" | "bolditalic" | "link" | "extlink" | "chip";
  text?: string;
  target?: string;
  label?: string;
}

function inlineWikitextToNodes(wikitext: string): WikiInlineNode[] {
  return inlineChunksToNodes(parseInlineWikitext(wikitext));
}

function parseInlineWikitext(wikitext: string): InlineChunk[] {
  const chunks: InlineChunk[] = [];
  const regex =
    /'''(.+?)'''|''(.+?)''|\[\[([^\]|]+)(?:\|([^\]]*))?\]\]|\[(https?:\/\/[^\s\]]+)(?:\s([^\]]*))?\]|\{\{(CountryData|BusinessData)\s*:\s*([^}|]+)\s*(?:\|([^}]*))?\}\}/g;
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = regex.exec(wikitext)) !== null) {
    if (m.index > last) chunks.push({ kind: "text", text: wikitext.slice(last, m.index) });
    if (m[1]) {
      chunks.push({ kind: "bold", text: m[1] });
    } else if (m[2]) {
      chunks.push({ kind: "italic", text: m[2] });
    } else if (m[3]) {
      chunks.push({ kind: "link", target: m[3].trim(), label: m[4]?.trim() || m[3].trim() });
    } else if (m[5]) {
      chunks.push({ kind: "extlink", target: m[5], label: m[6]?.trim() || m[5] });
    } else if (m[7]) {
      chunks.push({ kind: "chip", text: `${m[7]}:${(m[8] ?? "").trim()}`, label: m[7] });
    }
    last = regex.lastIndex;
  }
  if (last < wikitext.length) chunks.push({ kind: "text", text: wikitext.slice(last) });
  return chunks;
}

function inlineChunksToNodes(chunks: InlineChunk[]): WikiInlineNode[] {
  const nodes: WikiInlineNode[] = [];
  for (const c of chunks) {
    switch (c.kind) {
      case "text":
        if (c.text) nodes.push({ text: c.text });
        break;
      case "bold":
        nodes.push({ text: c.text!, bold: true });
        break;
      case "italic":
        nodes.push({ text: c.text!, italic: true });
        break;
      case "bolditalic":
        nodes.push({ text: c.text!, bold: true, italic: true });
        break;
      case "link": {
        const inner = parseInlineWikitext(c.label ?? c.target ?? "");
        nodes.push({
          type: "wiki-link",
          target: c.target!,
          label: c.label,
          children: inner.length > 0 ? (inlineChunksToNodes(inner) as [never]) : ([{ text: c.target ?? "" }] as [never]),
        });
        break;
      }
      case "extlink":
        nodes.push({
          type: "external-link",
          url: c.target!,
          children: [{ text: c.label ?? c.target! }] as [never],
        });
        break;
      case "chip":
        nodes.push({
          type: "chip-engine-data",
          connector: (c.text?.split(":")[0] ?? "CountryData") as "CountryData" | "BusinessData" | "DefenseData",
          slug: (c.text?.split(":")[1] ?? "").split("|")[0] ?? "",
          metric: (c.text?.split("|")[1] ?? ""),
          children: [{ text: "" }],
        });
        break;
    }
  }
  if (nodes.length === 0) nodes.push({ text: "" });
  return nodes;
}

function nodesToInline(nodes: WikiInlineNode[]): string {
  let out = "";
  for (const node of nodes) {
    if (!("type" in node)) {
      const t = node as typeof node & { bold?: boolean; italic?: boolean };
      let text = t.text.replace(/\n/g, "");
      if (t.bold && t.italic) text = "'''''" + text + "'''''";
      else if (t.bold) text = "'''" + text + "'''";
      else if (t.italic) text = "''" + text + "''";
      out += text;
      continue;
    }
    switch (node.type) {
      case "wiki-link":
        out += node.label && node.label !== node.target ? `[[${node.target}|${node.label}]]` : `[[${node.target}]]`;
        break;
      case "external-link":
        out += `[${node.url} ${node.children.map((c) => ("text" in c ? c.text : "")).join("")}]`;
        break;
      default:
        break;
    }
  }
  return out;
}

// ─── Block parsing helpers ──────────────────────────────────────────────────

function parseMultilineTemplate(
  lines: string[],
  startIndex: number
): { name: string; params: Record<string, string>; raw: string; nextIndex: number } | null {
  let raw = "";
  let depth = 0;
  let i = startIndex;
  for (; i < lines.length; i++) {
    raw += (raw ? "\n" : "") + lines[i];
    for (let j = 0; j < lines[i]!.length - 1; j++) {
      if (lines[i]!.slice(j, j + 2) === "{{") { depth++; j++; }
      else if (lines[i]!.slice(j, j + 2) === "}}") { depth--; j++; }
    }
    if (depth <= 0) { i++; break; }
  }
  if (depth > 0) return null;

  const inner = raw.trim().replace(/^\{\{/, "").replace(/\}\}$/, "");
  const parts = splitTemplateParts(inner);
  const name = (parts[0] ?? "").trim();
  if (!name) return null;
  const params: Record<string, string> = {};
  for (const part of parts.slice(1)) {
    const eq = part.indexOf("=");
    if (eq !== -1) params[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
  }
  return { name, params, raw: raw.trim(), nextIndex: i };
}

function splitTemplateParts(inner: string): string[] {
  const parts: string[] = [];
  let current = "";
  let depth = 0;
  for (let k = 0; k < inner.length; k++) {
    const two = inner.slice(k, k + 2);
    if (two === "[[" || two === "{{") { depth++; current += two; k++; continue; }
    if (two === "]]" || two === "}}") { depth--; current += two; k++; continue; }
    if (two[0] === "|" && depth === 0) { parts.push(current); current = ""; continue; }
    current += two[0];
  }
  parts.push(current);
  return parts;
}

interface ParsedCell { header: boolean; text: string }
interface ParsedRow { header: boolean; cells: ParsedCell[] }

function parseTable(raw: string): WikiBlockNode {
  const body = raw.split("\n").slice(1, -1); // strip {| and |}
  const parsedRows: ParsedRow[] = [];
  let current: ParsedRow | null = null;
  const splitCells = (text: string): string[] => text.split(/\|\||!!/).map((x) => x.trim());

  for (const ln of body) {
    const t = ln.trim();
    if (t.startsWith("|-")) {
      if (current && current.cells.length > 0) parsedRows.push(current);
      current = { header: false, cells: [] };
    } else if (t.startsWith("!")) {
      const segs = splitCells(t.replace(/^!/, ""));
      if (!current) current = { header: true, cells: [] };
      for (const seg of segs) {
        if (seg.length > 0 || segs.length === 1) {
          current.cells.push({ header: true, text: seg });
        }
      }
    } else if (t.startsWith("|")) {
      const segs = splitCells(t.replace(/^\|/, ""));
      if (!current) current = { header: false, cells: [] };
      for (const seg of segs) {
        if (seg.length > 0 || segs.length === 1) {
          current.cells.push({ header: false, text: seg });
        }
      }
    } else if (t.length > 0 && current && current.cells.length > 0) {
      const last = current.cells[current.cells.length - 1]!;
      last.text += ` ${t}`;
    }
  }
  if (current && current.cells.length > 0) parsedRows.push(current);

  return {
    type: "table",
    children: parsedRows.map((row) => ({
      type: "table-row",
      children: row.cells.map((cell) => ({
        type: "table-cell",
        isHeader: cell.header,
        children: [{ text: cell.text }],
      })),
    })),
  } as unknown as WikiBlockNode;
}

// ─── Serialization helpers ──────────────────────────────────────────────────

function serializeBlock(node: WikiBlockNode): string {
  switch (node.type) {
    case "heading": {
      const n = node as WikiHeadingBlock;
      return `${"=".repeat(n.level)} ${nodesToInline(n.children)} ${"=".repeat(n.level)}`;
    }
    case "paragraph":
      return nodesToInline(node.children);
    case "infobox": {
      const ib = node as WikiInfoboxBlock;
      const params = Object.entries(ib.params)
        .filter(([, v]) => v.trim())
        .map(([k, v]) => `| ${k} = ${v}`)
        .join("\n");
      return `{{${ib.templateName}${params ? `\n${params}\n` : ""}}}`;
    }
    case "template": {
      const params = Object.entries(node.params)
        .filter(([, v]) => v.trim())
        .map(([k, v]) => `| ${k} = ${v}`)
        .join("\n");
      return `{{${node.templateName}${params ? `\n${params}\n` : ""}}}`;
    }
    case "media": {
      const flags: string[] = [];
      if (node.align) flags.push(node.align);
      if (node.caption) flags.push(node.caption);
      return `[[${node.filename}${flags.length ? `|${flags.join("|")}` : ""}]]`;
    }
    case "list": {
      const marker = node.ordered ? "#" : "*";
      return node.children
        .map((li) => `${marker} ${nodesToInline(li.children as WikiInlineNode[])}`)
        .join("\n");
    }
    case "divider":
      return "----";
    case "table": {
      // Structured tables with rows render in classic wikitable syntax;
      // unstructured fallback keeps raw wikitext when present.
      const anyNode = node as unknown as { rawWikitext?: string; children: unknown[] };
      if (anyNode.rawWikitext) return anyNode.rawWikitext;
      if (!Array.isArray(anyNode.children) || anyNode.children.length === 0) {
        return anyNode.rawWikitext ?? "";
      }
      const lines: string[] = ['{| class="wikitable"'];
      for (const row of anyNode.children as Array<{ children?: Array<{ isHeader?: boolean; children: WikiInlineNode[] }> }>) {
        lines.push("|-");
        for (const cell of row.children ?? []) {
          const prefix = cell.isHeader ? "!" : "|";
          const text = nodesToInline(cell.children).replace(/\n/g, " ");
          lines.push(`${prefix} ${text}`);
        }
      }
      lines.push("|}");
      return lines.join("\n");
    }
    case "quote": {
      const paras = (node.children as WikiParagraphBlock[])
        .map((p) => `<blockquote>${nodesToInline(p.children)}</blockquote>`)
        .join("\n");
      return paras;
    }
    case "code-block":
      return `<pre>${node.code}</pre>`;
    case "map-embed":
      return `[[MapEmbed:${node.lat},${node.lng}|Location]]`;
    default:
      return "";
  }
}

// ─── AST → HTML (for instant source→visual switching) ──────────────────────

function inlineNodesToHtml(nodes: WikiInlineNode[]): string {
  let out = "";
  for (const node of nodes) {
    if (!("type" in node)) {
      const t = node as typeof node & { bold?: boolean; italic?: boolean; strike?: boolean };
      let text = t.text.replace(/\n/g, "<br>");
      if (t.bold) text = `<b>${text}</b>`;
      if (t.italic) text = `<i>${text}</i>`;
      if (t.strike) text = `<s>${text}</s>`;
      out += text;
    }
  }
  return out;
}

/** Serialize a WikiAST document to the clean HTML dialect the Plate editor consumes. */
export function astToHtml(doc: WikiDocument): string {
  const parts: string[] = [];
  for (const node of doc.nodes) {
    switch (node.type) {
      case "heading":
        parts.push(`<h${node.level}>${inlineNodesToHtml(node.children)}</h${node.level}>`);
        break;
      case "paragraph": {
        const inner = inlineNodesToHtml(node.children);
        if (inner.trim()) parts.push(`<p>${inner}</p>`);
        break;
      }
      case "infobox":
      case "template": {
        const paramParts = Object.entries(node.params)
          .filter(([, v]) => v.trim())
          .map(([k, v]) => `|${k}=${v}`)
          .join("");
        const dataMw = JSON.stringify({
          parts: [{ template: { target: { wt: node.templateName }, params: Object.fromEntries(Object.entries(node.params).map(([k, v]) => [k, { wt: v }])) } }],
        });
        parts.push(
          `<div typeof="mw:Transclusion" about="#mwt1" data-mw='${dataMw.replace(/'/g, "&#39;")}' class="wikios-ve-${node.type === "infobox" ? "infobox" : "template"}"><em>{{${node.templateName}${paramParts}}}</em></div>`
        );
        break;
      }
      case "media":
        parts.push(`<figure typeof="mw:File" class="${node.align ?? "thumb"}"><img src="/wiki/Special:Redirect/file/${encodeURIComponent((node.filename ?? "").replace(/^File:/, ""))}" alt="${esc2(node.caption ?? "")}"/>${node.caption ? `<figcaption>${esc2(node.caption)}</figcaption>` : ""}</figure>`);
        break;
      case "list":
        parts.push(
          `<${node.ordered ? "ol" : "ul"}>${node.children
            .map((li) => `<li>${li.children.map((c) => ("text" in c ? c.text : "")).join("")}</li>`)
            .join("")}</${node.ordered ? "ol" : "ul"}>`
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

function esc2(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
