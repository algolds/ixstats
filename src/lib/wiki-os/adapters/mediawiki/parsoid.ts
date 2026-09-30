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
 * Render an article's Postgres wikitext through MediaWiki `action=parse` (`text=`, with the title as
 * context) so templates, parser functions and Lua expand. MediaWiki's own copy of the page is never
 * read: it is the pre-edit version until the background export lands (or forever under
 * SKIP_MEDIAWIKI_SYNC). `wikitext` must not be blank (the render service never sends a blank page).
 * Returns null when MediaWiki is unreachable or returns nothing.
 */
export async function renderArticleViaMediaWiki(
  wikitext: string,
  title: string
): Promise<string | null> {
  try {
    const res = await fetch(getMediaWikiApiUrl("ixwiki"), {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": DEFAULT_USER_AGENT,
        "Api-User-Agent": DEFAULT_USER_AGENT,
      },
      body: new URLSearchParams({
        action: "parse",
        text: wikitext,
        title,
        contentmodel: "wikitext",
        prop: "text",
        disablelimitreport: "1",
        disableeditsection: "1",
        formatversion: "2",
        format: "json",
      }).toString(),
      signal: AbortSignal.timeout(6000),
    });
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

