/**
 * HTML Sanitization System for IxStats
 *
 * Provides three levels of sanitization:
 * - sanitizeUserContent(): Strictest - for user posts, comments, collaborative docs
 * - sanitizeWikiContent(): Moderate - for external wiki HTML with allowed styling
 * - sanitizeHtml(): Balanced - for general use cases
 * - sanitizeWikiArticleHtml(): WikiOS article HTML (Parsoid/MediaWiki markup, MediaWiki's legacy tags and
 *   attributes, and TemplateStyles <style> blocks, scoped to the article)
 *
 * Uses DOMPurify in the browser and DOMPurify + jsdom on the server (SSR, tRPC, API routes).
 */

import DOMPurify, { type Config } from "dompurify";
import { mediaWikiOrigin, wikiosConfig } from "~/lib/wiki-os/config";
import { DOM_DEPTH_CEILING, tagsNestTooDeep } from "~/lib/wiki-os/transformers/inert-dom";
import { scopeTemplateStyles } from "./scope-template-styles";

type Purifier = typeof DOMPurify;
type StyleSanitizer = (style: Element) => void;

let serverWindow: import("jsdom").DOMWindow | null = null;

/**
 * DOMPurify needs a DOM. Browsers (and Jest's jsdom environment) provide one; on the
 * server (SSR, tRPC, route handlers) it is backed by one jsdom window, created on first
 * use. `typeof window` is a compile-time constant per bundle, so browser bundles drop
 * the jsdom branch. `fresh` asks for an instance of its own (hooks are per instance), not the shared one.
 */
function createPurifier(fresh = false): Purifier {
  if (typeof window === "undefined") {
    const { JSDOM } = require("jsdom") as typeof import("jsdom");
    serverWindow ??= new JSDOM("").window;
    return DOMPurify(serverWindow);
  }
  return fresh ? DOMPurify(window) : DOMPurify;
}

/** Block data: URIs in src/href attributes. */
function installSharedHooks(created: Purifier): void {
  created.addHook("uponSanitizeAttribute", (_node, event) => {
    if (
      (event.attrName === "src" || event.attrName === "href") &&
      event.attrValue.trim().toLowerCase().startsWith("data:")
    ) {
      event.attrValue = "";
    }
  });
}

let purifier: Purifier | null = null;

function getPurifier(): Purifier {
  if (purifier) return purifier;
  const created = createPurifier();
  installSharedHooks(created);
  purifier = created;
  return created;
}

const purify = {
  sanitize: (html: string, config: Config): string => getPurifier().sanitize(html, config),
};

const HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
/** What TemplateStyles puts on the `<style>` it emits: the only block the article sanitizer lets stay. */
const TEMPLATE_STYLES_ATTRIBUTE = "data-mw-deduplicate";

/**
 * Keeps a `<style>` only when it is TemplateStyles' own: an HTML element, carrying `data-mw-deduplicate`,
 * holding nothing but text, whose CSS the scoper leaves something of. It then holds that scoped CSS and no
 * other attribute; anything else is removed (DOMPurify treats a node a hook detached as removed).
 */
const sanitizeTemplateStyle: StyleSanitizer = (style) => {
  const text = Array.from(style.childNodes).every((child) => child.nodeType === 3)
    ? (style.textContent ?? "")
    : "";
  const css =
    wikiosConfig.templateStyles &&
    style.namespaceURI === HTML_NAMESPACE &&
    style.hasAttribute(TEMPLATE_STYLES_ATTRIBUTE)
      ? scopeTemplateStyles(text, new URL(mediaWikiOrigin()).origin)
      : "";
  if (!css) {
    style.remove();
    return;
  }
  const kept = style.getAttribute(TEMPLATE_STYLES_ATTRIBUTE) ?? "";
  for (const name of style.getAttributeNames()) style.removeAttribute(name);
  style.setAttribute(TEMPLATE_STYLES_ATTRIBUTE, kept);
  style.textContent = css;
};

let articlePurifier: Purifier | null = null;

/** The article's own instance: the shared hooks plus the `<style>` filter, which no other sanitizer wants. */
function getArticlePurifier(): Purifier {
  if (articlePurifier) return articlePurifier;
  const created = createPurifier(true);
  installSharedHooks(created);
  created.addHook("uponSanitizeElement", (node, data) => {
    if (data.tagName === "style") sanitizeTemplateStyle(node as Element);
  });
  articlePurifier = created;
  return created;
}

