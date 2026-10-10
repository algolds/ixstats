/**
 * Transforms XenForo BBCode into HTML. Used by the XenForo bridge (`~/server/modules/forum`, its defaults) and by the
 * phase 4 import (`post-html.ts`: forum links kept absolute, mentions as text, action tokens kept, then degraded and
 * sanitized there). The output is NOT sanitized: every caller that stores or renders it sanitizes it.
 */
import { mapHtmlRuns } from "~/lib/action-links";
import { replacePairs, type PairSpec } from "./bbcode-pairs";
import { replaceWikiTags } from "./bbcode-wiki";
import { escapeHtml, unescapeHtml } from "./html-text";

/**
 * Bodies longer than this (characters) are not transformed: they render as escaped plain text with line breaks,
 * flagged `tooLong` (the import counts them). XenForo's own message limit is far below it.
 */
export const MAX_BBCODE_LENGTH = 200_000;

/** [tag, open, close] for BBCode tags that map straight onto an HTML wrapper around their content. */
type SimpleTag = readonly [tag: string, open: string, close: string];

const INLINE_TAGS: SimpleTag[] = [
  ["b", "<strong>", "</strong>"],
  ["i", "<em>", "</em>"],
  ["u", "<u>", "</u>"],
  ["s", "<del>", "</del>"],
];
const ALIGNMENT_TAGS: SimpleTag[] = [
  ["center", '<div class="text-center">', "</div>"],
  ["left", '<div class="text-left">', "</div>"],
  ["right", '<div class="text-right">', "</div>"],
];
const TABLE_TAGS: SimpleTag[] = [
  ["table", '<table class="forum-table">', "</table>"],
  ["tr", "<tr>", "</tr>"],
  ["td", "<td>", "</td>"],
  ["th", "<th>", "</th>"],
];

/** An opener with no option: `[tag]`. */
const BARE = /\]/y;

/** `[tag…]content[/tag]` pairs, as `/\[tag…\]([\s\S]*?)\[\/tag\]/gi` would match them, in linear time. */
const pairs =
  (
    tag: string,
    rest: RegExp,
    render: PairSpec["render"],
    extra: Pick<PairSpec, "body" | "innermost"> = {}
  ) =>
  (html: string) =>
    replacePairs(html, { tag, rest, render, ...extra });

function replaceSimpleTags(html: string, tags: SimpleTag[]): string {
  return tags.reduce(
    (result, [tag, open, close]) =>
      pairs(tag, BARE, (_o, content) => `${open}${content}${close}`)(result),
    html
  );
}

const sizeClass = (size: string): string => {
  const sizeNum = parseInt(size, 10);
  if (sizeNum <= 2) return "text-xs";
  if (sizeNum <= 4) return "text-sm";
  if (sizeNum <= 5) return "text-base";
  return sizeNum <= 6 ? "text-lg" : "text-xl";
};

interface TransformedPost {
  /** Post body as HTML: user text escaped, tags as fixed markup. NOT sanitized: callers sanitize at render or store. */
  contentHtml: string;
  /** Attachment references found in the post */
  attachments: AttachmentRef[];
  /** Usernames quoted in the post */
  quotedUsers: string[];
  /** Usernames @mentioned in the post */
  mentionedUsers: string[];
  /** Whether the post contains a spoiler */
  hasSpoiler: boolean;
  /** Over MAX_BBCODE_LENGTH: rendered as escaped plain text, no tag transformed. */
  tooLong: boolean;
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
 * Unknown tags out of one text run. Every tag ends with `]`, so the run after its last `]` is left alone (which
 * keeps an opener with no `]` after it from scanning to the end of the run, once per opener).
 */
function stripUnknownTags(text: string, keepTokens: boolean): string {
  const end = text.lastIndexOf("]") + 1;
  const stripped = text
    .slice(0, end)
    .replace(UNKNOWN_TAG, (tag) => (keepTokens && isActionToken(tag) ? tag : ""));
  return stripped + text.slice(end);
}

/** A body over the length cap: escaped text with its line breaks, nothing else. */
const tooLongPost = (bbcode: string): TransformedPost => ({
  contentHtml: escapeHtml(bbcode).replace(/\n/g, "<br />").trim(),
  attachments: [],
  quotedUsers: [],
  mentionedUsers: [],
  hasSpoiler: false,
  tooLong: true,
});

/**
 * Transform XenForo BBCode into HTML for the bridge, or for the import to degrade and sanitize.
 * Raw text is escaped first; the tags it knows become fixed markup.
 */
export function transformBBCode(bbcode: string, options: BBCodeOptions = {}): TransformedPost {
  if (bbcode.length > MAX_BBCODE_LENGTH) return tooLongPost(bbcode);
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
  html = pairs(
    "size",
    /=(\d+)\]/y,
    ([, size], content) => `<span class="forum-size ${sizeClass(size!)}">${content}</span>`
  )(html);

