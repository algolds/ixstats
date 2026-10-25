/**
 * mirror-collision.ts — the conflict rule (conflict-rule.ts) for a batch of `revision` mirror jobs, before anything is
 * sent. The batch's newest revision meets what classic MediaWiki has: its current revision, when a classic editor made
 * it and WikiOS has not seen it (behind the mirror's own revisions, the newest classic one), or the page's deletion when
 * it is gone. The later save wins, by when each was saved on its own wiki (a tie goes to classic), however late the job
 * runs. Every collision is one row of the conflict log, whichever of the mirror and the inbound cycle sees it first.
 *
 * A winner carries the trail in its summary (written in the database, so the XML has it). A batch that lost to an edit
 * is imported as history only (mirror-revision.ts); one that lost to a delete is parked and sends nothing, so classic
 * stays deleted.
 */
import { db } from "~/server/db";
import { repointArticleHead } from "../core/article-head";
import {
  conflictKey,
  decideCollision,
  trailSummary,
  type CollisionVerdict,
  type PageChange,
} from "./conflict-rule";
import {
  parkRevisions,
  recordConflict,
  setTrailRevision,
  toConflictEntry,
  verdictOfEntry,
  type ConflictRow,
} from "./conflict-log";
import {
  classicChangeOfEvent,
  classicChangeOfRevision,
  isSystemWrite,
  wikiosBranchSince,
  wikiosEditOf,
} from "./conflict-sides";
import {
  byTime,
  currentRevision,
  isWikiosOwn,
  latestClassicDelete,
  recentHistory,
  stampedIn,
  type HistoryEntry,
} from "./mirror-history";
import { MIRROR_SOURCE } from "./mirror-outbox";
import type { MirroredRevision, RevisionBatchPlan } from "./mirror-revision";

/** What the conflict rule made of a batch against classic MediaWiki (see `checkCollision`). */
export interface BatchCollision {
  verdict: CollisionVerdict;
  conflictId: string;
  /** The batch's newest revision won: it goes out with its trail. False: the batch lost. */
  wikiosWon: boolean;
}

/** The most of an edit summary MediaWiki keeps, in characters (its comment store cuts the rest). */
const COMMENT_LIMIT = 500;
/** Between a summary and the trail appended to it. */
const TRAIL_SEPARATOR = "; ";
/** A trail as `trailSummary` writes it, at the end of a summary. */
const TRAIL_AT_END = /(?:^|; )Overwrote .+ \(conflict [A-Za-z0-9]+\)$/s;

/** `summary` with `trail` at its end, the summary cut so MediaWiki keeps the whole trail. */
function withTrail(summary: string | null, trail: string): string {
  const own = summary?.trim();
  if (!own) return trail;
  const room = COMMENT_LIMIT - trail.length - TRAIL_SEPARATOR.length;
  return room > 0 ? `${own.slice(0, room)}${TRAIL_SEPARATOR}${trail}` : trail;
}

/** A summary without the trail `withTrail` put at its end. */
export function withoutTrail(summary: string): string {
  return summary.replace(TRAIL_AT_END, "");
}

/** A classic revision as a change, at its save time. */
function classicChange(entry: { revid: number; user: string | null; timestamp: string | Date }) {
  return classicChangeOfRevision({
    revid: entry.revid,
    user: entry.user,
    timestamp: new Date(entry.timestamp),
  });
}

/**
 * The classic side of a collision: the revisions classic editors made since the newest one WikiOS has (the base), and
 * that base. With no base in the history read, none.
 */
async function classicSince(
  title: string,
  articleId: string
): Promise<{ base: HistoryEntry | null; branch: HistoryEntry[] }> {
  const history = [...(await recentHistory(title))].sort(byTime);
  const stamped = await stampedIn(
    articleId,
    history.map((entry) => entry.revid)
  );
  const baseAt = history.reduce((at, entry, index) => (stamped.has(entry.revid) ? index : at), -1);
  if (baseAt === -1) return { base: null, branch: [] };
  // nothing after the base is stamped: the base is the newest revision WikiOS has
  const branch = history.slice(baseAt + 1).filter((entry) => !isWikiosOwn(entry));
  return { base: history[baseAt] ?? null, branch };
}

/**
 * The verdict when nothing but system writes (`isSystemWrite`) meets a classic delete: the delete stands over them,
 * whenever they were written, as no person's save is lost. Nobody is told; the row keeps the record.
 */
function deleteOverSystemWrites(
  articleId: string,
  removal: PageChange,
  writes: readonly PageChange[]
): CollisionVerdict {
  return {
    winner: removal,
    overwritten: writes,
    incomingWins: false,
    key: conflictKey(MIRROR_SOURCE, articleId, removal.ref),
  };
}

/**
 * The page is gone from classic: its latest deletion, when one is logged, meets the batch (the WikiOS saves MediaWiki
 * has not had, up to `newest`), recorded in the conflict log like any collision. A delete saved after the newest
 * person's save (or in its second) wins: every unsent revision is parked, in one transaction with the row, and nothing
 * is sent, so classic stays deleted. An earlier delete loses: the revisions bring the page back, as MediaWiki's import
 * does, and the deleter is told. A system write never keeps the page alive. Null when the page was never deleted there.
 */
