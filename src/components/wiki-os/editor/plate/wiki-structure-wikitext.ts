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
import { ProtectedScanner, skipProtectedAt } from "~/lib/wiki-os/wikitext/protected-regions";
import { serializeTemplateToWikitext } from "~/lib/wiki-os/wikitext/serializer";
import { readTemplateParams, rewriteTemplateParams } from "~/lib/wiki-os/wikitext/template-edit";
import { isUnmodified, serializeInline } from "./wiki-inline-wikitext";

// ─── Templates ──────────────────────────────────────────────────────────────

/**
 * The parameter values an edited template should have, or null when it was not edited (`edited` is
 * set by the template form). `params` are the values after the edit.
 */
function editedParams(
  el: PlateNode,
  base: string | undefined,
  notices: string[]
): Record<string, string> | null {
  if (!el.edited) return null;
  const loaded = base ? readTemplateParams(base) : null;
  if (loaded === null) {
    if (base) {
      // A template that is not closed has no parameters to edit: it is saved as written, and the author is told.
      notices.push(
        `The edit to {{${el.templateName || el.name || "template"}}} was not saved: the template is not closed. Fix it in the source editor.`
      );
    }
    return null;
  }
  return { ...(el.params ?? loaded) };
}

export function templateWikitext(
  el: PlateNode,
  fallbackName: string,
  notices: string[] = []
): string {
  const base = el.rawWikitext || el.wikitext;
  const values = editedParams(el, base, notices);
  const rebuilt = values && base ? rewriteTemplateParams(base, values) : null;
  return (
    rebuilt ||
    base ||
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

/** `text` with each line break (and the space around it) made one space, except inside comments and literal tags. */
function joinLines(text: string): string {
  const scanner = new ProtectedScanner(text);
  let out = "";
  let i = 0;
  while (i < text.length) {
    const end = text[i] === "<" ? skipProtectedAt(text, i, true, scanner) : null;
    if (end !== null) {
      out += text.slice(i, end);
      i = end;
    } else if (text[i] === "\n") {
      out = out.replace(/[ \t]+$/, "") + " ";
      i++;
      while (text[i] === " " || text[i] === "\t" || text[i] === "\n") i++;
    } else {
      out += text[i];
      i++;
    }
  }
  return out;
}

/** The inline children with the line breaks of their TEXT joined; chips, templates and literal spans are left as they are. */
function withJoinedLines(children: PlateNode[] | undefined): PlateNode[] {
  return (children ?? []).map((child) => {
    if (typeof child.text === "string") return { ...child, text: joinLines(child.text) };
    const editable =
      child.type === "link" || child.type === "a" || child.type === "lic" || child.type === "span";
    return editable ? { ...child, children: withJoinedLines(child.children) } : child;
  });
}

/** A heading is one line; with no text it is nothing (an empty `==  ==` is not a heading). */
export function headingWikitext(el: PlateNode, level: number): string {
  const text = serializeInline(withJoinedLines(el.children)).trim();
  if (text === "") return "";
  const pads = el.wikiRaw === undefined ? null : HEADING_PADS.exec(el.wikiRaw);
  const marks = "=".repeat(level);
  return `${marks}${pads ? pads[2] : " "}${text}${pads ? pads[4] : " "}${marks}`;
}

// ─── Lists ──────────────────────────────────────────────────────────────────

const ITEM_SPACING = /^[*#:;]+([ \t]*)/;
const ITEM_MARKER = /^[*#:;]+/;
const ITEM_TRAIL = /[ \t]+$/;

const isBlankCode = (code: number): boolean => code === 32 || code === 9 || code === 10 || code === 13;

/** `text` without the spaces, tabs and line breaks around it; other white space (a non-breaking space) is text. */
function trimBlanks(text: string): string {
  let start = 0;
  let end = text.length;
  while (start < end && isBlankCode(text.charCodeAt(start))) start++;
  while (end > start && isBlankCode(text.charCodeAt(end - 1))) end--;
  return text.slice(start, end);
}

/**
 * The marker kind every item of this list must have, `*` for a bulleted list and `#` for a numbered
 * one; null for a list of `:`/`;` lines (indents and definitions), which makes no claim.
 */
function listKind(el: PlateNode): "*" | "#" | null {
  if (el.wikiRaw !== undefined && !/^[*#]/.test(el.wikiRaw)) return null;
  return el.type === "ol" ? "#" : "*";
}

/**
 * A marker in the kind of its list: an item that was bulleted and sits in a list now numbered (the
 * list type was toggled, or the item was pasted or moved from the other kind of list) is re-marked
 * `*`<->`#` at every depth, keeping its depth and any `:` or `;` in it.
 */
function markerInKind(marker: string, kind: "*" | "#" | null): string {
  const first = marker[0];
  if (kind === null || (first !== "*" && first !== "#") || first === kind) return marker;
  return marker.replace(/[*#]/g, kind);
}

/** The marker for `level`: the item's own marker (`*#:`) cut or extended with its last character. */
function itemMarker(li: PlateNode, defaultMarker: string): string {
  const level = Math.max(1, li.level || 1);
  const prefix = li.prefix;
  if (!prefix) return defaultMarker.repeat(level);
  return prefix.length >= level
    ? prefix.slice(0, level)
    : prefix + prefix.slice(-1).repeat(level - prefix.length);
}

function itemWikitext(li: PlateNode, defaultMarker: string, kind: "*" | "#" | null): string {
  let kids = li.children ?? [];
  if (kids.length === 1 && kids[0]?.type === "lic") kids = kids[0].children ?? [];
  const lead = li.wikiRaw === undefined ? null : ITEM_SPACING.exec(li.wikiRaw);
  const spacing = lead ? lead[1] : " ";
  // The blanks that ended the line as it was written stay: an edit changes the item's text, not its spacing.
  const trail = lead ? (ITEM_TRAIL.exec((li.wikiRaw ?? "").slice(lead[0].length))?.[0] ?? "") : "";
  return `${markerInKind(itemMarker(li, defaultMarker), kind)}${spacing}${trimBlanks(serializeInline(kids))}${trail}`;
}

export function listWikitext(el: PlateNode): string {
  const defaultMarker = el.type === "ol" ? "#" : "*";
  const kind = listKind(el);
  return (el.children ?? [])
    .map((li) =>
      isUnmodified(li) && li.wikiRaw !== undefined
        ? // written as loaded, but in the kind of the list it is in now
          li.wikiRaw.replace(ITEM_MARKER, (marker) => markerInKind(marker, kind))
        : itemWikitext(li, defaultMarker, kind)
    )
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

/**
 * An edited cell written in the markup it had: its delimiter, attributes and spacing as written, with the new content
 * between them. Null when the cell is new, or its kind (`th`/`td`) or attributes changed.
 */
function splicedCell(cell: PlateNode): string | null {
  if (cell.wikiCellHead === undefined || cell.wikiCellTail === undefined) return null;
  if (cell.wikiCellHeadFp !== plateFingerprint({ type: cell.type, attributes: cell.attributes })) return null;
  return `${cell.wikiCellHead}${serializeInline(cell.children).trimEnd()}${cell.wikiCellTail}`;
}

/** Whether a row's head (the start of its source up to its first cell) is still valid: its attributes are unchanged. */
function rowHeadIntact(row: PlateNode): row is PlateNode & { wikiRowHead: string } {
  return row.wikiRowHead !== undefined && row.wikiRowHeadFp === plateFingerprint({ attributes: row.attributes });
}

const ROW_LINE = /^[ \t]*\|-/m;

/** Whether `text` ends at the start of a line (it is empty, or ends in a line break and blanks): a cell can begin there. */
function atLineStart(text: string): boolean {
  let at = text.length;
  while (at > 0 && (text[at - 1] === " " || text[at - 1] === "\t")) at--;
  return at === 0 || text[at - 1] === "\n";
}

/** The text before a row's first cell, and where it ends in the row's source when it is the original head. */
function rowHead(row: PlateNode, position: number): { text: string; end: number | null } {
  if (!rowHeadIntact(row)) return { text: `|-${row.attributes ? ` ${row.attributes}` : ""}\n`, end: null };
  const head = row.wikiRowHead;
  // A row that was first may have had no `|-`; one that is not first in the output needs it.
  const text = position > 0 && !ROW_LINE.test(head) ? `|-\n${head}` : head;
  return { text, end: head.length };
}

const lineCount = (text: string): number => text.split("\n").length;

const startsDoubled = (text: string): boolean => text.startsWith("||") || text.startsWith("!!");

/** A cell of an edited row, with what to write before it and where it ends in the row's source (null: not as written). */
function cellPiece(cell: PlateNode, prevEnd: number | null, lineOpen: boolean): { text: string; end: number | null } {
  const { wikiRaw: raw, wikiSrc: src, wikiSep: recorded } = cell;
  const original = raw !== undefined && src !== undefined && recorded !== undefined ? { raw, src, recorded } : null;
  const adjacent = original !== null && prevEnd === original.src - original.recorded.length;
  const unmodified = isUnmodified(cell);
  let body = unmodified && raw !== undefined ? raw : (splicedCell(cell) ?? cellWikitext(cell));
  // `||`/`!!` continues the line of the cell before it; anywhere else the cell starts its own line.
  if (!adjacent && startsDoubled(body)) body = body.slice(1);
  // What was before it still is, and it is still written on the same kind of line (after `||`, or at a line start).
  const keepSep = adjacent && startsDoubled(body) === startsDoubled(original.raw);
  const sep = keepSep ? original.recorded : lineOpen ? "\n" : "";
  const sameShape = unmodified || lineCount(body) === lineCount(original?.raw ?? "");
  return { text: sep + body, end: original && sameShape ? original.src + original.raw.length : null };
}

/**
 * A row as written. An edited row keeps what it can as it was: its `|-` line while its attributes are unchanged, every
 * unchanged cell exactly as written (on the line it shared with its neighbour, after `||`), and an edited cell in its
 * own markup (see splicedCell). A row that was the first of its table may have no `|-` line, but one that is not first
 * in the output needs it, or its cells would run into the row before.
 */
function rowWikitext(row: PlateNode, position: number): string {
  if (isUnmodified(row) && row.wikiRaw !== undefined) {
    return position > 0 && !row.wikiRaw.trimStart().startsWith("|-") ? `|-\n${row.wikiRaw}` : row.wikiRaw;
  }
  const head = rowHead(row, position);
  let out = head.text;
  let prevEnd = head.end;
  for (const cell of row.children ?? []) {
    const piece = cellPiece(cell, prevEnd, !atLineStart(out));
    out += piece.text;
    prevEnd = piece.end;
  }
  // A row left with no cells is its `|-` line alone.
  return (row.children ?? []).length === 0 ? out.replace(/\n$/, "") : out;
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
    ...(el.children ?? []).map((row, position) => rowWikitext(row, position)),
    el.wikiTableTail ?? "|}",
  ].join("\n");
}
