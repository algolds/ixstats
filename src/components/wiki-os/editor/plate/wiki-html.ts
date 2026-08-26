/**
 * wiki-html.ts — Parsoid HTML ⇄ Plate (Slate) value conversion for the WikiOS
 * visual editor.
 *
 * Data-integrity strategy: any node the editor models as "atomic" (template
 * transclusions, engine chips, coords/map-embed chips, media figures, and an
 * escape-hatch raw block) stores its ORIGINAL outer HTML verbatim and the
 * serializer re-emits it unchanged. This preserves `data-mw` / `typeof`
 * attributes through every edit roundtrip.
 */

import type { Descendant } from "slate";

// ─── Node model ─────────────────────────────────────────────────────────────

export type WikiText = { text: string; bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean; sup?: boolean; sub?: boolean; codeMark?: boolean };

export interface BaseEl {
  id?: string;
  children: Descendant[];
}
export interface PEl extends BaseEl { type: "p" }
export interface HeadingEl extends BaseEl { type: "h2" | "h3" | "h4"; }
export interface QuoteEl extends BaseEl { type: "blockquote" }
export interface ListEl extends BaseEl { type: "ul" | "ol" }
export interface ListItemEl extends BaseEl { type: "li" }
export interface CodeBlockEl extends BaseEl { type: "code-block" }
export interface TableEl extends BaseEl { type: "table" }
export interface RowEl extends BaseEl { type: "tr" }
export interface CellEl extends BaseEl { type: "td" | "th" }
export interface HrEl extends BaseEl { type: "hr" }
export interface LinkEl extends BaseEl { type: "link"; url: string; internal?: boolean }
export interface TemplateEl extends BaseEl { type: "template"; name: string; params: Record<string, string>; dataMw: string; html: string }
export interface ChipEngineEl extends BaseEl { type: "chip-engine"; name: string; params: Record<string, string>; dataMw: string; label: string }
export interface ChipCoordEl extends BaseEl { type: "chip-coord"; href: string; title: string; label: string }
export interface ChipMapEmbedEl extends BaseEl { type: "chip-mapembed"; href: string; title: string }
export interface MediaEl extends BaseEl { type: "media"; html: string; filename?: string }
export interface RawHtmlEl extends BaseEl { type: "raw-html"; html: string; kind?: "infobox" | "generic"; name?: string; params?: Record<string, string>; dataMw?: string }
export interface RefEl extends BaseEl { type: "ref"; label: string }

export type WikiElement =
  | PEl | HeadingEl | QuoteEl | ListEl | ListItemEl | CodeBlockEl
  | TableEl | RowEl | CellEl | HrEl | LinkEl
  | TemplateEl | ChipEngineEl | ChipCoordEl | ChipMapEmbedEl
  | MediaEl | RawHtmlEl | RefEl;

let idCounter = 0;
const nextId = () => `wn${Date.now().toString(36)}${(idCounter++).toString(36)}`;

const VOID_TYPES = new Set(["hr", "template", "chip-engine", "chip-coord", "chip-mapembed", "media", "raw-html", "ref"]);

export function isVoidType(type: string): boolean {
  return VOID_TYPES.has(type);
}

// ─── HTML → Slate ───────────────────────────────────────────────────────────

function parseTemplateData(el: Element): { name: string; params: Record<string, string>; dataMw: string } | null {
  const raw = el.getAttribute("data-mw");
  if (!raw) return null;
  try {
    const dataMw = JSON.parse(raw);
    const tmpl = dataMw?.parts?.[0]?.template;
    if (!tmpl) return null;
    const name = tmpl.target?.wt ?? "Template";
    const params: Record<string, string> = {};
    if (tmpl.params) {
      for (const [k, v] of Object.entries(tmpl.params)) {
        params[k] = (v as { wt?: string })?.wt ?? String(v);
      }
    }
    return { name, params, dataMw: raw };
  } catch {
    return null;
  }
}

