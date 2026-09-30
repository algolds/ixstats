/**
 * createIxWikiPlugins.ts — Plugin registry for the WikiOS Plate editor.
 *
 * Custom element types are registered as void plugins so Slate treats them as
 * atomic; rendering is wired through `components` in createPlateEditor.
 * Standard text marks (bold/italic/…) are plain leaf properties — no plugins
 * required, they render via `renderLeaf` in PlateWikiEditor.
 */

import { createPlatePlugin } from "platejs/react";
import { PlateInteractiveTemplateElement } from "../elements/PlateInteractiveTemplateElement";
import { PlateEngineChipElement } from "../elements/PlateEngineChipElement";
import { PlateCoordChipElement, PlateMapEmbedChipElement } from "../elements/PlateCoordChipElement";
import { PlateMediaElement } from "../elements/PlateMediaElement";

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

function voidPlugin(key: string, isInline = false) {
  return createPlatePlugin({ key }).extend({
    node: { isVoid: true, isElement: true, isInline },
  });
}

/**
 * Registry of IxWiki-specific void plugins. Components for these keys are
 * supplied via the `components` map in `createPlateEditor`.
 */
export function createIxWikiPlugins() {
  return [
    voidPlugin(ELEMENT_RAW_HTML),
    voidPlugin(ELEMENT_TEMPLATE),
    voidPlugin(ELEMENT_TEMPLATE_BLOCK),
    voidPlugin(ELEMENT_INFOBOX),
    voidPlugin(ELEMENT_INFOBOX_BLOCK),
    voidPlugin(ELEMENT_CHIP_ENGINE, true),
    voidPlugin(ELEMENT_CHIP_COORD, true),
    voidPlugin(ELEMENT_CHIP_MAP_EMBED),
    voidPlugin(ELEMENT_MEDIA),
    voidPlugin(ELEMENT_REF, true),
    voidPlugin(ELEMENT_HR),
    voidPlugin(ELEMENT_CHIP_TEMPLATE, true),
    voidPlugin(ELEMENT_INLINE_TEMPLATE, true),
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
  };
}
