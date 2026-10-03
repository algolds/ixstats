/**
 * parsoid.ts — WikiOS article HTML rendering and wikitext preview.
 *
 * Renders from PostgreSQL through the in-process wikitext compiler, falling back to
 * MediaWiki `action=parse` for the Main Page, cached HTML missing its infobox, and
 * previews (so templates, parser functions and Lua modules expand).
 */

import { ArticleRepository } from "~/lib/wiki-os/core/article-repository";
import type { WikiArticleEntity } from "~/lib/wiki-os/core/domain-types";
import { parseWikitextToHtml } from "~/lib/wiki-os/transformers/wikitext-parser";
import {
  DEFAULT_MEDIAWIKI_URL,
  DEFAULT_USER_AGENT,
  getMediaWikiApiUrl,
} from "~/lib/wiki-os/config";
import { saveArticleHtmlShadow } from "./article-store";

interface ParsoidArticle {
  html: string;
  title: string;
  categories: string[];
  lastModified: string | null;
  isRedirect: boolean;
  redirectTarget: string | null;
}

const PARSE_COMMON = {
  prop: "text",
  disablelimitreport: "1",
  disableeditsection: "1",
  formatversion: "2",
  format: "json",
};

/** POST an `action=parse` request with the given params to the WikiOS MediaWiki API. */
function postParse(params: Record<string, string>, timeoutMs: number): Promise<Response> {
  return fetch(getMediaWikiApiUrl("ixwiki"), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": DEFAULT_USER_AGENT,
      "Api-User-Agent": DEFAULT_USER_AGENT,
    },
    body: new URLSearchParams({ ...PARSE_COMMON, action: "parse", ...params }).toString(),
    signal: AbortSignal.timeout(timeoutMs),
  });
}

/** GET `action=parse` for a page name on the public wiki. */
function getParse(params: Record<string, string>, timeoutMs: number): Promise<Response> {
  const query = new URLSearchParams({ action: "parse", ...params });
  return fetch(`${DEFAULT_MEDIAWIKI_URL.replace(/\/+$/, "")}/api.php?${query}`, {
    headers: { "User-Agent": DEFAULT_USER_AGENT },
    signal: AbortSignal.timeout(timeoutMs),
  });
}

/**
 * Render an article through MediaWiki `action=parse` so templates, parser functions and Lua expand.
 *
 * When the Postgres wikitext is at hand it is what gets rendered (`text=` with the title as context).
 * `page=` reads MediaWiki's own copy of the page, which is the pre-edit version until the background
 * export lands (or forever under SKIP_MEDIAWIKI_SYNC), so it is only the fallback for HTML-only rows.
 * Returns null when MediaWiki is unreachable or returns nothing.
 */
export async function renderArticleViaMediaWiki(
  wikitext: string | null | undefined,
  title: string
): Promise<string | null> {
  try {
    const res =
      wikitext && wikitext.trim() !== ""
        ? await postParse({ text: wikitext, title, contentmodel: "wikitext" }, 6000)
        : await getParse({ ...PARSE_COMMON, page: title.replace(/ /g, "_") }, 3500);
    if (!res.ok) return null;
    const data = (await res.json()) as { parse?: { text?: unknown } };
    const text = data?.parse?.text;
    return typeof text === "string" && text !== "" ? text : null;
  } catch {
    return null;
  }
}

/** The MediaWiki-rendered Main Page, whose featured portal layout the local compiler cannot match. */
async function fetchMainPageHtml(): Promise<string | null> {
  try {
    const res = await getParse({ page: "Main_Page", prop: "text", format: "json" }, 6000);
    if (!res.ok) return null;
    const data = (await res.json()) as { parse?: { text?: string | { "*"?: string } } };
    const text = data?.parse?.text;
    return (typeof text === "string" ? text : text?.["*"]) || null;
  } catch {
    return null;
  }
}

const hasCorruptedMarkup = (html: string): boolean =>
  /\|\d+px\|/i.test(html) || /\|\s*(?:center|left|right|thumb)\]\]/i.test(html);

/** Cached HTML, re-rendered upstream or locally when it is missing, corrupted or lacks an infobox. */
async function resolveArticleHtml(
  article: WikiArticleEntity,
  cleanTitle: string,
  isMainPage: boolean
): Promise<string> {
  let html = article.contentHtml && article.contentHtml.trim() !== "" ? article.contentHtml : "";
  // Cached HTML can hold leaked wikitext (table pipes, dangling image parameters)
  const corrupted = html !== "" && hasCorruptedMarkup(html);

  const wikitextHasInfobox = article.wikitext && /\{\{[Ii]nfobox/i.test(article.wikitext);
  const htmlHasInfobox = html && !corrupted && (html.includes("infobox") || html.includes("aside"));

  if ((!html || corrupted || (wikitextHasInfobox && !htmlHasInfobox)) && !isMainPage) {
    const parsed = await renderArticleViaMediaWiki(article.wikitext, cleanTitle);
    if (parsed) {
      html = parsed;
      void saveArticleHtmlShadow(cleanTitle, html, "ixwiki", article.wikitext || undefined).catch(
        () => {}
      );
    }
  }

  if ((!html || corrupted) && article.wikitext) {
    html = parseWikitextToHtml(article.wikitext, "ixwiki");
    void saveArticleHtmlShadow(cleanTitle, html, "ixwiki", article.wikitext).catch(() => {});
  }

  return html;
}

/** Fetch rendered HTML for an article from PostgreSQL / the in-process wikitext compiler. */
export async function getArticleHtml(title: string): Promise<ParsoidArticle> {
  const cleanTitle = decodeURIComponent(title).replace(/_/g, " ").trim();
  const isMainPage = cleanTitle.toLowerCase() === "main page";

  if (isMainPage) {
    const html = await fetchMainPageHtml();
    if (html) {
      return {
        html,
        title: "Main Page",
        categories: [],
        lastModified: new Date().toISOString(),
        isRedirect: false,
        redirectTarget: null,
      };
    }
  }

  const article = await ArticleRepository.findBySlug(cleanTitle, "ixwiki");
  if (!article || !(article.contentHtml || article.wikitext)) {
    throw new Error(`Article "${title}" not found`);
  }

  return {
    html: await resolveArticleHtml(article, cleanTitle, isMainPage),
    title: article.title,
    categories: [],
    lastModified: article.updatedAt ? article.updatedAt.toISOString() : null,
    isRedirect: Boolean(article.redirectTargetSlug),
    redirectTarget: article.redirectTargetSlug ?? null,
  };
}

/**
 * Convert wikitext to HTML with 100% MediaWiki compliancy.
 * Queries MediaWiki Action API action=parse to expand all templates, parser functions (#if, #switch),
 * Lua Scribunto modules, and wikitables. Falls back gracefully to native AST compiler.
 */
export async function wikitextToHtml(wikitext: string, title = "Preview"): Promise<string> {
  if (!wikitext || !wikitext.trim()) return "";
  const cleanTitle = title.replace(/^Template:/i, "").trim() || "Preview";

  try {
    const res = await postParse(
      { text: wikitext, title: cleanTitle, contentmodel: "wikitext", pst: "1" },
      8000
    );
    if (res.ok) {
      const data = (await res.json()) as { parse?: { text?: string } };
      if (data?.parse?.text) return data.parse.text;
    }
  } catch {
    // Network unavailable or offline: fall back to local in-process compiler
  }

  return parseWikitextToHtml(wikitext, "ixwiki");
}
