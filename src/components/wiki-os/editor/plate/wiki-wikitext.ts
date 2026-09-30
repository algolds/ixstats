/**
 * wiki-wikitext.ts — Canonical wikitext serialization for the Plate canvas.
 *
 * Selective serialisation (plan 414): a block loaded from wikitext whose content is unchanged is
 * written back exactly as it was loaded, with the separator it had; only blocks the user edited or
 * inserted are generated from the Plate node. Atomic and interactive template nodes emit their
 * stored wikitext or canonical representation; structural blocks map to standard MediaWiki markup.
 */

import type { Descendant } from "slate";
import type { PlateNode } from "~/lib/wiki-os/transformers/plate-node";
import { serializeTemplateToWikitext } from "~/lib/wiki-os/wikitext/serializer";
import { isUnmodified, serializeInline } from "./wiki-inline-wikitext";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export interface WikitextSerializeResult {
  wikitext: string;
  complete: boolean;
}

const templateWikitext = (el: PlateNode, fallbackName: string): string =>
  el.rawWikitext ||
  el.wikitext ||
  serializeTemplateToWikitext({
    templateName: el.templateName || el.name || fallbackName,
    params: el.params,
    positional: el.positional,
    paramList: el.paramList,
  });

function headingWikitext(el: PlateNode, level: number): string {
  const marks = "=".repeat(level);
  return `${marks} ${serializeInline(el.children)} ${marks}`;
}

function listWikitext(el: PlateNode): string {
  const defaultMarker = el.type === "ol" ? "#" : "*";
  const lines = (el.children ?? []).map((li) => {
    const marker = li.prefix || defaultMarker.repeat(Math.max(1, li.level || 1));
    if (typeof li.text === "string") return `${marker} ${li.text.trim()}`;
    let kids = li.children ?? [];
    if (kids.length === 1 && kids[0]?.type === "lic") kids = kids[0].children ?? [];
    return `${marker} ${serializeInline(kids).trim()}`;
  });
  return lines.join("\n");
}

function cellWikitext(cell: PlateNode): string {
  const head = cell.type === "th" ? "!" : "|";
  const attributes = cell.attributes ? ` ${cell.attributes} |` : "";
  const content = serializeInline(cell.children);
  // Content that starts on its own line (a list in a cell) must keep that line break.
  return content.startsWith("\n") ? `${head}${attributes}${content.trimEnd()}` : `${head}${attributes} ${content.trim()}`;
}

function tableWikitext(el: PlateNode): string {
  // A table loaded from wikitext without attributes has none; only a new table gets the default class.
  const attributes = el.attributes ? ` ${el.attributes}` : el.wikiRaw === undefined ? ' class="wikitable"' : "";
  const lines = [`{|${attributes}`];
  if (el.caption) lines.push(`|+ ${el.caption}`);
  for (const row of el.children ?? []) {
    lines.push(`|-${row.attributes ? ` ${row.attributes}` : ""}`);
    for (const cell of row.children ?? []) lines.push(cellWikitext(cell));
  }
  lines.push("|}");
  return lines.join("\n");
}

function mediaWikitext(el: PlateNode): string {
  if (el.wikitext) return el.wikitext;
  if (!el.filename) return el.rawWikitext || "";
  return `[[File:${el.filename}${el.align ? `|${el.align}` : "|thumb"}${el.caption ? `|${el.caption}` : ""}]]`;
}

