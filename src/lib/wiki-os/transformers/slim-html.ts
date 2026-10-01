// src/lib/wiki-os/transformers/slim-html.ts
// Takes weight out of a view bundle's HTML at render time, once per revision, so every reader's
// first response (and its hydration copy) carries less. Server only: it works on a jsdom DOM, and
// runs after the sanitizer, so it can only ever remove: attributes, classes, whitespace.
//
//   - a `title` that only repeats the link's own text ("Foo" on a link that says "Foo");
//   - classes MediaWiki and its citation templates put everywhere and nothing here styles or reads
//     (a test checks every one against the stylesheets and the code);
//   - class/style/title attributes left empty;
//   - whitespace between block elements, and in a table's or list's structure.

import { parseInertOnServer } from "./server-dom";

/**
 * MediaWiki's and its citation templates' own classes: no WikiOS stylesheet has a rule for them and
 * no WikiOS code selects them (src/tests/lib/wiki-os/slim-html.test.ts checks both, so a stylesheet
 * that starts using one fails there before it quietly loses its styling).
 */
export const UNUSED_MEDIAWIKI_CLASSES: ReadonlySet<string> = new Set([
  "mw-redirect",
  "mw-heading2",
  "mw-heading3",
  "mw-heading4",
  "mw-no-invert",
  "mw-broken-media",
  "mw-references-wrap",
  "mw-selflink-fragment",
  "extiw",
  "navigation-not-searchable",
  "plainlinks",
  "reference-text",
  "cite-bracket",
  "citation-comment",
  "cs1-visible-error",
  "cs1-code",
  "vevent",
  "selfref",
  "Z3988",
  "mergedtoprow",
  "mergedrow",
  "mergedbottomrow",
  "infobox-hiddenrow",
  "infobox-subbox",
  "infobox-caption",
  "infobox-below",
  "mbox-image-div",
  "mbox-text-span",
  "nv-view",
  "nv-talk",
  "nv-edit",
  "collapsible-list",
  "treeview",
]);

/** Attributes that say nothing when empty. */
const REMOVABLE_WHEN_EMPTY = ["class", "style", "title"] as const;

/** Elements whose children are laid out as a structure: whitespace between them is never text. */
const STRUCTURAL_PARENTS: ReadonlySet<string> = new Set([
  "UL",
  "OL",
  "DL",
  "TABLE",
  "THEAD",
  "TBODY",
  "TFOOT",
  "TR",
  "COLGROUP",
  "SELECT",
]);

const BLOCK_ELEMENTS: ReadonlySet<string> = new Set([
  "ADDRESS",
  "ARTICLE",
  "ASIDE",
  "BLOCKQUOTE",
  "CAPTION",
  "CENTER",
  "DD",
  "DETAILS",
  "DIV",
  "DL",
  "DT",
  "FIELDSET",
  "FIGCAPTION",
  "FIGURE",
  "FOOTER",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "HEADER",
  "HR",
  "LI",
  "NAV",
  "OL",
  "P",
  "PRE",
  "SECTION",
  "TABLE",
  "TBODY",
  "TD",
  "TFOOT",
  "TH",
  "THEAD",
  "TR",
  "UL",
]);

/** Text in these keeps its whitespace exactly. */
const WHITESPACE_SENSITIVE = "pre, textarea, code, script, style, svg, [style*='white-space']";

const ELEMENT_NODE = 1;
/** NodeFilter.SHOW_TEXT: the server has no global NodeFilter. */
const SHOW_TEXT = 4;

const collapse = (text: string): string => text.replace(/\s+/g, " ").trim();

/** An `<a title>` that repeats the link's own text carries nothing the text does not. */
function dropRedundantTitle(element: Element): void {
  if (element.tagName !== "A") return;
  const title = element.getAttribute("title");
  if (title !== null && collapse(title) === collapse(element.textContent ?? "")) {
    element.removeAttribute("title");
  }
}

function dropUnusedClasses(element: Element): void {
  const className = element.getAttribute("class");
  if (className === null) return;
  const names = className.split(/\s+/).filter(Boolean);
  const kept = names.filter((name) => !UNUSED_MEDIAWIKI_CLASSES.has(name));
  if (kept.length === names.length) return;
  if (kept.length === 0) element.removeAttribute("class");
  else element.setAttribute("class", kept.join(" "));
}

function dropEmptyAttributes(element: Element): void {
  for (const name of REMOVABLE_WHEN_EMPTY) {
    const value = element.getAttribute(name);
    if (value !== null && value.trim() === "") element.removeAttribute(name);
  }
}

const isBlock = (node: Node | null): boolean =>
  node === null ||
  (node.nodeType === ELEMENT_NODE && BLOCK_ELEMENTS.has((node as Element).tagName));

/**
 * Whitespace-only text that carries no space a reader could see: in a table's or list's structure,
 * or between block elements (or at a block's edge). Inside an inline element or between inline
 * neighbours a space can separate two words, so it stays.
 */
function isLayoutWhitespace(text: Text): boolean {
  if (text.data.trim() !== "") return false;
  const parent = text.parentElement; // null at the fragment's root
  if (parent?.closest(WHITESPACE_SENSITIVE)) return false;
  if (parent && STRUCTURAL_PARENTS.has(parent.tagName)) return true;
  if (parent && !BLOCK_ELEMENTS.has(parent.tagName)) return false;
  return isBlock(text.previousSibling) && isBlock(text.nextSibling);
}

/** `html` with its dead weight taken out. */
export function slimArticleHtml(html: string): string {
  if (!html) return html;
  const { template, content, document } = parseInertOnServer(html);

  for (const element of Array.from(content.querySelectorAll("*"))) {
    dropRedundantTitle(element);
    dropUnusedClasses(element);
    dropEmptyAttributes(element);
  }

  const walker = document.createTreeWalker(content, SHOW_TEXT);
  const removable: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (isLayoutWhitespace(node as Text)) removable.push(node as Text);
  }
  for (const text of removable) text.remove();

  return template.innerHTML;
}