  // 4. Colors — an allowlisted value only (XSS-safe)
  html = pairs("color", /=([^\]]+)\]/y, ([, color], content) => {
    const safeColor = sanitizeColor(color!);
    return safeColor
      ? `<span style="color:${safeColor}">${content}</span>`
      : `<span>${content}</span>`;
  })(html);

  // 5. URLs
  html = pairs("url", /=([^\]]+)\]/y, ([, url], text) => {
    const href = linkOf(unescapeHtml(optionValue(url!)));
    return `<a href="${urlAttr(href)}" class="forum-link" rel="noopener">${text}</a>`;
  })(html);
  // XenForo 2.2 writes pasted links as [URL unfurl="true"]…[/URL]
  html = pairs("url", /(?:\s[^\]]*)?\]/y, (_o, url) => {
    const href = linkOf(unescapeHtml(url));
    return `<a href="${urlAttr(href)}" class="forum-link" rel="noopener">${escapeHtml(href)}</a>`;
  })(html);

  // 6. Images ([IMG width="…"] in XenForo 2.2)
  html = pairs("img", /(?:\s[^\]]*)?\]/y, (_o, src) => {
    const safeSrc = sanitizeUrl(unescapeHtml(src));
    return safeSrc
      ? `<img src="${urlAttr(safeSrc)}" class="forum-img" loading="lazy" alt="" />`
      : "";
  })(html);

  // 7. Quotes — extract quoted username, support nested quotes
  html = processQuotes(html, quotedUsers);

  // 8. Code blocks
  html = pairs(
    "code",
    /(?:=[^\]]*)?\]/y,
    (_o, code) => `<pre class="forum-code"><code>${code}</code></pre>`
  )(html);
  html = pairs("icode", BARE, (_o, code) => `<code class="forum-inline-code">${code}</code>`)(html);

  // 9. Lists
  html = processLists(html);

  // 10. Media embeds
  html = pairs("media", /=youtube\]/iy, (_o, videoId) => {
    const safeId = videoId.replace(/[^a-zA-Z0-9_-]/g, "");
    return `<div class="forum-embed forum-embed-youtube"><iframe src="https://www.youtube-nocookie.com/embed/${safeId}" frameborder="0" allowfullscreen loading="lazy"></iframe></div>`;
  })(html);

  // 11. Spoilers
  html = pairs("spoiler", /(?:=([^\]]*))?\]/y, ([, title], content) => {
    hasSpoiler = true;
    const label = title ? asText(optionValue(title)) : "Spoiler";
    return `<details class="forum-spoiler"><summary class="forum-spoiler-toggle">${label}</summary><div class="forum-spoiler-content">${content}</div></details>`;
  })(html);

  // 12. User mentions
  html = pairs("user", /=(\d+)\]/y, ([, userId], username) => {
    mentionedUsers.push(username);
    // XenForo 2.2 stores the name with its "@"
    if (options.mentions === "text") return `@${username.replace(/^@/, "")}`;
    return `<a href="/forum/members/${userId}" class="forum-mention">@${username}</a>`;
  })(html);

  // 13. Attachments
  // [attach], [attach=full], and XenForo 2.2's [ATTACH type="full" alt="…"]
  html = pairs(
    "attach",
    /(?:=full|\s[^\]]*)?\]/iy,
    (_o, attachId) => {
      const id = parseInt(attachId, 10);
      attachments.push({ id, inline: true });
      return `<div class="forum-attachment" data-attachment-id="${id}"></div>`;
    },
    { body: /\d+/y }
  )(html);

  // 14. Horizontal rule
  html = html.replace(/\[hr\]/gi, '<hr class="forum-hr" />');

  // 15. Alignment
  html = replaceSimpleTags(html, ALIGNMENT_TAGS);

  // 16. Headings (XenForo 2.x)
  html = pairs("heading", /=(\d)\]/y, ([, level], content) => {
    const safeLevel = Math.min(Math.max(parseInt(level!, 10), 1), 6);
    return `<h${safeLevel} class="forum-heading">${content}</h${safeLevel}>`;
  })(html);

  // 17. Tables
  html = replaceSimpleTags(html, TABLE_TAGS);

  // 18. Wiki tags ([wikilink], [wikisummary], [wikiinfobox], [wikiimage=W])
  html = replaceWikiTags(html);

  // 19. Line breaks — convert newlines to <br> (XenForo stores plain newlines)
  html = html.replace(/\n/g, "<br />");

  // 20. Strip any remaining unclosed/unknown BBCode tags, in text only (never inside a generated tag)
  html = mapHtmlRuns(html, {
    text: (text) => stripUnknownTags(text, options.actionTokens === "keep"),
  });

  return {
    contentHtml: html.trim(),
    attachments,
    quotedUsers: Array.from(new Set(quotedUsers)),
    mentionedUsers: Array.from(new Set(mentionedUsers)),
    hasSpoiler,
    tooLong: false,
  };
}

