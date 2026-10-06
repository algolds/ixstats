/**
 * plate-marks.ts — the bold/italic around an inline element, read from where Slate puts it.
 *
 * Marks live on text leaves: toggling bold over a selection sets it on every leaf in the range, and
 * on the one child leaf of a markable void element (a file, chip or reference inside the range).
 * The marks MediaWiki writes around a link or a file are therefore derived from those leaves, never
 * from a property of the element, so toggling a mark off removes it from the wikitext too.
 */

import type { PlateNode } from "./plate-node";

export interface BoldItalic {
  bold: boolean;
  italic: boolean;
}

/** The marks around a void inline element (file, chip, template, reference): those of its child leaf. */
export function voidInlineMarks(el: PlateNode): BoldItalic {
  const leaf = el.children?.[0];
  return { bold: Boolean(leaf?.bold), italic: Boolean(leaf?.italic) };
}

/** The marks around a link: a mark that every non-empty text leaf of its label has. */
export function linkOuterMarks(el: PlateNode): BoldItalic {
  const leaves = (el.children ?? []).filter((child) => typeof child.text === "string" && child.text !== "");
  return {
    bold: leaves.length > 0 && leaves.every((leaf) => leaf.bold),
    italic: leaves.length > 0 && leaves.every((leaf) => leaf.italic),
  };
}

/** `{ bold: true }` / `{ italic: true }` for the marks that are on, nothing for those that are off. */
export function markProps(marks: Partial<BoldItalic>): { bold?: true; italic?: true } {
  return { ...(marks.bold ? { bold: true as const } : {}), ...(marks.italic ? { italic: true as const } : {}) };
}
