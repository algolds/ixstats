/**
 * createIxWikiPlugins.ts — Plugin registry for the WikiOS Plate editor.
 *
 * Custom element types are registered as void plugins so Slate treats them as
 * atomic; rendering is wired through `components` in createPlateEditor.
 * Standard text marks (bold/italic/…) are plain leaf properties — no plugins
 * required, they render via `renderLeaf` in PlateWikiEditor.
 */

import { createPlatePlugin } from "platejs/react";
import { PlateRawHtmlElement } from "../elements/PlateRawHtmlElement";
import { PlateInfoboxElement } from "../elements/PlateInfoboxElement";
import { PlateEngineChipElement } from "../elements/PlateEngineChipElement";
import { PlateCoordChipElement, PlateMapEmbedChipElement } from "../elements/PlateCoordChipElement";
import { PlateMediaElement } from "../elements/PlateMediaElement";

export const ELEMENT_RAW_HTML = "raw-html";
export const ELEMENT_TEMPLATE = "template";
export const ELEMENT_INFOBOX = "infobox";
export const ELEMENT_CHIP_ENGINE = "chip-engine";
export const ELEMENT_CHIP_COORD = "chip-coord";
export const ELEMENT_CHIP_MAP_EMBED = "chip-mapembed";
export const ELEMENT_MEDIA = "media";
export const ELEMENT_REF = "ref";
export const ELEMENT_HR = "hr";

function voidPlugin(key: string) {
  return createPlatePlugin({ key }).extend({
    node: { isVoid: true, isElement: true },
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
    voidPlugin(ELEMENT_INFOBOX),
    voidPlugin(ELEMENT_CHIP_ENGINE),
    voidPlugin(ELEMENT_CHIP_COORD),
    voidPlugin(ELEMENT_CHIP_MAP_EMBED),
    voidPlugin(ELEMENT_MEDIA),
    voidPlugin(ELEMENT_REF),
    voidPlugin(ELEMENT_HR),
  ];
}

/** Element-type → React component map consumed by `createPlateEditor`. */
export function getIxWikiComponents() {
  return {
    [ELEMENT_RAW_HTML]: PlateRawHtmlElement,
    [ELEMENT_INFOBOX]: PlateInfoboxElement,
    [ELEMENT_TEMPLATE]: PlateRawHtmlElement,
    [ELEMENT_CHIP_ENGINE]: PlateEngineChipElement,
    [ELEMENT_CHIP_COORD]: PlateCoordChipElement,
    [ELEMENT_CHIP_MAP_EMBED]: PlateMapEmbedChipElement,
    [ELEMENT_MEDIA]: PlateMediaElement,
  };
}
