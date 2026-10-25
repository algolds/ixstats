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
import { classicChangeOfEntry, withTrail } from "./mirror-collision";
import {
  byTime,
  classicPage,
  isWikiosOwn,
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
  /** A move: the title classic has the page at now (where a classic move WikiOS's later move won over took it). */
  from: string;
  /** A move: the page is deleted in classic, and WikiOS's later move brings it back first. */
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
 * A delete against the classic revisions WikiOS has not had (a classic editor's, not stamped on any revision of the
 * article). The first one saved after the delete (or in its second) brought the page back, as the cycle judges it: it
 * wins, and nothing is sent. With none after it, the delete wins over all of them, and their authors are told.
 */
async function ruleDelete(judged: JudgedJob): Promise<Outcome> {
  const { job, articleId, change } = judged;
  const history = [...(await recentHistory(job.title))].sort(byTime);
  const stamped = await stampedIn(
    articleId,
    history.map((entry) => entry.revid)
  );
  const unseen = await Promise.all(
    history
      .filter((entry) => !isWikiosOwn(entry) && !stamped.has(entry.revid))
      .map(classicChangeOfEntry)
  );
  const newest = unseen.at(-1);
  if (!newest) return asIs(job);
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
  await record(judged, verdict, job.title);
  return verdict.incomingWins ? asIs(job) : lost(verdict.winner);
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
 * A move against the page's latest classic move it never saw, to another title: a later classic move wins, and the move
 * (with the moves built on it) is not sent; an earlier one loses, and classic's page moves from where classic put it.
 * Otherwise (no such move, or one WikiOS had before its own) the page may be deleted in classic (`ruleMoveOfDeleted`).
 */
async function ruleMove(judged: JudgedJob): Promise<Outcome> {
  const { job, articleId, change } = judged;
  const { to } = movePayloadSchema.parse(job.payload);
  const moved = await latestClassicEvent(job.title, "move", CLASSIC_MOVE_ACTIONS);
  const target = moved ? classicMoveTarget(moved) : null;
  // a classic move to the same title is the same move: MediaWiki answers that it is done
  if (moved && target && target !== to) {
    const standing = await classicChangeOfEvent(moved, "move");
    const winner = await winnerAgainst(
      judged,
      moved,
      (verdict) => (verdict.winner.side === "classic" ? target : to),
      async () =>
        decideCollision(MIRROR_SOURCE, articleId, {
          incoming: change,
          standing,
          incomingBranch: await moveChain({ change, articleId }),
          standingBranch: [standing],
        })
    );
    if (winner)
      return winner.side === "classic" ? lost(winner) : { from: target, undeleteFirst: false };
  }
  return ruleMoveOfDeleted(judged);
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
