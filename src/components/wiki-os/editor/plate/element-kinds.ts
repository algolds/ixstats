/**
 * element-kinds.ts — which Plate element types are void and which are inline.
 *
 * Slate's normaliser treats an element type it does not know as a block. A `link` inside a
 * paragraph is therefore unwrapped into plain text on load, and a `citation-ref` loses its
 * identity the same way, unless the editor is told they are inline. Plain constants so that the
 * plugin registry and the tests use one list.
 */

/** Block elements that are one atomic, non-editable unit. */
export const VOID_BLOCK_ELEMENTS = [
  "raw-html",
  "template",
  "template-block",
  "infobox",
  "infobox-block",
  "chip-mapembed",
  "media",
  "hr",
  "raw-wikitext",
] as const;

/** Inline elements that are one atomic, non-editable unit. */
export const VOID_INLINE_ELEMENTS = [
  "chip-engine",
  "chip-coord",
  "ref",
  "chip-template",
  "inline-template",
  "wiki-file",
  "citation-ref",
] as const;

/** Inline elements whose text children are editable. */
export const INLINE_ELEMENTS = ["link", "a"] as const;
