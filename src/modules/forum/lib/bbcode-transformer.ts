// src/lib/forum/bbcode-transformer.ts
// Transforms XenForo BBCode post content into sanitized HTML for React rendering.
// Server-side only — runs in tRPC router, never shipped to client.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TransformedPost {
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

export interface AttachmentRef {
  id: number;
  /** Whether this is an inline attachment (embedded in text) */
  inline: boolean;
}

// ---------------------------------------------------------------------------
// Main transformer
// ---------------------------------------------------------------------------

/**
 * Transform XenForo BBCode into sanitized HTML suitable for React rendering.
 * Handles nested tags, XSS sanitization, and internal link rewriting.
 */
export function transformBBCode(
  bbcode: string,
  options: { forumBaseUrl?: string } = {}
): TransformedPost {
  const { forumBaseUrl = "https://forum.ixwiki.com" } = options;

  const quotedUsers: string[] = [];
  const mentionedUsers: string[] = [];
  const attachments: AttachmentRef[] = [];
  let hasSpoiler = false;

  let html = bbcode;

  // 1. Escape HTML entities in raw text (prevent XSS)
  html = escapeHtml(html);

  // 2. Inline formatting
  html = html.replace(/\[b\]([\s\S]*?)\[\/b\]/gi, "<strong>$1</strong>");
  html = html.replace(/\[i\]([\s\S]*?)\[\/i\]/gi, "<em>$1</em>");
  html = html.replace(/\[u\]([\s\S]*?)\[\/u\]/gi, "<u>$1</u>");
  html = html.replace(/\[s\]([\s\S]*?)\[\/s\]/gi, "<del>$1</del>");

  // 3. Font size — map to relative classes
  html = html.replace(
    /\[size=(\d+)\]([\s\S]*?)\[\/size\]/gi,
    (_m, size: string, content: string) => {
      const sizeNum = parseInt(size, 10);
      const cls =
        sizeNum <= 2 ? "text-xs" :
        sizeNum <= 4 ? "text-sm" :
        sizeNum <= 5 ? "text-base" :
        sizeNum <= 6 ? "text-lg" :
        "text-xl";
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
  html = html.replace(
    /\[url=([^\]]+)\]([\s\S]*?)\[\/url\]/gi,
    (_m, url: string, text: string) => {
      const href = rewriteForumUrl(unescapeHtml(url), forumBaseUrl);
      return `<a href="${escapeAttr(href)}" class="forum-link" rel="noopener">${text}</a>`;
    }
  );
  html = html.replace(
    /\[url\]([\s\S]*?)\[\/url\]/gi,
    (_m, url: string) => {
      const href = rewriteForumUrl(unescapeHtml(url), forumBaseUrl);
      return `<a href="${escapeAttr(href)}" class="forum-link" rel="noopener">${escapeHtml(href)}</a>`;
    }
  );

  // 6. Images
  html = html.replace(
    /\[img\]([\s\S]*?)\[\/img\]/gi,
    (_m, src: string) => {
      const safeSrc = sanitizeUrl(unescapeHtml(src));
      return safeSrc
        ? `<img src="${escapeAttr(safeSrc)}" class="forum-img" loading="lazy" alt="" />`
        : "";
    }
  );

  // 7. Quotes — extract quoted username, support nested quotes
  html = processQuotes(html, quotedUsers);

  // 8. Code blocks
  html = html.replace(
    /\[code\]([\s\S]*?)\[\/code\]/gi,
    (_m, code: string) => `<pre class="forum-code"><code>${code}</code></pre>`
  );
  html = html.replace(
    /\[icode\]([\s\S]*?)\[\/icode\]/gi,
    (_m, code: string) => `<code class="forum-inline-code">${code}</code>`
  );

  // 9. Lists
  html = processLists(html);

  // 10. Media embeds
  html = html.replace(
    /\[media=youtube\]([\s\S]*?)\[\/media\]/gi,
    (_m, videoId: string) => {
      const safeId = videoId.replace(/[^a-zA-Z0-9_-]/g, "");
      return `<div class="forum-embed forum-embed-youtube"><iframe src="https://www.youtube-nocookie.com/embed/${safeId}" frameborder="0" allowfullscreen loading="lazy"></iframe></div>`;
    }
  );

  // 11. Spoilers
  html = html.replace(
    /\[spoiler(?:=([^\]]*))?\]([\s\S]*?)\[\/spoiler\]/gi,
    (_m, title: string | undefined, content: string) => {
      hasSpoiler = true;
      const label = title ? escapeHtml(title) : "Spoiler";
      return `<details class="forum-spoiler"><summary class="forum-spoiler-toggle">${label}</summary><div class="forum-spoiler-content">${content}</div></details>`;
    }
  );

  // 12. User mentions
  html = html.replace(
    /\[user=(\d+)\]([\s\S]*?)\[\/user\]/gi,
    (_m, userId: string, username: string) => {
      mentionedUsers.push(username);
      return `<a href="/forum/members/${userId}" class="forum-mention">@${username}</a>`;
    }
  );

  // 13. Attachments
  html = html.replace(
    /\[attach(?:=full)?\](\d+)\[\/attach\]/gi,
    (_m, attachId: string) => {
      const id = parseInt(attachId, 10);
      attachments.push({ id, inline: true });
      return `<div class="forum-attachment" data-attachment-id="${id}"></div>`;
    }
  );

  // 14. Horizontal rule
  html = html.replace(/\[hr\]/gi, '<hr class="forum-hr" />');

  // 15. Alignment
  html = html.replace(
    /\[center\]([\s\S]*?)\[\/center\]/gi,
    '<div class="text-center">$1</div>'
  );
  html = html.replace(
    /\[left\]([\s\S]*?)\[\/left\]/gi,
    '<div class="text-left">$1</div>'
  );
  html = html.replace(
    /\[right\]([\s\S]*?)\[\/right\]/gi,
    '<div class="text-right">$1</div>'
  );

  // 16. Headings (XenForo 2.x)
  html = html.replace(
    /\[heading=(\d)\]([\s\S]*?)\[\/heading\]/gi,
    (_m, level: string, content: string) => {
      const safeLevel = Math.min(Math.max(parseInt(level, 10), 1), 6);
      return `<h${safeLevel} class="forum-heading">${content}</h${safeLevel}>`;
    }
  );

  // 17. Tables
  html = html.replace(/\[table\]([\s\S]*?)\[\/table\]/gi, '<table class="forum-table">$1</table>');
  html = html.replace(/\[tr\]([\s\S]*?)\[\/tr\]/gi, "<tr>$1</tr>");
  html = html.replace(/\[td\]([\s\S]*?)\[\/td\]/gi, "<td>$1</td>");
  html = html.replace(/\[th\]([\s\S]*?)\[\/th\]/gi, "<th>$1</th>");

  // 18. Line breaks — convert newlines to <br> (XenForo stores plain newlines)
  html = html.replace(/\n/g, "<br />");

  // 19. Strip any remaining unclosed/unknown BBCode tags
  html = html.replace(/\[\/?[a-z][a-z0-9]*(?:=[^\]]*)?]/gi, "");

  return {
    contentHtml: html.trim(),
    attachments,
    quotedUsers: Array.from(new Set(quotedUsers)),
    mentionedUsers: Array.from(new Set(mentionedUsers)),
    hasSpoiler,
  };
}

