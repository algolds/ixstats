/**
 * wiki-wikitext.ts — Canonical wikitext serialization for the Plate canvas.
 * Atomic and interactive template nodes emit their stored wikitext or canonical
 * representation; structural blocks map to standard MediaWiki markup.
 */

import type { Descendant } from "slate";
import type { WikiText, WikiElement, ListItemEl, RowEl, CellEl } from "./wiki-html";
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
    const t = child as any;
    if (typeof t.text !== "string") continue;
    let text = t.text;
    const isCode = Boolean(t.codeMark || t.code);
    const isStrike = Boolean(t.strike || t.strikethrough);
    const isUnderline = Boolean(t.underline);
    const isBold = Boolean(t.bold);
    const isItalic = Boolean(t.italic);
    const isSup = Boolean(t.sup || t.superscript);
    const isSub = Boolean(t.sub || t.subscript);

    if (isBold || isItalic || isUnderline || isStrike || isCode || isSup || isSub) {
      text = text.replace(/\n/g, "");
    }
    if (isCode) text = `<code>${text}</code>`;
    if (isStrike) text = `<s>${text}</s>`;
    if (isUnderline) text = `<u>${text}</u>`;
    if (isBold && isItalic) text = `'''''${text}'''''`;
    else if (isBold) text = `'''${text}'''`;
    else if (isItalic) text = `''${text}''`;
    if (isSup) text = `<sup>${text}</sup>`;
    if (isSub) text = `<sub>${text}</sub>`;
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
      const elAny = child as any;
      switch (elAny.type) {
        case "a":
        case "link": {
          const label = leavesToWikitext(elAny.children || []);
          const isInternal =
            elAny.internal ??
            Boolean(
              elAny.target ||
                (elAny.url ? !/^https?:/i.test(elAny.url) || elAny.url.startsWith("/wiki/") : true)
            );
          if (isInternal) {
            const target =
              elAny.target ||
              decodeURIComponent((elAny.url || "").replace(/^\/wiki\//, "").replace(/_/g, " "));
            out += target === label ? `[[${target}]]` : `[[${target}|${label}]]`;
          } else {
            out += `[${elAny.url} ${label}]`;
          }
          break;
        }
        case "ref":
          out += `<ref>${elAny.label || ""}</ref>`;
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
        case "chip-template":
        case "inline-template": {
          out +=
            elAny.rawWikitext ||
            elAny.wikitext ||
            serializeTemplateToWikitext({
              templateName: elAny.templateName || elAny.name || "Template",
              params: elAny.params || {},
              positional: elAny.positional,
              paramList: elAny.paramList,
            });
          break;
        }
        case "lic":
        case "span": {
          out += walkInline(elAny.children || []);
          break;
        }
        default: {
          const wt =
            (child as unknown as { rawWikitext?: string; wikitext?: string }).rawWikitext ||
            (child as unknown as { wikitext?: string }).wikitext;
          if (wt) {
            out += wt;
          } else if (Array.isArray(elAny.children)) {
            out += walkInline(elAny.children);
          }
        }
      }
    }
    return out;
  };

  const walkBlock = (node: Descendant): void => {
    const el = node as any;
    switch (el.type) {
      case "h1":
        parts.push(`= ${inlineToWikitextSafe(el)} =\n`);
        break;
      case "h2":
        parts.push(`== ${inlineToWikitextSafe(el)} ==\n`);
        break;
      case "h3":
        parts.push(`=== ${inlineToWikitextSafe(el)} ===\n`);
        break;
      case "h4":
        parts.push(`==== ${inlineToWikitextSafe(el)} ====\n`);
        break;
      case "h5":
        parts.push(`===== ${inlineToWikitextSafe(el)} =====\n`);
        break;
      case "h6":
        parts.push(`====== ${inlineToWikitextSafe(el)} ======\n`);
        break;
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
        const defaultMarker = el.type === "ol" ? "#" : "*";
        for (const li of (el.children || []) as any[]) {
          const level = Math.max(1, li.level || 1);
          const marker = li.prefix || defaultMarker.repeat(level);
          if (typeof li.text === "string") {
            parts.push(`${marker} ${leavesToWikitext([li]).trim()}\n`);
          } else {
            let kids = li.children || [];
            if (kids.length === 1 && kids[0]?.type === "lic") {
              kids = kids[0].children || [];
            }
            parts.push(`${marker} ${walkInline(kids).trim()}\n`);
          }
        }
        break;
      }
      case "table": {
        const rows = (el.children || []) as any[];
        const tableAttrs = el.attributes ? ` ${el.attributes}` : ' class="wikitable"';
        const lines = [`{|${tableAttrs}`];
        if (el.caption) {
          lines.push(`|+ ${el.caption}`);
        }
        for (const tr of rows) {
          const trAttrs = tr.attributes ? ` ${tr.attributes}` : "";
          lines.push(`|-${trAttrs}`);
          for (const cell of (tr.children || []) as any[]) {
            const prefix = cell.type === "th" ? "!" : "|";
            const attrPart = cell.attributes ? `${cell.attributes} | ` : "";
            lines.push(`${prefix} ${attrPart}${walkInline(cell.children || []).trim()}`);
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
        const wt =
          el.rawWikitext ||
          el.wikitext ||
          serializeTemplateToWikitext({
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
        const wt =
          el.rawWikitext ||
          el.wikitext ||
          serializeTemplateToWikitext({
            templateName: el.templateName || el.name || "Template",
            params: el.params,
            positional: el.positional,
            paramList: el.paramList,
          });
        parts.push(`${wt}\n`);
        break;
      }
      case "lic": {
        const inner = walkInline(el.children);
        if (inner.trim()) parts.push(`${inner}\n`);
        break;
      }
      case "media": {
        const wt =
          el.wikitext ||
          (el.filename
            ? `[[File:${el.filename}${el.align ? `|${el.align}` : "|thumb"}${
                el.caption ? `|${el.caption}` : ""
              }]]`
            : el.rawWikitext || "");
        if (wt) parts.push(`${wt}\n`);
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
