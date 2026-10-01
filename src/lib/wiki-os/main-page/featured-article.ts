// src/lib/wiki-os/main-page/featured-article.ts
// Picks the featured-article card out of the Main Page's HTML and reads its title, image and lead
// out for the hero. Runs on the server (main-page-service), where `parse` is a jsdom-backed
// `parseInert`; in a browser the default one is used.
//
// This works on the DOM (see transformers/inert-dom.ts): the HTML is already sanitized, and counting
// `</div>`s or removing `<div ...>[\s\S]*?</div>` by regex on sanitized HTML can be made to end inside
// an attribute and publish the rest of it as live markup. The card is found with selectors, cut out
// of the page as a node, edited with DOM APIs and serialized from its inert template, then sanitized
// once more on the way to the hero's `dangerouslySetInnerHTML`.

import { sanitizeWikiArticleHtml } from "~/lib/utils/sanitize-html";
import { mediaWikiHostPattern } from "../config";
import { stripHtmlTags } from "../transformers/clean-markup-passes";
import {
  PARAGRAPHS,
  blocks,
  imageTags,
  openingTags,
  scanHtml,
  type HtmlScan,
  type Tag,
} from "../transformers/html-scan";
import { extractLeadImageFromHtml, normalizeWikiImageUrl } from "../transformers/image-url";
import { forwardFinder } from "../wikitext/forward-finder";
import { parseInert, type InertFragment } from "../transformers/inert-dom";

/** Where the card can be, in order of preference; the first selector that finds one wins. */
const FEATURED_SELECTORS = [
  'div[id="featured_article"]',
  'div[id="mp-tfa"]',
  'div[id="mainpage-featured"]',
  'div[class*="featured-article" i], div[class*="tfa-box" i], div[class*="mp-box" i], div[class*="featured_article" i]',
  'section[class*="featured" i]',
  'div[class*="card" i]',
];

/** An absolute link to an article of the wiki, as the Main Page wikitext spells it (an `/wiki/` link is relative). */
const ABSOLUTE_WIKI_URL = `https?:\\/\\/${mediaWikiHostPattern()}\\/wiki\\/`;
const ABSOLUTE_WIKI_HREF = new RegExp(`^${ABSOLUTE_WIKI_URL}`);

/** A page this short with a paragraph in it is taken to be the card itself. */
const WHOLE_PAGE_LIMIT = 2500;

const ELEMENT_NODE = 1;

const classOf = (element: Element) => element.getAttribute("class") ?? "";

/** The elements of `root` (and `root` itself, when it is one) in document order. */
function elementsOf(root: Element | DocumentFragment): Element[] {
  const all = Array.from(root.querySelectorAll("*"));
  // nodeType, not `instanceof Element`: on the server there is no global Element
  return root.nodeType === ELEMENT_NODE ? [root as Element, ...all] : all;
}

function firstMatch(content: DocumentFragment): Element | null {
  for (const selector of FEATURED_SELECTORS) {
    const found = content.querySelector(selector);
    if (found) return found;
  }
  return null;
}

/** Drop the byline and "Featured article" kicker, rename the card's classes, route links to /wiki/. */
function dressCard(root: Element | DocumentFragment): void {
  const inside = Array.from(root.querySelectorAll('div[class*="byline" i], p[class*="byline" i]'));
  for (const byline of inside) byline.remove();
  for (const paragraph of Array.from(root.querySelectorAll("p"))) {
    const isKicker =
      paragraph.attributes.length === 0 &&
      /^featured article$/i.test((paragraph.textContent ?? "").trim());
    if (isKicker) paragraph.remove();
  }

  const elements = elementsOf(root);
  elements.find((el) => /^card/i.test(classOf(el)))?.setAttribute("class", "wikios-fa-card");
  for (const el of elements) {
    const className = classOf(el);
    if (/^card-image/i.test(className)) el.setAttribute("class", "wikios-fa-image");
    else if (/^card-text$/i.test(className)) el.setAttribute("class", "wikios-fa-text");
    else if (/^byline$/i.test(className)) el.setAttribute("class", "wikios-fa-byline hidden");
  }

  for (const el of elements) {
    const href = el.getAttribute("href");
    if (href?.startsWith("/w/Special:MyLanguage/")) {
      el.setAttribute("href", `/wiki/${href.slice("/w/Special:MyLanguage/".length)}`);
    } else if (href && ABSOLUTE_WIKI_HREF.test(href)) {
      el.setAttribute("href", href.replace(ABSOLUTE_WIKI_HREF, "/wiki/"));
    }
  }
}