async function judgeDeletion(
  title: string,
  articleId: string,
  newest: PageChange
): Promise<BatchCollision | null> {
  const removal = await latestClassicDelete(title);
  if (!removal) return null;
  const standing = await classicChangeOfEvent(removal, "delete");
  const unseen = (await wikiosBranchSince(articleId, 0, null)).filter(
    (change) => change.at <= newest.at
  );
  const people = unseen.filter((change) => !isSystemWrite(change.author));
  const incoming = people.at(-1);
  const verdict = incoming
    ? decideCollision(MIRROR_SOURCE, articleId, {
        incoming,
        standing,
        incomingBranch: people,
        standingBranch: [standing],
      })
    : deleteOverSystemWrites(articleId, standing, unseen);
  const input = { source: MIRROR_SOURCE, articleId, title, verdict, baseRef: null };
  const id = await db.$transaction(async (tx) => {
    const recorded = await recordConflict(tx, input);
    if (!verdict.incomingWins) {
      // the system writes go with the people's saves the delete overwrote: sent, they would bring the page back
      await parkRevisions(tx, articleId, unseen, standing.ref);
      // the page never shows a parked loser's text
      await repointArticleHead(tx, articleId);
    }
    return recorded.id;
  });
  return { verdict, conflictId: id, wikiosWon: verdict.incomingWins };
}

/**
 * The rule's verdict on `revision` (the batch's newest) against what classic has, recorded in the conflict log. Null
 * when there is nothing to judge: classic's current revision is one WikiOS has (the inbound sync brought it over and
 * judged it then), or no classic editor saved since WikiOS's last revision there (only the mirror's own revisions
 * follow it).
 */
async function judgeAgainstClassic(
  title: string,
  articleId: string,
  revision: MirroredRevision
): Promise<BatchCollision | null> {
  const incoming = await wikiosEditOf(revision);
  const current = await currentRevision(title);
  if (!current) return judgeDeletion(title, articleId, incoming);
  if ((await stampedIn(articleId, [current.revid])).size > 0) return null;

  const { base, branch } = await classicSince(title, articleId);
  // behind the mirror's own revisions (an import's null revision), the newest a classic editor made
  const standing = isWikiosOwn(current) ? branch.at(-1) : current;
  if (!standing) return null;
  const wikiosBranch = await wikiosBranchSince(articleId, base?.revid ?? 0, base?.sha1 ?? null);
  const verdict = decideCollision(MIRROR_SOURCE, articleId, {
    incoming,
    standing: await classicChange(standing),
    // what WikiOS changed since the base up to this revision; anything later is judged with its own batch
    incomingBranch: wikiosBranch.filter((change) => change.at <= incoming.at),
    standingBranch: await Promise.all(branch.map(classicChange)),
  });
  const { id } = await recordConflict(db, {
    source: MIRROR_SOURCE,
    articleId,
    title,
    verdict,
    baseRef: base ? String(base.revid) : null,
  });
  return { verdict, conflictId: id, wikiosWon: verdict.incomingWins };
}

/** Puts the trail of `row` (a collision `revision` won) in the revision's summary, once: true for the one that does. */
async function writeTrail(row: ConflictRow, revision: MirroredRevision): Promise<boolean> {
  // what a WikiOS winner overwrote is classic's: its refs are MediaWiki ids already
  const trail = trailSummary(verdictOfEntry(toConflictEntry(row)), row.id);
  return db.$transaction(async (tx) => {
    if (!(await setTrailRevision(tx, row.id, revision.id))) return false;
    await tx.wikiRevision.update({
      where: { id: revision.id },
      data: { summary: withTrail(revision.summary, trail) },
    });
    return true;
  });
}

/**
 * The collisions a revision of the batch won that have no trail yet (judged here, or by the inbound cycle before the
 * job ran): each winner's summary gets its trail, exactly once. The last one written, or null for none.
 */
async function writeTrails(
  articleId: string,
  revisions: readonly MirroredRevision[]
): Promise<BatchCollision | null> {
  const byId = new Map(revisions.map((revision) => [revision.id, revision]));
  const rows = await db.wikiConflict.findMany({
    where: {
      articleId,
      winnerSide: "wikios",
      winnerRef: { in: [...byId.keys()] },
      trailRevisionId: null,
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  let written: BatchCollision | null = null;
  for (const row of rows) {
    const revision = byId.get(row.winnerRef);
    if (revision && (await writeTrail(row, revision))) {
      written = {
        verdict: verdictOfEntry(toConflictEntry(row)),
        conflictId: row.id,
        wikiosWon: true,
      };
    }
  }
  return written;
}

/**
 * Ask the conflict rule about a planned batch before it is sent: its newest revision against what classic has (see
 * `judgeAgainstClassic`). `wikiosWon` false means the batch lost: history only after an edit, nothing sent after a
 * delete. Every collision a revision of the batch won, here or one the inbound cycle judged before the job ran, has its
 * trail written into that revision's summary in the database, once. The caller plans the batch again whenever this
 * resolves to a collision, so the XML carries the trails and leaves the parked revisions out. Null when there is
 * nothing to judge and no trail to write.
 */
export async function checkCollision(plan: RevisionBatchPlan): Promise<BatchCollision | null> {
  const sent = plan.members.flatMap((member) => (member.send ? [member] : []));
  const newest = sent.at(-1);
  const articleId = newest?.job.articleId;
  if (!newest || !articleId) return null;
  const judged = await judgeAgainstClassic(plan.title, articleId, newest.revision);
  // a revision of a batch that lost can have won an earlier collision: its history line names that one
  const trailed = await writeTrails(
    articleId,
    sent.map((member) => member.revision)
  );
  return judged ?? trailed;
}