function chipInfoFromAnchor(a: HTMLAnchorElement): { kind: "coord" | "mapembed"; href: string; title: string; label: string } | null {
  const href = a.getAttribute("href") || "";
  const title = a.getAttribute("title") || "";
  let decodedHref = href;
  try { decodedHref = decodeURIComponent(href); } catch { /* keep */ }
  if (/Coords:/i.test(decodedHref) || /Coords:/i.test(title)) {
    return { kind: "coord", href, title, label: a.textContent?.trim() || "Location" };
  }
  if (/MapEmbed:/i.test(decodedHref) || /MapEmbed:/i.test(title)) {
    return { kind: "mapembed", href, title, label: "Map Embed" };
  }
  return null;
}

/** Inline conversion: returns array of leaf nodes (text/link/ref). */
function convertInlineNodes(nodes: NodeList, marks: Partial<WikiText>, out: Descendant[]): void {
  nodes.forEach((n) => {
    if (n.nodeType === Node.TEXT_NODE) {
      const raw = n.textContent ?? "";
      const text = raw.replace(/\s+/g, " ");
      if (text.length === 0 || text === " ") {
        // preserve single meaningful space only when between content
        if (/\s/.test(raw) && out.length > 0) {
          const last = out[out.length - 1] as WikiText;
          if (last && typeof last.text === "string" && !last.text.endsWith(" ")) {
            out.push({ text: " ", ...marks });
          }
        }
        return;
      }
      out.push({ text, ...marks });
      return;
    }
    if (n.nodeType !== Node.ELEMENT_NODE) return;
    const el = n as Element;
    const tag = el.tagName.toLowerCase();

    if (tag === "br") { out.push({ text: "\n", ...marks }); return; }

    // atomic inline constructs
    if (el.getAttribute("typeof")?.includes("mw:Transclusion")) {
      const info = parseTemplateData(el);
      const wt = info?.name ?? "";
      const chipClass = el.className || "";
      if (wt.startsWith("MyCountry:") || wt.startsWith("CountryData:") || wt.startsWith("BusinessData:") || chipClass.includes("wikios-ve-custom-chip")) {
        out.push({
          type: "chip-engine", name: wt || el.getAttribute("data-wt") || "CountryData",
          params: info?.params ?? {}, dataMw: info?.dataMw ?? "{}",
          label: el.textContent?.trim() || wt.split(":").pop() || "Chip",
          children: [{ text: "" }], id: nextId(),
        } as unknown as Descendant);
        return;
      }
      const anchor = el.querySelector("a");
      const chip = anchor ? chipInfoFromAnchor(anchor) : null;
      if (chip?.kind === "coord") {
        out.push({ type: "chip-coord", href: chip.href, title: chip.title, label: chip.label, children: [{ text: "" }], id: nextId() } as unknown as Descendant);
        return;
      }
      if (chip?.kind === "mapembed") {
        out.push({ type: "chip-mapembed", href: chip.href, title: chip.title, children: [{ text: "" }], id: nextId() } as unknown as Descendant);
        return;
      }
      out.push({
        type: "template", name: info?.name ?? "Template", params: info?.params ?? {},
        dataMw: info?.dataMw ?? "{}", html: el.outerHTML,
        children: [{ text: "" }], id: nextId(),
      } as unknown as Descendant);
      return;
    }

    if (tag === "a") {
      const chip = chipInfoFromAnchor(el as HTMLAnchorElement);
      if (chip?.kind === "coord") {
        out.push({ type: "chip-coord", href: chip.href, title: chip.title, label: chip.label, children: [{ text: "" }], id: nextId() } as unknown as Descendant);
        return;
      }
      if (chip?.kind === "mapembed") {
        out.push({ type: "chip-mapembed", href: chip.href, title: chip.title, children: [{ text: "" }], id: nextId() } as unknown as Descendant);
        return;
      }
      const href = el.getAttribute("href") || "";
      const internal = !/^https?:/i.test(href);
      const children: Descendant[] = [];
      convertInlineNodes(el.childNodes, marks, children);
      const linkChildren = children.filter((c) => typeof (c as WikiText).text === "string");
      out.push({ type: "link", url: href, internal, children: linkChildren.length ? linkChildren : [{ text: el.textContent ?? "" , ...marks }] } as unknown as Descendant);
      return;
    }

    if (tag === "sup" && el.querySelector("ref")) {
      out.push({ type: "ref", label: el.querySelector("ref")?.textContent?.trim() || "Citation needed", children: [{ text: "" }], id: nextId() } as unknown as Descendant);
      return;
    }

    const nextMarks = { ...marks };
    let recurse = true;
    switch (tag) {
      case "b": case "strong": nextMarks.bold = true; break;
      case "i": case "em": nextMarks.italic = true; break;
      case "u": nextMarks.underline = true; break;
      case "s": case "strike": case "del": nextMarks.strike = true; break;
      case "sup": nextMarks.sup = true; break;
      case "sub": nextMarks.sub = true; break;
      case "code": nextMarks.codeMark = true; break;
      default: recurse = tag === "span" || tag === "small" || tag === "abbr" || tag === "cite" || tag === "time" || tag === "figure-inline" || tag === "ref";
    }
    if (recurse) {
      convertInlineNodes(el.childNodes, nextMarks, out);
    } else if (!VOID_TYPES.has(tag)) {
      convertInlineNodes(el.childNodes, nextMarks, out);
    }
  });
}

