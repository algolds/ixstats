// src/components/wikios/editor/plugins/template-plugin.ts
// Custom PlateJS plugin for {{template}} transclusions.
// Renders templates as opaque void blocks with parameter preview.

import { createPlatePlugin } from "platejs/react";

/**
 * Template node type.
 * Represents a {{Template|param1=value1|param2=value2}} in the editor.
 */
export interface TemplateElement {
  type: "template";
  /** Template name (e.g., "Infobox country") */
  templateName: string;
  /** Template parameters as key-value pairs */
  params: Record<string, string>;
  /** Raw wikitext of the entire template invocation (for source roundtrip) */
  rawWikitext: string;
  children: Array<{ text: string }>;
}

/**
 * Template plugin for PlateJS.
 * Renders {{templates}} as void block elements (not editable inline).
 * Complex templates are edited via a parameter form or raw source.
 */
export const TemplatePlugin = createPlatePlugin({
  key: "template",
  node: {
    isElement: true,
    isVoid: true,
  },
});

/**
 * Helper: create a template node for insertion.
 */
export function createTemplateNode(
  templateName: string,
  params: Record<string, string>,
  rawWikitext: string
): TemplateElement {
  return {
    type: "template",
    templateName,
    params,
    rawWikitext,
    children: [{ text: "" }],
  };
}

/**
 * Parse a template wikitext string into name and params.
 * e.g., "{{Infobox country|name=Burgundie|capital=Vilauristre}}"
 */
export function parseTemplateWikitext(
  wikitext: string
): { name: string; params: Record<string, string> } | null {
  const match = wikitext.match(/^\{\{([^|}\n]+)((?:\|[^}]*)*)?\}\}$/s);
  if (!match) return null;

  const name = match[1]!.trim();
  const params: Record<string, string> = {};

  if (match[2]) {
    const paramStr = match[2].slice(1); // remove leading |
    let paramIndex = 1;

    // Simple param splitting (doesn't handle nested templates)
    const parts = paramStr.split("|");
    for (const part of parts) {
      const eqIndex = part.indexOf("=");
      if (eqIndex !== -1) {
        const key = part.slice(0, eqIndex).trim();
        const value = part.slice(eqIndex + 1).trim();
        params[key] = value;
      } else {
        params[String(paramIndex)] = part.trim();
        paramIndex++;
      }
    }
  }

  return { name, params };
}
