/**
 * svg-sanitize.ts — DOM-based sanitiser for uploaded SVG files (DOMPurify + jsdom on the server, as in
 * `~/lib/utils/sanitize-html`). Scripts, foreignObject, event-handler attributes and every link that is not a
 * same-document `#fragment` reference are removed; a `<style>` that reaches outside the document is dropped.
 */
import DOMPurify from "dompurify";

type Purifier = typeof DOMPurify;

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const LINK_ATTRIBUTES = new Set(["href", "xlink:href", "src"]);
/** CSS that loads another resource: an `@import`, or a `url()` that is not a `#fragment`. */
const EXTERNAL_CSS = /@import|url\(\s*["']?\s*(?!#)/i;

let serverWindow: import("jsdom").DOMWindow | null = null;
let purifier: Purifier | null = null;

function createPurifier(): Purifier {
  if (typeof window === "undefined") {
    const { JSDOM } = require("jsdom") as typeof import("jsdom");
    serverWindow ??= new JSDOM("").window;
    return DOMPurify(serverWindow);
  }
  return DOMPurify(window);
}

function getPurifier(): Purifier {
  if (purifier) return purifier;
  const created = createPurifier();
  created.addHook("uponSanitizeAttribute", (_node, event) => {
    if (LINK_ATTRIBUTES.has(event.attrName.toLowerCase()) && !event.attrValue.trim().startsWith("#")) {
      event.keepAttr = false;
    }
  });
  created.addHook("uponSanitizeElement", (node) => {
    if (node.nodeName.toLowerCase() === "style" && EXTERNAL_CSS.test(node.textContent ?? "")) {
      node.parentNode?.removeChild(node);
    }
  });
  purifier = created;
  return created;
}

/** The sanitised SVG markup, or null when nothing with an `<svg` root is left. */
export function sanitizeSvg(svg: string): string | null {
  const clean = getPurifier()
    .sanitize(svg, {
      USE_PROFILES: { svg: true, svgFilters: true },
      ADD_TAGS: ["use"],
      FORBID_TAGS: ["foreignObject", "script", "iframe", "object", "embed"],
      FORBID_ATTR: ["onload", "onerror", "onclick", "onmouseover", "onfocus", "onbegin", "onend"],
      RETURN_TRUSTED_TYPE: false,
    })
    .trim();
  if (!/^<svg\b/i.test(clean)) return null;
  return /^<svg\b[^>]*\sxmlns\s*=/i.test(clean)
    ? clean
    : clean.replace(/^<svg\b/i, `<svg xmlns="${SVG_NAMESPACE}"`);
}
