/**
 * mirror-page-rule.ts — the conflict rule (conflict-rule.ts) for a WikiOS move, delete or undelete before its mirror job
 * sends anything. The operation meets the classic changes it never saw: the classic revisions a delete would remove,
 * the classic move of the page a move would undo, the classic delete an undelete (or a move) would reverse. The later
 * change wins, by when each happened on its own wiki (a tie goes to classic), however late the job runs, and every
 * collision is one row of the conflict log, whichever of the mirror and the inbound cycle sees it first.
 *
 * An operation that lost sends nothing: its job is done with a note. One the cycle already judged follows that row. One
 * that won goes out with the trail of its collision in its reason (and in its WikiOS log entry), except a delete, which
 * leaves no page to carry it. A move that won over an earlier classic move moves classic's page from where classic has
 * it; one that won over an earlier classic delete brings the page back first.
 */
import { db } from "~/server/db";
import {
  decideCollision,
  trailSummary,
  type ChangeAction,
  type CollisionVerdict,
  type PageChange,
  type WikiSide,
} from "./conflict-rule";
import {
  conflictsOfArticle,
  recordConflict,
  setTrailRevision,
  toConflictEntry,
  verdictOfEntry,
  type ConflictLogEntry,
} from "./conflict-log";
import {
  CLASSIC_DELETE_ACTIONS,
  CLASSIC_MOVE_ACTIONS,
  classicEventApplied,
  classicMoveTarget,
  judgeClassicDelete,
  moveChain,
} from "./conflict-page-ops";
import { changeOfOperationJob, classicChangeOfEvent, verdictAsShown } from "./conflict-sides";
import type { LogEvent } from "./inbound-mediawiki";
import { findClassicPage } from "./mirror-classic-location";
import { classicChangeOfEntry, withTrail } from "./mirror-collision";
import {
  byTime,
  classicPage,
  isClassicEdit,
  latestClassicDelete,
  latestClassicEvent,
  recentHistory,
  stampedIn,
} from "./mirror-history";
import { MIRROR_SOURCE, movePayloadSchema } from "./mirror-outbox";
import type { MirrorJob } from "./mirror-queue";

/** What the rule lets a page job do. */
export interface PageRuling {
  /** The operation lost to a later classic change: the job's note, and nothing is sent. Null: it goes out. */
  lost: string | null;
  /** The reason to send: WikiOS's, with the trail of the collision the operation won. */
  reason: string;
  /**
   * The title classic has the page at now: for a move, where a classic move WikiOS's later move won over took it; for a
   * delete, where an earlier classic move took it.
   */
  from: string;
  /** A move: the page is deleted in classic (at `from`), and WikiOS's later move brings it back first. */
  undeleteFirst: boolean;
}

/** A job's operation as the rule reads it, with the conflict log's rows of its article. */
interface JudgedJob {
  job: MirrorJob;
  articleId: string;
  change: PageChange;
  rows: readonly ConflictLogEntry[];
}

type Outcome = { lost: string } | { from: string; undeleteFirst: boolean };

/** A winner as a row or a verdict names it. */
type Winner = { side: WikiSide; action: ChangeAction };

/** How a job's note names the classic change its operation lost to. */
const LOST_TO: Readonly<Record<ChangeAction, string>> = {
  edit: "edit",
  delete: "delete",
  move: "move",
  undelete: "restore",
};

function lost(winner: Winner): Outcome {
  return { lost: `Lost to a later ${LOST_TO[winner.action]} in MediaWiki` };
}

function asIs(job: MirrorJob): Outcome {
  return { from: job.title, undeleteFirst: false };
}

function overwrites(row: ConflictLogEntry, ref: string): boolean {
  return row.overwritten.some((change) => change.ref === ref);
}

async function record(judged: JudgedJob, verdict: CollisionVerdict, title: string): Promise<void> {
  await recordConflict(db, {
    source: MIRROR_SOURCE,
    articleId: judged.articleId,
    title,
    verdict,
    baseRef: null,
  });
}

/**
 * Who won between the job's operation and the classic log event `event`: a WikiOS change that already beat it (the
 * cycle judged them), else null when WikiOS had the event before (nothing to judge), else what `judge` decides, recorded
 * under `titleOf(verdict)`. A verdict of null (the two never met) is null too.
 */
async function winnerAgainst(
  judged: JudgedJob,
  event: LogEvent,
  titleOf: (verdict: CollisionVerdict) => string,
  judge: () => Promise<CollisionVerdict | null>
): Promise<Winner | null> {
  const ref = `mwlog:${event.logid}`;
  const beaten = judged.rows.find((row) => row.winner.side === "wikios" && overwrites(row, ref));
  if (beaten) return beaten.winner;
  if (await classicEventApplied(event.logid)) return null;
  const verdict = await judge();
  if (!verdict) return null;
  await record(judged, verdict, titleOf(verdict));
  return verdict.winner;
}