function isMeaningfulInline(children: Descendant[]): boolean {
  const text = children.map((c) => (typeof (c as WikiText).text === "string" ? (c as WikiText).text : "")).join("");
  return text.trim().length > 0;
}

function convertBlockChildren(el: Element): Descendant[] {
  const out: Descendant[] = [];
  convertInlineNodes(el.childNodes, {}, out);
  if (out.length === 0) out.push({ text: "" });
  return out;
}

/** Collect an [about] sibling group into one raw-html block (infobox tables etc.). */
function collectAboutGroup(el: Element): { html: string; info: { name: string; params: Record<string, string>; dataMw: string } | null } {
  const about = el.getAttribute("about")!;
  const parts: string[] = [el.outerHTML];
  let cursor = el.nextElementSibling;
  while (cursor) {
    const next = cursor.nextElementSibling;
    if (cursor.getAttribute("about") === about) {
      parts.push(cursor.outerHTML);
      cursor.remove();
    }
    cursor = next;
  }
  const dataMwHost = el.matches("[data-mw]") ? el : el.querySelector("[data-mw]");
  return { html: parts.join("\n"), info: dataMwHost ? parseTemplateData(dataMwHost) : null };
}

/**
 * Convert Parsoid-ish article HTML into a Plate value.
 * Anything not explicitly modeled becomes a lossless `raw-html` void block.
 */