/**
 * STRICT sanitization for user-generated content
 * Use for: ThinkPages posts, comments, collaborative documents, user profiles
 *
 * Allows: Basic text formatting (b, i, em, strong, p, br, ul, ol, li, blockquote)
 * Blocks: Scripts, iframes, forms, links with javascript:, event handlers
 */
export function sanitizeUserContent(html: string): string {
  if (!html) return "";

  const config: Config = {
    ALLOWED_TAGS: [
      "p",
      "br",
      "span",
      "div",
      "b",
      "i",
      "em",
      "strong",
      "u",
      "s",
      "sub",
      "sup",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "ul",
      "ol",
      "li",
      "blockquote",
      "pre",
      "code",
      "a",
      "img",
    ],
    ALLOWED_ATTR: [
      "href",
      "title",
      "target",
      "src",
      "alt",
      "width",
      "height",
      "class", // Limited to safe classes
      "data-wikiembed",
      "data-title",
      "data-summary",
      "data-imageurl",
      "data-source",
      // Forum posts: a quote's source post, and the wiki links and embeds the XenForo import converts
      "data-post",
      "data-wiki-embed",
      "data-wiki-title",
      "data-width",
    ],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form", "input", "button"],
    FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus", "onblur"],
    // A wiki title is not a URL: "File:X.jpg" must not be read as an unknown protocol and dropped.
    ADD_URI_SAFE_ATTR: ["data-wiki-title"],
    ALLOW_DATA_ATTR: true,
    ALLOW_UNKNOWN_PROTOCOLS: false,
    SAFE_FOR_TEMPLATES: true,
    KEEP_CONTENT: true,
    RETURN_TRUSTED_TYPE: false,
  };

  return purify.sanitize(html, config);
}

/**
 * Config for sanitizeWikiContent(): wiki HTML with allowed styling.
 */
const WIKI_CONTENT_SANITIZE_CONFIG = {
  ALLOWED_TAGS: [
    "p",
    "br",
    "span",
    "div",
    "section",
    "article",
    "b",
    "i",
    "em",
    "strong",
    "u",
    "s",
    "sub",
    "sup",
    "small",
    "mark",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "ul",
    "ol",
    "li",
    "dl",
    "dt",
    "dd",
    "blockquote",
    "pre",
    "code",
    "a",
    "img",
    "figure",
    "figcaption",
    "table",
    "thead",
    "tbody",
    "tfoot",
    "tr",
    "th",
    "td",
    "caption",
    "hr",
    "abbr",
    "cite",
    "q",
    "time",
  ],
  ALLOWED_ATTR: [
    "href",
    "title",
    "target",
    "rel",
    "src",
    "alt",
    "width",
    "height",
    "class",
    "id",
    "style", // Allow styling for wiki content
    "colspan",
    "rowspan",
    "scope", // Table attributes
    "datetime",
    "cite", // Semantic attributes
    "data-wikiembed",
    "data-title",
    "data-summary",
    "data-imageurl",
    "data-source",
  ],
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|ftp):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  FORBID_TAGS: [
    "script",
    "iframe",
    "object",
    "embed",
    "form",
    "input",
    "button",
    "select",
    "textarea",
  ],
  FORBID_ATTR: [
    "onerror",
    "onload",
    "onclick",
    "onmouseover",
    "onfocus",
    "onblur",
    "onchange",
    "onsubmit",
  ],
  ALLOW_DATA_ATTR: true,
  ALLOW_UNKNOWN_PROTOCOLS: false,
  SAFE_FOR_TEMPLATES: true,
  KEEP_CONTENT: true,
} satisfies Config;

/**
 * MODERATE sanitization for wiki content
 * Use for: IxWiki API responses, external HTML content with styling
 *
 * Allows: More HTML tags and styling attributes for rich wiki content
 * Blocks: Scripts, iframes, forms, event handlers
 */
export function sanitizeWikiContent(html: string): string {
  if (!html) return "";
  return purify.sanitize(html, WIKI_CONTENT_SANITIZE_CONFIG);
}

/** Attributes that let markup restyle or reposition itself over the page around it (fixed overlays, fake UI). */
const LAYOUT_ATTRIBUTES = new Set(["class", "id", "style"]);

