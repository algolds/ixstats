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
import { linkOuterMarks, voidInlineMarks } from "~/lib/wiki-os/transformers/plate-marks";
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

/** The label of a link: its text leaves with their own marks, less those written around the whole link. */
function labelText(children: PlateNode[], around: { bold: boolean; italic: boolean }): string {
  return textLeaves(children)
    .map((leaf) =>
      wrapQuotes(
        withHtmlMarks(leaf, leaf.text ?? ""),
        Boolean(leaf.bold) && !around.bold,
        Boolean(leaf.italic) && !around.italic
      )
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

function linkItem(el: PlateNode): MarkedSegment | null {
  // The marks around the link are the ones every leaf of its label has: toggling a mark off on the
  // label removes it from the wikitext, and a bolded paragraph is one bold run across the link.
  if (isUnmodified(el) && el.wikiRaw !== undefined) {
    // Unchanged: its source already holds the marks inside its label; what was around it is recorded.
    return { text: el.wikiRaw, bold: Boolean(el.wikiOuter?.bold), italic: Boolean(el.wikiOuter?.italic), isText: false };
  }
  const { bold, italic } = linkOuterMarks(el);

  const label = labelText(el.children ?? [], { bold, italic });
  // A link with no text is not there: Enter at its edge or deleting its text must not leave [[Target]].
  if (textLeaves(el.children ?? []).length === 0) return null;
  let text: string;
  if (isInternalLink(el)) {
    const target = linkTarget(el);
    if (target === "") text = label;
    else text = label === target ? `[[${target}]]` : `[[${target}|${label}]]`;
  } else {
    text = label === el.url ? `[${el.url}]` : `[${el.url} ${label}]`;
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
      const link = linkItem(child);
      if (link) items.push(link);
    } else if (child.type === "lic" || child.type === "span") {
      collectItems(child.children ?? [], items);
    } else {
      const text = elementText(child);
      if (text !== null) {
        items.push({ text, ...voidInlineMarks(child), isText: false });
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
