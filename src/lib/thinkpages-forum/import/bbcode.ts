/**
 * Transforms XenForo BBCode into HTML. Used by the XenForo bridge (`~/server/modules/forum`, its defaults) and by the
 * phase 4 import (`post-html.ts`: forum links kept absolute, mentions as text, action tokens kept, then degraded and
 * sanitized there). The output is NOT sanitized: every caller that stores or renders it sanitizes it.
 */
import { mapHtmlRuns } from "~/lib/action-links";

/** [tag, replacement] pairs for BBCode tags that map straight onto an HTML wrapper around `$1`. */
type SimpleTag = readonly [tag: string, replacement: string];

const INLINE_TAGS: SimpleTag[] = [
  ["b", "<strong>$1</strong>"],
  ["i", "<em>$1</em>"],
  ["u", "<u>$1</u>"],
  ["s", "<del>$1</del>"],
];
const ALIGNMENT_TAGS: SimpleTag[] = [
  ["center", '<div class="text-center">$1</div>'],
  ["left", '<div class="text-left">$1</div>'],
  ["right", '<div class="text-right">$1</div>'],
];
const TABLE_TAGS: SimpleTag[] = [
  ["table", '<table class="forum-table">$1</table>'],
  ["tr", "<tr>$1</tr>"],
  ["td", "<td>$1</td>"],
  ["th", "<th>$1</th>"],
];

function replaceSimpleTags(html: string, tags: SimpleTag[]): string {
  return tags.reduce(
    (result, [tag, replacement]) =>
      result.replace(new RegExp(`\\[${tag}\\]([\\s\\S]*?)\\[\\/${tag}\\]`, "gi"), replacement),
    html
  );
}

interface TransformedPost {
  /** Post body as sanitized HTML */
  contentHtml: string;
  /** Attachment references found in the post */
  attachments: AttachmentRef[];
  /** Usernames quoted in the post */
  quotedUsers: string[];
  /** Usernames @mentioned in the post */
  mentionedUsers: string[];
  /** Whether the post contains a spoiler */
  hasSpoiler: boolean;
}

interface AttachmentRef {
  id: number;
  /** Whether this is an inline attachment (embedded in text) */
  inline: boolean;
}

export interface BBCodeOptions {
  forumBaseUrl?: string;
  /** "rewrite" (default): forum thread/forum/member URLs become bridge routes. "keep": left as written. */
  forumLinks?: "rewrite" | "keep";
  /** "link" (default): `[user=7]Name[/user]` links the bridge member page. "text": plain `@Name`. */
  mentions?: "link" | "text";
  /** "strip" (default): `[ixaction=…]` goes with the other unknown tags. "keep": left in the text. */
  actionTokens?: "strip" | "keep";
}

