/**
 * The forum quote as the Canvas editor holds it (pure): one atomic read-only `raw-wikitext` block that shows who
 * wrote what and is saved as the wikitext `quoteWikitext` wrote. Shared by the Quote button (a new quote) and the
 * page loader (a quote already in a post being edited), so both make the same block.
 */
import { isPostId } from "./post-html";

export interface ForumQuoteBlock {
  type: "raw-wikitext";
  construct: "forum-quote";
  rawWikitext: string;
  label: string;
  caption: string;
  children: [{ text: "" }];
}

/** The block for the quote `rawWikitext`, shown as `author` wrote `text`. */
export function forumQuoteBlock(rawWikitext: string, author: string, text: string): ForumQuoteBlock {
  return {
    type: "raw-wikitext",
    construct: "forum-quote",
    rawWikitext,
    label: author,
    caption: text,
    children: [{ text: "" }],
  };
}

// Exactly the shape quoteWikitext emits (the Quote button strips `<` and `>` from the author and the text).
const QUOTE =
  /^<blockquote((?:\s+[a-z-]+="[^"<>]*")+)\s*><div class="forum-quote-author">'''([^<>]*)''' wrote:<\/div><div class="forum-quote-body">([^<>]*)<\/div><\/blockquote>$/;
const ATTRIBUTE = /([a-z-]+)="([^"]*)"/g;

/** Whether the attributes are a `class` with the token `forum-quote` and, optionally, a valid `data-post`, only. */
function isQuoteOpening(attributes: string): boolean {
  const seen = new Map<string, string>();
  for (const [, name = "", value = ""] of attributes.matchAll(ATTRIBUTE)) {
    if (seen.has(name)) return false;
    seen.set(name, value);
  }
  const classes = seen.get("class")?.split(/\s+/) ?? [];
  const post = seen.get("data-post");
  const known = [...seen.keys()].every((name) => name === "class" || name === "data-post");
  return known && classes.includes("forum-quote") && (post === undefined || isPostId(post));
}

/** The editor block for `source` when it is exactly one forum quote (as quoteWikitext emits it), else null. */
export function parseForumQuote(source: string): ForumQuoteBlock | null {
  const match = QUOTE.exec(source);
  if (!match || !isQuoteOpening(match[1] ?? "")) return null;
  return forumQuoteBlock(source, match[2] ?? "", match[3] ?? "");
}
