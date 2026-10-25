/**
 * src/lib/wiki-os/services/inbound-stale-steps.ts — whether a quarantined log event has been overtaken (A5)
 *
 * The sync moves past a quarantined step and applies what classic MediaWiki did after it. A log event replayed after
 * that would undo it: a delete would archive a page classic brought back, a rights change would set the groups it had
 * then (`newgroups` is the whole list), an unblock would lift a later block. So a log event is retried only while
 * nothing later of its subject has been applied in WikiOS: no classic log event with a higher MediaWiki log id about
 * the same page (its title, or the article it names) or the same user, and, for a page, no classic revision saved after
 * it. A recent change is never stale: a revision older than WikiOS's head is filed as history (inbound-decision.ts).
 */

import { z } from "zod";
import { db } from "~/server/db";
import { canonicalizeTitle } from "~/lib/wiki-os/core/title";

const SOURCE = "ixwiki";
/** The origin of a revision the inbound sync or an import brought from classic MediaWiki. */
const CLASSIC_ORIGIN = "classic";
/** Log types about a user (their `title` is `User:Name`), not a page. */
const USER_EVENTS: ReadonlySet<string> = new Set(["block", "rights"]);

/** A log event as a dead letter keeps it: the shape `fetchLogEventsPage` reads. */
export const storedLogEvent = z.object({
  logid: z.number().int(),
  type: z.string(),
  action: z.string(),
  title: z.string(),
  user: z.string().nullable(),
  timestamp: z.string(),
  comment: z.string(),
  params: z.record(z.string(), z.json()),
  pageId: z.number().int().optional(),
});

export type StoredLogEvent = z.infer<typeof storedLogEvent>;

/** What a stale event is about, for the refusal's words. */
export type StaleSubject = "page" | "user";

/** The articles a page event is about: the one at its title, and the one MediaWiki's page id names (moved since). */
async function articlesOf(title: string, pageId: number | undefined): Promise<string[]> {
  const rows = await db.wikiArticle.findMany({
    where: {
      source: SOURCE,
      OR: [{ title }, ...(pageId ? [{ mwPageId: pageId }] : [])],
    },
    select: { id: true },
  });
  return rows.map((row) => row.id);
}

/** A classic revision of one of `articleIds` saved after `at`. */
async function classicRevisionAfter(articleIds: string[], at: Date): Promise<boolean> {
  if (articleIds.length === 0 || Number.isNaN(at.getTime())) return false;
  const later = await db.wikiRevision.findFirst({
    where: { articleId: { in: articleIds }, origin: CLASSIC_ORIGIN, createdAt: { gt: at } },
    select: { id: true },
  });
  return later !== null;
}

/**
 * Whether a later classic change of the event's subject has been applied, and so retrying it would undo that change:
 * "page" or "user" (what it is about), or null when the event can still be applied.
 */
export async function staleSubject(event: StoredLogEvent): Promise<StaleSubject | null> {
  const title = canonicalizeTitle(event.title)?.title ?? event.title;
  const subject: StaleSubject = USER_EVENTS.has(event.type) ? "user" : "page";
  const articleIds = subject === "page" ? await articlesOf(title, event.pageId) : [];
  const laterEvent = await db.wikiLog.findFirst({
    where: {
      mwLogId: { gt: event.logid },
      OR: [{ title }, ...(articleIds.length > 0 ? [{ articleId: { in: articleIds } }] : [])],
    },
    select: { id: true },
  });
  if (laterEvent) return subject;
  return (await classicRevisionAfter(articleIds, new Date(event.timestamp))) ? subject : null;
}

/** The refusal of a stale retry, in the words of what it is about. */
export function staleMessage(subject: StaleSubject): string {
  return `A later classic change of this ${subject} was applied; retrying would undo it. Dismiss it instead.`;
}
