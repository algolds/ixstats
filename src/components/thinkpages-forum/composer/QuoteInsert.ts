/**
 * The quote block the Quote button puts in the Canvas composer (pure). MediaWiki keeps the quote's `class` and
 * `data-post`, so the thread page can link the author line back to the quoted post (linkQuoteSources).
 */
import { isPostId } from "~/lib/thinkpages-forum/post-html";

export interface QuoteRequest {
  postId: string;
  author: string;
  text: string;
}

const QUOTE_TEXT_MAX = 600;
// Quoted text opens no tag, template or link, and carries no signature (the server refuses `~~~~`).
const WIKI_MARKUP = /[<>]|\{\{|\}\}|\[\[|\]\]|~{3,}/g;
const LINE_BREAKS = /\s*\n\s*/g;

/**
 * Strips until nothing more goes: removing `<>` from "{<>{" or a token from "[[x[[" joins what was around it into a
 * new one (the same reason the server strips to a fixed point).
 */
function plain(value: string): string {
  let text = value.replace(WIKI_MARKUP, "");
  for (
    let next = text.replace(WIKI_MARKUP, "");
    next !== text;
    next = text.replace(WIKI_MARKUP, "")
  ) {
    text = next;
  }
  return text.replace(LINE_BREAKS, " ").trim();
}

/** A quote of `q` as wikitext for the composer; a post id that is not a valid id is left out. */
export function quoteWikitext(q: QuoteRequest): string {
  const post = isPostId(q.postId) ? ` data-post="${q.postId}"` : "";
  return (
    `<blockquote class="forum-quote"${post}>` +
    `<div class="forum-quote-author">'''${plain(q.author)}''' wrote:</div>` +
    `<div class="forum-quote-body">${plain(q.text)}</div></blockquote>\n`
  );
}

const NESTED_QUOTE = /<blockquote\b[\s\S]*?<\/blockquote>/gi;
const ACTION_TOKEN = /\[ixaction=[^\]]*\]/g;
const BLOCK_END = /<\/(?:p|div|li|h[1-6]|tr)>|<br\s*\/?>/gi;
const TAG = /<[^>]*>/g;
const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
};

// Blocks that are not what the post says: the infobox card, the wiki's notices, a wiki embed (and its view).
const NON_PROSE_BLOCK =
  /<div\b[^>]*\bclass="(?:[^"]*\s)?(?:forum-infobox|wikios-notices-container|forum-wiki-embed|forum-embed-view)(?:\s[^"]*)?"[^>]*>/i;
const DIV_TAG = /<(\/?)div\b[^>]*>/gi;

/** `html` without each `<div>` block that matches NON_PROSE_BLOCK, nested divs included (an unclosed one runs to the end). */
function withoutNonProse(html: string): string {
  let rest = html;
  let out = "";
  for (let open = NON_PROSE_BLOCK.exec(rest); open; open = NON_PROSE_BLOCK.exec(rest)) {
    out += `${rest.slice(0, open.index)} `;
    const after = rest.slice(open.index + open[0].length);
    let depth = 1;
    let end = after.length;
    DIV_TAG.lastIndex = 0;
    for (let tag = DIV_TAG.exec(after); tag; tag = DIV_TAG.exec(after)) {
      depth += tag[1] ? -1 : 1;
      if (depth === 0) {
        end = tag.index + tag[0].length;
        break;
      }
    }
    rest = after.slice(end);
  }
  return out + rest;
}

/** The text a post reads as, to quote: no markup, infobox, notices, embeds, action tokens or earlier quotes, shortened to one short passage. */
export function htmlToQuoteText(html: string): string {
  const text = withoutNonProse(html)
    .replace(NESTED_QUOTE, " ")
    .replace(BLOCK_END, " ")
    .replace(TAG, "")
    .replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, (entity) => ENTITIES[entity] ?? entity)
    .replace(ACTION_TOKEN, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > QUOTE_TEXT_MAX ? `${text.slice(0, QUOTE_TEXT_MAX - 3).trimEnd()}...` : text;
}
