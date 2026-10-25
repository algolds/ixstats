/**
 * The two sides of a collision, as the conflict machinery names and reaches them: which wiki a side is, the author
 * WikiOS's own conflict writes go under, the classic user talk page an overwritten author is told on, and the readers
 * that turn each side's saves into the rule's `PageChange`s (heads, branches, authors, effective times).
 *
 * The article repository imports the names from here; the readers reach only the database and the name claims, never
 * the repository or the sync, so that import stays free of cycles.
 */
import { isIP } from "node:net";
import type { Prisma } from "@prisma/client";
import { db } from "~/server/db";
import { namesOfUsers, ownerOfName, type ClaimedName } from "~/lib/identity/wiki-names";
import { toRevisionRef } from "../core/domain-types";
import type {
  ChangeAction,
  ChangeAuthor,
  CollisionVerdict,
  NoticeRecipient,
  PageChange,
  WikiSide,
} from "./conflict-rule";
import type { LogEvent, MediaWikiRevision } from "./inbound-mediawiki";
import { movePayloadSchema } from "./mirror-outbox";

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

// --- refs as people read them ----------------------------------------------------------------------------------------

/** A ref that names a WikiOS revision by its row id (not a MediaWiki id, not a log entry). */
function isRowRef(ref: string): boolean {
  return !/^\d+$/.test(ref) && !ref.includes(":");
}

/**
 * Each ref as people read it in a trail or a talk note: a WikiOS revision MediaWiki has is named by its MediaWiki id
 * ("revision 1234"), never its row id; anything else stays as it is. The conflict log keeps the row ids.
 */
export async function shownRefs(refs: readonly string[]): Promise<string[]> {
  const ids = refs.filter(isRowRef);
  const rows =
    ids.length > 0
      ? await db.wikiRevision.findMany({
          where: { id: { in: ids } },
          select: { id: true, mwRevId: true },
        })
      : [];
  const byId = new Map(rows.flatMap((row) => (row.mwRevId ? [[row.id, String(row.mwRevId)]] : [])));
  return refs.map((ref) => byId.get(ref) ?? ref);
}

