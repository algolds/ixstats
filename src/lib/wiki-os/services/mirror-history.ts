/**
 * mirror-history.ts — what the outbound mirror reads of a page in classic MediaWiki: its current revision, a few pages
 * of its history, and its latest deletion. And how those read against WikiOS: which revisions are WikiOS's own (the
 * mirror account's, `wikios>` imports), which classic revisions WikiOS already has (stamped), where a batch's imports
 * landed, and whether a classic editor saved after a revision.
 */

import { z } from "zod";
import { db } from "~/server/db";
import { getMediaWikiAction } from "../adapters/mediawiki/write-service";
import { isMirrorAccount } from "../adapters/mediawiki/csrf-cache";
import { toXmlTimestamp } from "../xml/export-writer";
import { mwSha1Base36, sha1HexToBase36 } from "../xml/sha1";
import { labelOfImportName } from "./import-label";
import { fetchLogEventsPage, type LogEvent } from "./inbound-mediawiki";

/** Pages of the page's history read to find the revisions of a batch. */
const MAX_HISTORY_PAGES = 4;
/** Log entries read to find a title's latest deletion or move. */
const TITLE_LOG_LIMIT = "50";

const revisionsPageSchema = z.object({
  query: z.object({
    pages: z.array(
      z.looseObject({
        revisions: z
          .array(
            z.looseObject({
              revid: z.number(),
              sha1: z.string().optional(),
              timestamp: z.string().optional(),
              user: z.string().optional(),
            })
          )
          .optional(),
      })
    ),
  }),
  continue: z.looseObject({ rvcontinue: z.string().optional() }).optional(),
});

export interface CurrentRevision {
  revid: number;
  /** `rev_sha1` in MediaWiki's base 36; null when MediaWiki hides it. */
  sha1: string | null;
  /** Who made it; null when MediaWiki hides that. */
  user: string | null;
  /** When it was saved (MediaWiki's `rev_timestamp`). */
  timestamp: Date;
}

/** One revision of the page's history as MediaWiki lists it. */
export interface HistoryEntry {
  revid: number;
  /** In base 36; null when MediaWiki hides it. */
  sha1: string | null;
  /** As MediaWiki writes it, to the second ("2026-09-27T10:00:00Z"). */
  timestamp: string;
  user: string | null;
}

/** A WikiOS revision as an import carries it: what finds it again in the history. */
interface ImportedRevision {
  id: string;
  wikitext: string;
  createdAt: Date;
}

/** MediaWiki's current revision of `title`; null when the page does not exist there. */
export async function currentRevision(title: string): Promise<CurrentRevision | null> {
  const data = await getMediaWikiAction(
    {
      action: "query",
      prop: "revisions",
      titles: title,
      rvprop: "ids|sha1|timestamp|user",
      rvlimit: "1",
    },
    revisionsPageSchema
  );
  const revision = data.query.pages[0]?.revisions?.[0];
  if (!revision) return null;
  return {
    revid: revision.revid,
    sha1: revision.sha1 ? sha1HexToBase36(revision.sha1) : null,
    user: revision.user ?? null,
    // never missing in practice; if it were, the classic revision counts as saved now: it wins, nothing is lost
    timestamp: revision.timestamp ? new Date(revision.timestamp) : new Date(),
  };
}

/**
 * The page's history, oldest revision first (a few pages of it: the batch's revisions are among the newest).
 */
export async function recentHistory(title: string): Promise<HistoryEntry[]> {
  const history: HistoryEntry[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_HISTORY_PAGES; page++) {
    const data = await getMediaWikiAction(
      {
        action: "query",
        prop: "revisions",
        titles: title,
        rvprop: "ids|sha1|timestamp|user",
        rvlimit: "max",
        ...(cursor ? { rvcontinue: cursor } : {}),
      },
      revisionsPageSchema
    );
    for (const { revid, sha1, timestamp, user } of data.query.pages[0]?.revisions ?? []) {
      if (timestamp) {
        history.push({
          revid,
          sha1: sha1 ? sha1HexToBase36(sha1) : null,
          timestamp,
          user: user ?? null,
        });
      }
    }
    cursor = data.continue?.rvcontinue;
    if (!cursor) break;
  }
  return history.sort((a, b) => a.revid - b.revid);
}

/** MediaWiki's history order: by time, then by id. */
export function byTime(a: HistoryEntry, b: HistoryEntry): number {
  return a.timestamp === b.timestamp ? a.revid - b.revid : a.timestamp < b.timestamp ? -1 : 1;
}

/** A revision WikiOS wrote itself: by the mirror account, or imported under the `wikios>` prefix. */
export function isWikiosOwn(entry: Pick<HistoryEntry, "user">): boolean {
  return (
    isMirrorAccount(entry.user) || (entry.user !== null && labelOfImportName(entry.user) !== null)
  );
}

