/**
 * wiki-inline-wikitext.ts — inline Plate content (text, links, chips, images) to wikitext.
 *
 * Bold and italic are MediaWiki quote marks over a whole line, so they are written from the marks
 * of the whole inline sequence: `'''[[Foo]] bar'''` is one bold run across a link and some text.
 * A link, file or template that was loaded from wikitext and not changed is written back exactly
 * as it was loaded.
 */

import { decodeTitleParam } from "~/lib/wiki-os/core/title";
import { plateFingerprint } from "~/lib/wiki-os/transformers/plate-fingerprint";
import type { PlateNode } from "~/lib/wiki-os/transformers/plate-node";
import { buildFileLink } from "~/lib/wiki-os/wikitext/file-params";
import { joinMarkedSegments, wrapQuotes, type MarkedSegment } from "~/lib/wiki-os/wikitext/quote-marks";
import { serializeTemplateToWikitext } from "~/lib/wiki-os/wikitext/serializer";

/** Whether `node` still holds what it held when it was loaded from wikitext (so `wikiRaw` is valid). */
export function isUnmodified(node: PlateNode): boolean {
  return typeof node.wikiRaw === "string" && node.wikiFp === plateFingerprint(node);
}

/** `<code>`, `<s>`, `<u>`, `<sup>` and `<sub>`: marks MediaWiki has no quote syntax for. */
function withHtmlMarks(leaf: PlateNode, text: string): string {
  let out = text;
  if (leaf.codeMark || leaf.code) out = `<code>${out}</code>`;
  if (leaf.strike || leaf.strikethrough) out = `<s>${out}</s>`;
  if (leaf.underline) out = `<u>${out}</u>`;
  if (leaf.sup || leaf.superscript) out = `<sup>${out}</sup>`;
  if (leaf.sub || leaf.subscript) out = `<sub>${out}</sub>`;
  return out;
}

function leafItem(leaf: PlateNode): MarkedSegment | null {
  if (!leaf.text) return null;
  return {
    text: withHtmlMarks(leaf, leaf.text),
    bold: Boolean(leaf.bold),
    italic: Boolean(leaf.italic),
    isText: true,
  };
}

const textLeaves = (children: PlateNode[]): PlateNode[] =>
  children.filter((child) => typeof child.text === "string" && child.text !== "");

/** The label of a link: its text leaves, each with its own bold, italic and HTML marks. */
function labelText(children: PlateNode[]): string {
  return textLeaves(children)
    .map((leaf) =>
      wrapQuotes(withHtmlMarks(leaf, leaf.text ?? ""), Boolean(leaf.bold), Boolean(leaf.italic))
    )
    .join("");
}

function isInternalLink(el: PlateNode): boolean {
  if (el.internal !== undefined) return el.internal;
  if (el.target) return true;
  return el.url ? !/^https?:/i.test(el.url) || el.url.startsWith("/wiki/") : true;
}

function linkTarget(el: PlateNode): string {
  if (el.target) return el.target;
  return decodeTitleParam((el.url || "").replace(/^\/wiki\//, "").replace(/_/g, " "));
}

function linkItem(el: PlateNode): MarkedSegment {
  // The marks around the link (bold across it) are properties of the element; the marks inside its
  // label are on its text leaves.
  const bold = Boolean(el.bold);
  const italic = Boolean(el.italic);
  if (isUnmodified(el) && el.wikiRaw !== undefined) {
    return { text: el.wikiRaw, bold, italic, isText: false };
  }

  const label = labelText(el.children ?? []);
  let text: string;
  if (isInternalLink(el)) {
    const target = linkTarget(el);
    // A link whose label was emptied is [[Target]]: [[Target|]] would be MediaWiki's pipe trick.
    if (target === "") text = label;
    else text = label === "" || label === target ? `[[${target}]]` : `[[${target}|${label}]]`;
  } else {
    text = label === "" || label === el.url ? `[${el.url}]` : `[${el.url} ${label}]`;
  }
  return { text, bold, italic, isText: false };
}

function fileText(el: PlateNode): string {
  if (isUnmodified(el) && el.wikiRaw !== undefined) return el.wikiRaw;
  return buildFileLink(el.target ?? "", el.fileParams ?? [], el.caption ?? "");
}

function templateText(el: PlateNode): string {
  return (
    el.rawWikitext ||
    el.wikitext ||
    serializeTemplateToWikitext({
      templateName: el.templateName || el.name || "Template",
      params: el.params || {},
      positional: el.positional,
      paramList: el.paramList,
    })
  );
}

/** The wikitext of a void inline element, or null for an element with no wikitext of its own. */
function elementText(el: PlateNode): string | null {
  switch (el.type) {
    case "ref":
      return `<ref>${el.label || ""}</ref>`;
    case "chip-coord":
      return el.wikitext || `[[Coords:${el.lat},${el.lng}|${el.label || "Location"}]]`;
    case "chip-engine":
      return el.wikitext || `[[${el.connector || "CountryData"}:${el.slug}|${el.metric}]]`;
    case "chip-template":
    case "inline-template":
      return templateText(el);
    case "wiki-file":
      return fileText(el);
    default:
      return el.rawWikitext || el.wikitext || null;
  }
}

function collectItems(children: PlateNode[], items: MarkedSegment[]): void {
  for (const child of children) {
    if (typeof child.text === "string") {
      const item = leafItem(child);
      if (item) items.push(item);
      continue;
    }
    if (child.type === "a" || child.type === "link") {
      items.push(linkItem(child));
    } else if (child.type === "lic" || child.type === "span") {
      collectItems(child.children ?? [], items);
    } else {
      const text = elementText(child);
      if (text !== null) {
        items.push({ text, bold: Boolean(child.bold), italic: Boolean(child.italic), isText: false });
      } else {
        collectItems(child.children ?? [], items);
      }
    }
  }
}

/** Serializes the inline children of a block (paragraph, heading, list item, table cell) to wikitext. */
export function serializeInline(children: PlateNode[] | undefined): string {
  const items: MarkedSegment[] = [];
  collectItems(children ?? [], items);
  return joinMarkedSegments(items);
}
