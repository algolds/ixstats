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

export type WikiText = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  sup?: boolean;
  sub?: boolean;
  codeMark?: boolean;
};

interface BaseEl {
  id?: string;
  children: Descendant[];
}
interface PEl extends BaseEl {
  type: "p";
}
interface HeadingEl extends BaseEl {
  type: "h2" | "h3" | "h4";
}
interface QuoteEl extends BaseEl {
  type: "blockquote";
}
interface ListEl extends BaseEl {
  type: "ul" | "ol";
}
interface ListItemEl extends BaseEl {
  type: "li";
  level?: number;
  prefix?: string;
}
interface CodeBlockEl extends BaseEl {
  type: "code-block";
}
interface TableEl extends BaseEl {
  type: "table";
  caption?: string;
  attributes?: string;
}
interface RowEl extends BaseEl {
  type: "tr";
  attributes?: string;
}
interface CellEl extends BaseEl {
  type: "td" | "th";
  attributes?: string;
  isHeader?: boolean;
}
interface HrEl extends BaseEl {
  type: "hr";
}
interface LinkEl extends BaseEl {
  type: "link";
  url: string;
  internal?: boolean;
}
interface TemplateEl extends BaseEl {
  type: "template";
  name: string;
  params: Record<string, string>;
  dataMw: string;
  html: string;
  /** Canonical MediaWiki invocation — emitted verbatim by serializePlateToWikitext. */ wikitext?: string;
}
export interface ChipEngineEl extends BaseEl {
  type: "chip-engine";
  name: string;
  params: Record<string, string>;
  dataMw: string;
  label: string;
}
export interface ChipCoordEl extends BaseEl {
  type: "chip-coord";
  href: string;
  title: string;
  label: string;
}
export interface ChipMapEmbedEl extends BaseEl {
  type: "chip-mapembed";
  href: string;
  title: string;
}
interface MediaEl extends BaseEl {
  type: "media";
  html: string;
  filename?: string;
}
interface RawHtmlEl extends BaseEl {
  type: "raw-html";
  html: string;
  kind?: "infobox" | "generic";
  name?: string;
  params?: Record<string, string>;
  dataMw?: string;
  /** Canonical MediaWiki invocation — emitted verbatim by serializePlateToWikitext. */ wikitext?: string;
}
interface RefEl extends BaseEl {
  type: "ref";
  label: string;
}
interface InfoboxBoxEl extends BaseEl {
  type: "infobox-box";
  title?: string;
  fields: Array<{ label: string; value: string }>;
  html: string;
  edited?: boolean;
  /** Canonical MediaWiki invocation — emitted verbatim by serializePlateToWikitext. */ wikitext?: string;
}

export type WikiElement =
  | PEl
  | HeadingEl
  | QuoteEl
  | ListEl
  | ListItemEl
  | CodeBlockEl
  | TableEl
  | RowEl
  | CellEl
  | HrEl
  | LinkEl
  | TemplateEl
  | ChipEngineEl
  | ChipCoordEl
  | ChipMapEmbedEl
  | MediaEl
  | RawHtmlEl
  | RefEl
  | InfoboxBoxEl;

let idCounter = 0;
const nextId = () => `wn${Date.now().toString(36)}${(idCounter++).toString(36)}`;

const VOID_TYPES = new Set([
  "hr",
  "template",
  "chip-engine",
  "chip-coord",
  "chip-mapembed",
  "media",
  "raw-html",
  "infobox-box",
]);

// Table classes that indicate metadata/navigation furniture → atomic, not editable grids
const FURNITURE_RE =
  /navbox|metadata|vertical-navbox|mbox|sidebar|sistersitebox|toc|navigation|catlinks|mw-jump/i;

const squish = (s?: string | null) => (s ?? "").replace(/\s+/g, " ").trim();

function parseInfoboxFields(el: Element): {
  title?: string;
  fields: Array<{ label: string; value: string }>;
} {
  const title = squish(el.querySelector(".infobox-title, caption, .infobox-above")?.textContent);
  const fields: Array<{ label: string; value: string }> = [];

  el.querySelectorAll("tr").forEach((tr) => {
    // skip rows that are pure media/layout
    if (tr.querySelector("img, figure")) return;
    const label = squish(tr.querySelector("th")?.textContent);
    const value = squish(tr.querySelector("td")?.textContent);
    if (value && (label || value.length < 120)) fields.push({ label, value });
  });
  return { title: title || undefined, fields };
}

