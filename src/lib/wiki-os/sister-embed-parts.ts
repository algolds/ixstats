/**
 * sister-embed-parts.ts: the parts of a rendered sister page (sister-render-service.ts) a `Template:Sister` embed can
 * show: one section (`renderSectionOf`), a card (`cardOf`), the whole page without its in-page navigation
 * (`withoutInPageNavigation`), and a size cap for any HTML part (`trimHtml`).
 *
 * Server only: it parses with jsdom (`parseInertOnServer`). The input is the render service's sanitized HTML (ids
 * prefixed `sister-`, images through the media proxy); what this returns is sanitized again for embedding by the caller.
 */
import { SISTER_ID_PREFIX } from "~/lib/utils/sanitize-sister-html";
import { isSisterMediaPath } from "~/lib/wiki-os/sister-media";
import type { SisterReaderId } from "~/lib/wiki-os/wiki-hosts";
import type { SisterRender } from "~/lib/wiki-os/services/sister-render-service";
import { parseInertOnServer } from "~/lib/wiki-os/transformers/server-dom";

const HEADING_TAG = /^H([2-6])$/;
const MAX_SUMMARY_LENGTH = 300;
const ELLIPSIS = "…";

/**
 * `value` decoded (percent-encoding), `_` as space, whitespace collapsed, lowercased: how headings are compared (and
 * how the embed cache keys a section). Null when nothing is left, so a blank name never matches a heading with no text.
 */
export function headingKey(value: string): string | null {
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    // not percent-encoding: compared as written
  }
  const key = decoded.replace(/_/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  return key === "" ? null : key;
}

/** The heading element a top-level node is (bare, or inside `div.mw-heading`), or null. */
function headingIn(node: ChildNode): Element | null {
  if (node.nodeType !== 1) return null;
  const element = node as Element;
  if (HEADING_TAG.test(element.tagName)) return element;
  if (!element.classList.contains("mw-heading")) return null;
  const inner = element.firstElementChild;
  return inner && HEADING_TAG.test(inner.tagName) ? inner : null;
}

const levelOf = (heading: Element): number => Number(HEADING_TAG.exec(heading.tagName)?.[1]);

/** The names a heading answers to (`headingKey`): its anchor (without the render's `sister-` prefix) and its text. */
function namesOf(heading: Element): string[] {
  const id = heading.id.startsWith(SISTER_ID_PREFIX)
    ? heading.id.slice(SISTER_ID_PREFIX.length)
    : heading.id;
  return [headingKey(id), headingKey(heading.textContent ?? "")].filter(
    (name): name is string => name !== null
  );
}

/** How a node serializes (the HTML serialization of an element, a text or a comment; anything else is nothing). */
function htmlOf(node: ChildNode): string {
  if (node.nodeType === 1) return (node as Element).outerHTML;
  const text = node.textContent ?? "";
  if (node.nodeType === 8) return `<!--${text}-->`;
  if (node.nodeType !== 3) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/\u00a0/g, "&nbsp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** A page's top level read once: each node's HTML, and where its headings are, their level and names. */
interface SectionIndex {
  nodes: string[];
  headings: Array<{ at: number; level: number; names: string[] }>;
}

function sectionIndexOf(html: string): SectionIndex {
  const nodes = Array.from(parseInertOnServer(html).content.childNodes);
  const headings = nodes.flatMap((node, at) => {
    const heading = headingIn(node);
    return heading ? [{ at, level: levelOf(heading), names: namesOf(heading) }] : [];
  });
  return { nodes: nodes.map(htmlOf), headings };
}

function sectionIn(index: SectionIndex, heading: string): string | null {
  const key = headingKey(heading);
  // (a heading's names are never null: a blank `heading` matches none)
  const start = index.headings.findIndex((h) => h.names.some((name) => name === key));
  const found = index.headings[start];
  if (!found) return null;
  const next = index.headings.slice(start + 1).find((h) => h.level <= found.level);
  return index.nodes.slice(found.at, next?.at).join("");
}

/** Each render's section index, read on the first section asked of it (a render the service caches is one object). */
const sectionIndexes = new WeakMap<SisterRender, SectionIndex>();

/**
 * The section of the render's body under `heading`: the first h2 to h6 (bare, or inside `div.mw-heading`) at the top
 * level whose anchor or text is `heading` (compared decoded, `_` as space, whitespace collapsed, in any case), with
 * the top-level nodes after it up to the next heading of the same or a higher level (so its subsections stay inside).
 * Null when there is no such heading, or `heading` is blank. Its headings are read once per render: a second section,
 * or a miss, is a lookup.
 */
export function renderSectionOf(render: SisterRender, heading: string): string | null {
  let index = sectionIndexes.get(render);
  if (!index) {
    index = sectionIndexOf(render.contentHtml);
    sectionIndexes.set(render, index);
  }
  return sectionIn(index, heading);
}

/** `text` whitespace-collapsed and cut at a word to at most 300 characters, ending "…" when cut. */
function summaryOf(text: string): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  if (collapsed.length <= MAX_SUMMARY_LENGTH) return collapsed;
  const cut = collapsed.slice(0, MAX_SUMMARY_LENGTH - ELLIPSIS.length);
  const atWord = cut.lastIndexOf(" ");
  const kept = atWord > 0 ? cut.slice(0, atWord) : cut;
  return `${kept.replace(/[\s,;:]+$/, "")}${ELLIPSIS}`;
}