/**
 * Config for sanitizeRealmContent(): the wiki tags, but no styling hooks: no `style`, `class`, `id` or `data-*`.
 */
const REALM_CONTENT_SANITIZE_CONFIG = {
  ...WIKI_CONTENT_SANITIZE_CONFIG,
  ALLOWED_ATTR: WIKI_CONTENT_SANITIZE_CONFIG.ALLOWED_ATTR.filter(
    (attr) => !LAYOUT_ATTRIBUTES.has(attr) && !attr.startsWith("data-")
  ),
  ALLOW_DATA_ATTR: false,
} satisfies Config;

/**
 * STRICT sanitization for a realm's factbook and rules, which staff write and every visitor's realm page renders
 * inline: wiki formatting, links and images, but nothing that styles or positions an element (a fixed,
 * full-screen "sign in again" overlay), since the realm page styles that content itself.
 */
export function sanitizeRealmContent(html: string): string {
  if (!html) return "";
  return purify.sanitize(html, REALM_CONTENT_SANITIZE_CONFIG);
}

/**
 * Tags MediaWiki's own Sanitizer lets through that the shared wiki config lacks (plan 415, COMPAT-10): the
 * legacy presentational markup that old wikitext and `{| ... |}` tables still produce, ruby, `<bdo>` and
 * `<data>`. Tags that are already allowed (`bdi`, `wbr`, `time`, `mark`, `u`, `s`, `small`, `sub`, `sup`,
 * `abbr`, `cite`, `q`, `caption`) are not repeated.
 */
const MEDIAWIKI_MARKUP_TAGS = [
  "del",
  "ins",
  "center",
  "font",
  "big",
  "tt",
  "kbd",
  "samp",
  "var",
  "dfn",
  "strike",
  "bdo",
  "data",
  "ruby",
  "rt",
  "rp",
  "rb",
  "rtc",
  "col",
  "colgroup",
];

/**
 * Attributes of MediaWiki's attribute whitelist that the shared wiki config lacks: the table, list and
 * `<font>` attributes of legacy markup (`border`, `cellpadding`, `bgcolor`, `align`, `valign`, `start`,
 * `reversed`, `type`, `headers`, `size`, `color`, `face`, ...). Every value is still checked against
 * ALLOWED_URI_REGEXP, so none can carry a `javascript:` URL.
 */
const MEDIAWIKI_MARKUP_ATTRIBUTES = [
  "align",
  "valign",
  "bgcolor",
  "border",
  "cellpadding",
  "cellspacing",
  "summary",
  "frame",
  "rules",
  "abbr",
  "axis",
  "headers",
  "nowrap",
  "char",
  "charoff",
  "span",
  "start",
  "reversed",
  "type",
  "value",
  "clear",
  "size",
  "color",
  "face",
  "rbspan",
];

const WIKI_ARTICLE_SANITIZE_CONFIG: Config = {
  ...WIKI_CONTENT_SANITIZE_CONFIG,
  ALLOWED_TAGS: [
    ...WIKI_CONTENT_SANITIZE_CONFIG.ALLOWED_TAGS,
    "aside",
    "nav",
    "details",
    "summary",
    "bdi",
    "wbr",
    ...MEDIAWIKI_MARKUP_TAGS,
    // TemplateStyles' `<style data-mw-deduplicate>`: getArticlePurifier's hook removes any other, and scopes this one's CSS
    "style",
  ],
  ALLOWED_ATTR: [
    ...WIKI_CONTENT_SANITIZE_CONFIG.ALLOWED_ATTR,
    "typeof",
    "about",
    "property",
    "lang",
    "dir",
    "srcset",
    "loading",
    "decoding",
    "referrerpolicy", // added to <img> by transformArticleHtml
    "role",
    ...MEDIAWIKI_MARKUP_ATTRIBUTES,
  ],
  // RDFa values such as typeof="mw:Transclusion" look like URI schemes; they are inert.
  ADD_URI_SAFE_ATTR: ["typeof", "about", "property"],
  // A leading <style> (TemplateStyles' usual place) is otherwise taken for <head> content and dropped.
  FORCE_BODY: true,
  // SAFE_FOR_TEMPLATES would drop every data-* attribute (Parsoid data-mw, template chips)
  // and blank {{MyCountry:...}} placeholders. This HTML never goes through a template engine.
  SAFE_FOR_TEMPLATES: false,
};