/** A tag option as written, without the quotes XenForo 2.2 puts around it (`[QUOTE="Name, post: 1"]`). */
const optionValue = (raw: string): string =>
  raw.trim().replace(/^(?:&quot;|&#039;)([\s\S]*)(?:&quot;|&#039;)$/, "$1");

/** Text taken from the escaped body, escaped once for the page (never twice). */
const asText = (escaped: string): string => escapeHtml(unescapeHtml(escaped));

// Unknown or unclosed tags are dropped, except an action token when the caller keeps them.
const UNKNOWN_TAG = /\[\/?[a-z][a-z0-9]*(?:=[^\]]*)?]/gi;
const isActionToken = (tag: string): boolean => /^\[ixaction=[A-Za-z0-9_-]{1,64}\]$/.test(tag);

/**
 * Transform XenForo BBCode into HTML for the bridge, or for the import to degrade and sanitize.
 * Raw text is escaped first; the tags it knows become fixed markup.
 */
export function transformBBCode(bbcode: string, options: BBCodeOptions = {}): TransformedPost {
  const { forumBaseUrl = "https://forum.ixwiki.com" } = options;
  const linkOf = (url: string): string =>
    options.forumLinks === "keep" ? url : rewriteForumUrl(url, forumBaseUrl);

  const quotedUsers: string[] = [];
  const mentionedUsers: string[] = [];
  const attachments: AttachmentRef[] = [];
  let hasSpoiler = false;

  let html = bbcode;

  // 1. Escape HTML entities in raw text (prevent XSS)
  html = escapeHtml(html);

  // 2. Inline formatting
  html = replaceSimpleTags(html, INLINE_TAGS);

  // 3. Font size — map to relative classes
  html = html.replace(
    /\[size=(\d+)\]([\s\S]*?)\[\/size\]/gi,
    (_m, size: string, content: string) => {
      const sizeNum = parseInt(size, 10);
      const cls =
        sizeNum <= 2
          ? "text-xs"
          : sizeNum <= 4
            ? "text-sm"
            : sizeNum <= 5
              ? "text-base"
              : sizeNum <= 6
                ? "text-lg"
                : "text-xl";
      return `<span class="forum-size ${cls}">${content}</span>`;
    }
  );

  // 4. Colors — map to CSS classes, not inline styles (XSS-safe)
  html = html.replace(
    /\[color=([^\]]+)\]([\s\S]*?)\[\/color\]/gi,
    (_m, color: string, content: string) => {
      const safeColor = sanitizeColor(color);
      return safeColor
        ? `<span style="color:${safeColor}">${content}</span>`
        : `<span>${content}</span>`;
    }
  );

  // 5. URLs
  html = html.replace(/\[url=([^\]]+)\]([\s\S]*?)\[\/url\]/gi, (_m, url: string, text: string) => {
    const href = linkOf(unescapeHtml(optionValue(url)));
    return `<a href="${urlAttr(href)}" class="forum-link" rel="noopener">${text}</a>`;
  });
  // XenForo 2.2 writes pasted links as [URL unfurl="true"]…[/URL]
  html = html.replace(/\[url(?:\s[^\]]*)?\]([\s\S]*?)\[\/url\]/gi, (_m, url: string) => {
    const href = linkOf(unescapeHtml(url));
    return `<a href="${urlAttr(href)}" class="forum-link" rel="noopener">${escapeHtml(href)}</a>`;
  });

  // 6. Images ([IMG width="…"] in XenForo 2.2)
  html = html.replace(/\[img(?:\s[^\]]*)?\]([\s\S]*?)\[\/img\]/gi, (_m, src: string) => {
    const safeSrc = sanitizeUrl(unescapeHtml(src));
    return safeSrc
      ? `<img src="${urlAttr(safeSrc)}" class="forum-img" loading="lazy" alt="" />`
      : "";
  });

  // 7. Quotes — extract quoted username, support nested quotes
  html = processQuotes(html, quotedUsers);

  // 8. Code blocks
  html = html.replace(
    /\[code(?:=[^\]]*)?\]([\s\S]*?)\[\/code\]/gi,
    (_m, code: string) => `<pre class="forum-code"><code>${code}</code></pre>`
  );
  html = html.replace(
    /\[icode\]([\s\S]*?)\[\/icode\]/gi,
    (_m, code: string) => `<code class="forum-inline-code">${code}</code>`
  );

  // 9. Lists
  html = processLists(html);

  // 10. Media embeds
  html = html.replace(/\[media=youtube\]([\s\S]*?)\[\/media\]/gi, (_m, videoId: string) => {
    const safeId = videoId.replace(/[^a-zA-Z0-9_-]/g, "");
    return `<div class="forum-embed forum-embed-youtube"><iframe src="https://www.youtube-nocookie.com/embed/${safeId}" frameborder="0" allowfullscreen loading="lazy"></iframe></div>`;
  });

  // 11. Spoilers
  html = html.replace(
    /\[spoiler(?:=([^\]]*))?\]([\s\S]*?)\[\/spoiler\]/gi,
    (_m, title: string | undefined, content: string) => {
      hasSpoiler = true;
      const label = title ? asText(optionValue(title)) : "Spoiler";
      return `<details class="forum-spoiler"><summary class="forum-spoiler-toggle">${label}</summary><div class="forum-spoiler-content">${content}</div></details>`;
    }
  );

  // 12. User mentions
  html = html.replace(
    /\[user=(\d+)\]([\s\S]*?)\[\/user\]/gi,
    (_m, userId: string, username: string) => {
      mentionedUsers.push(username);
      // XenForo 2.2 stores the name with its "@"
      if (options.mentions === "text") return `@${username.replace(/^@/, "")}`;
      return `<a href="/forum/members/${userId}" class="forum-mention">@${username}</a>`;
    }
  );

  // 13. Attachments
  // [attach], [attach=full], and XenForo 2.2's [ATTACH type="full" alt="…"]
  html = html.replace(
    /\[attach(?:=full|\s[^\]]*)?\](\d+)\[\/attach\]/gi,
    (_m, attachId: string) => {
      const id = parseInt(attachId, 10);
      attachments.push({ id, inline: true });
      return `<div class="forum-attachment" data-attachment-id="${id}"></div>`;
    }
  );

  // 14. Horizontal rule
  html = html.replace(/\[hr\]/gi, '<hr class="forum-hr" />');

  // 15. Alignment
  html = replaceSimpleTags(html, ALIGNMENT_TAGS);

  // 16. Headings (XenForo 2.x)
  html = html.replace(
    /\[heading=(\d)\]([\s\S]*?)\[\/heading\]/gi,
    (_m, level: string, content: string) => {
      const safeLevel = Math.min(Math.max(parseInt(level, 10), 1), 6);
      return `<h${safeLevel} class="forum-heading">${content}</h${safeLevel}>`;
    }
  );

  // 17. Tables
  html = replaceSimpleTags(html, TABLE_TAGS);

  // 18. Line breaks — convert newlines to <br> (XenForo stores plain newlines)
  html = html.replace(/\n/g, "<br />");

  // 19. Strip any remaining unclosed/unknown BBCode tags, in text only (never inside a generated tag)
  html = mapHtmlRuns(html, {
    text: (text) =>
      text.replace(UNKNOWN_TAG, (tag) =>
        options.actionTokens === "keep" && isActionToken(tag) ? tag : ""
      ),
  });

  return {
    contentHtml: html.trim(),
    attachments,
    quotedUsers: Array.from(new Set(quotedUsers)),
    mentionedUsers: Array.from(new Set(mentionedUsers)),
    hasSpoiler,
  };
}

