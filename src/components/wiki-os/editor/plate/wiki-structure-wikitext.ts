/**
 * wiki-structure-wikitext.ts — headings, lists, tables and templates of the Plate canvas to wikitext.
 *
 * These blocks are selective below the block level too (plan 414): a list item or a table row that
 * was loaded from wikitext and is unchanged is written back exactly as it was, so editing one item
 * or one cell changes only its own lines. What is generated keeps the markup style it had: the
 * spaces inside `==x==` and after `*`, and the attribute-free `{|` of a table loaded without any.
 */

import type { PlateNode } from "~/lib/wiki-os/transformers/plate-node";
import { plateFingerprint } from "~/lib/wiki-os/transformers/plate-fingerprint";
import { serializeTemplateToWikitext } from "~/lib/wiki-os/wikitext/serializer";
import { readTemplateParams, rewriteTemplateParams } from "~/lib/wiki-os/wikitext/template-edit";
import { isUnmodified, serializeInline } from "./wiki-inline-wikitext";

// ─── Templates ──────────────────────────────────────────────────────────────

/** Key of the parameter a field label names: the same key up to case, spaces and underscores. */
function keyForLabel(label: string, keys: readonly string[]): string {
  const normal = (text: string): string => text.toLowerCase().replace(/[\s_]+/g, " ").trim();
  return keys.find((key) => normal(key) === normal(label)) ?? label.trim();
}

/**
 * The parameter values an edited template should have, or null when it was not edited (`edited` is
 * set by the infobox field editor). `params` are the values after the edit and `fields` (label/value
 * pairs) override the matching parameters; everything else stays as written.
 */
function editedParams(el: PlateNode): Record<string, string> | null {
  if (!el.edited) return null;
  const loaded = el.rawWikitext ? readTemplateParams(el.rawWikitext) : null;
  if (loaded === null) return null;
  const values = { ...(el.params ?? loaded) };
  for (const field of el.fields ?? []) {
    values[keyForLabel(field.label, Object.keys(values))] = field.value;
  }
  return values;
}

export function templateWikitext(el: PlateNode, fallbackName: string): string {
  const values = editedParams(el);
  const rebuilt = values && el.rawWikitext ? rewriteTemplateParams(el.rawWikitext, values) : null;
  return (
    rebuilt ||
    el.rawWikitext ||
    el.wikitext ||
    serializeTemplateToWikitext({
      templateName: el.templateName || el.name || fallbackName,
      params: el.params,
      positional: el.positional,
      paramList: el.paramList,
    })
  );
}

// ─── Headings ───────────────────────────────────────────────────────────────

/** The spaces inside the equals signs of the heading as it was written: `==  A ==` is `  ` and ` `. */
const HEADING_PADS = /^(={1,6})(\s*)(.+?)(\s*)\1$/;

/** A heading is one line; with no text it is nothing (an empty `==  ==` is not a heading). */
export function headingWikitext(el: PlateNode, level: number): string {
  const text = serializeInline(el.children).replace(/\s*\n\s*/g, " ").trim();
  if (text === "") return "";
  const pads = el.wikiRaw === undefined ? null : HEADING_PADS.exec(el.wikiRaw);
  const marks = "=".repeat(level);
  return `${marks}${pads ? pads[2] : " "}${text}${pads ? pads[4] : " "}${marks}`;
}

// ─── Lists ──────────────────────────────────────────────────────────────────

const ITEM_SPACING = /^[*#:;]+([ \t]*)/;

/** The marker for `level`: the item's own marker (`*#:`) cut or extended with its last character. */
function itemMarker(li: PlateNode, defaultMarker: string): string {
  const level = Math.max(1, li.level || 1);
  const prefix = li.prefix;
  if (!prefix) return defaultMarker.repeat(level);
  return prefix.length >= level ? prefix.slice(0, level) : prefix + prefix.slice(-1).repeat(level - prefix.length);
}

function itemWikitext(li: PlateNode, defaultMarker: string): string {
  let kids = li.children ?? [];
  if (kids.length === 1 && kids[0]?.type === "lic") kids = kids[0].children ?? [];
  const spacing = li.wikiRaw === undefined ? " " : (ITEM_SPACING.exec(li.wikiRaw)?.[1] ?? " ");
  return `${itemMarker(li, defaultMarker)}${spacing}${serializeInline(kids).trim()}`;
}

export function listWikitext(el: PlateNode): string {
  const defaultMarker = el.type === "ol" ? "#" : "*";
  return (el.children ?? [])
    .map((li) => (isUnmodified(li) && li.wikiRaw !== undefined ? li.wikiRaw : itemWikitext(li, defaultMarker)))
    .join("\n");
}

// ─── Tables ─────────────────────────────────────────────────────────────────

function cellWikitext(cell: PlateNode): string {
  const head = cell.type === "th" ? "!" : "|";
  const attributes = cell.attributes ? ` ${cell.attributes} |` : "";
  const content = serializeInline(cell.children);
  // Content that starts on its own line (a list in a cell) must keep that line break.
  return content.startsWith("\n")
    ? `${head}${attributes}${content.trimEnd()}`
    : `${head}${attributes} ${content.trim()}`;
}

function rowWikitext(row: PlateNode): string {
  if (isUnmodified(row) && row.wikiRaw !== undefined) return row.wikiRaw;
  const lines = [`|-${row.attributes ? ` ${row.attributes}` : ""}`];
  for (const cell of row.children ?? []) lines.push(cellWikitext(cell));
  return lines.join("\n");
}

/** The `{|` line and the caption: as written while the attributes and caption are unchanged. */
function tableHeadWikitext(el: PlateNode): string {
  const intact =
    el.wikiTableHead !== undefined &&
    el.wikiTableHeadFp === plateFingerprint({ attributes: el.attributes, caption: el.caption });
  if (intact) return el.wikiTableHead as string;
  // A table loaded from wikitext without attributes has none; only a new table gets the default class.
  const attributes = el.attributes
    ? ` ${el.attributes}`
    : el.wikiRaw === undefined
      ? ' class="wikitable"'
      : "";
  return el.caption ? `{|${attributes}\n|+ ${el.caption}` : `{|${attributes}`;
}

export function tableWikitext(el: PlateNode): string {
  return [
    tableHeadWikitext(el),
    ...(el.children ?? []).map(rowWikitext),
    el.wikiTableTail ?? "|}",
  ].join("\n");
}
