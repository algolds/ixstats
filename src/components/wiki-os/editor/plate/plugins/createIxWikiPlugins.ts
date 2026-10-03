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

const ELEMENT_RAW_HTML = "raw-html";
const ELEMENT_TEMPLATE = "template";
const ELEMENT_TEMPLATE_BLOCK = "template-block";
const ELEMENT_INFOBOX = "infobox";
const ELEMENT_INFOBOX_BLOCK = "infobox-block";
const ELEMENT_CHIP_ENGINE = "chip-engine";
const ELEMENT_CHIP_COORD = "chip-coord";
const ELEMENT_CHIP_MAP_EMBED = "chip-mapembed";
const ELEMENT_MEDIA = "media";
const ELEMENT_REF = "ref";
const ELEMENT_HR = "hr";
const ELEMENT_CHIP_TEMPLATE = "chip-template";
const ELEMENT_INLINE_TEMPLATE = "inline-template";

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
