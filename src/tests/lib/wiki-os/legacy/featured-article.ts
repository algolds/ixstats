// The featured-article reader as the integration branch has it (515ca3c72), before the regex-DoS sweep (plan F15), verbatim apart from its
// import paths: regex-dos-html.test.ts holds the scanning rewrite against it. Not used by any code.

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
import { mediaWikiHostPattern } from "~/lib/wiki-os/config";
import { extractLeadImageFromHtml, normalizeWikiImageUrl } from "~/lib/wiki-os/transformers/image-url";
import { parseInert, type InertFragment } from "~/lib/wiki-os/transformers/inert-dom";

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

const stripTags = (html: string): string => html.replace(/<[^>]+>/g, "").trim();

/** `%`-decoded when it can be: a stray % in a link is used as written. */
function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

const WIKI_HREF = `href="(?:\\/wiki\\/|${ABSOLUTE_WIKI_URL})([^">]+)"`;
const HEADING_LINK = new RegExp(
  `<h3[^>]*>[\\s\\S]*?<a[^>]+${WIKI_HREF}[^>]*>([\\s\\S]*?)<\\/a>[\\s\\S]*?<\\/h3>`,
  "i"
);
const ANY_LINK = new RegExp(`<a[^>]+${WIKI_HREF}[^>]*>([\\s\\S]*?)<\\/a>`, "i");

/** The title and slug of the link the card is about; its heading is the last resort. */
function titleOf(cardHtml: string): { title: string; slug: string } {
  const link = cardHtml.match(HEADING_LINK) ?? cardHtml.match(ANY_LINK);
  if (link) {
    return {
      title: stripTags(link[2] ?? link[1] ?? ""),
      slug: decodeSegment(link[1] ?? "").replace(/ /g, "_"),
    };
  }
  const heading = cardHtml.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
  if (!heading) return { title: "Featured Article", slug: "Featured_Article" };
  const title = stripTags(heading[1] ?? "");
  return { title, slug: title.replace(/ /g, "_") };
}

/** The card's lead paragraph, without its byline and "Featured article" kicker, as plain text. */
function excerptOf(cardHtml: string): string {
  const paragraphs = cardHtml.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) ?? [];
  const lead = paragraphs.find((p) => {
    const lower = p.toLowerCase();
    return !lower.includes("byline") && !lower.includes("featured article");
  });
  return (lead ?? "")
    .replace(/<[^>]+>/g, "")
    .replace(/^Featured article\s*/i, "")
    .trim();
}

/** What the hero shows of the featured-article card (`extractFeaturedArticle`'s output). */
export function featuredArticleDetails(cardHtml: string): FeaturedArticleDetails {
  const image =
    extractLeadImageFromHtml(cardHtml) ??
    normalizeWikiImageUrl(cardHtml.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i)?.[1]);
  return { ...titleOf(cardHtml), image, excerpt: excerptOf(cardHtml) };
}
