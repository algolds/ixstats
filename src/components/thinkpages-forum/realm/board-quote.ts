import { boardExcerpt } from "~/lib/thinkpages-forum/board";
import { htmlToQuoteText } from "../composer/QuoteInsert";

/**
 * The text Quote puts into the board's light editor: who wrote it and a short passage of what they said. The light
 * editor carries no quote block, so the quote is plain text (the sanitizer and the 1,000 character cap treat it as
 * any other text). Null when the message has no words to quote.
 */
export function boardQuoteText(authorName: string, html: string): string | null {
  const excerpt = boardExcerpt(htmlToQuoteText(html));
  return excerpt ? `${authorName} wrote: "${excerpt}" ` : null;
}
