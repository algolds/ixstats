/**
 * Quote post ids in imported post HTML (`<blockquote class="forum-quote" data-post="12">`, bbcode.ts). The converter
 * writes the XenForo post id; once the quoted post is imported the write step points it at the native post id (native
 * ids are cuids, never all digits, so a rerun cannot read one as a XenForo id). Pure.
 */

/** A blockquote's `data-post` holding digits only (a XenForo id), wherever it sits among the attributes. */
const QUOTE_POST_ATTR = /(<blockquote\b[^>]*?)\sdata-post="(\d{1,12})"/g;

/** The XenForo post ids the HTML's quotes still carry, each once. */
export function quotedXenforoPostIds(html: string): number[] {
  const ids = new Set<number>();
  for (const match of html.matchAll(QUOTE_POST_ATTR)) ids.add(Number(match[2]));
  return [...ids];
}

/**
 * Each quote's XenForo id becomes the native post id; an id nothing maps is dropped ("drop") or left for a later run
 * ("keep", while threads are still missing).
 */
export function remapQuotePostIds(
  html: string,
  nativeIdOf: (xenforoPostId: number) => string | undefined,
  unmapped: "drop" | "keep"
): string {
  return html.replace(QUOTE_POST_ATTR, (whole, head: string, id: string) => {
    const native = nativeIdOf(Number(id));
    if (native) return `${head} data-post="${native}"`;
    return unmapped === "drop" ? head : whole;
  });
}
