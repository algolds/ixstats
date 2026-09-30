// src/components/wiki-os/reader/featured-article.ts
// Picks the featured-article card out of the Main Page's HTML and dresses it for the hero.
//
// This works on the DOM (see transformers/inert-dom.ts): the HTML is already sanitized, and counting
// `</div>`s or removing `<div ...>[\s\S]*?</div>` by regex on sanitized HTML can be made to end inside
// an attribute and publish the rest of it as live markup. The card is found with selectors, cut out
// of the page as a node, edited with DOM APIs and serialized from its inert template, then sanitized
// once more on the way to the hero's `dangerouslySetInnerHTML`.

import { sanitizeWikiArticleHtml } from "~/lib/utils/sanitize-html";
import { parseInert } from "~/lib/wiki-os/transformers/inert-dom";

/** Where the card can be, in order of preference; the first selector that finds one wins. */
const FEATURED_SELECTORS = [
  'div[id="featured_article"]',
  'div[id="mp-tfa"]',
  'div[id="mainpage-featured"]',
  'div[class*="featured-article" i], div[class*="tfa-box" i], div[class*="mp-box" i], div[class*="featured_article" i]',
  'section[class*="featured" i]',
  'div[class*="card" i]',
];

/** A page this short with a paragraph in it is taken to be the card itself. */
const WHOLE_PAGE_LIMIT = 2500;

const classOf = (element: Element) => element.getAttribute("class") ?? "";

/** The elements of `root` (and `root` itself, when it is one) in document order. */
function elementsOf(root: Element | DocumentFragment): Element[] {
  const all = Array.from(root.querySelectorAll("*"));
  return root instanceof Element ? [root, ...all] : all;
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
    } else if (href && /^https?:\/\/ixwiki\.com\/wiki\//.test(href)) {
      el.setAttribute("href", href.replace(/^https?:\/\/ixwiki\.com\/wiki\//, "/wiki/"));
    }
  }
}

/** The card's HTML from the Main Page's HTML, or null when the page has no featured article. */
export function extractFeaturedArticle(html: string): string | null {
  if (!html) return null;
  const parsed = parseInert(html);
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
