/**
 * Stash content types.
 *
 * A stash holds one item per (content type, title): the Onoma name "Rome" and the article "Rome"
 * live side by side (`StashItem` is unique on `[stashId, contentType, pageTitle]`). Callers that
 * only know a title (the article page's stash button, Margin annotations) mean the type the title's
 * prefix implies — an ordinary title is a wiki article.
 */
export type StashContentType = "wiki" | "image" | "forum_thread";

/** Title prefixes of a stashed forum thread: the native ThinkPages forum, and the XenForo bridge's legacy items. */
export const NATIVE_THREAD_PREFIX = "thinkpages:thread:";
export const LEGACY_THREAD_PREFIX = "forum:thread:";

/** The thread id inside a native stash title, else null. */
export function nativeThreadIdOf(pageTitle: string): string | null {
  const id = pageTitle.startsWith(NATIVE_THREAD_PREFIX)
    ? pageTitle.slice(NATIVE_THREAD_PREFIX.length)
    : "";
  return id === "" ? null : id;
}

/** Whether a stash title names a forum thread, native or legacy. */
export function isForumThreadTitle(pageTitle: string): boolean {
  return pageTitle.startsWith(NATIVE_THREAD_PREFIX) || pageTitle.startsWith(LEGACY_THREAD_PREFIX);
}

/** The content type a bare stash title stands for. */
export function stashContentTypeForTitle(pageTitle: string): StashContentType {
  if (pageTitle.startsWith("commons:")) return "image";
  if (isForumThreadTitle(pageTitle)) return "forum_thread";
  return "wiki";
}

/** Whether a stash item is a forum thread, native or legacy: by its content type, else by its title. */
export function isStashedForumThread(item: {
  contentType?: string | null;
  pageTitle: string;
}): boolean {
  return item.contentType === "forum_thread" || isForumThreadTitle(item.pageTitle);
}

/** Whether a stash item is a wiki article: an explicit "wiki" type, else anything that is not an image or a thread. */
export function isStashedArticle(item: {
  contentType?: string | null;
  pageTitle: string;
}): boolean {
  return (
    item.contentType === "wiki" ||
    (!item.pageTitle.startsWith("commons:") && !isForumThreadTitle(item.pageTitle))
  );
}
