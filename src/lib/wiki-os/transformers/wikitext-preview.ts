/**
 * wikitext-preview.ts: wikitext compiled for an excerpt a client renders as HTML (lore cards, wiki feed cards, inline
 * article previews). `parseWikitextToHtml` passes the wikitext's own HTML through, and the wikitext may be another
 * wiki's (IIWiki, AltHistory), so its output is never rendered as it is: this compiles and sanitizes in one call.
 */
import { sanitizeWikiPreviewHtml } from "~/lib/utils/sanitize-html";
import { parseWikitextToHtml } from "./wikitext-parser";

/** `parseWikitextToHtml`'s HTML, sanitized for an excerpt (`sanitizeWikiPreviewHtml`). */
export function parseWikitextToPreviewHtml(
  ...args: Parameters<typeof parseWikitextToHtml>
): string {
  return sanitizeWikiPreviewHtml(parseWikitextToHtml(...args));
}