/** The verdict with its overwritten changes named as people read them (see `shownRefs`), for a trail. */
export async function verdictAsShown(verdict: CollisionVerdict): Promise<CollisionVerdict> {
  const refs = await shownRefs(verdict.overwritten.map((change) => change.ref));
  return {
    ...verdict,
    overwritten: verdict.overwritten.map((change, at) => ({
      ...change,
      ref: refs[at] ?? change.ref,
    })),
  };
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

/** A classic user as an author: their classic name (or address) and the account holding that name's approved claim. */
async function classicAuthor(user: string | null): Promise<ChangeAuthor> {
  const ip = user !== null && isIP(user) !== 0 ? user : null;
  const name = ip ? null : user;
  return {
    userId: name ? await ownerOfName(db, SOURCE, name) : null,
    classicName: name,
    ip,
    label: null,
  };
}

/**
 * A classic revision as a change: at its save time, or at `effectiveAt` (a restore that brought it back counts when it
 * happened).
 */
export async function classicChangeOfRevision(
  rev: Pick<MediaWikiRevision, "revid" | "timestamp" | "user">,
  effectiveAt?: Date
): Promise<PageChange> {
  return {
    side: "classic",
    action: "edit",
    ref: String(rev.revid),
    at: effectiveAt ?? rev.timestamp,
    author: await classicAuthor(rev.user),
  };
}

/** A classic log event (a delete, move or restore) as a change: `action`, at the moment MediaWiki logged it. */
export async function classicChangeOfEvent(
  event: LogEvent,
  action: ChangeAction
): Promise<PageChange> {
  return {
    side: "classic",
    action,
    ref: `mwlog:${event.logid}`,
    at: new Date(event.timestamp),
    author: await classicAuthor(event.user),
  };
}

// --- WikiOS's side --------------------------------------------------------------------------------------------------

const LIVE_REVISION_SELECT = {
  id: true,
  mwRevId: true,
  authorId: true,
  author: true,
  createdAt: true,
  origin: true,
} as const;

interface LiveRevision extends AuthoredRow {
  id: string;
  mwRevId: number | null;
  createdAt: Date;
  /** "wikios" for a WikiOS save, "classic" for a MediaWiki revision brought in. */
  origin: string;
}

/**
 * A revision's ref as the conflict log names it. A WikiOS save keeps its row id for good: the mirror stamps it with a
 * MediaWiki id later, and the mirror and the inbound cycle must name it the same before and after (one conflict key).
 * A classic revision is named by its MediaWiki id, as classic's side names it.
 */
function conflictRefOf(row: Pick<LiveRevision, "id" | "mwRevId" | "origin">): string {
  return row.origin === "classic" ? toRevisionRef(row) : row.id;
}

function editOf(row: LiveRevision, author: ChangeAuthor, at = row.createdAt): PageChange {
  return { side: "wikios", action: "edit", ref: conflictRefOf(row), at, author };
}

/** A WikiOS revision as a change, at its commit time. */
export async function wikiosEditOf(row: LiveRevision): Promise<PageChange> {
  return editOf(row, await authorOfWikiosRevision(row));
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

// --- what MediaWiki has not seen yet ----------------------------------------------------------------------------------

/**
 * A page operation's mirror job that MediaWiki may not have had yet: queued, being sent, or dead (still owed: only an
 * administrator's discard gives it up).
 */
const UNSENT_JOB_STATES = ["pending", "running", "dead"];

const OPERATION_ACTIONS: Readonly<Record<string, ChangeAction>> = {
  move: "move",
  delete: "delete",
  undelete: "undelete",
};

interface OperationJob {
  kind: string;
  logId: string | null;
  articleId: string | null;
  payload: Prisma.JsonValue;
  createdAt: Date;
}

/** Each unsent operation job with its change: at its log row's time (the job's own, if the row is gone), by its actor. */
async function operationChanges(
  where: Prisma.WikiMirrorJobWhereInput
): Promise<Array<{ job: OperationJob; change: PageChange }>> {
  const jobs = await db.wikiMirrorJob.findMany({
    where: {
      kind: { in: Object.keys(OPERATION_ACTIONS) },
      state: { in: UNSENT_JOB_STATES },
      logId: { not: null },
      ...where,
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { kind: true, logId: true, articleId: true, payload: true, createdAt: true },
  });
  if (jobs.length === 0) return [];
  const logs = await db.wikiLog.findMany({
    where: { id: { in: jobs.flatMap((job) => (job.logId ? [job.logId] : [])) } },
    select: { id: true, userId: true, actorName: true, createdAt: true },
  });
  const byId = new Map(logs.map((log) => [log.id, log]));
  const names = await shownNames(logs.map((log) => ({ authorId: log.userId, author: null })));
  return jobs.flatMap((job) => {
    const action = OPERATION_ACTIONS[job.kind];
    if (!action) return [];
    const log = byId.get(job.logId ?? "");
    const row = { authorId: log?.userId ?? null, author: log?.actorName ?? null };
    const change: PageChange = {
      side: "wikios",
      action,
      ref: `log:${job.logId}`,
      at: log?.createdAt ?? job.createdAt,
      author: authorFrom(row, names),
    };
    return [{ job, change }];
  });
}

/**
 * What WikiOS changed on the page that MediaWiki has not seen yet, oldest first: its live revisions with no MediaWiki
 * id (a baseline row holds classic's own text and is not one), and its moves, deletes and undeletes whose mirror jobs are
 * still owed, at the time each was logged.
 */
export async function unmirroredWikiosChanges(articleId: string): Promise<PageChange[]> {
  const rows = await db.wikiRevision.findMany({
    where: { articleId, parked: false, mwRevId: null, origin: { not: "classic" } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: LIVE_REVISION_SELECT,
  });
  const names = await shownNames(rows);
  const edits = rows.map((row) => editOf(row, authorFrom(row, names)));
  const operations = (await operationChanges({ articleId })).map(({ change }) => change);
  return [...edits, ...operations].sort((a, b) => a.at.getTime() - b.at.getTime());
}

/** A WikiOS move of `title` that MediaWiki has not had yet: the change, the moved article and where WikiOS put it. */
export interface UnsentWikiosMove {
  change: PageChange;
  articleId: string;
  to: string;
}

/** The newest WikiOS move away from `title` whose mirror job is still owed; null when there is none. */
export async function unsentWikiosMove(title: string): Promise<UnsentWikiosMove | null> {
  const moves = await operationChanges({ source: SOURCE, kind: "move", title });
  for (const { job, change } of moves.reverse()) {
    const payload = movePayloadSchema.safeParse(job.payload);
    if (payload.success && job.articleId) {
      return { change, articleId: job.articleId, to: payload.data.to };
    }
  }
  return null;
}
