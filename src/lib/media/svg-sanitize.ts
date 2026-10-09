/**
 * svg-sanitize.ts — DOM-based sanitiser for uploaded SVG files (DOMPurify + jsdom on the server, as in
 * `~/lib/utils/sanitize-html`). Scripts, foreignObject, event-handler attributes and every link that is not a
 * same-document `#fragment` reference are removed. Any attribute (`style` and the presentation attributes `fill`,
 * `filter`, `mask`, `clip-path`, `marker-*` included) whose value holds a `url()` other than a `#fragment`, or an
 * `image-set()`, is dropped; so is a `style` attribute or `<style>` element that uses a CSS backslash escape (it
 * could hide a `url(`), and a `<style>` that has an `@import` or an external `url()`. The result is serialised with
 * `XMLSerializer`, so it is well-formed XML (a non-breaking space stays a character, never an `&nbsp;` entity).
 */
import DOMPurify from "dompurify";

type Purifier = typeof DOMPurify;

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const LINK_ATTRIBUTES = new Set(["href", "xlink:href", "src"]);
/** A value that loads another resource: an `@import`, an `image-set()`, or a `url()` that is not a (quoted) `#fragment`. */
const EXTERNAL_CSS = /@import|image-set\(|url\(\s*(?!["']?\s*#)/i;
/** A CSS escape, which could spell `url(` past the check above. */
const CSS_ESCAPE = /\\/;

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
    const name = event.attrName.toLowerCase();
    if (
      (LINK_ATTRIBUTES.has(name) && !event.attrValue.trim().startsWith("#")) ||
      EXTERNAL_CSS.test(event.attrValue) ||
      (name === "style" && CSS_ESCAPE.test(event.attrValue))
    ) {
      event.keepAttr = false;
    }
  });
  created.addHook("uponSanitizeElement", (node) => {
    const css = node.textContent ?? "";
    if (node.nodeName.toLowerCase() === "style" && (EXTERNAL_CSS.test(css) || CSS_ESCAPE.test(css))) {
      node.parentNode?.removeChild(node);
    }
  });
  purifier = created;
  return created;
}

function serialize(element: Element): string {
  const Serializer = typeof window === "undefined" ? serverWindow!.XMLSerializer : window.XMLSerializer;
  return new Serializer().serializeToString(element).trim();
}

/** The sanitised SVG markup (well-formed XML), or null when nothing with an `<svg` root is left. */
export function sanitizeSvg(svg: string): string | null {
  const body = getPurifier().sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true },
    ADD_TAGS: ["use"],
    FORBID_TAGS: ["foreignObject", "script", "iframe", "object", "embed"],
    FORBID_ATTR: ["onload", "onerror", "onclick", "onmouseover", "onfocus", "onbegin", "onend"],
    RETURN_DOM: true,
  });
  const root = body.firstElementChild;
  if (!root || root.localName !== "svg") return null;
  if (!root.hasAttribute("xmlns")) root.setAttribute("xmlns", SVG_NAMESPACE);
  return serialize(root);
}
