import "server-only";

import { cookies, headers } from "next/headers";
import { hasClerkSessionCookie } from "~/lib/wiki-os/chrome-prefs";
import { articleHtmlInput } from "~/lib/wiki-os/config";
import { leanFlightEnabled, leanMarker, stashLeanArticle } from "~/lib/wiki-os/lean-article";
import { replacePrefetched } from "~/trpc/server";
import type { ArticleHtml } from "./load-article";

/** An article smaller than this (in characters of HTML) is not worth a marker. */
const LEAN_MIN_CHARS = 20_000;

/** A page load of a reader with no Clerk session: not a client navigation (its flight fetch has no DOM to read back). */
async function isAnonymousDocumentRequest(): Promise<boolean> {
  const requestHeaders = await headers();
  if (requestHeaders.get("rsc") || requestHeaders.get("next-router-prefetch")) return false;
  if (!/\btext\/html\b/i.test(requestHeaders.get("accept") ?? "")) return false;
  return !hasClerkSessionCookie((await cookies()).getAll());
}

/**
 * In lean mode (see lib/wiki-os/lean-article.ts) swaps the article's HTML in this request's
 * hydration state for markers, so the page does not carry the article a second time. The SSR render
 * still gets the real HTML, from the process-wide stash. A no-op unless the mode is on, the request
 * is an anonymous page load, and the article is a fresh, large one.
 */
export async function leanTheFlight(
  title: string,
  followRedirect: boolean,
  data: ArticleHtml
): Promise<void> {
  const size = data.contentHtml.length + (data.infoboxHtml?.length ?? 0);
  if (!leanFlightEnabled() || data.stale || size < LEAN_MIN_CHARS) return;
  if (!(await isAnonymousDocumentRequest())) return;

  const token = stashLeanArticle({
    body: data.contentHtml,
    infobox: data.infoboxHtml,
    notices: data.noticesHtml,
  });
  replacePrefetched<ArticleHtml>(
    ["wikios", "getArticleHtml"],
    articleHtmlInput(title, "ixwiki", { followRedirect }),
    (current) => ({
      ...current,
      contentHtml: leanMarker(token, "body"),
      infoboxHtml: current.infoboxHtml === null ? null : leanMarker(token, "infobox"),
      noticesHtml: current.noticesHtml === null ? null : leanMarker(token, "notices"),
    })
  );
}
