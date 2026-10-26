/**
 * sanitize-wiki-preview.ts: `sanitizeWikiPreviewHtml`, for wikitext compiled by `parseWikitextToHtml` into an excerpt
 * (lore cards, wiki feed cards, inline article previews). The compiler passes the wikitext's own HTML through, and that
 * wikitext can come from another wiki (IIWiki, AltHistory), so this is a trust boundary: the article sanitizer
 * (`sanitize-html.ts`) with no `<style>`, then the forum Canvas pass (`stripPositioning`), so no style or class takes an
 * element out of the excerpt. `parseWikitextToPreviewHtml` (wikitext-preview.ts) compiles and sanitizes in one call.
 */
import type { Config } from "dompurify";
import { stripPositioning } from "~/lib/thinkpages-forum/strip-positioning";
import {
  createArticlePurifier,
  nestedTooDeepSource,
  WIKI_ARTICLE_SANITIZE_CONFIG,
} from "./sanitize-html";

/** The article config without any `<style>`: an excerpt has no TemplateStyles to keep. */
const WIKI_PREVIEW_SANITIZE_CONFIG: Config = {
  ...WIKI_ARTICLE_SANITIZE_CONFIG,
  FORBID_TAGS: [...(WIKI_ARTICLE_SANITIZE_CONFIG.FORBID_TAGS ?? []), "style"],
};

let purifier: ReturnType<typeof createArticlePurifier> | null = null;

/** Compiled wikitext for an excerpt, from any wiki (see the file header). */
export function sanitizeWikiPreviewHtml(html: string): string {
  if (!html) return "";
  purifier ??= createArticlePurifier();
  return stripPositioning(
    nestedTooDeepSource(html) ?? purifier.sanitize(html, WIKI_PREVIEW_SANITIZE_CONFIG)
  );
}