type TemplateInfo = { name: string; params: Record<string, string>; dataMw: string };

function parseTemplateData(el: Element): TemplateInfo | null {
  const raw = el.getAttribute("data-mw");
  if (!raw) return null;
  try {
    const tmpl = JSON.parse(raw)?.parts?.[0]?.template;
    if (!tmpl) return null;
    const params = Object.fromEntries(
      Object.entries(tmpl.params ?? {}).map(([k, v]) => [
        k,
        (v as { wt?: string })?.wt ?? String(v),
      ])
    );
    return { name: tmpl.target?.wt ?? "Template", params, dataMw: raw };
  } catch {
    return null;
  }
}

type ChipInfo = { kind: "coord" | "mapembed"; href: string; title: string; label: string };

function chipInfoFromAnchor(a: HTMLAnchorElement): ChipInfo | null {
  const href = a.getAttribute("href") || "";
  const title = a.getAttribute("title") || "";
  let decodedHref = href;
  try {
    decodedHref = decodeURIComponent(href);
  } catch {
    /* keep */
  }
  const mentions = (re: RegExp) => re.test(decodedHref) || re.test(title);
  if (mentions(/Coords:/i)) {
    return { kind: "coord", href, title, label: a.textContent?.trim() || "Location" };
  }
  if (mentions(/MapEmbed:/i)) return { kind: "mapembed", href, title, label: "Map Embed" };
  return null;
}

/** Build a Slate node of `type` with a fresh id; atomic nodes get an empty text child. */
function makeNode(
  type: string,
  props: Record<string, unknown> = {},
  children: Descendant[] = [{ text: "" }]
): Descendant {
  return { type, ...props, children, id: nextId() } as unknown as Descendant;
}

function chipNode({ kind, href, title, label }: ChipInfo): Descendant {
  return kind === "coord"
    ? makeNode("chip-coord", { href, title, label })
    : makeNode("chip-mapembed", { href, title });
}

const MARK_BY_TAG: Record<string, Partial<WikiText>> = {
  b: { bold: true },
  strong: { bold: true },
  i: { italic: true },
  em: { italic: true },
  u: { underline: true },
  s: { strike: true },
  strike: { strike: true },
  del: { strike: true },
  sup: { sup: true },
  sub: { sub: true },
  code: { codeMark: true },
};

const SKIPPED_INLINE_TAGS = new Set(["style", "input", "button", "form", "select"]);
const SKIPPED_BLOCK_TAGS = new Set([...SKIPPED_INLINE_TAGS, "link", "head", "meta"]);

function pushText(raw: string, marks: Partial<WikiText>, out: Descendant[]): void {
  const text = raw.replace(/\s+/g, " ");
  if (text.length > 0 && text !== " ") {
    out.push({ text, ...marks });
    return;
  }
  // preserve single meaningful space only when between content
  const last = out.at(-1) as WikiText | undefined;
  if (/\s/.test(raw) && last && typeof last.text === "string" && !last.text.endsWith(" ")) {
    out.push({ text: " ", ...marks });
  }
}

function convertTransclusion(el: Element): Descendant {
  const info = parseTemplateData(el);
  const wt = info?.name ?? "";
  if (
    /^(MyCountry|CountryData|BusinessData):/.test(wt) ||
    el.className.includes("wikios-ve-custom-chip")
  ) {
    return makeNode("chip-engine", {
      name: wt || el.getAttribute("data-wt") || "CountryData",
      params: info?.params ?? {},
      dataMw: info?.dataMw ?? "{}",
      label: el.textContent?.trim() || wt.split(":").pop() || "Chip",
    });
  }
  const anchor = el.querySelector("a");
  const chip = anchor && chipInfoFromAnchor(anchor);
  if (chip) return chipNode(chip);
  return makeNode("template", {
    name: info?.name ?? "Template",
    params: info?.params ?? {},
    dataMw: info?.dataMw ?? "{}",
    html: el.outerHTML,
  });
}

