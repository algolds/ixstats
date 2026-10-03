/**
 * Canonical wikitext serialization for the Plate canvas. Atomic and interactive
 * template nodes emit their stored wikitext or canonical representation;
 * structural blocks map to standard MediaWiki markup.
 */

import type { Descendant } from "slate";
import { serializeTemplateToWikitext } from "~/lib/wiki-os/wikitext/serializer";
import { esc } from "./wiki-html";

export interface WikitextSerializeResult {
  wikitext: string;
  complete: boolean;
}

/** Plate nodes are loosely typed: legacy and plugin nodes carry extra fields. */
type Loose = any;

const WRAP_INNER: ReadonlyArray<[string, string]> = [
  ["code", "code"],
  ["strike", "s"],
  ["underline", "u"],
];
const WRAP_OUTER: ReadonlyArray<[string, string]> = [
  ["sup", "sup"],
  ["sub", "sub"],
];

function leavesToWikitext(children: Descendant[]): string {
  let out = "";
  for (const t of children as Loose[]) {
    if (typeof t.text !== "string") continue;
    const marks: Record<string, boolean> = {
      code: Boolean(t.codeMark || t.code),
      strike: Boolean(t.strike || t.strikethrough),
      underline: Boolean(t.underline),
      sup: Boolean(t.sup || t.superscript),
      sub: Boolean(t.sub || t.subscript),
    };
    const quotes = "'".repeat((t.bold ? 3 : 0) + (t.italic ? 2 : 0));
    let text: string = t.text;
    if (quotes || Object.values(marks).some(Boolean)) text = text.replace(/\n/g, "");
    for (const [mark, tag] of WRAP_INNER) if (marks[mark]) text = `<${tag}>${text}</${tag}>`;
    text = `${quotes}${text}${quotes}`;
    for (const [mark, tag] of WRAP_OUTER) if (marks[mark]) text = `<${tag}>${text}</${tag}>`;
    out += text;
  }
  return out;
}

const verbatimWikitext = (el: Loose): string | undefined => el.rawWikitext || el.wikitext;

const templateWikitext = (el: Loose, fallbackName: string): string =>
  verbatimWikitext(el) ||
  serializeTemplateToWikitext({
    templateName: el.templateName || el.name || fallbackName,
    params: el.params,
    positional: el.positional,
    paramList: el.paramList,
  });

