/**
 * The article columns that follow its head revision: the text the page renders from (render-service.ts reads the
 * article's own `wikitext`), and what is derived from it (excerpt, word count, redirect, lead image).
 *
 * The inbound sync derives them for a revision it imports as the head; `repointArticleHead` puts them back on the
 * newest live revision when the revision they came from stops being the head (overwritten, so parked), so a page never
 * shows or renders a loser's text.
 */
import type { Prisma } from "@prisma/client";
import { parseRedirect } from "./redirect";
import { extractLeadImagePath } from "../transformers/image-url";
import { cleanWikitextExcerpt } from "../transformers/wikitext-parser";

const SUMMARY_COLUMN_LIMIT = 480;
/** The excerpt is the lead of the article: cleaning more than this is wasted work on a 2 MB page. */
const EXCERPT_SOURCE_LENGTH = 20_000;

/** The columns derived from a head's wikitext, exactly as a save or an import derives them. */
export function headFieldsOf(wikitext: string) {
  const words = wikitext.split(/\s+/).filter(Boolean).length;
  const redirect = parseRedirect(wikitext);
  return {
    wikitext,
    summary:
      cleanWikitextExcerpt(wikitext.slice(0, EXCERPT_SOURCE_LENGTH), 300).slice(
        0,
        SUMMARY_COLUMN_LIMIT
      ) || null,
    wordCount: words,
    readingTime: Math.max(1, Math.ceil(words / 200)),
    redirectTargetSlug: redirect?.title ?? null,
    redirectTargetFragment: redirect?.fragment ?? null,
    leadImageUrl: extractLeadImagePath(wikitext),
  };
}

/**
 * Point the article's head columns at its newest live (not parked) revision whose text is not hidden, marking its view stale, when they hold
 * other text. True when they changed; a page with no live revision keeps what it has.
 */
export async function repointArticleHead(
  client: Prisma.TransactionClient,
  articleId: string
): Promise<boolean> {
  const head = await client.wikiRevision.findFirst({
    // a hidden revision's text is "" by convention, never the page's
    where: { articleId, parked: false, textDeleted: false },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { wikitext: true },
  });
  if (!head) return false;
  const stale = await client.wikiArticle.count({
    where: { id: articleId, wikitext: { not: head.wikitext } },
  });
  if (stale === 0) return false;
  await client.wikiArticle.update({
    where: { id: articleId },
    data: { ...headFieldsOf(head.wikitext), htmlSyncedAt: null },
  });
  return true;
}