function processQuotes(html: string, quotedUsers: string[]): string {
  // Process innermost quotes first, then work outward
  let result = html;
  let changed = true;
  let iterations = 0;
  const MAX_ITERATIONS = 10;
  const quote = (option: string | undefined, content: string): string => {
    changed = true;
    const author = option && quoteAuthor(option);
    const postId = option && quotePostId(option);
    const open = `<blockquote class="forum-quote"${postId ? ` data-post="${postId}"` : ""}>`;
    if (author) {
      quotedUsers.push(author);
      return `${open}<div class="forum-quote-author">${author} wrote:</div><div class="forum-quote-body">${content}</div></blockquote>`;
    }
    return `${open}<div class="forum-quote-body">${content}</div></blockquote>`;
  };
  // Innermost [quote] blocks (no nested [quote] inside)
  const innermost = pairs(
    "quote",
    /(?:=["']?([^"\]]*?)["']?)?\]/y,
    ([, option], content) => quote(option, content),
    { innermost: true }
  );

  while (changed && iterations < MAX_ITERATIONS) {
    changed = false;
    iterations++;
    result = innermost(result);
  }

  return result;
}

/** The quoted member's name, without XenForo 2.2's `, post: 12, member: 7` suffix. */
function quoteAuthor(option: string): string {
  return asText(optionValue(option).replace(/,\s*(?:post|member):[\s\S]*$/, "")).trim();
}

/** The quoted XenForo post id from XenForo 2.2's `, post: 12, member: 7` suffix: digits only, or null. */
function quotePostId(option: string): string | null {
  return /(?:^|,)\s*post:\s*(\d{1,12})(?!\w)/i.exec(optionValue(option))?.[1] ?? null;
}

function listItems(content: string): string {
  return content
    .split(/\[\*\]/)
    .filter((s) => s.trim())
    .map((s) => `<li>${s.trim()}</li>`)
    .join("");
}

const orderedLists = pairs(
  "list",
  /=1\]/y,
  (_o, content) => `<ol class="forum-list forum-list-ordered">${listItems(content)}</ol>`
);
const bulletLists = pairs(
  "list",
  BARE,
  (_o, content) => `<ul class="forum-list">${listItems(content)}</ul>`
);

function processLists(html: string): string {
  return bulletLists(orderedLists(html));
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
