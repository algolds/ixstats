/**
 * Shared SVG/XML primitives for the SVG → GeoJSON parser.
 */

// svg-path-parser is CJS-only; use createRequire for ESM compatibility
import { createRequire } from "module";
import type { SvgPathCommand } from "./command-evaluator";

export const SVG_NS = "http://www.w3.org/2000/svg";
export const INKSCAPE_NS = "http://www.inkscape.org/namespaces/inkscape";

// @xmldom/xmldom@0.9's Element type is no longer structurally assignable to the
// global lib.dom Element (it was in 0.8). All "Element" values in the parser are
// xmldom-parsed nodes, never real DOM elements, so alias to the package's own type.
export type XmlElement = import("@xmldom/xmldom").Element;

const _require = createRequire(import.meta.url);
const { parseSVG, makeAbsolute } = _require("svg-path-parser") as {
  parseSVG: (d: string) => SvgPathCommand[];
  makeAbsolute: (cmds: SvgPathCommand[]) => SvgPathCommand[];
};

/**
 * Parse an SVG path `d` attribute into absolute path commands.
 */
export function parseAbsolutePath(d: string): SvgPathCommand[] {
  return makeAbsolute(parseSVG(d));
}

/**
 * Inkscape layer/path label (namespaced attribute first, then the raw prefixed name).
 */
export function inkscapeLabel(el: XmlElement): string {
  return el.getAttributeNS(INKSCAPE_NS, "label") || el.getAttribute("inkscape:label") || "";
}
