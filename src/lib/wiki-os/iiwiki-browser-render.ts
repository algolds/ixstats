/**
 * iiwiki-browser-render.ts: an IIWiki page rendered from the reader's own browser.
 *
 * IIWiki sits behind a Cloudflare challenge that can refuse the server (sister-render-service.ts) while a reader's
 * browser passes. When the server cannot render an IIWiki page, the browser asks IIWiki's own parser for it
 * (`action=parse&page=`, an anonymous CORS GET) and the answer is transformed and sanitized exactly as the server's
 * would be. A fetch cannot solve a challenge, so a browser Cloudflare refuses gets an error here too.
 */
import { sanitizeWikiArticleHtml } from "~/lib/utils/sanitize-html";
import { sisterApiUrl } from "~/lib/wiki-os/config";
import {
  stripConflictingStyles,
  transformArticleHtml,
  type TocEntry,
} from "~/lib/wiki-os/transformers/html-transformer";

export interface BrowserRenderedArticle {
  title: string;
  contentHtml: string;
  infoboxHtml: string | null;
  noticesHtml: string | null;
  toc: TocEntry[];
}

interface ParseAnswer {
  parse?: { title?: string; text?: string };
  error?: { code?: string; info?: string };
}

const sanitizeOrNull = (html: string | null) => (html ? sanitizeWikiArticleHtml(html) : null);

/** `title` as IIWiki renders it, or null when IIWiki has no such page. Throws when IIWiki cannot be reached. */
export async function renderIiwikiInBrowser(
  title: string,
  signal?: AbortSignal
): Promise<BrowserRenderedArticle | null> {
  const query = new URLSearchParams({
    action: "parse",
    page: title,
    prop: "text",
    redirects: "1",
    disableeditsection: "1",
    disablelimitreport: "1",
    formatversion: "2",
    format: "json",
    origin: "*",
  });
  const response = await fetch(`${sisterApiUrl("iiwiki")}?${query}`, {
    credentials: "omit",
    signal,
  });
  if (!response.ok) throw new Error(`IIWiki answered ${response.status}`);

  const answer = (await response.json()) as ParseAnswer;
  if (answer.error?.code === "missingtitle") return null;
  const html = answer.parse?.text;
  if (!html) throw new Error(answer.error?.info ?? "IIWiki sent no page");

  const transformed = transformArticleHtml(stripConflictingStyles(html), "", "iiwiki");
  return {
    title: answer.parse?.title ?? title,
    contentHtml: sanitizeWikiArticleHtml(transformed.contentHtml),
    infoboxHtml: sanitizeOrNull(transformed.infoboxHtml),
    noticesHtml: sanitizeOrNull(transformed.noticesHtml),
    toc: transformed.toc,
  };
}
