/**
 * wiki-wikitext.ts — Canonical wikitext serialization for the Plate canvas.
 * Atomic and interactive template nodes emit their stored wikitext or canonical
 * representation; structural blocks map to standard MediaWiki markup.
 */

import type { Descendant } from "slate";
import type {
  WikiText,
  WikiElement,
  ListItemEl,
  RowEl,
  CellEl,
} from "./wiki-html";
import { serializeTemplateToWikitext } from "~/lib/wiki-os/wikitext/serializer";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export interface WikitextSerializeResult {
  wikitext: string;
  complete: boolean;
}

function leavesToWikitext(children: Descendant[]): string {
  let out = "";
  for (const child of children) {
    const t = child as WikiText;
    if (typeof t.text !== "string") continue;
    let text = t.text.replace(/\n/g, "");
    if (!(t.bold || t.italic || t.underline || t.strike || t.codeMark)) {
      text = t.text;
    }
    if (t.codeMark) text = `<code>${text}</code>`;
    if (t.strike) text = `<s>${text}</s>`;
    if (t.underline) text = `<u>${text}</u>`;
    if (t.bold && t.italic) text = `'''''${text}'''''`;
    else if (t.bold) text = `'''${text}'''`;
    else if (t.italic) text = `''${text}''`;
    if (t.sup) text = `<sup>${text}</sup>`;
    if (t.sub) text = `<sub>${text}</sub>`;
    out += text;
  }
  return out;
}

/**
 * Serialize the Plate value to canonical MediaWiki wikitext.
 */
export function serializePlateToWikitext(nodes: Descendant[]): WikitextSerializeResult {
  let complete = true;
  const parts: string[] = [];

  const walkInline = (children: Descendant[]): string => {
    let out = "";
    for (const child of children) {
      const el = child as WikiElement & WikiText;
      if (typeof el.text === "string") {
        out += leavesToWikitext([child]);
        continue;
      }
      switch (el.type) {
        case "link": {
          const label = leavesToWikitext(el.children);
          if (el.internal) {
            const target = decodeURIComponent(el.url.replace(/^\/wiki\//, "").replace(/_/g, " "));
            out += target === label ? `[[${target}]]` : `[[${target}|${label}]]`;
          } else {
            out += `[${el.url} ${label}]`;
          }
          break;
        }
        case "ref":
          out += `<ref>${el.label}</ref>`;
          break;
        case "chip-coord": {
          const cc = child as any;
          out += cc.wikitext || `[[Coords:${cc.lat},${cc.lng}|${cc.label || "Location"}]]`;
          break;
        }
        case "chip-engine": {
          const ce = child as any;
          out += ce.wikitext || `[[${ce.connector || "CountryData"}:${ce.slug}|${ce.metric}]]`;
          break;
        }
        default: {
          const wt = (child as unknown as { rawWikitext?: string; wikitext?: string }).rawWikitext || (child as unknown as { wikitext?: string }).wikitext;
          if (wt) out += wt;
        }
      }
    }
    return out;
  };

  const walkBlock = (node: Descendant): void => {
    const el = node as any;
    switch (el.type) {
      case "h1": parts.push(`= ${inlineToWikitextSafe(el)} =\n`); break;
      case "h2": parts.push(`== ${inlineToWikitextSafe(el)} ==\n`); break;
      case "h3": parts.push(`=== ${inlineToWikitextSafe(el)} ===\n`); break;
      case "h4": parts.push(`==== ${inlineToWikitextSafe(el)} ====\n`); break;
      case "h5": parts.push(`===== ${inlineToWikitextSafe(el)} =====\n`); break;
      case "h6": parts.push(`====== ${inlineToWikitextSafe(el)} ======\n`); break;
      case "p": {
        const inner = walkInline(el.children);
        if (inner.trim()) parts.push(`${inner}\n`);
        break;
      }
      case "blockquote":
        parts.push(`<blockquote>${walkInline(el.children)}</blockquote>\n`);
        break;
      case "code-block":
        parts.push(`<pre>${esc(el.children.map((c: any) => c.text ?? "").join(""))}</pre>\n`);
        break;
      case "ul":
      case "ol": {
        const marker = el.type === "ol" ? "#" : "*";
        for (const li of el.children as ListItemEl[]) {
          parts.push(`${marker} ${walkInline(li.children).trim()}\n`);
        }
        break;
      }
      case "table": {
        const rows = el.children as RowEl[];
        const lines = ['{| class="wikitable"'];
        for (const tr of rows) {
          lines.push("|-");
          for (const cell of tr.children as CellEl[]) {
            const prefix = cell.type === "th" ? "!" : "|";
            lines.push(`${prefix} ${walkInline(cell.children).trim()}`);
          }
        }
        lines.push("|}");
        parts.push(lines.join("\n") + "\n");
        break;
      }
      case "hr":
        parts.push("----\n");
        break;
      case "infobox-block":
      case "infobox":
      case "infobox-box": {
        const wt = el.rawWikitext || el.wikitext || serializeTemplateToWikitext({
          templateName: el.templateName || "Infobox",
          params: el.params,
          positional: el.positional,
          paramList: el.paramList,
        });
        parts.push(`${wt}\n`);
        break;
      }
      case "template-block":
      case "template": {
        const wt = el.rawWikitext || el.wikitext || serializeTemplateToWikitext({
          templateName: el.templateName || el.name || "Template",
          params: el.params,
          positional: el.positional,
          paramList: el.paramList,
        });
        parts.push(`${wt}\n`);
        break;
      }
      case "media": {
        const wt = el.wikitext || `[[File:${el.filename}|${el.align || "thumb"}|${el.caption || ""}]]`;
        parts.push(`${wt}\n`);
        break;
      }
      case "raw-html": {
        const wt = el.rawWikitext || el.wikitext;
        if (!wt) {
          complete = false;
        }
        parts.push(`${wt || el.html || ""}\n`);
        break;
      }
      default: {
        const wt = el.rawWikitext || el.wikitext;
        if (wt) parts.push(`${wt}\n`);
      }
    }
  };

  function inlineToWikitextSafe(e: WikiElement): string {
    return walkInline(e.children);
  }

  nodes.forEach(walkBlock);
  return { wikitext: parts.join("\n").trim(), complete };
}