function convertAnchor(el: Element, marks: Partial<WikiText>): Descendant {
  const chip = chipInfoFromAnchor(el as HTMLAnchorElement);
  if (chip) return chipNode(chip);

  let href = el.getAttribute("href") || "";
  if (href.startsWith("./")) href = `/wiki/${href.slice(2)}`;
  const children: Descendant[] = [];
  convertInlineNodes(el.childNodes, marks, children);
  const linkChildren = children.filter((c) => typeof (c as WikiText).text === "string");
  return {
    type: "link",
    url: href,
    internal: !/^https?:/i.test(href),
    children: linkChildren.length ? linkChildren : [{ text: el.textContent ?? "", ...marks }],
  } as unknown as Descendant;
}

/** Inline conversion: returns array of leaf nodes (text/link/ref). */
function convertInlineNodes(nodes: NodeList, marks: Partial<WikiText>, out: Descendant[]): void {
  nodes.forEach((n) => {
    if (n.nodeType === Node.TEXT_NODE) {
      pushText(n.textContent ?? "", marks, out);
      return;
    }
    if (n.nodeType !== Node.ELEMENT_NODE) return;
    const el = n as Element;
    const tag = el.tagName.toLowerCase();

    if (el.classList.contains("mw-editsection") || SKIPPED_INLINE_TAGS.has(tag)) return;
    if (tag === "br") {
      out.push({ text: "\n", ...marks });
    } else if (isTransclusion(el)) {
      // atomic inline constructs
      out.push(convertTransclusion(el));
    } else if (tag === "a") {
      out.push(convertAnchor(el, marks));
    } else if (tag === "sup" && el.querySelector("ref")) {
      out.push(
        makeNode("ref", {
          label: el.querySelector("ref")?.textContent?.trim() || "Citation needed",
        })
      );
    } else if (!VOID_TYPES.has(tag)) {
      convertInlineNodes(el.childNodes, { ...marks, ...MARK_BY_TAG[tag] }, out);
    }
  });
}

function isMeaningfulInline(children: Descendant[]): boolean {
  return children.some(
    (c) => typeof (c as WikiText).text === "string" && (c as WikiText).text.trim()
  );
}

function convertBlockChildren(el: Element): Descendant[] {
  const out: Descendant[] = [];
  convertInlineNodes(el.childNodes, {}, out);
  if (out.length === 0) out.push({ text: "" });
  return out;
}

/** Collect an [about] sibling group into one raw-html block (infobox tables etc.). */
function collectAboutGroup(el: Element): string {
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
  return parts.join("\n");
}

const findDataMwHost = (el: Element) =>
  el.matches("[data-mw]") ? el : el.querySelector("[data-mw]");

const isTransclusion = (el: Element) => !!el.getAttribute("typeof")?.includes("mw:Transclusion");

/** Space-joined `name="value"` pairs for the attributes an element actually has. */
function attrString(el: Element, names: string[]): string | undefined {
  const pairs = names.flatMap((name) => {
    const value = el.getAttribute(name);
    return value ? [`${name}="${value}"`] : [];
  });
  return pairs.length > 0 ? pairs.join(" ") : undefined;
}

type Blocks = Descendant[];

/** An atomic, lossless raw-html block; `about` siblings are merged into it. */
function pushRaw(blocks: Blocks, node: Element, kind: "infobox" | "generic" = "generic"): void {
  const html = node.hasAttribute("about") ? collectAboutGroup(node) : node.outerHTML;
  const host = findDataMwHost(node);
  const info = host ? parseTemplateData(host) : null;
  blocks.push(
    makeNode("raw-html", {
      html,
      kind: kind === "infobox" || /infobox/i.test(node.className) ? "infobox" : "generic",
      name: info?.name,
      params: info?.params,
      dataMw: info?.dataMw,
    })
  );
}

const headingType = (tag: string) => `h${Math.min(Math.max(parseInt(tag[1]!, 10), 2), 4)}`;