/** The card's HTML from the Main Page's HTML, or null when the page has no featured article. */
export function extractFeaturedArticle(
  html: string,
  parse: (html: string) => InertFragment | null = parseInert
): string | null {
  if (!html) return null;
  const parsed = parse(html);
  if (!parsed) return null;
  const { template, content } = parsed;

  const card = firstMatch(content);
  if (card) {
    dressCard(card);
    return sanitizeWikiArticleHtml(card.outerHTML);
  }
  if (html.length < WHOLE_PAGE_LIMIT && html.includes("<p>")) {
    dressCard(content);
    return sanitizeWikiArticleHtml(template.innerHTML);
  }
  return null;
}

export interface FeaturedArticleDetails {
  title: string;
  /** The title as a /wiki/ path segment. */
  slug: string;
  /** The card's picture (already routed through the image proxy), or null. */
  image: string | null;
  /** The card's first paragraph as plain text. */
  excerpt: string;
}

const stripTags = (html: string): string => stripHtmlTags(html).trim();

/** `%`-decoded when it can be: a stray % in a link is used as written. */
function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** What follows `href="` of a link to a page of the wiki (`ABSOLUTE_WIKI_URL`, above, is the address it may start with). */
const WIKI_PATH_AFTER_HREF = new RegExp(`^(?:\\/wiki\\/|${ABSOLUTE_WIKI_URL})([^">]+)"`, "i");

/** An anchor to a page of the wiki: its `href` (after `/wiki/`) and its opening tag. */
interface WikiAnchor {
  path: string;
  tag: Tag;
}

/**
 * The anchors that link to a page of the wiki, in order (what
 * `/<a[^>]+href="(?:\/wiki\/|<the wiki's address>\/wiki\/)([^">]+)"[^>]*>/gi` finds): the address is the one after
 * the last `href="` of the tag that is such a link (the expression reads greedily).
 */
function* wikiAnchors(scan: HtmlScan, from = 0): Generator<WikiAnchor> {
  for (const tag of openingTags(scan, ["a"], from)) {
    const text = scan.lower.slice(tag.start, tag.end);
    for (let at = text.lastIndexOf('href="'); at >= 3; at = text.lastIndexOf('href="', at - 1)) {
      const match = WIKI_PATH_AFTER_HREF.exec(text.slice(at + 6));
      if (!match) continue;
      const pathStart = tag.start + at + 6 + match[0].length - match[1]!.length - 1;
      yield { path: scan.html.slice(pathStart, pathStart + match[1]!.length), tag };
      break;
    }
  }
}

/** The title and slug of the link the card is about; its heading is the last resort. */
function titleOf(cardHtml: string): { title: string; slug: string } {
  const scan = scanHtml(cardHtml);
  const nextCloseA = forwardFinder(scan.lower, "</a>");
  const nextCloseH3 = forwardFinder(scan.lower, "</h3>");
  // The anchor with its text, which runs to the first `</a>` after it; and where that is.
  const read = (anchor: WikiAnchor | undefined) => {
    const close = anchor && nextCloseA(anchor.tag.end);
    return anchor && close !== undefined && close !== -1
      ? { path: anchor.path, text: cardHtml.slice(anchor.tag.end, close), close }
      : null;
  };

  // Only the first `<h3>` can hold the link, for a later one has fewer links after it, and only the first link
  // after it, for a later one has its `</a>` and the `</h3>` after it later still.
  const heading = openingTags(scan, ["h3"]).next().value;
  const inHeading = heading && read(wikiAnchors(scan, heading.end).next().value);
  const link =
    inHeading && nextCloseH3(inHeading.close + 4) !== -1
      ? inHeading
      : read(wikiAnchors(scan).next().value);
  if (link) {
    return {
      title: stripTags(link.text),
      slug: decodeSegment(link.path).replace(/ /g, "_"),
    };
  }
  const headingClose = heading && nextCloseH3(heading.end);
  if (!heading || headingClose === undefined || headingClose === -1) {
    return { title: "Featured Article", slug: "Featured_Article" };
  }
  const title = stripTags(cardHtml.slice(heading.end, headingClose));
  return { title, slug: title.replace(/ /g, "_") };
}

/** The card's lead paragraph, without its byline and "Featured article" kicker, as plain text. */
function excerptOf(cardHtml: string): string {
  const scan = scanHtml(cardHtml);
  let lead = "";
  for (const [start, end] of blocks(scan, PARAGRAPHS)) {
    const paragraph = cardHtml.slice(start, end);
    const lower = paragraph.toLowerCase();
    if (!lower.includes("byline") && !lower.includes("featured article")) {
      lead = paragraph;
      break;
    }
  }
  return stripHtmlTags(lead)
    .replace(/^Featured article\s*/i, "")
    .trim();
}

/** What the hero shows of the featured-article card (`extractFeaturedArticle`'s output). */
export function featuredArticleDetails(cardHtml: string): FeaturedArticleDetails {
  const image =
    extractLeadImageFromHtml(cardHtml) ??
    normalizeWikiImageUrl([...imageTags(scanHtml(cardHtml))][0]?.src);
  return { ...titleOf(cardHtml), image, excerpt: excerptOf(cardHtml) };
}
