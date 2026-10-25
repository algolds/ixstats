/**
 * The two sides of a collision, as the conflict machinery names and reaches them: which wiki a side is, the author
 * WikiOS's own conflict writes go under, the classic user talk page an overwritten author is told on, and the readers
 * that turn each side's saves into the rule's `PageChange`s (heads, branches, authors, effective times).
 *
 * The article repository imports the names from here; the readers reach only the database and the name claims, never
 * the repository or the sync, so that import stays free of cycles.
 */
import { isIP } from "node:net";
import { db } from "~/server/db";
import { namesOfUsers, ownerOfName, type ClaimedName } from "~/lib/identity/wiki-names";
import { toRevisionRef } from "../core/domain-types";
import type { ChangeAuthor, NoticeRecipient, PageChange, WikiSide } from "./conflict-rule";
import type { MediaWikiRevision } from "./inbound-mediawiki";

const SOURCE = "ixwiki";

/** The author of WikiOS's own conflict writes (talk notes, trail edits); MediaWiki shows it as `wikios>WikiOS`. */
export const CONFLICT_NOTICE_AUTHOR = "WikiOS";

/** The wiki a side's save was made on, as the notices name it. */
export function wikiName(side: WikiSide): string {
  return side === "wikios" ? "WikiOS" : "classic MediaWiki";
}

/** The classic user talk page a recipient is told on: their classic name's, else their address's; null for neither. */
export function talkPageTitle(
  recipient: Pick<NoticeRecipient, "classicName" | "ip">
): string | null {
  const name = recipient.classicName ?? recipient.ip;
  return name ? `User talk:${name}` : null;
}

// --- authors --------------------------------------------------------------------------------------------------------

interface AuthoredRow {
  authorId: string | null;
  author: string | null;
}

/** The first name each account shows, for the accounts behind `rows`. */
async function shownNames(rows: readonly AuthoredRow[]): Promise<Map<string, ClaimedName[]>> {
  const ids = rows.flatMap((row) => (row.authorId ? [row.authorId] : []));
  return namesOfUsers(db, ids, { shown: true });
}

function authorFrom(row: AuthoredRow, names: Map<string, ClaimedName[]>): ChangeAuthor {
  return {
    userId: row.authorId,
    classicName: (row.authorId && names.get(row.authorId)?.[0]?.name) || null,
    ip: null,
    label: row.author,
  };
}

/** A WikiOS save's author: the account, the classic name it shows (its claim), and the label the save went under. */
export async function authorOfWikiosRevision(row: AuthoredRow): Promise<ChangeAuthor> {
  return authorFrom(row, await shownNames([row]));
}

/**
 * A classic revision as a change: at its save time, or at `effectiveAt` (a restore that brought it back counts when it
 * happened). Its editor is their classic name (or address) and the account holding that name's approved claim.
 */
export async function classicChangeOfRevision(
  rev: MediaWikiRevision,
  effectiveAt?: Date
): Promise<PageChange> {
  const ip = rev.user !== null && isIP(rev.user) !== 0 ? rev.user : null;
  const name = ip ? null : rev.user;
  return {
    side: "classic",
    action: "edit",
    ref: String(rev.revid),
    at: effectiveAt ?? rev.timestamp,
    author: {
      userId: name ? await ownerOfName(db, SOURCE, name) : null,
      classicName: name,
      ip,
      label: null,
    },
  };
}

// --- WikiOS's side --------------------------------------------------------------------------------------------------

const LIVE_REVISION_SELECT = {
  id: true,
  mwRevId: true,
  authorId: true,
  author: true,
  createdAt: true,
} as const;

interface LiveRevision extends AuthoredRow {
  id: string;
  mwRevId: number | null;
  createdAt: Date;
}

function editOf(row: LiveRevision, author: ChangeAuthor, at = row.createdAt): PageChange {
  return { side: "wikios", action: "edit", ref: toRevisionRef(row), at, author };
}

/** When the page last came back from a deletion, if it ever did. */
async function lastUndeleteAt(articleId: string): Promise<Date | null> {
  const log = await db.wikiLog.findFirst({
    where: { articleId, logType: "delete", action: "restore" },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { createdAt: true },
  });
  return log?.createdAt ?? null;
}

/**
 * WikiOS's head (its newest live revision) as a change, counting at the later of its commit and the page's last
 * undelete: a restore counts when it happened. Null for a page with no revision.
 */
export async function wikiosHead(articleId: string): Promise<PageChange | null> {
  const head = await db.wikiRevision.findFirst({
    where: { articleId, parked: false },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: LIVE_REVISION_SELECT,
  });
  if (!head) return null;
  const undeleted = await lastUndeleteAt(articleId);
  const at = undeleted && undeleted > head.createdAt ? undeleted : head.createdAt;
  return editOf(head, await authorOfWikiosRevision(head), at);
}

/** The live revision a classic edit started from: the one stamped with its parent, else the newest with its text. */
async function findBase(articleId: string, parentRevId: number, parentSha1: string | null) {
  const select = { createdAt: true } as const;
  const byId =
    parentRevId > 0
      ? await db.wikiRevision.findFirst({
          where: { articleId, parked: false, mwRevId: parentRevId },
          select,
        })
      : null;
  if (byId || !parentSha1) return byId;
  return db.wikiRevision.findFirst({
    where: { articleId, parked: false, sha1: parentSha1 },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select,
  });
}

/**
 * WikiOS's changes since the base a classic edit started from (MediaWiki revision `parentRevId`, with text hash
 * `parentSha1` when known): its live revisions after that base, oldest first. With no base found, the live revisions
 * MediaWiki has never seen (no MediaWiki id).
 */
export async function wikiosBranchSince(
  articleId: string,
  parentRevId: number,
  parentSha1: string | null
): Promise<PageChange[]> {
  const base = await findBase(articleId, parentRevId, parentSha1);
  const rows = await db.wikiRevision.findMany({
    where: {
      articleId,
      parked: false,
      ...(base ? { createdAt: { gt: base.createdAt } } : { mwRevId: null }),
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: LIVE_REVISION_SELECT,
  });
  const names = await shownNames(rows);
  return rows.map((row) => editOf(row, authorFrom(row, names)));
}

/**
 * The delete that took the page out of WikiOS (a page WikiOS deleted stands on it), as a change at the delete's time.
 * Null when WikiOS itself never deleted it (a delete brought in from classic stands on classic's side).
 */
export async function wikiosDeletion(articleId: string): Promise<PageChange | null> {
  const log = await db.wikiLog.findFirst({
    where: { articleId, logType: "delete", action: "delete", mwLogId: null },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { id: true, userId: true, actorName: true, createdAt: true },
  });
  if (!log) return null;
  return {
    side: "wikios",
    action: "delete",
    ref: `log:${log.id}`,
    at: log.createdAt,
    author: await authorOfWikiosRevision({ authorId: log.userId, author: log.actorName }),
  };
}