function processQuotes(html: string, quotedUsers: string[]): string {
  // Process innermost quotes first, then work outward
  let result = html;
  let changed = true;
  let iterations = 0;
  const MAX_ITERATIONS = 10;

  while (changed && iterations < MAX_ITERATIONS) {
    changed = false;
    iterations++;

    // Match innermost [quote] blocks (no nested [quote] inside)
    result = result.replace(
      /\[quote(?:=["']?([^"\]]*?)["']?)?\]((?:(?!\[quote)[\s\S])*?)\[\/quote\]/gi,
      (_m, option: string | undefined, content: string) => {
        changed = true;
        const author = option && quoteAuthor(option);
        if (author) {
          quotedUsers.push(author);
          return `<blockquote class="forum-quote"><div class="forum-quote-author">${author} wrote:</div><div class="forum-quote-body">${content}</div></blockquote>`;
        }
        return `<blockquote class="forum-quote"><div class="forum-quote-body">${content}</div></blockquote>`;
      }
    );
  }

  return result;
}

/** The quoted member's name, without XenForo 2.2's `, post: 12, member: 7` suffix. */
function quoteAuthor(option: string): string {
  return asText(optionValue(option).replace(/,\s*(?:post|member):[\s\S]*$/, "")).trim();
}

function listItems(content: string): string {
  return content
    .split(/\[\*\]/)
    .filter((s) => s.trim())
    .map((s) => `<li>${s.trim()}</li>`)
    .join("");
}

function processLists(html: string): string {
  return html
    .replace(
      /\[list=1\]([\s\S]*?)\[\/list\]/gi,
      (_m, content: string) =>
        `<ol class="forum-list forum-list-ordered">${listItems(content)}</ol>`
    )
    .replace(
      /\[list\]([\s\S]*?)\[\/list\]/gi,
      (_m, content: string) => `<ul class="forum-list">${listItems(content)}</ul>`
    );
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function unescapeHtml(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}

/**
 * A URL as a generated href/src value: fully escaped, with `[`, `]` and line breaks percent-encoded, so no later
 * BBCode step (quotes, lists, line breaks, unknown-tag strip) can match inside the attribute and break its quoting.
 */
function urlAttr(url: string): string {
  return escapeHtml(
    url.replace(
      /[[\]\r\n]/g,
      (c) => `%${c.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`
    )
  );
}

/** Only allow safe color values (hex, named colors, rgb/hsl) */
function sanitizeColor(color: string): string | null {
  const trimmed = color.trim();
  // Hex colors
  if (/^#[0-9a-fA-F]{3,8}$/.test(trimmed)) return trimmed;
  // Named colors (basic set)
  if (/^[a-zA-Z]{3,20}$/.test(trimmed)) return trimmed;
  // rgb/hsl
  if (/^(?:rgb|hsl)a?\(\s*[\d.,\s%]+\)$/.test(trimmed)) return trimmed;
  return null;
}

/** Only allow http/https URLs */
function sanitizeUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") return url;
    return null;
  } catch {
    return null;
  }
}

/** Rewrite forum.ixwiki.com URLs to /forum/ internal routes */
function rewriteForumUrl(url: string, forumBaseUrl: string): string {
  if (!url.startsWith(forumBaseUrl)) return url;

  const relative = url.slice(forumBaseUrl.length);

  // Thread URLs: /threads/thread-title.123/ → /forum/thread/123
  const threadMatch = relative.match(/\/threads\/[^/]*?\.?(\d+)\/?$/);
  if (threadMatch) return `/forum/thread/${threadMatch[1]}`;

  // Forum URLs: /forums/forum-name.123/ → /forum/123
  const forumMatch = relative.match(/\/forums\/[^/]*?\.?(\d+)\/?$/);
  if (forumMatch) return `/forum/${forumMatch[1]}`;

  // Member URLs: /members/username.123/ → /forum/members/123
  const memberMatch = relative.match(/\/members\/[^/]*?\.?(\d+)\/?$/);
  if (memberMatch) return `/forum/members/${memberMatch[1]}`;

  // Post URLs: /posts/123/ → /forum/thread/... (keep as-is, will need post resolution)
  const postMatch = relative.match(/\/posts\/(\d+)\/?$/);
  if (postMatch) return `/forum/thread/${postMatch[1]}`;

  return url;
}
