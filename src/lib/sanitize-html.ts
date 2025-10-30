/**
 * HTML Sanitization System for IxStats
 *
 * Provides three levels of sanitization:
 * - sanitizeUserContent(): Strictest - for user posts, comments, collaborative docs
 * - sanitizeWikiContent(): Moderate - for external wiki HTML with allowed styling
 * - sanitizeHtml(): Balanced - for general use cases
 *
 * Uses DOMPurify with isomorphic support for SSR/CSR compatibility
 */

import * as DOMPurifyModule from "dompurify";
const DOMPurify = DOMPurifyModule.default || DOMPurifyModule;

// Client-side DOMPurify instance
// Note: This should only be used in client components or after hydration
const getPurify = () => {
  if (typeof window === "undefined") {
    // Server-side: return a no-op that just escapes HTML
    return {
      sanitize: (html: string, _config?: any) => {
        return html
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");
      },
    };
  }
  return DOMPurify;
};

const purify = getPurify();

/**
 * STRICT sanitization for user-generated content
 * Use for: ThinkPages posts, comments, collaborative documents, user profiles
 *
 * Allows: Basic text formatting (b, i, em, strong, p, br, ul, ol, li, blockquote)
 * Blocks: Scripts, iframes, forms, links with javascript:, event handlers
 */
export function sanitizeUserContent(html: string): string {
  if (!html) return "";

  const config = {
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
    ],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form", "input", "button"],
    FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus", "onblur"],
    ALLOW_DATA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
    SAFE_FOR_TEMPLATES: true,
    KEEP_CONTENT: true,
    RETURN_TRUSTED_TYPE: false,
  };

  return purify.sanitize(html, config) as string;
}

/**
 * MODERATE sanitization for wiki content
 * Use for: IxWiki API responses, external HTML content with styling
 *
 * Allows: More HTML tags and styling attributes for rich wiki content
 * Blocks: Scripts, iframes, forms, event handlers
 */
export function sanitizeWikiContent(html: string): string {
  if (!html) return "";

  const config = {
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
    ],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|ftp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
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
    ALLOW_DATA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
    SAFE_FOR_TEMPLATES: true,
    KEEP_CONTENT: true,
  };

  return purify.sanitize(html, config) as string;
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

  const config = {
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
    ALLOWED_ATTR: ["href", "title", "target", "src", "alt", "width", "height", "class"],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form", "input", "button"],
    FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus", "onblur"],
    ALLOW_DATA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
    SAFE_FOR_TEMPLATES: true,
    KEEP_CONTENT: true,
  };

  return purify.sanitize(html, config) as string;
}

/**
 * Escape HTML entities for plain text display
 * Use for: Converting user input to safe plain text
 */
export function escapeHtml(text: string): string {
  if (!text) return "";

  const div =
    typeof document !== "undefined"
      ? document.createElement("div")
      : { textContent: text, innerHTML: "" };

  div.textContent = text;
  return div.innerHTML;
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

  // Check for data URLs (potential XSS vector)
  if (/data:text\/html/i.test(content)) {
    return { valid: false, reason: "Data URLs with HTML are not allowed" };
  }

  // Check for iframe tags
  if (/<iframe[\s>]/i.test(content)) {
    return { valid: false, reason: "Iframe tags are not allowed" };
  }

  return { valid: true };
}
