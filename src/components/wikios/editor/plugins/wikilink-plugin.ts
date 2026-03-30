// src/components/wikios/editor/plugins/wikilink-plugin.ts
// Custom PlateJS plugin for [[wikilink]] elements.
// Renders wiki links as styled inline elements with hover preview.

import { createPlatePlugin } from "platejs/react";

/**
 * WikiLink node type.
 * Represents a [[Page|display text]] link in the editor.
 */
export interface WikiLinkElement {
  type: "wikilink";
  /** Target page title */
  target: string;
  /** Display text (defaults to target if not set) */
  children: Array<{ text: string }>;
}

/**
 * WikiLink plugin for PlateJS.
 * Renders [[wikilinks]] as inline, non-void elements (editable display text).
 */
export const WikiLinkPlugin = createPlatePlugin({
  key: "wikilink",
  node: {
    isElement: true,
    isInline: true,
  },
});

/**
 * Helper: create a wikilink node for insertion.
 */
export function createWikiLinkNode(target: string, displayText?: string): WikiLinkElement {
  return {
    type: "wikilink",
    target,
    children: [{ text: displayText ?? target }],
  };
}