/** The wikitext of one generated block, without its separator; "" for a block that writes nothing. */
function blockWikitext(el: PlateNode, state: { complete: boolean }): string {
  switch (el.type) {
    case "h1":
    case "h2":
    case "h3":
    case "h4":
    case "h5":
    case "h6":
      return headingWikitext(el, Number(el.type.slice(1)));
    case "p":
    case "lic": {
      const inner = serializeInline(el.children);
      return inner.trim() ? inner : "";
    }
    case "blockquote":
      return `<blockquote>${serializeInline(el.children)}</blockquote>`;
    case "code-block":
      return `<pre>${esc((el.children ?? []).map((c) => c.text ?? "").join(""))}</pre>`;
    case "ul":
    case "ol":
      return listWikitext(el);
    case "table":
      return tableWikitext(el);
    case "hr":
      return "----";
    case "infobox-block":
    case "infobox":
    case "infobox-box":
      return templateWikitext(el, "Infobox");
    case "template-block":
    case "template":
      return templateWikitext(el, "Template");
    case "media":
      return mediaWikitext(el);
    case "raw-wikitext":
      return el.rawWikitext ?? "";
    case "raw-html": {
      const wt = el.rawWikitext || el.wikitext;
      if (!wt) state.complete = false;
      return wt || el.html || "";
    }
    default:
      return el.rawWikitext || el.wikitext || "";
  }
}

const newlineCount = (text: string): number => text.split("\n").length - 1;

/** What the previous block written to the output tells the next one about its separator. */
interface Written {
  type: string | undefined;
  /** End offset of the previous block in the loaded page, when it is an original block. */
  srcEnd: number | null;
}

/**
 * The separator to write before `el`. An original block keeps the one it had when it is safe: any
 * blank-line separator, or a single line break when the block before it is still its original
 * neighbour. Everything else gets a blank line, and two paragraphs are always a blank line apart
 * (a single line break would merge them).
 */
function separatorBefore(el: PlateNode, isOriginal: boolean, prev: Written): string {
  const recorded = isOriginal ? el.wikiSep : undefined;
  let sep = "\n\n";
  if (recorded !== undefined && recorded.includes("\n")) {
    const adjacent = prev.srcEnd !== null && prev.srcEnd === (el.wikiSrc ?? 0) - recorded.length;
    if (newlineCount(recorded) >= 2 || adjacent) sep = recorded;
  }
  if (prev.type === "p" && el.type === "p" && newlineCount(sep) < 2) sep = "\n\n";
  return sep;
}

/**
 * For each original block (by offset in the loaded page) the index of the node that still is that
 * block. Slate copies a block's properties when it splits it, so an offset can appear twice: the
 * unmodified node owns it, else the first one.
 */
function originalOwners(nodes: readonly PlateNode[]): Map<number, number> {
  const owners = new Map<number, number>();
  nodes.forEach((node, index) => {
    if (node.wikiSrc !== undefined && isUnmodified(node) && !owners.has(node.wikiSrc)) {
      owners.set(node.wikiSrc, index);
    }
  });
  nodes.forEach((node, index) => {
    if (node.wikiSrc !== undefined && !owners.has(node.wikiSrc)) owners.set(node.wikiSrc, index);
  });
  return owners;
}

/**
 * Serialize the Plate value to MediaWiki wikitext. Blocks loaded from wikitext and not edited are
 * written back byte for byte, separators included; the leading text of the page is kept with its
 * first block and the trailing text with its last.
 */
export function serializePlateToWikitext(value: readonly Descendant[]): WikitextSerializeResult {
  const nodes = value as readonly PlateNode[];
  const owners = originalOwners(nodes);
  const state = { complete: true };
  let out = "";
  let prev: Written | null = null;

  for (const [index, el] of nodes.entries()) {
    const isOriginal = el.wikiSrc !== undefined && owners.get(el.wikiSrc) === index;
    const verbatim = isOriginal && isUnmodified(el) ? el.wikiRaw : undefined;
    const body = verbatim ?? blockWikitext(el, state);
    if (body === "") continue;

    const lead = isOriginal ? (el.wikiLead ?? "") : "";
    out += (prev === null ? lead : separatorBefore(el, isOriginal, prev)) + body;
    prev = {
      type: el.type,
      srcEnd: isOriginal && el.wikiRaw !== undefined ? (el.wikiSrc ?? 0) + el.wikiRaw.length : null,
    };
  }

  out += nodes[nodes.length - 1]?.wikiTrail ?? "";
  return { wikitext: out, complete: state.complete };
}