function convertTable(el: Element, blocks: Blocks): void {
  const cls = el.className || "";
  if (/infobox/i.test(cls)) {
    const parsed = parseInfoboxFields(el);
    if (parsed.fields.length > 0) {
      blocks.push(
        makeNode("infobox-box", { html: el.outerHTML, title: parsed.title, fields: parsed.fields })
      );
    } else {
      // layout-only infobox (media/map) → lossless atomic block
      pushRaw(blocks, el, "infobox");
    }
    return;
  }
  if (FURNITURE_RE.test(cls)) {
    pushRaw(blocks, el);
    return;
  }

  // real (non-infobox) wikitable → structured table model
  const rows: Descendant[] = [];
  el.querySelectorAll("tr").forEach((tr) => {
    const cells = Array.from(tr.querySelectorAll("th,td")).map((cell) =>
      makeNode(
        cell.tagName.toLowerCase(),
        { attributes: attrString(cell, ["colspan", "rowspan", "style", "class"]) },
        convertBlockChildren(cell)
      )
    );
    if (cells.length > 0) {
      rows.push(makeNode("tr", { attributes: attrString(tr, ["class", "style"]) }, cells));
    }
  });
  if (rows.length > 0) {
    blocks.push(
      makeNode(
        "table",
        {
          caption: el.querySelector("caption")?.textContent?.trim() || undefined,
          attributes: attrString(el, ["class", "style"]),
        },
        rows
      )
    );
  }
}

function convertList(el: Element, blocks: Blocks): void {
  const items = Array.from(el.querySelectorAll(":scope > li")).map((li) =>
    makeNode("li", {}, convertBlockChildren(li))
  );
  if (items.length > 0) blocks.push(makeNode(el.tagName.toLowerCase(), {}, items));
}

/** Push a paragraph for `el`; false (and nothing pushed) when it has no visible text. */
function pushParagraph(el: Element, blocks: Blocks): boolean {
  const kids = convertBlockChildren(el);
  const meaningful = isMeaningfulInline(kids);
  if (meaningful) blocks.push(makeNode("p", {}, kids));
  return meaningful;
}

const BLOCK_CONVERTERS: Record<string, (el: Element, blocks: Blocks) => void> = {
  ...Object.fromEntries(
    ["h1", "h2", "h3", "h4", "h5", "h6"].map((tag) => [
      tag,
      (el: Element, blocks: Blocks) =>
        blocks.push(makeNode(headingType(tag), {}, convertBlockChildren(el))),
    ])
  ),
  p: pushParagraph,
  blockquote: (el, blocks) => blocks.push(makeNode("blockquote", {}, convertBlockChildren(el))),
  pre: (el, blocks) => blocks.push(makeNode("code-block", {}, [{ text: el.textContent ?? "" }])),
  // inline <code> inside <pre> is already part of the code block
  code: (el, blocks) => {
    if (!el.closest("pre")) BLOCK_CONVERTERS.pre!(el, blocks);
  },
  ul: convertList,
  ol: convertList,
  table: convertTable,
  hr: (_el, blocks) => blocks.push(makeNode("hr")),
};

function convertBlockElement(el: Element, blocks: Blocks): void {
  const tag = el.tagName.toLowerCase();
  // Citizen/skin heading wrappers: <div class="mw-heading"><h3>…<span class="mw-editsection">…
  if (el.classList.contains("mw-heading")) {
    el.querySelectorAll(".mw-editsection").forEach((x) => x.remove());
    const h = el.querySelector("h2, h3, h4, h5, h6, h1");
    if (h) {
      blocks.push(makeNode(headingType(h.tagName.toLowerCase()), {}, convertBlockChildren(h)));
      return;
    }
  }
  if (isTransclusion(el) || el.hasAttribute("about")) {
    // infobox tables & grouped transclusions stay atomic + lossless
    pushRaw(blocks, el, /infobox/i.test(el.className) ? "infobox" : "generic");
    return;
  }
  if (el.getAttribute("typeof")?.includes("mw:File") || tag === "figure") {
    blocks.push(
      makeNode("media", {
        html: el.outerHTML,
        filename: el.querySelector("img")?.getAttribute("alt") ?? undefined,
      })
    );
    return;
  }

  if (Object.hasOwn(BLOCK_CONVERTERS, tag)) {
    BLOCK_CONVERTERS[tag]!(el, blocks);
    return;
  }
  // container-ish elements: recurse; everything else preserved raw
  if (
    /^(div|section|main|article|center|figcaption|span)$/i.test(tag) &&
    !el.querySelector("table, figure, p, h1, h2, h3, h4, h5, h6, ul, ol") &&
    pushParagraph(el, blocks)
  ) {
    return;
  }
  if (/^(div|section)$/.test(tag)) {
    walkBlocks(el, blocks);
  } else {
    pushRaw(blocks, el);
  }
}

