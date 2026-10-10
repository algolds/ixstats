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

function plain(value: string): string {
  return value.replace(WIKI_MARKUP, "").replace(LINE_BREAKS, " ").trim();
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

/** The text a post reads as, to quote: no markup, action tokens or earlier quotes, shortened to one short passage. */
export function htmlToQuoteText(html: string): string {
  const text = html
    .replace(NESTED_QUOTE, " ")
    .replace(BLOCK_END, " ")
    .replace(TAG, "")
    .replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, (entity) => ENTITIES[entity] ?? entity)
    .replace(ACTION_TOKEN, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > QUOTE_TEXT_MAX ? `${text.slice(0, QUOTE_TEXT_MAX - 3).trimEnd()}...` : text;
}
