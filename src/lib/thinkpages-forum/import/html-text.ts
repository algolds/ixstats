/** Text escaping shared by the BBCode transformer (bbcode.ts) and its wiki tags (bbcode-wiki.ts). */

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/** escapeHtml undone: `&amp;` last, so escaped entity text (`&amp;lt;`) comes back as written (`&lt;`), never as `<`. */
export function unescapeHtml(str: string): string {
  return str
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, "&");
}