export function deserializeParsoidHtml(html: string): Descendant[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const body = doc.body;
  const blocks: Descendant[] = [];

  const pushRaw = (node: Element, kind: "infobox" | "generic" = "generic") => {
    const about = node.getAttribute("about");
    let htmlPart = node.outerHTML;
    let info: ReturnType<typeof parseTemplateData> = null;
    if (about) {
      const group = collectAboutGroup(node);
      htmlPart = group.html;
      info = group.info;
    } else {
      const host = node.matches("[data-mw]") ? node : node.querySelector("[data-mw]");
      info = host ? parseTemplateData(host) : null;
    }
    const isInfobox = kind === "infobox" || /infobox/i.test(node.className);
    blocks.push({
      type: "raw-html", html: htmlPart, kind: isInfobox ? "infobox" : "generic",
      name: info?.name, params: info?.params, dataMw: info?.dataMw,
      children: [{ text: "" }], id: nextId(),
    } as unknown as Descendant);
  };

  const walkBlocks = (parent: Element) => {
    parent.childNodes.forEach((n) => { /* placeholder to satisfy lint on forEach reuse */ });
    for (let i = 0; i < parent.childNodes.length; i++) {
      const n = parent.childNodes[i];
      if (n.nodeType === Node.TEXT_NODE) {
        const t = (n.textContent ?? "").replace(/\s+/g, " ");
        if (t.trim().length > 0) {
          blocks.push({ type: "p", children: [{ text: t.trim() }], id: nextId() } as unknown as Descendant);
        }
        continue;
      }
      if (n.nodeType !== Node.ELEMENT_NODE) continue;
      const el = n as Element;
      const tag = el.tagName.toLowerCase();
      if (tag === "style" || tag === "link" || tag === "head" || tag === "meta") continue;
      if (el.getAttribute("typeof")?.includes("mw:Transclusion") || el.hasAttribute("about")) {
        // infobox tables & grouped transclusions stay atomic + lossless
        pushRaw(el, /infobox/i.test(el.className) ? "infobox" : "generic");
        continue;
      }
      if (el.getAttribute("typeof")?.includes("mw:File") || tag === "figure") {
        blocks.push({ type: "media", html: el.outerHTML, filename: el.querySelector("img")?.getAttribute("alt") ?? undefined, children: [{ text: "" }], id: nextId() } as unknown as Descendant);
        continue;
      }
      switch (tag) {
        case "h1": case "h2": case "h3": case "h4": case "h5": case "h6": {
          const level = Math.min(Math.max(parseInt(tag[1], 10), 2), 4);
          blocks.push({ type: `h${level}` as "h2", children: convertBlockChildren(el), id: nextId() } as unknown as Descendant);
          break;
        }
        case "p": {
          const kids = convertBlockChildren(el);
          if (isMeaningfulInline(kids)) {
            blocks.push({ type: "p", children: kids, id: nextId() } as unknown as Descendant);
          }
          break;
        }
        case "blockquote": {
          blocks.push({ type: "blockquote", children: convertBlockChildren(el), id: nextId() } as unknown as Descendant);
          break;
        }
        case "pre": case "code": {
          if (tag === "code" && el.closest("pre")) { break; }
          blocks.push({ type: "code-block", children: [{ text: el.textContent ?? "" }], id: nextId() } as unknown as Descendant);
          break;
        }
        case "ul": case "ol": {
          const items: Descendant[] = [];
          el.querySelectorAll(":scope > li").forEach((li) => {
            items.push({ type: "li", children: convertBlockChildren(li), id: nextId() } as unknown as Descendant);
          });
          if (items.length > 0) {
            blocks.push({ type: tag, children: items, id: nextId() } as unknown as Descendant);
          }
          break;
        }
        case "table": {
          // real (non-infobox) wikitable → structured table model
          const rows: Descendant[] = [];
          el.querySelectorAll("tr").forEach((tr) => {
            const cells: Descendant[] = [];
            tr.querySelectorAll("th,td").forEach((cell) => {
              cells.push({ type: cell.tagName.toLowerCase(), children: convertBlockChildren(cell), id: nextId() } as unknown as Descendant);
            });
            if (cells.length > 0) rows.push({ type: "tr", children: cells, id: nextId() } as unknown as Descendant);
          });
          if (rows.length > 0 && !el.querySelector("[typeof*=Transclusion], figure")) {
            blocks.push({ type: "table", children: rows, id: nextId() } as unknown as Descendant);
          } else if (rows.length > 0) {
            pushRaw(el, "generic");
          }
          break;
        }
        case "hr": {
          blocks.push({ type: "hr", children: [{ text: "" }], id: nextId() } as unknown as Descendant);
          break;
        }
        default: {
          // container-ish elements: recurse; everything else preserved raw
          if (/^(div|section|main|article|center|figcaption|span)$/i.test(tag) && !el.querySelector("table, figure, p, h1, h2, h3, h4, h5, h6, ul, ol")) {
            const kids = convertBlockChildren(el);
            if (isMeaningfulInline(kids)) {
              blocks.push({ type: "p", children: kids, id: nextId() } as unknown as Descendant);
              break;
            }
          }
          if (/^(div|section)$/.test(tag)) {
            walkBlocks(el);
          } else {
            pushRaw(el, "generic");
          }
        }
      }
    }
  };

  walkBlocks(body);
  if (blocks.length === 0) blocks.push({ type: "p", children: [{ text: "" }], id: nextId() } as unknown as Descendant);
  return blocks;
}

// ─── Slate → HTML ───────────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function serializeLeaves(children: Descendant[]): string {
  let out = "";
  for (const child of children) {
    const t = child as WikiText;
    if (typeof t.text !== "string") continue;
    let text = t.text;
    if (!(t.bold || t.italic || t.underline || t.strike || t.codeMark)) {
      text = text.replace(/\n/g, "<br>");
    }
    let html = esc(text);
    if (t.codeMark) html = `<code>${html}</code>`;
    if (t.strike) html = `<s>${html}</s>`;
    if (t.underline) html = `<u>${html}</u>`;
    if (t.italic) html = `<i>${html}</i>`;
    if (t.bold) html = `<b>${html}</b>`;
    if (t.sup) html = `<sup>${html}</sup>`;
    if (t.sub) html = `<sub>${html}</sub>`;
    out += html;
  }
  return out;
}

