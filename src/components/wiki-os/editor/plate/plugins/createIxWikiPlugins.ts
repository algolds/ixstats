/**
 * createIxWikiPlugins.ts — Plugin registry for the WikiOS Plate editor.
 *
 * Custom element types are registered as void plugins so Slate treats them as
 * atomic (and links as inline elements, which keeps Slate from unwrapping them);
 * rendering is wired through `components` in createPlateEditor.
 * Standard text marks (bold/italic/…) are plain leaf properties — no plugins
 * required, they render via `renderLeaf` in PlateWikiEditor.
 */

import { createPlatePlugin } from "platejs/react";
import type { Editor, NodeEntry } from "slate";
import { removeEmptyLink } from "../link-normalizer";
import { PlateInteractiveTemplateElement } from "../elements/PlateInteractiveTemplateElement";
import { PlateEngineChipElement } from "../elements/PlateEngineChipElement";
import { PlateCoordChipElement, PlateMapEmbedChipElement } from "../elements/PlateCoordChipElement";
import { PlateMediaElement } from "../elements/PlateMediaElement";
import { PlateRawWikitextElement } from "../elements/PlateRawWikitextElement";
import { INLINE_ELEMENTS, VOID_BLOCK_ELEMENTS, VOID_INLINE_ELEMENTS } from "../element-kinds";

export const ELEMENT_RAW_HTML = "raw-html";
export const ELEMENT_TEMPLATE = "template";
export const ELEMENT_TEMPLATE_BLOCK = "template-block";
export const ELEMENT_INFOBOX = "infobox";
export const ELEMENT_INFOBOX_BLOCK = "infobox-block";
export const ELEMENT_CHIP_ENGINE = "chip-engine";
export const ELEMENT_CHIP_COORD = "chip-coord";
export const ELEMENT_CHIP_MAP_EMBED = "chip-mapembed";
export const ELEMENT_MEDIA = "media";
export const ELEMENT_REF = "ref";
export const ELEMENT_HR = "hr";
export const ELEMENT_CHIP_TEMPLATE = "chip-template";
export const ELEMENT_INLINE_TEMPLATE = "inline-template";
export const ELEMENT_RAW_WIKITEXT = "raw-wikitext";

/**
 * A void element. An inline one is markable: bold and italic toggled over a selection land on its
 * one child leaf, where the serializer reads the marks around a file, chip or reference.
 */
function voidPlugin(key: string, isInline = false) {
  return createPlatePlugin({ key }).extend({
    node: { isVoid: true, isElement: true, isInline, isMarkableVoid: isInline },
  });
}

/**
 * An inline element with editable text children (a link). Unregistered, Slate unwraps it on load.
 * A link that loses all its text (Enter at its edge, deleting it) is removed rather than left empty.
 */
function inlinePlugin(key: string) {
  return createPlatePlugin({ key })
    .extend({ node: { isElement: true, isInline: true } })
    .overrideEditor(({ editor, tf: { normalizeNode } }) => ({
      transforms: {
        normalizeNode(entry, options) {
          if (removeEmptyLink(editor as unknown as Editor, entry as NodeEntry)) return;
          normalizeNode(entry, options);
        },
      },
    }));
}

/**
 * Registry of IxWiki-specific plugins: void elements for atomic blocks and chips, and the inline
 * elements Slate must not normalise away (see element-kinds.ts). Components for these keys are
 * supplied via the `components` map in `createPlateEditor`.
 */
export function createIxWikiPlugins() {
  return [
    ...VOID_BLOCK_ELEMENTS.map((key) => voidPlugin(key)),
    ...VOID_INLINE_ELEMENTS.map((key) => voidPlugin(key, true)),
    ...INLINE_ELEMENTS.map((key) => inlinePlugin(key)),
  ];
}

/** Element-type → React component map consumed by `createPlateEditor`. */
export function getIxWikiComponents() {
  return {
    [ELEMENT_RAW_HTML]: PlateInteractiveTemplateElement,
    [ELEMENT_INFOBOX]: PlateInteractiveTemplateElement,
    [ELEMENT_INFOBOX_BLOCK]: PlateInteractiveTemplateElement,
    [ELEMENT_TEMPLATE]: PlateInteractiveTemplateElement,
    [ELEMENT_TEMPLATE_BLOCK]: PlateInteractiveTemplateElement,
    [ELEMENT_CHIP_ENGINE]: PlateEngineChipElement,
    [ELEMENT_CHIP_COORD]: PlateCoordChipElement,
    [ELEMENT_CHIP_MAP_EMBED]: PlateMapEmbedChipElement,
    [ELEMENT_MEDIA]: PlateMediaElement,
    [ELEMENT_RAW_WIKITEXT]: PlateRawWikitextElement,
  };
}