/**
 * The MediaWiki revision of each of `revisions` (oldest first), found by hash and timestamp in `history` (the first,
 * in import order, that nobody claimed yet, so identical revisions of one second are told apart); `except` is the
 * current revision, which the import's null revision may share a hash and a second with.
 */
export function findImported(
  history: readonly HistoryEntry[],
  revisions: readonly ImportedRevision[],
  except: number | null
): Map<string, number> {
  const pool = history.filter((entry) => entry.revid !== except && entry.sha1 !== null);
  const found = new Map<string, number>();
  for (const revision of revisions) {
    const sha1 = mwSha1Base36(revision.wikitext);
    const timestamp = toXmlTimestamp(revision.createdAt);
    const at = pool.findIndex((entry) => entry.sha1 === sha1 && entry.timestamp === timestamp);
    const [entry] = at === -1 ? [] : pool.splice(at, 1);
    if (entry) found.set(revision.id, entry.revid);
  }
  return found;
}

/**
 * The newest revision of `history` dated after `revision` (the same second counts: a tie goes to classic) that a
 * classic editor made; null when every one is WikiOS's own (the mirror's null revisions, its imports). The imports of
 * `batch` (the revisions sent with it, itself included) are not classic editors' revisions, whoever they are credited
 * to: a claimed name is a real MediaWiki account.
 */
export function laterClassicRevision(
  history: readonly HistoryEntry[],
  revision: ImportedRevision,
  batch: readonly ImportedRevision[]
): number | null {
  const second = toXmlTimestamp(revision.createdAt);
  const imports = new Set(findImported(history, batch, null).values());
  const later = history.filter(
    (entry) => entry.timestamp >= second && !imports.has(entry.revid) && !isWikiosOwn(entry)
  );
  return later.at(-1)?.revid ?? null;
}

/** The MediaWiki ids among `revids` that a revision of the article carries (WikiOS has that revision). */
export async function stampedIn(
  articleId: string,
  revids: readonly number[]
): Promise<Set<number>> {
  if (revids.length === 0) return new Set();
  const rows = await db.wikiRevision.findMany({
    where: { articleId, mwRevId: { in: [...revids] } },
    select: { mwRevId: true },
  });
  return new Set(rows.flatMap((row) => row.mwRevId ?? []));
}

const pageInfoSchema = z.object({
  query: z.object({
    pages: z.array(
      z.looseObject({
        title: z.string(),
        missing: z.boolean().optional(),
        redirect: z.boolean().optional(),
      })
    ),
  }),
});

/** A title as classic MediaWiki has it: the page's title, whether it exists, and whether it is a redirect. */
export interface ClassicPage {
  title: string;
  exists: boolean;
  redirect: boolean;
}

/**
 * The page `title` is in classic MediaWiki; with `followRedirects`, a redirect stands for the page it points to (so
 * `title` is the target's, and `exists` says whether the target is there).
 */
export async function classicPage(title: string, followRedirects: boolean): Promise<ClassicPage> {
  const data = await getMediaWikiAction(
    {
      action: "query",
      prop: "info",
      titles: title,
      ...(followRedirects ? { redirects: "1" } : {}),
    },
    pageInfoSchema
  );
  const page = data.query.pages[0];
  return {
    title: page?.title ?? title,
    exists: page?.missing !== true,
    redirect: page?.redirect === true,
  };
}

/** The title's `type` log entries in classic MediaWiki (a few of them), newest first. */
async function titleLog(title: string, type: "delete" | "move"): Promise<LogEvent[]> {
  const { entries } = await fetchLogEventsPage({
    letype: type,
    letitle: title,
    lelimit: TITLE_LOG_LIMIT,
  });
  return entries.filter((event) => event.type === type && event.title === title);
}

/**
 * The title's latest deletion in classic MediaWiki (its delete log, newest first); null when it was never deleted
 * there.
 */
export async function latestClassicDelete(title: string): Promise<LogEvent | null> {
  return (await titleLog(title, "delete")).find((event) => event.action === "delete") ?? null;
}

/**
 * The title's latest `type` log entry in classic MediaWiki when it is one of `actions` by a classic editor: null when
 * there is none, when the latest is another action (a restore after a delete), or when the mirror account made it
 * (WikiOS's own act, which WikiOS has).
 */
export async function latestClassicEvent(
  title: string,
  type: "delete" | "move",
  actions: ReadonlySet<string>
): Promise<LogEvent | null> {
  const [latest] = await titleLog(title, type);
  return latest && actions.has(latest.action) && !isMirrorAccount(latest.user) ? latest : null;
}