function serializeInline(children: Descendant[]): string {
  let out = "";
  for (const child of children) {
    const el = child as WikiElement & WikiText;
    if (typeof el.text === "string") {
      out += serializeLeaves([child]);
      continue;
    }
    switch (el.type) {
      case "link":
        out += `<a href="${esc(el.url)}"${el.internal ? ' rel="internal"' : ""}>${serializeLeaves(el.children)}</a>`;
        break;
      case "ref":
        out += `<sup><ref>${esc(el.label)}</ref></sup>`;
        break;
      case "template":
        out += el.html;
        break;
      case "chip-engine": {
        const cls = el.name.startsWith("MyCountry:")
          ? "wikios-ve-custom-chip chip-mycountry"
          : el.name.startsWith("BusinessData:")
            ? "wikios-ve-custom-chip chip-business"
            : "wikios-ve-custom-chip chip-country";
        out += `<span typeof="mw:Transclusion" data-mw='${esc(el.dataMw)}' class="${cls}" contenteditable="false"><span class="opacity-70">⚡</span> ${esc(el.label)}</span>`;
        break;
      }
      case "chip-coord":
        out += `<a href="${esc(el.href)}" title="${esc(el.title)}" class="wikios-ve-custom-chip chip-coords" contenteditable="false"><span class="opacity-70">📍</span> ${esc(el.label)}</a>`;
        break;
      case "chip-mapembed":
        out += `<a href="${esc(el.href)}" title="${esc(el.title)}" class="wikios-ve-custom-chip chip-mapembed" contenteditable="false"><span class="opacity-70">🗺️</span> Map Embed</a>`;
        break;
      default:
        out += serializeLeaves([child]);
    }
  }
  return out;
}

function serializeBlock(el: WikiElement): string {
  switch (el.type) {
    case "p": {
      const inner = serializeInline(el.children);
      return inner.trim().length > 0 ? `<p>${inner}</p>` : "";
    }
    case "h2": case "h3": case "h4":
      return `<${el.type}>${serializeInline(el.children)}</${el.type}>`;
    case "blockquote":
      return `<blockquote>${serializeInline(el.children)}</blockquote>`;
    case "code-block":
      return `<pre><code>${esc(el.children.map((c) => (c as WikiText).text ?? "").join(""))}</code></pre>`;
    case "ul": case "ol": {
      const items = el.children.map((li) => `<li>${serializeInline((li as ListItemEl).children)}</li>`).join("");
      return `<${el.type}>${items}</${el.type}>`;
    }
    case "table": {
      const rows = (el.children as RowEl[])
        .map(
          (tr) =>
            `<tr>${(tr.children as CellEl[])
              .map((cell) => `<${cell.type}>${serializeInline(cell.children)}</${cell.type}>`)
              .join("")}</tr>`
        )
        .join("");
      return `<table style="border-collapse:collapse;width:100%"><tbody>${rows}</tbody></table>`;
    }
    case "hr":
      return "<hr>";
    case "template":
    case "raw-html":
    case "media":
      return el.html;
    default:
      return "";
  }
}

/** Serialize the Plate value back to article HTML (Parsoid-tolerant). */
export function serializePlateToHtml(nodes: Descendant[]): string {
  return nodes
    .map((n) => serializeBlock(n as WikiElement))
    .filter(Boolean)
    .join("\n");
}

/** Plain-text projection used for word counts. */
export function valueToPlainText(nodes: Descendant[]): string {
  const out: string[] = [];
  const visit = (n: Descendant) => {
    const el = n as WikiElement & WikiText;
    if (typeof el.text === "string") { out.push(el.text); return; }
    if (Array.isArray(el.children)) el.children.forEach(visit);
  };
  nodes.forEach(visit);
  return out.join(" ").replace(/\s+/g, " ").trim();
}