/** A 53-bit string hash (cyrb53): plenty to tell one sanitizer configuration from another. */
function hashString(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

/**
 * Bump when the hooks (`installSharedHooks`, the article's `<style>` filter), the TemplateStyles scoper
 * (`scope-template-styles.ts`) or the guard that shows HTML nested too deep as its source
 * (`sanitizeWikiArticleHtml`) change: they shape the output but are not part of the config.
 * 8: HTML nested past DOM_DEPTH_CEILING (as the parser nests it) is an escaped `<pre class="wikios-fallback-plain">`.
 */
const SANITIZER_HOOKS_VERSION = 8;

let articleSanitizerFingerprint: string | null = null;

/**
 * Identifies everything that decides what `sanitizeWikiArticleHtml` outputs: its allow and forbid
 * lists (regular expressions included), the hooks version, the depth past which HTML is shown as its source,
 * DOMPurify's own version, the wiki's origin (the one host a TemplateStyles `url()` may name) and whether
 * TemplateStyles is on (`WIKIOS_TEMPLATESTYLES`).
 * Stored article bundles carry it, so changing the sanitizer invalidates them by itself.
 */
export function wikiArticleSanitizerFingerprint(): string {
  articleSanitizerFingerprint ??= hashString(
    JSON.stringify(
      [
        WIKI_ARTICLE_SANITIZE_CONFIG,
        SANITIZER_HOOKS_VERSION,
        DOM_DEPTH_CEILING,
        DOMPurify.version,
        mediaWikiOrigin(),
        wikiosConfig.templateStyles,
      ],
      (_key: string, value: object | string | number | boolean | null) =>
        value instanceof RegExp ? value.toString() : value
    )
  );
  return articleSanitizerFingerprint;
}

/**
 * WikiOS article sanitization (stored or compiled article HTML, served to every reader).
 * Wiki config plus the MediaWiki/Parsoid markup articles need, and the legacy tags and attributes
 * MediaWiki's own Sanitizer allows. A `<style>` stays only when it is TemplateStyles' (it carries
 * `data-mw-deduplicate`) and then only as CSS scoped under `.mw-parser-output` and cleared of imports,
 * URLs other than the page's own and the wiki's origin, and script hooks (`scope-template-styles.ts`); the style attribute stays allowed.
 */
export function sanitizeWikiArticleHtml(html: string): string {
  if (!html) return "";
  // ponytail: jsdom's DOM, which DOMPurify runs on a server, is quadratic in nesting depth (6,000 `<s>` took 5 s, 12,000 take
  // 20): HTML the parser nests past DOM_DEPTH_CEILING (400; real pages nest a few dozen) is shown as its escaped source,
  // which is safe and one pass. A server asks the parser how deep (tags alone do not say: `<span><div></span>` and
  // `<i><b></i>` nest thousands deep); a browser's DOM is native and gets the estimate from the tags.
  // (`typeof window` is a compile-time constant: a browser bundle drops the branch that loads parse5.)
  const tooDeep =
    typeof window === "undefined"
      ? (
          require("../wiki-os/transformers/dom-depth") as typeof import("../wiki-os/transformers/dom-depth")
        ).nestsTooDeep(html)
      : tagsNestTooDeep(html);
  if (tooDeep) {
    const escaped = html.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return `<pre class="wikios-fallback-plain">${escaped}</pre>`;
  }
  return getArticlePurifier().sanitize(html, WIKI_ARTICLE_SANITIZE_CONFIG);
}

/**
 * BALANCED sanitization for general use
 * Use for: General HTML content, notifications, formatted text
 *
 * Allows: Common HTML tags with basic formatting
 * Blocks: Scripts, iframes, forms, dangerous attributes
 */
export function sanitizeHtml(html: string): string {
  if (!html) return "";

  const config: Config = {
    ALLOWED_TAGS: [
      "p",
      "br",
      "span",
      "div",
      "b",
      "i",
      "em",
      "strong",
      "u",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "ul",
      "ol",
      "li",
      "blockquote",
      "pre",
      "code",
      "a",
      "img",
    ],
    ALLOWED_ATTR: [
      "href",
      "title",
      "target",
      "src",
      "alt",
      "width",
      "height",
      "class",
      "data-wikiembed",
      "data-title",
      "data-summary",
      "data-imageurl",
      "data-source",
    ],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form", "input", "button"],
    FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus", "onblur"],
    ALLOW_DATA_ATTR: true,
    ALLOW_UNKNOWN_PROTOCOLS: false,
    SAFE_FOR_TEMPLATES: true,
    KEEP_CONTENT: true,
  };

  return purify.sanitize(html, config);
}

/**
 * Escape HTML entities for plain text display
 * Use for: Converting user input to safe plain text
 */
export function escapeHtml(text: string): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "\u2013",
  mdash: "\u2014",
  hellip: "\u2026",
  lsquo: "\u2018",
  rsquo: "\u2019",
  ldquo: "\u201C",
  rdquo: "\u201D",
  copy: "\u00A9",
  reg: "\u00AE",
  trade: "\u2122",
};