// ---------------------------------------------------------------------------
// Quote processing (supports nesting)
// ---------------------------------------------------------------------------

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
      (_m, author: string | undefined, content: string) => {
        changed = true;
        if (author) {
          quotedUsers.push(author);
          return `<blockquote class="forum-quote"><div class="forum-quote-author">${escapeHtml(author)} wrote:</div><div class="forum-quote-body">${content}</div></blockquote>`;
        }
        return `<blockquote class="forum-quote"><div class="forum-quote-body">${content}</div></blockquote>`;
      }
    );
  }

  return result;
}

// ---------------------------------------------------------------------------
// List processing
// ---------------------------------------------------------------------------

function processLists(html: string): string {
  let result = html;

  // Ordered lists
  result = result.replace(
    /\[list=1\]([\s\S]*?)\[\/list\]/gi,
    (_m, content: string) => {
      const items = content
        .split(/\[\*\]/)
        .filter((s) => s.trim())
        .map((s) => `<li>${s.trim()}</li>`)
        .join("");
      return `<ol class="forum-list forum-list-ordered">${items}</ol>`;
    }
  );

  // Unordered lists
  result = result.replace(
    /\[list\]([\s\S]*?)\[\/list\]/gi,
    (_m, content: string) => {
      const items = content
        .split(/\[\*\]/)
        .filter((s) => s.trim())
        .map((s) => `<li>${s.trim()}</li>`)
        .join("");
      return `<ul class="forum-list">${items}</ul>`;
    }
  );

  return result;
}

// ---------------------------------------------------------------------------
// Security helpers
// ---------------------------------------------------------------------------

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

function escapeAttr(str: string): string {
  return str.replace(/"/g, "&quot;").replace(/'/g, "&#039;");
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

// ---------------------------------------------------------------------------
// Batch transform (for thread view with multiple posts)
// ---------------------------------------------------------------------------

/**
 * Transform multiple posts at once (more efficient for thread views).
 */
export function transformPosts(
  posts: Array<{ postId: number; message: string }>,
  options?: { forumBaseUrl?: string }
): Map<number, TransformedPost> {
  const results = new Map<number, TransformedPost>();
  for (const post of posts) {
    results.set(post.postId, transformBBCode(post.message, options));
  }
  return results;
}
