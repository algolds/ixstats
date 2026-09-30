/**
 * parsoid.ts — the MediaWiki `action=parse` calls WikiOS makes.
 *
 * `renderArticleViaMediaWiki` is the render service's engine call (MediaWiki as a private renderer of
 * Postgres wikitext); `wikitextToHtml` renders editor previews, falling back to the in-process
 * wikitext compiler when MediaWiki is unreachable.
 */

import { parseWikitextToHtml } from "~/lib/wiki-os/transformers/wikitext-parser";
import { DEFAULT_USER_AGENT, getMediaWikiApiUrl } from "~/lib/wiki-os/config";

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

