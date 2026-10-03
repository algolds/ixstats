/**
 * parsoid.ts — WikiOS article HTML rendering and wikitext preview.
 *
 * Renders from PostgreSQL through the in-process wikitext compiler, falling back to
 * MediaWiki `action=parse` for the Main Page, cached HTML missing its infobox, and
 * previews (so templates, parser functions and Lua modules expand).
 */

import { ArticleRepository } from "~/lib/wiki-os/core/article-repository";
import { parseWikitextToHtml } from "~/lib/wiki-os/transformers/wikitext-parser";
import { DEFAULT_USER_AGENT, getMediaWikiApiUrl } from "~/lib/wiki-os/config";
import { saveArticleHtmlShadow } from "./article-store";

interface ParsoidArticle {
  /** Rendered HTML */
  html: string;
  /** Article title */
  title: string;
  /** Categories extracted from the page */
  categories: string[];
  /** Last modification timestamp */
  lastModified: string | null;
  /** Whether this is a redirect */
  isRedirect: boolean;
  /** Redirect target if applicable */
  redirectTarget: string | null;
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
    const common = {
      prop: "text",
      disablelimitreport: "1",
      disableeditsection: "1",
      formatversion: "2",
      format: "json",
    };
    let res: Response;
    if (wikitext && wikitext.trim() !== "") {
      res = await fetch(getMediaWikiApiUrl("ixwiki"), {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": DEFAULT_USER_AGENT,
          "Api-User-Agent": DEFAULT_USER_AGENT,
        },
        body: new URLSearchParams({
          ...common,
          action: "parse",
          text: wikitext,
          title,
          contentmodel: "wikitext",
        }).toString(),
        signal: AbortSignal.timeout(6000),
      });
    } else {
      const wikiUrl = process.env.NEXT_PUBLIC_MEDIAWIKI_URL || "https://ixwiki.com";
      const params = new URLSearchParams({
        ...common,
        action: "parse",
        page: title.replace(/ /g, "_"),
      });
      res = await fetch(`${wikiUrl.replace(/\/+$/, "")}/api.php?${params.toString()}`, {
        headers: { "User-Agent": DEFAULT_USER_AGENT },
        signal: AbortSignal.timeout(3500),
      });
    }
    if (!res.ok) return null;
    const data = (await res.json()) as { parse?: { text?: unknown } };
    const text = data?.parse?.text;
    return typeof text === "string" && text !== "" ? text : null;
  } catch {
    return null;
  }
}

/**
 * Fetch rendered HTML for an article directly from PostgreSQL / in-process wikitext compiler (<2ms).
 */
export async function getArticleHtml(title: string): Promise<ParsoidArticle> {
  const cleanTitle = decodeURIComponent(title).replace(/_/g, " ").trim();
  const isMainPage = cleanTitle.toLowerCase() === "main page";

  // If Main Page, fetch pre-rendered parse HTML for the rich featured portal layout
  if (isMainPage) {
    try {
      const wikiUrl = process.env.NEXT_PUBLIC_MEDIAWIKI_URL || "https://ixwiki.com";
      const apiEndpoint = `${wikiUrl.replace(/\/+$/, "")}/api.php`;
      const res = await fetch(`${apiEndpoint}?action=parse&page=Main_Page&prop=text&format=json`, {
        headers: { "User-Agent": "IxStats-Builder" },
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) {
        const data = (await res.json()) as any;
        const html = data?.parse?.text?.["*"] || data?.parse?.text;
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
    } catch {
      // Fall through to local parser
    }
  }

  const article = await ArticleRepository.findBySlug(cleanTitle, "ixwiki");

  if (article && (article.contentHtml || article.wikitext)) {
    let html = article.contentHtml && article.contentHtml.trim() !== "" ? article.contentHtml : "";

    // Detect corrupted wikitext remnants in cached HTML (e.g. leaked table pipes or dangling image parameters)
    const hasCorruptedMarkup =
      Boolean(html && (/\|\d+px\|/i.test(html) || /\|\s*(?:center|left|right|thumb)\]\]/i.test(html)));

    // If cached HTML doesn't have an infobox but wikitext does, fetch upstream MediaWiki parse
    const wikitextHasInfobox = article.wikitext && /\{\{[Ii]nfobox/i.test(article.wikitext);
    const htmlHasInfobox = html && !hasCorruptedMarkup && (html.includes("infobox") || html.includes("aside"));

    if ((!html || hasCorruptedMarkup || (wikitextHasInfobox && !htmlHasInfobox)) && !isMainPage) {
      const parsed = await renderArticleViaMediaWiki(article.wikitext, cleanTitle);
      if (parsed) {
        html = parsed;
        void saveArticleHtmlShadow(cleanTitle, html, "ixwiki", article.wikitext || undefined).catch(
          () => {}
        );
      }
    }

    if ((!html || hasCorruptedMarkup) && article.wikitext) {
      html = parseWikitextToHtml(article.wikitext, "ixwiki");
      void saveArticleHtmlShadow(cleanTitle, html, "ixwiki", article.wikitext).catch(() => {});
    }

    return {
      html: html || "",
      title: article.title,
      categories: [],
      lastModified: article.updatedAt ? article.updatedAt.toISOString() : null,
      isRedirect: Boolean(article.redirectTargetSlug),
      redirectTarget: article.redirectTargetSlug ?? null,
    };
  }

  throw new Error(`Article "${title}" not found`);
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
    const mwApi = getMediaWikiApiUrl("ixwiki");
    const body = new URLSearchParams({
      action: "parse",
      text: wikitext,
      title: cleanTitle,
      contentmodel: "wikitext",
      prop: "text",
      pst: "1",
      disablelimitreport: "1",
      disableeditsection: "1",
      formatversion: "2",
      format: "json",
    });
    const res = await fetch(mwApi, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": DEFAULT_USER_AGENT,
        "Api-User-Agent": DEFAULT_USER_AGENT,
      },
      body: body.toString(),
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const data = (await res.json()) as { parse?: { text?: string } };
      if (data?.parse?.text) {
        return data.parse.text;
      }
    }
  } catch {
    // Network unavailable or offline: fall back to local in-process compiler
  }

  return parseWikitextToHtml(wikitext, "ixwiki");
}