function walkBlocks(parent: Element, blocks: Blocks): void {
  // Live loop: collectAboutGroup removes later siblings while we iterate.
  for (let i = 0; i < parent.childNodes.length; i++) {
    const n = parent.childNodes[i]!;
    if (n.nodeType === Node.TEXT_NODE) {
      const text = squish(n.textContent);
      if (text) blocks.push(makeNode("p", {}, [{ text }]));
    } else if (
      n.nodeType === Node.ELEMENT_NODE &&
      !SKIPPED_BLOCK_TAGS.has((n as Element).tagName.toLowerCase())
    ) {
      convertBlockElement(n as Element, blocks);
    }
  }
}

/**
 * Convert Parsoid-ish article HTML into a Plate value.
 * Anything not explicitly modeled becomes a lossless `raw-html` void block.
 */
export function deserializeParsoidHtml(html: string): Descendant[] {
  const blocks: Blocks = [];
  walkBlocks(new DOMParser().parseFromString(html, "text/html").body, blocks);
  if (blocks.length === 0) blocks.push(makeNode("p", {}, [{ text: "" }]));
  return blocks;
}

export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Innermost first, matching the nesting order of the emitted HTML. */
const LEAF_WRAPS: ReadonlyArray<[keyof WikiText & string, string]> = [
  ["codeMark", "code"],
  ["strike", "s"],
  ["underline", "u"],
  ["italic", "i"],
  ["bold", "b"],
  ["sup", "sup"],
  ["sub", "sub"],
];

function serializeLeaves(children: Descendant[]): string {
  let out = "";
  for (const child of children) {
    const t = child as WikiText;
    if (typeof t.text !== "string") continue;
    let text = t.text;
    if (!(t.bold || t.italic || t.underline || t.strike || t.codeMark)) {
      text = text.replace(/\n/g, "<br>");
    }
    out += LEAF_WRAPS.reduce(
      (html, [mark, tag]) => (t[mark] ? `<${tag}>${html}</${tag}>` : html),
      esc(text)
    );
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
    case "h2":
    case "h3":
    case "h4":
      return `<${el.type}>${serializeInline(el.children)}</${el.type}>`;
    case "blockquote":
      return `<blockquote>${serializeInline(el.children)}</blockquote>`;
    case "code-block":
      return `<pre><code>${esc(el.children.map((c) => (c as WikiText).text ?? "").join(""))}</code></pre>`;
    case "ul":
    case "ol": {
      const items = el.children
        .map((li) => `<li>${serializeInline((li as ListItemEl).children)}</li>`)
        .join("");
      return `<${el.type}>${items}</${el.type}>`;
    }
    case "table": {
      const tb = el as TableEl;
      const caption = tb.caption ? `<caption>${esc(tb.caption)}</caption>` : "";
      const rows = ((tb.children as RowEl[]) || [])
        .map((tr) => {
          const rowAttrs = tr.attributes ? ` ${tr.attributes}` : "";
          const cells = ((tr.children as CellEl[]) || [])
            .map((cell) => {
              const cellAttrs = cell.attributes ? ` ${cell.attributes}` : "";
              return `<${cell.type}${cellAttrs}>${serializeInline(cell.children)}</${cell.type}>`;
            })
            .join("");
          return `<tr${rowAttrs}>${cells}</tr>`;
        })
        .join("");
      const tableAttrs = tb.attributes ? ` ${tb.attributes}` : ' class="wikitable"';
      return `<table${tableAttrs}>${caption}<tbody>${rows}</tbody></table>`;
    }
    case "hr":
      return "<hr>";
    case "infobox-box": {
      const ib = el as InfoboxBoxEl;
      if (!ib.edited) return ib.html;
      const rows = ib.fields
        .map(
          (f) =>
            `<tr>${f.label ? `<th class="infobox-label">${esc(f.label)}</th>` : ""}<td class="infobox-data">${esc(f.value)}</td></tr>`
        )
        .join("");
      const title = ib.title
        ? `<tr><th colspan="2" class="infobox-title">${esc(ib.title)}</th></tr>`
        : "";
      return `<table class="infobox wikios-ve-infobox"><tbody>${title}${rows}</tbody></table>`;
    }
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
    if (typeof el.text === "string") {
      out.push(el.text);
      return;
    }
    if (Array.isArray(el.children)) el.children.forEach(visit);
  };
  nodes.forEach(visit);
  return out.join(" ").replace(/\s+/g, " ").trim();
}
