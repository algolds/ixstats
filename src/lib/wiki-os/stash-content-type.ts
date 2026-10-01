/**
 * Stash content types.
 *
 * A stash holds one item per (content type, title): the Onoma name "Rome" and the article "Rome"
 * live side by side (`StashItem` is unique on `[stashId, contentType, pageTitle]`). Callers that
 * only know a title (the article page's stash button, Margin annotations) mean the type the title's
 * prefix implies — an ordinary title is a wiki article.
 */
export type StashContentType = "wiki" | "image" | "forum_thread";

/** The content type a bare stash title stands for. */
export function stashContentTypeForTitle(pageTitle: string): StashContentType {
  if (pageTitle.startsWith("commons:")) return "image";
  if (pageTitle.startsWith("forum:thread:")) return "forum_thread";
  return "wiki";
}
