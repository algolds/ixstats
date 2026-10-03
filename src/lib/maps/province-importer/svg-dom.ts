// Shared xmldom helpers for the SVG importers. @xmldom/xmldom@0.9's Element is no longer
// assignable to lib.dom's Element, and everything parsed here is an xmldom node, so alias to it.
export type XmlElement = import("@xmldom/xmldom").Element;

export const SVG_NS = "http://www.w3.org/2000/svg";
export const INKSCAPE_NS = "http://www.inkscape.org/namespaces/inkscape";

/** Local tag name without any namespace prefix. */
export function svgTag(el: XmlElement): string {
  return el.localName ?? el.tagName?.split(":").pop() ?? "";
}

/** Direct child elements (text and comment nodes dropped). */
export function elementChildren(el: XmlElement): XmlElement[] {
  return [...el.childNodes].filter((n): n is XmlElement => n?.nodeType === 1);
}

/** Ancestor elements, nearest first (the Document node is not included). */
export function ancestorElements(el: XmlElement): XmlElement[] {
  const result: XmlElement[] = [];
  for (let p = el.parentNode as XmlElement | null; p; p = p.parentNode as XmlElement | null) {
    if (p.nodeType === 1) result.push(p);
  }
  return result;
}

export function inkscapeLabel(el: XmlElement): string {
  return el.getAttributeNS(INKSCAPE_NS, "label") || el.getAttribute("inkscape:label") || "";
}

/** True when an inline `style` string declares `prop: value` (with or without the space). */
export function styleDeclares(style: string, prop: string, value: string): boolean {
  return style.includes(`${prop}:${value}`) || style.includes(`${prop}: ${value}`);
}

/** First present attribute among `names`, parsed as a number (0 if none present). */
export function attrNumber(el: XmlElement, ...names: string[]): number {
  return parseFloat(names.map((n) => el.getAttribute(n)).find((v) => v != null) ?? "0");
}

/** Display name of a group: Inkscape label, then data-name, then id ("" if none). */
export function groupName(el: XmlElement): string {
  return inkscapeLabel(el) || el.getAttribute("data-name") || el.getAttribute("id") || "";
}

/** Strip scripts, inline event handlers and external/javascript hrefs from uploaded SVG text. */
export function sanitizeSvg(svgContent: string): string {
  return svgContent
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*')/gi, "")
    .replace(/href\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi, "")
    .replace(/xlink:href\s*=\s*(?:"https?:\/\/[^"]*"|'https?:\/\/[^']*')/gi, "");
}
