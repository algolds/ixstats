/**
 * wiki-wikitext.ts — Canonical wikitext serialization for the Plate canvas.
 * Atomic nodes (templates/chips/media/raw blocks) emit their stored
 * `wikitext` verbatim; structural blocks map to MediaWiki markup.
 */

import type { Descendant } from "slate";
import type {
  WikiText,
  WikiElement,
  ListItemEl,
  RowEl,
  CellEl,
  InfoboxBoxEl,
} from "./wiki-html";

// ─── Slate → Wikitext (canonical, lossless for atomic nodes) ───────────────

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export interface WikitextSerializeResult {
  wikitext: string;
  /** false when any atomic node lacks a canonical wikitext field */
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
 * Atomic nodes (templates/chips/media/raw blocks) emit their stored
 * `wikitext` verbatim when present; if any atomic node lacks one,
 * `complete` is false and callers must fall back to the HTML save path.
 */
export function serializePlateToWikitext(nodes: Descendant[]): WikitextSerializeResult {
  let complete = true;
  const parts: string[] = [];

  const walkInline = (children: Descendant[]): string => {
    let out = "";
    let atomicMissing = false;
    for (const child of children) {
      const el = child as WikiElement & WikiText;
      if (typeof el.text === "string") { out += leavesToWikitext([child]); continue; }
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
        default: {
          const wt = (child as unknown as { wikitext?: string }).wikitext;
          if (wt) out += wt;
          else atomicMissing = true;
        }
      }
    }
    if (atomicMissing) complete = false;
    return out;
  };

  const walkBlock = (node: Descendant): void => {
    const el = node as WikiElement;
    switch (el.type) {
      case "h2": parts.push(`== ${inlineToWikitextSafe(el)} ==\n`); break;
      case "h3": parts.push(`=== ${inlineToWikitextSafe(el)} ===\n`); break;
      case "h4": parts.push(`==== ${inlineToWikitextSafe(el)} ====\n`); break;
      case "p": {
        const inner = walkInline(el.children);
        if (inner.trim()) parts.push(`${inner}\n`);
        break;
      }
      case "blockquote":
        parts.push(`<blockquote>${walkInline(el.children)}</blockquote>\n`);
        break;
      case "code-block":
        parts.push(`<pre>${esc(el.children.map((c) => (c as WikiText).text ?? "").join(""))}</pre>\n`);
        break;
      case "ul": case "ol": {
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
      case "infobox-box": {
        const ib = el as InfoboxBoxEl;
        if (ib.wikitext) parts.push(`${ib.wikitext}\n`);
        else { complete = false; parts.push(`${ib.html}\n`); }
        break;
      }
      case "template": case "media": case "raw-html": case "chip-engine": case "chip-coord": case "chip-mapembed": {
        const wt = (node as unknown as { wikitext?: string }).wikitext;
        if (wt) parts.push(`${wt}\n`);
        else complete = false;
        break;
      }
      default:
        complete = false;
    }
  };

  // heading helper needs access to walkInline + complete flag
  function inlineToWikitextSafe(e: WikiElement): string {
    return walkInline(e.children);
  }

  nodes.forEach(walkBlock);
  return { wikitext: parts.join("\n"), complete };
}