/**
 * A delete of the page at `title` against the classic revisions WikiOS has not had there (a classic editor's edits, not
 * stamped on any revision of the article; a move's or a protection's null revision is no edit). The first one saved
 * after the delete (or in its second) brought the page back, as the cycle judges it: it wins, and nothing is sent. With
 * none after it, the delete wins over all of them, and their authors are told.
 */
async function ruleDeleteOverEdits(judged: JudgedJob, title: string): Promise<Outcome> {
  const { articleId, change } = judged;
  const sendHere: Outcome = { from: title, undeleteFirst: false };
  const history = [...(await recentHistory(title))].sort(byTime);
  const stamped = await stampedIn(
    articleId,
    history.map((entry) => entry.revid)
  );
  const unseen = await Promise.all(
    history
      .filter((entry) => isClassicEdit(entry, history) && !stamped.has(entry.revid))
      .map(classicChangeOfEntry)
  );
  const newest = unseen.at(-1);
  if (!newest) return sendHere;
  const against = (standing: PageChange, branch: readonly PageChange[]) =>
    decideCollision(MIRROR_SOURCE, articleId, {
      incoming: change,
      standing,
      incomingBranch: [change],
      standingBranch: branch,
    });
  const verdict =
    unseen.map((edit) => against(edit, [edit])).find((each) => !each.incomingWins) ??
    against(newest, unseen);
  await record(judged, verdict, title);
  return verdict.incomingWins ? sendHere : lost(verdict.winner);
}

/** Classic's latest move of `title` (by a classic editor) to a title other than `except`, and where it went. */
async function classicMoveOf(
  title: string,
  except: string | null
): Promise<{ moved: LogEvent; target: string } | null> {
  const moved = await latestClassicEvent(title, "move", CLASSIC_MOVE_ACTIONS);
  const target = moved ? classicMoveTarget(moved) : null;
  return moved && target && target !== except ? { moved, target } : null;
}

/** Who won between the job's operation (with `branch`, the WikiOS changes that go with it) and classic's move `moved`. */
async function winnerAgainstMove(
  judged: JudgedJob,
  moved: LogEvent,
  branch: readonly PageChange[],
  titleOf: (verdict: CollisionVerdict) => string
): Promise<Winner | null> {
  const standing = await classicChangeOfEvent(moved, "move");
  return winnerAgainst(judged, moved, titleOf, async () =>
    decideCollision(MIRROR_SOURCE, judged.articleId, {
      incoming: judged.change,
      standing,
      incomingBranch: branch,
      standingBranch: [standing],
    })
  );
}

/**
 * A delete. Against classic's move of the page it never saw first: a later move wins (the page lives on where classic
 * moved it, and nothing is sent); an earlier one loses, and the delete follows the page to where classic has it. Then
 * against the classic edits there (`ruleDeleteOverEdits`).
 */
async function ruleDelete(judged: JudgedJob): Promise<Outcome> {
  const { job } = judged;
  const classic = await classicMoveOf(job.title, null);
  const winner = classic
    ? await winnerAgainstMove(judged, classic.moved, [judged.change], (verdict) =>
        verdict.winner.side === "classic" ? classic.target : job.title
      )
    : null;
  if (!classic || !winner) return ruleDeleteOverEdits(judged, job.title);
  if (winner.side === "classic") return lost(winner);
  // where classic has the page now (gone from classic as well: nothing to delete there, and MediaWiki says so)
  const location = await findClassicPage(classic.target, classic.moved.pageId ?? null);
  return ruleDeleteOverEdits(judged, location.title);
}

/** An undelete against the page's latest classic delete it never saw: a later delete keeps the page deleted. */
async function ruleUndelete(judged: JudgedJob): Promise<Outcome> {
  const { job, articleId } = judged;
  const removal = await latestClassicEvent(job.title, "delete", CLASSIC_DELETE_ACTIONS);
  const winner = removal
    ? await winnerAgainst(
        judged,
        removal,
        () => job.title,
        () => judgeClassicDelete(articleId, removal)
      )
    : null;
  return winner?.side === "classic" ? lost(winner) : asIs(job);
}

/**
 * A move of a page classic has deleted, against that delete (the move and the moves built on it are among what the
 * deleter never saw): a later delete keeps it deleted; an earlier one loses, and the page comes back before it moves.
 */
async function ruleMoveOfDeleted(judged: JudgedJob): Promise<Outcome> {
  const { job, articleId } = judged;
  if ((await classicPage(job.title, false)).exists) return asIs(job);
  const removal = await latestClassicEvent(job.title, "delete", CLASSIC_DELETE_ACTIONS);
  if (!removal) return asIs(job);
  const winner = await winnerAgainst(
    judged,
    removal,
    () => job.title,
    () => judgeClassicDelete(articleId, removal)
  );
  if (winner?.side === "classic") return lost(winner);
  return { from: job.title, undeleteFirst: winner !== null };
}