function linkToWikitext(el: Loose): string {
  const label = leavesToWikitext(el.children || []);
  const isInternal =
    el.internal ??
    Boolean(
      el.target || (el.url ? !/^https?:/i.test(el.url) || el.url.startsWith("/wiki/") : true)
    );
  if (!isInternal) return `[${el.url} ${label}]`;
  const target =
    el.target || decodeURIComponent((el.url || "").replace(/^\/wiki\//, "").replace(/_/g, " "));
  return target === label ? `[[${target}]]` : `[[${target}|${label}]]`;
}

function inlineToWikitext(children: Descendant[]): string {
  let out = "";
  for (const el of children as Loose[]) {
    switch (typeof el.text === "string" ? "text" : el.type) {
      case "text":
        out += leavesToWikitext([el]);
        break;
      case "a":
      case "link":
        out += linkToWikitext(el);
        break;
      case "ref":
        out += `<ref>${el.label || ""}</ref>`;
        break;
      case "chip-coord":
        out += el.wikitext || `[[Coords:${el.lat},${el.lng}|${el.label || "Location"}]]`;
        break;
      case "chip-engine":
        out += el.wikitext || `[[${el.connector || "CountryData"}:${el.slug}|${el.metric}]]`;
        break;
      case "chip-template":
      case "inline-template":
        out += templateWikitext(el, "Template");
        break;
      case "lic":
      case "span":
        out += inlineToWikitext(el.children || []);
        break;
      default:
        if (verbatimWikitext(el)) out += verbatimWikitext(el);
        else if (Array.isArray(el.children)) out += inlineToWikitext(el.children);
    }
  }
  return out;
}

/** One entry per item, each ending in a newline; join with "" so items stay on consecutive lines. */
function listToWikitext(el: Loose): string[] {
  const defaultMarker = el.type === "ol" ? "#" : "*";
  return (el.children || []).map((li: Loose) => {
    const marker = li.prefix || defaultMarker.repeat(Math.max(1, li.level || 1));
    if (typeof li.text === "string") return `${marker} ${leavesToWikitext([li]).trim()}\n`;
    let kids = li.children || [];
    if (kids.length === 1 && kids[0]?.type === "lic") kids = kids[0].children || [];
    return `${marker} ${inlineToWikitext(kids).trim()}\n`;
  });
}

function tableToWikitext(el: Loose): string {
  const lines = [`{|${el.attributes ? ` ${el.attributes}` : ' class="wikitable"'}`];
  if (el.caption) lines.push(`|+ ${el.caption}`);
  for (const tr of el.children || []) {
    lines.push(`|-${tr.attributes ? ` ${tr.attributes}` : ""}`);
    for (const cell of tr.children || []) {
      const attrPart = cell.attributes ? `${cell.attributes} | ` : "";
      lines.push(
        `${cell.type === "th" ? "!" : "|"} ${attrPart}${inlineToWikitext(cell.children || []).trim()}`
      );
    }
  }
  lines.push("|}");
  return lines.join("\n") + "\n";
}

function mediaToWikitext(el: Loose): string {
  if (el.wikitext) return el.wikitext;
  if (!el.filename) return el.rawWikitext || "";
  return `[[File:${el.filename}|${el.align || "thumb"}${el.caption ? `|${el.caption}` : ""}]]`;
}

const TEMPLATE_BLOCK_NAMES: Record<string, string> = {
  "infobox-block": "Infobox",
  infobox: "Infobox",
  "infobox-box": "Infobox",
  "template-block": "Template",
  template: "Template",
};

/** Wikitext for one block node, or "" when it emits nothing. `complete` flips when HTML had to leak. */
function blockToWikitext(el: Loose, state: { complete: boolean }): string {
  const heading = /^h([1-6])$/.exec(el.type);
  if (heading) {
    const marks = "=".repeat(Number(heading[1]));
    return `${marks} ${inlineToWikitext(el.children)} ${marks}\n`;
  }
  if (Object.hasOwn(TEMPLATE_BLOCK_NAMES, el.type)) {
    return `${templateWikitext(el, TEMPLATE_BLOCK_NAMES[el.type]!)}\n`;
  }
  switch (el.type) {
    case "p":
    case "lic": {
      const inner = inlineToWikitext(el.children);
      return inner.trim() ? `${inner}\n` : "";
    }
    case "blockquote":
      return `<blockquote>${inlineToWikitext(el.children)}</blockquote>\n`;
    case "code-block":
      return `<pre>${esc(el.children.map((c: Loose) => c.text ?? "").join(""))}</pre>\n`;
    case "ul":
    case "ol":
      return listToWikitext(el).join("");
    case "table":
      return tableToWikitext(el);
    case "hr":
      return "----\n";
    case "media": {
      const wt = mediaToWikitext(el);
      return wt ? `${wt}\n` : "";
    }
    case "raw-html": {
      const wt = verbatimWikitext(el);
      if (!wt) state.complete = false;
      return `${wt || el.html || ""}\n`;
    }
    default: {
      const wt = verbatimWikitext(el);
      return wt ? `${wt}\n` : "";
    }
  }
}

/**
 * Serialize the Plate value to canonical MediaWiki wikitext.
 */
export function serializePlateToWikitext(nodes: Descendant[]): WikitextSerializeResult {
  const state = { complete: true };
  const parts = nodes.map((node) => blockToWikitext(node, state)).filter(Boolean);
  return { wikitext: parts.join("\n").trim(), complete: state.complete };
}