/**
 * Decode the common HTML entities in one pass, with no DOM, so server and client
 * produce identical text (a DOM-based decode on the client only would cause hydration
 * mismatches). Unknown or out-of-range entities are left untouched.
 */
function decodeEntities(text: string): string {
  return text.replace(/&(?:#(\d+)|#[xX]([0-9a-fA-F]+)|([a-zA-Z]+));/g, (match, dec, hex, name) => {
    if (name !== undefined) return NAMED_ENTITIES[name] ?? match;
    const codePoint = dec !== undefined ? parseInt(dec, 10) : parseInt(hex, 16);
    if (codePoint < 1 || codePoint > 0x10ffff || (codePoint >= 0xd800 && codePoint <= 0xdfff)) {
      return match;
    }
    return String.fromCodePoint(codePoint);
  });
}

const BLOCK_TAG_PATTERN =
  /<\/?(?:br|hr|p|div|li|ul|ol|dl|dt|dd|tr|td|th|table|thead|tbody|tfoot|h[1-6]|blockquote|pre|section|article|aside|header|footer|nav|figure|figcaption)\b(?:"[^"]*"|'[^']*'|[^>"'])*>/gi;
const ANY_TAG_PATTERN = /<\/?[a-zA-Z](?:"[^"]*"|'[^']*'|[^>"'])*>/g;

/**
 * Strip all HTML tags and return plain text
 * Use for: Search indexing, previews, meta descriptions
 *
 * Line breaks and block-level tags become a single space (so "A<br>B" is "A B"),
 * entities are decoded identically on server and client, and whitespace is collapsed.
 */
export function stripHtml(html: string): string {
  if (!html) return "";

  // First sanitize to remove dangerous content
  const sanitized = sanitizeHtml(html);

  const withoutTags = sanitized.replace(BLOCK_TAG_PATTERN, " ").replace(ANY_TAG_PATTERN, "");
  return decodeEntities(withoutTags).replace(/\s+/g, " ").trim();
}

/**
 * Validate that content doesn't contain XSS patterns
 * Use for: Pre-validation before storing user content
 */
export function validateNoXSS(content: string): { valid: boolean; reason?: string } {
  if (!content) return { valid: true };

  // Check for data URLs (potential XSS vector) - Checked first to return specific reason before general tag/script check
  if (/data:text\/html/i.test(content)) {
    return { valid: false, reason: "Data URLs with HTML are not allowed" };
  }

  // Check for script tags
  if (/<script[\s>]/i.test(content)) {
    return { valid: false, reason: "Script tags are not allowed" };
  }

  // Check for javascript: protocol
  if (/javascript:/i.test(content)) {
    return { valid: false, reason: "JavaScript protocols are not allowed" };
  }

  // Check for event handlers
  if (/on\w+\s*=/i.test(content)) {
    return { valid: false, reason: "Event handlers are not allowed" };
  }

  // Check for iframe tags
  if (/<iframe[\s>]/i.test(content)) {
    return { valid: false, reason: "Iframe tags are not allowed" };
  }

  return { valid: true };
}

/**
 * SVG markup (heraldry charges, imported artwork): DOMPurify's SVG profile, which drops
 * scripts, event handlers, foreignObject and javascript: links. Use before any
 * dangerouslySetInnerHTML of stored or fetched SVG.
 */
export function sanitizeSvgMarkup(svg: string): string {
  return purify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true } });
}