/**
 * WikiOS's move won over classic's earlier move of the page: it moves classic's page (the one the move log names) from
 * where classic has it now. A retry finds it moved already. Classic deleted the page there since: that delete is judged
 * (a later one wins, and nothing is sent; an earlier one loses, and the page comes back before it moves).
 */
async function followMovedPage(
  judged: JudgedJob,
  classic: { moved: LogEvent; target: string },
  to: string
): Promise<Outcome> {
  const pageId = classic.moved.pageId ?? null;
  const location = await findClassicPage(classic.target, pageId);
  if (location.found) return { from: location.title, undeleteFirst: false };
  const there = await classicPage(to, true);
  if (there.exists && (pageId === null || there.pageId === pageId)) {
    return { from: to, undeleteFirst: false };
  }
  const removal = await latestClassicDelete(location.title);
  if (!removal) throw new Error(`Classic MediaWiki has the page of "${judged.job.title}" nowhere`);
  const winner = await winnerAgainst(
    judged,
    removal,
    () => location.title,
    () => judgeClassicDelete(judged.articleId, removal)
  );
  if (winner?.side === "classic") return lost(winner);
  return { from: location.title, undeleteFirst: true };
}

/**
 * A move against the page's latest classic move it never saw, to another title: a later classic move wins, and the move
 * (with the moves built on it) is not sent; an earlier one loses, and classic's page moves from where classic put it
 * (`followMovedPage`). Otherwise (no such move, or one WikiOS had before its own) the page may be deleted in classic
 * (`ruleMoveOfDeleted`).
 */
async function ruleMove(judged: JudgedJob): Promise<Outcome> {
  const { job, articleId, change } = judged;
  const { to } = movePayloadSchema.parse(job.payload);
  // a classic move to the same title is the same move: MediaWiki answers that it is done
  const classic = await classicMoveOf(job.title, to);
  const winner = classic
    ? await winnerAgainstMove(
        judged,
        classic.moved,
        await moveChain({ change, articleId }),
        (verdict) => (verdict.winner.side === "classic" ? classic.target : to)
      )
    : null;
  if (!classic || !winner) return ruleMoveOfDeleted(judged);
  return winner.side === "classic" ? lost(winner) : followMovedPage(judged, classic, to);
}

const RULES: Readonly<Partial<Record<string, (judged: JudgedJob) => Promise<Outcome>>>> = {
  move: ruleMove,
  delete: ruleDelete,
  undelete: ruleUndelete,
};

/** Claims the trail for the operation's log entry and writes it into the entry's comment: once, whoever asks again. */
async function writeLogTrail(
  conflictId: string,
  change: PageChange,
  logId: string | null,
  trail: string
): Promise<void> {
  await db.$transaction(async (tx) => {
    if (!(await setTrailRevision(tx, conflictId, change.ref)) || !logId) return;
    const log = await tx.wikiLog.findUnique({ where: { id: logId }, select: { comment: true } });
    if (log) {
      await tx.wikiLog.update({
        where: { id: logId },
        data: { comment: withTrail(log.comment, trail) },
      });
    }
  });
}

/**
 * `reason` with the trail of the collision the operation won, written into its WikiOS log entry too (once; a retry
 * sends it again). A delete leaves no page to carry a trail, and gets none.
 */
async function reasonWithTrail(judged: JudgedJob, reason: string): Promise<string> {
  const { change, job } = judged;
  if (change.action === "delete") return reason;
  const row = await db.wikiConflict.findFirst({
    where: { articleId: judged.articleId, winnerRef: change.ref, legacyPark: false },
  });
  // the trail is claimed under the operation's own ref: a retry finds it claimed, and sends it again
  if (!row) return reason;
  const trail = trailSummary(await verdictAsShown(verdictOfEntry(toConflictEntry(row))), row.id);
  await writeLogTrail(row.id, change, job.logId, trail);
  return withTrail(reason, trail);
}

/**
 * The conflict rule's ruling on a move, delete or undelete job (`reason` is the operation's own), before it sends
 * anything. An operation a classic change already beat (a row lists it overwritten) is not sent; otherwise it meets
 * what classic changed and WikiOS never saw (see the rules above). Any other job goes as it is.
 */
export async function rulePageJob(job: MirrorJob, reason: string): Promise<PageRuling> {
  const sendAsIs: PageRuling = { lost: null, reason, from: job.title, undeleteFirst: false };
  const rule = RULES[job.kind];
  const change = rule ? await changeOfOperationJob(job) : null;
  if (!rule || !change || !job.articleId) return sendAsIs;
  const judged = {
    job,
    articleId: job.articleId,
    change,
    rows: await conflictsOfArticle(job.articleId),
  };
  const beaten = judged.rows.find(
    (row) => row.winner.side === "classic" && overwrites(row, change.ref)
  );
  const outcome = beaten ? lost(beaten.winner) : await rule(judged);
  if ("lost" in outcome) return { ...sendAsIs, lost: outcome.lost };
  return { lost: null, reason: await reasonWithTrail(judged, reason), ...outcome };
}
