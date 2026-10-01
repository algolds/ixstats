/**
 * chip-markers.ts — template chips as inert markers in a stored view bundle.
 *
 * `{{MyCountry:gdp}}`, `{{CountryData:Aurelia:population}}` and `[[Template:BusinessData:...]]` links
 * become live, per-viewer "chips" when an article is served. The bundle stores them as
 * `<span data-wikios-chip="KEY"></span>` instead, written with the DOM at render time (before the
 * sanitizer runs), and a reader's request substitutes exactly those markers.
 *
 * Why not string surgery on the stored HTML (what the template resolver once did): the sanitizer's
 * output serializes `<` and `>` unescaped inside attribute values, so a regex that looks for
 * `<a ...>...</a>` can be fooled by an attribute that contains `</a>` and end up publishing the rest
 * of that attribute as live markup. A marker can only ever match where a real element is, because
 * the key alphabet below holds no character the serializer escapes or that could end the marker.
 */

import { leavesAlone } from "../transformers/dom-depth";
import { extractTemplateKeys, rawChipsIn, type TemplateKey } from "./template-resolver";

export const CHIP_ATTRIBUTE = "data-wikios-chip";

/**
 * The keys a marker may carry: a chip prefix and one or more `:`-separated segments of letters,
 * digits, marks, spaces and `_ . , ' ’ ( ) -`. No `& " < > =` (the serializer escapes the first
 * two and the marker pattern stops at all of them), so a marker is byte-for-byte what was written.
 * A key outside it (a country called "Bosnia & Herzegovina") stays an ordinary anchor, which the
 * reader's client resolves on its own.
 */
const MARKABLE_KEY = /^(?:MyCountry|CountryData|BusinessData)(?::[\p{L}\p{N}\p{M} _.,'’()-]+)+$/u;

/** A chip is asked for by this many characters at most. */
const MAX_KEY_LENGTH = 200;

const CHIP_SIGNS =
  /Template(?::|%3a)(?:MyCountry|CountryData|BusinessData)|\{\{(?:MyCountry|CountryData|BusinessData):/i;

export function isMarkableKey(key: string): boolean {
  return key.length <= MAX_KEY_LENGTH && MARKABLE_KEY.test(key);
}

export function chipMarker(key: string): string {
  return `<span ${CHIP_ATTRIBUTE}="${key}"></span>`;
}

/** The serialized marker, exactly; nothing else in the HTML ever matches. */
function markerPattern(): RegExp {
  return new RegExp(`<span ${CHIP_ATTRIBUTE}="([^"&<>=]+)"></span>`, "g");
}

/** The distinct chip keys the markers in `parts` carry. */
export function chipKeysIn(...parts: Array<string | null>): string[] {
  const keys = new Set<string>();
  for (const part of parts) {
    if (!part) continue;
    for (const match of part.matchAll(markerPattern())) keys.add(match[1]!);
  }
  return Array.from(keys);
}

/** `html` with every marker replaced by `replacementFor(key)`; other text is never touched. */
export function substituteChipMarkers(
  html: string,
  replacementFor: (key: string) => string
): string {
  return html.replace(markerPattern(), (_marker, key: string) => replacementFor(key));
}

/** The provider keys for chip keys that came out of markers (they are valid, canonical keys). */
export function templateKeysOf(keys: string[]): TemplateKey[] {
  return extractTemplateKeys(keys.map((key) => `{{${key}}}`).join(" "));
}

/** The markable key of a link target like `/wiki/Template:CountryData:Aurelia:population`, or null. */
function chipKeyOfHref(href: string): string | null {
  const key = extractTemplateKeys(href)[0]?.key;
  return key && isMarkableKey(key) ? key : null;
}

function markerElement(document: Document, key: string): HTMLElement {
  const marker = document.createElement("span");
  marker.setAttribute(CHIP_ATTRIBUTE, key);
  return marker;
}

/**
 * ponytail: MAX_MARKERS, 1,000: the most chips of one page (chip links and raw `{{MyCountry:…}}` together) that
 * become markers. jsdom's `replaceWith` is linear in the parent's children, so 8,000 chip links in one flat
 * parent took 4.9 s; a real page holds a few dozen. A chip past the cap stays what it was, an anchor or raw
 * text, which the reader's client resolves on its own (as a key a marker cannot carry always did).
 */
const MAX_MARKERS = 1_000;

/**
 * The text of `node` with each markable raw chip replaced by a marker (at most `limit`), or null when there is none.
 * `count` is how many markers it made.
 */
function markRawChips(
  document: Document,
  text: string,
  limit: number
): { fragment: DocumentFragment; count: number } | null {
  const fragment = document.createDocumentFragment();
  let last = 0;
  let count = 0;
  for (const chip of rawChipsIn(text)) {
    if (count >= limit) break;
    const key = extractTemplateKeys(chip.text)[0]?.key;
    if (!key || !isMarkableKey(key)) continue;
    fragment.append(text.slice(last, chip.index), markerElement(document, key));
    last = chip.index + chip.text.length;
    count++;
  }
  if (count === 0) return null;
  fragment.append(text.slice(last));
  return { fragment, count };
}

function textNodesOf(document: Document, root: HTMLElement): Text[] {
  const walker = document.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */);
  const nodes: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement?.tagName;
    if (parent !== "SCRIPT" && parent !== "STYLE") nodes.push(node as Text);
  }
  return nodes;
}

let windowDocument: Document | null = null;

/**
 * One jsdom window for the life of the process, created on first use (like the sanitizer's). A
 * window costs ~0.5 MB that the process keeps for good: one per call leaked 1.5 GB over 2,000
 * renders. Nodes made from it are detached and collected as usual.
 */
function sharedDocument(): Document {
  if (!windowDocument) {
    const { JSDOM } = require("jsdom") as typeof import("jsdom");
    windowDocument = new JSDOM("").window.document;
  }
  return windowDocument;
}

/**
 * `html` with every chip link and raw chip replaced by a marker, using the DOM: parse, replace
 * nodes, serialize. HTML with no chip in it comes back byte for byte. Server-side only (jsdom).
 */
export function markTemplateChips(html: string): string {
  if (!CHIP_SIGNS.test(html) || leavesAlone(html)) return html;

  const document = sharedDocument();
  const holder = document.createElement("div");
  holder.innerHTML = html;

  let markers = 0;
  for (const anchor of Array.from(holder.querySelectorAll("a[href]"))) {
    if (markers >= MAX_MARKERS) break;
    const key = chipKeyOfHref(anchor.getAttribute("href") ?? "");
    if (!key) continue;
    anchor.replaceWith(markerElement(document, key));
    markers++;
  }
  for (const node of textNodesOf(document, holder)) {
    if (markers >= MAX_MARKERS) break;
    const marked = markRawChips(document, node.data, MAX_MARKERS - markers);
    if (!marked) continue;
    node.replaceWith(marked.fragment);
    markers += marked.count;
  }
  return holder.innerHTML;
}
