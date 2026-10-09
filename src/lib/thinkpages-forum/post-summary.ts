/**
 * A post's text for moderator views: report excerpts and the edit log's previous body (follow-up M13). Image-only
 * posts (allowed since phase 4) have no plain text, so they read as their images. Pure.
 */
const IMAGE_TAG = /<img\b/gi;

export function postSummary(post: { plainText: string; contentHtml: string }): string {
  const text = post.plainText.trim();
  if (text) return text;
  const images = post.contentHtml.match(IMAGE_TAG)?.length ?? 0;
  if (images === 0) return "";
  return images === 1 ? "[1 image]" : `[${images} images]`;
}