/** The text of the page's first paragraph that has some (outside tables, without its footnote marks), or "". */
function leadText(contentHtml: string): string {
  const { content } = parseInertOnServer(contentHtml);
  for (const mark of Array.from(content.querySelectorAll("sup.reference"))) mark.remove();
  const lead = Array.from(content.querySelectorAll("p")).find(
    (p) => !p.closest("table") && (p.textContent ?? "").trim() !== ""
  );
  return lead?.textContent ?? "";
}

/** The first image of `html` that loads through `wiki`'s media proxy, or null. */
function firstProxiedImage(html: string | null, wiki: SisterReaderId): string | null {
  if (!html) return null;
  const images = Array.from(parseInertOnServer(html).content.querySelectorAll("img[src]"));
  const src = images
    .map((img) => img.getAttribute("src") ?? "")
    .find((url) => isSisterMediaPath(url, wiki));
  return src ?? null;
}

/**
 * A card of the page: its lead paragraph (at most 300 characters, cut at a word) and its first image, the infobox's
 * before the body's, only one that loads through the wiki's media proxy (`isSisterMediaPath`).
 */
export function cardOf(
  render: SisterRender,
  wiki: SisterReaderId
): { summary: string; imageUrl: string | null } {
  return {
    summary: summaryOf(leadText(render.contentHtml)),
    imageUrl:
      firstProxiedImage(render.infoboxHtml, wiki) ?? firstProxiedImage(render.contentHtml, wiki),
  };
}

/** MediaWiki's table of contents, in each of its spellings. */
const TOC_SELECTOR = "#toc, .toc, .mw-toc";

/**
 * `html` without the navigation that only works on a page of its own: its table of contents is dropped and each
 * in-page link (`href="#…"`) gives way to its text. An embed has no ids (the sanitizer's embed mode), so both would
 * lead nowhere.
 */
export function withoutInPageNavigation(html: string): string {
  const { template, content } = parseInertOnServer(html);
  for (const toc of Array.from(content.querySelectorAll(TOC_SELECTOR))) toc.remove();
  for (const link of Array.from(content.querySelectorAll('a[href^="#"]'))) {
    link.replaceWith(...Array.from(link.childNodes));
  }
  return template.innerHTML;
}

/**
 * `html` cut to at most `maxChars`: its last blocks dropped until it fits. When the HTML is one wrapper (a table, a
 * div), the cut goes inside it, so what stays is well formed and starts as the page does.
 */
export function trimHtml(html: string, maxChars: number): string {
  if (html.length <= maxChars) return html;
  const { template, content } = parseInertOnServer(html);
  let container: ParentNode = content;
  while (container.childNodes.length === 1 && container.firstElementChild !== null) {
    container = container.firstElementChild;
  }
  // `htmlOf` is how each dropped node serialized, so the running size is the page's.
  let size = template.innerHTML.length;
  while (size > maxChars && container.lastChild) {
    size -= htmlOf(container.lastChild).length;
    container.lastChild.remove();
  }
  return template.innerHTML;
}
