/**
 * HTML Sanitization System for IxStats
 *
 * Provides three levels of sanitization:
 * - sanitizeUserContent(): Strictest - for user posts, comments, collaborative docs
 * - sanitizeWikiContent(): Moderate - for external wiki HTML with allowed styling
 * - sanitizeHtml(): Balanced - for general use cases
 * - sanitizeWikiArticleHtml(): WikiOS article HTML (Parsoid/MediaWiki markup, no <style>)
 *
 * Uses DOMPurify in the browser and DOMPurify + jsdom on the server (SSR, tRPC, API routes).
 */

import DOMPurify, { type Config } from "dompurify";

type Purifier = typeof DOMPurify;

/**
 * DOMPurify needs a DOM. Browsers (and Jest's jsdom environment) provide one; on the
 * server (SSR, tRPC, route handlers) it is backed by one jsdom window, created on first
 * use. `typeof window` is a compile-time constant per bundle, so browser bundles drop
 * the jsdom branch.
 */
function createPurifier(): Purifier {
  if (typeof window === "undefined") {
    const { JSDOM } = require("jsdom") as typeof import("jsdom");
    return DOMPurify(new JSDOM("").window);
  }
  return DOMPurify;
}

let purifier: Purifier | null = null;

function getPurifier(): Purifier {
  if (purifier) return purifier;
  const created = createPurifier();
  // Block data: URIs in src/href attributes
  created.addHook("uponSanitizeAttribute", (_node, event) => {
    if (
      (event.attrName === "src" || event.attrName === "href") &&
      event.attrValue.trim().toLowerCase().startsWith("data:")
    ) {
      event.attrValue = "";
    }
  });
  purifier = created;
  return created;
}

const purify = {
  sanitize: (html: string, config: Config): string => getPurifier().sanitize(html, config),
};

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
    ],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form", "input", "button"],
    FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus", "onblur"],
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
export const WIKI_CONTENT_SANITIZE_CONFIG = {
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
  ],
  // RDFa values such as typeof="mw:Transclusion" look like URI schemes; they are inert.
  ADD_URI_SAFE_ATTR: ["typeof", "about", "property"],
  FORBID_TAGS: [...WIKI_CONTENT_SANITIZE_CONFIG.FORBID_TAGS, "style"],
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

/** Bump when `getPurifier`'s hooks change: they shape the output but are not part of the config. */
const SANITIZER_HOOKS_VERSION = 1;

let articleSanitizerFingerprint: string | null = null;

/**
 * Identifies everything that decides what `sanitizeWikiArticleHtml` outputs: its allow and forbid
 * lists (regular expressions included), the hooks version and DOMPurify's own version. Stored
 * article bundles carry it, so changing the sanitizer invalidates them by itself.
 */
export function wikiArticleSanitizerFingerprint(): string {
  articleSanitizerFingerprint ??= hashString(
    JSON.stringify(
      [WIKI_ARTICLE_SANITIZE_CONFIG, SANITIZER_HOOKS_VERSION, DOMPurify.version],
      (_key: string, value: object | string | number | boolean | null) =>
        value instanceof RegExp ? value.toString() : value
    )
  );
  return articleSanitizerFingerprint;
}

/**
 * WikiOS article sanitization (stored or compiled article HTML, served to every reader).
 * Wiki config plus the MediaWiki/Parsoid markup articles need; <style> blocks are removed
 * (the style attribute stays allowed).
 */
export function sanitizeWikiArticleHtml(html: string): string {
  if (!html) return "";
  return purify.sanitize(html, WIKI_ARTICLE_SANITIZE_CONFIG);
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

/**
 * Strip all HTML tags and return plain text
 * Use for: Search indexing, previews, meta descriptions
 */
export function stripHtml(html: string): string {
  if (!html) return "";

  // First sanitize to remove dangerous content
  const sanitized = sanitizeHtml(html);

  // Then strip all tags
  if (typeof window === "undefined") {
    // Server-side: regex fallback
    return sanitized.replace(/<[^>]*>/g, "").trim();
  } else {
    // Client-side: use DOM
    const div = document.createElement("div");
    div.innerHTML = sanitized;
    return div.textContent?.trim() || "";
  }
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
