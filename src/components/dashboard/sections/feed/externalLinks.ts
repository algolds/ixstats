/** The ixwiki article title a URL points at, or null. */
export function wikiTitleFromUrl(url: string | null | undefined): string | null {
  const match = url?.match(/ixwiki\.com\/wiki\/([^#?]+)/);
  return match ? decodeURIComponent(match[1]!).replace(/_/g, " ") : null;
}

/** The forum thread id a URL points at, or null. */
export function forumThreadIdFromUrl(url: string | null | undefined): number | null {
  const match = url?.match(/forum\.ixwiki\.com\/threads\/(?:[^/]*\.)?(\d+)/);
  return match ? parseInt(match[1]!, 10) : null;
}

/** A wiki article title from a raw or URL-encoded title: decoded, underscores as spaces. */
export function decodeWikiTitle(raw: string): string {
  let title = raw;
  try {
    title = decodeURIComponent(raw);
  } catch {
    // Not URL-encoded: use as is.
  }
  return title.replace(/_/g, " ").trim();
}
