/**
 * The conflict rule's reads for page operations (moves, deletes, undeletes), shared by the inbound cycle (a classic
 * event against WikiOS) and the outbound mirror (a WikiOS operation's job against classic), so both judge the same
 * changes and name them the same: one conflict key, one row.
 *
 * WikiOS's moves are read from its own move log (`wiki_logs` rows with no MediaWiki log id, whose params carry the
 * titles), or from their mirror jobs while MediaWiki has not had them.
 */
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "~/server/db";
import { canonicalizeTitle } from "../core/title";
import { decideCollision, type CollisionVerdict, type PageChange } from "./conflict-rule";
import { conflictWonBy } from "./conflict-log";
import {
  authorOfWikiosRevision,
  classicChangeOfEvent,
  operationChanges,
  wikiosChangesAgainstDelete,
} from "./conflict-sides";
import type { LogEvent } from "./inbound-mediawiki";
import { movePayloadSchema } from "./mirror-outbox";

const SOURCE = "ixwiki";

/** A WikiOS move: the change, the moved article, and the titles it went from and to. */
export interface WikiosMove {
  change: PageChange;
  articleId: string;
  from: string;
  to: string;
}

// --- classic events -------------------------------------------------------------------------------------------------

/** The delete-log actions that remove a page (a delete, and a redirect deleted by a move over it). */
export const CLASSIC_DELETE_ACTIONS: ReadonlySet<string> = new Set([
  "delete",
  "delete_redir",
  "delete_redir2",
]);
/** The move-log actions that move a page (onto a free title, or over a redirect). */
export const CLASSIC_MOVE_ACTIONS: ReadonlySet<string> = new Set(["move", "move_redir"]);

/** Whether WikiOS has applied the classic log event (its `wiki_logs` row carries the MediaWiki log id). */
export async function classicEventApplied(logid: number): Promise<boolean> {
  const row = await db.wikiLog.findUnique({ where: { mwLogId: logid }, select: { id: true } });
  return row !== null;
}

/** The canonical title a classic move went to; null when MediaWiki's `target_title` is absent or not a title. */
export function classicMoveTarget(event: LogEvent): string | null {
  const raw = event.params.target_title;
  return typeof raw === "string" ? (canonicalizeTitle(raw)?.title ?? null) : null;
}

// --- WikiOS's moves -------------------------------------------------------------------------------------------------

const moveLogParamsSchema = z.looseObject({ oldTitle: z.string(), newTitle: z.string() });

/** WikiOS's own move log entries matching `where`, oldest first, as moves (an entry without its titles is left out). */
async function movesOfLogs(where: Prisma.WikiLogWhereInput): Promise<WikiosMove[]> {
  const logs = await db.wikiLog.findMany({
    where: { logType: "move", action: "move", mwLogId: null, ...where },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      userId: true,
      actorName: true,
      createdAt: true,
      articleId: true,
      params: true,
    },
  });
  const moves: WikiosMove[] = [];
  for (const log of logs) {
    const titles = moveLogParamsSchema.safeParse(log.params);
    if (!titles.success || !log.articleId) continue;
    const author = await authorOfWikiosRevision({ authorId: log.userId, author: log.actorName });
    moves.push({
      change: { side: "wikios", action: "move", ref: `log:${log.id}`, at: log.createdAt, author },
      articleId: log.articleId,
      from: titles.data.oldTitle,
      to: titles.data.newTitle,
    });
  }
  return moves;
}

/** WikiOS's moves of the article logged at `since` or later, oldest first (a move and the ones that built on it). */
export function wikiosMovesSince(articleId: string, since: Date): Promise<WikiosMove[]> {
  return movesOfLogs({ articleId, createdAt: { gte: since } });
}

/**
 * The changes a WikiOS move stands with: the move, and the moves of the same article logged after it (a chain A→B→D
 * goes with its first move), oldest first. A move that loses takes them all with it.
 */
export async function moveChain(
  move: Pick<WikiosMove, "change" | "articleId">
): Promise<PageChange[]> {
  const later = await wikiosMovesSince(move.articleId, move.change.at);
  return [
    move.change,
    ...later.map((each) => each.change).filter((change) => change.ref !== move.change.ref),
  ];
}

/** The newest WikiOS move away from `title` whose mirror job is still owed; null when there is none. */
export async function unsentWikiosMove(title: string): Promise<WikiosMove | null> {
  const moves = await operationChanges({ source: SOURCE, kind: "move", title });
  for (const { job, change } of moves.reverse()) {
    const payload = movePayloadSchema.safeParse(job.payload);
    if (payload.success && job.articleId) {
      return { change, articleId: job.articleId, from: title, to: payload.data.to };
    }
  }
  return null;
}

/**
 * The WikiOS move away from `title` that a classic event logged at `event` lost to, as the mirror recorded it (the job
 * is done, nothing was sent); null when the mirror recorded no such loss.
 */
async function moveThatLostTo(title: string, event: LogEvent): Promise<WikiosMove | null> {
  // a row won by a classic log entry: classic won it
  const row = await conflictWonBy(`mwlog:${event.logid}`);
  if (!row) return null;
  const ids = row.overwritten.flatMap((change) =>
    change.side === "wikios" && change.action === "move" ? [change.ref.replace(/^log:/, "")] : []
  );
  if (ids.length === 0) return null;
  const moves = await movesOfLogs({ id: { in: ids } });
  return moves.find((move) => move.from === title) ?? null;
}

/** The newest WikiOS move away from `title` logged in the event's second or later: MediaWiki had not had it then. */
async function moveLoggedSince(title: string, event: LogEvent): Promise<WikiosMove | null> {
  const second = new Date(Math.floor(new Date(event.timestamp).getTime() / 1000) * 1000);
  const moves = await movesOfLogs({ createdAt: { gte: second } });
  return moves.filter((move) => move.from === title).at(-1) ?? null;
}

/**
 * The WikiOS move away from `title` that a classic event on that title (a move, a delete) meets: one MediaWiki has not
 * had (its job owed), one the mirror held back because the event beat it, or one sent after the event happened. Each
 * is a move the classic editor never saw. Null when there is none.
 */
export async function contestingWikiosMove(
  title: string,
  event: LogEvent
): Promise<WikiosMove | null> {
  return (
    (await unsentWikiosMove(title)) ??
    (await moveThatLostTo(title, event)) ??
    (await moveLoggedSince(title, event))
  );
}

/** A WikiOS article classic has at a title WikiOS does not, and the WikiOS changes that put it elsewhere. */
export interface HeldElsewhere {
  articleId: string;
  /** WikiOS's changes classic had not had when the event happened (its moves away, oldest first). */
  changes: PageChange[];
}

/**
 * The WikiOS article classic has at `title` though WikiOS has it elsewhere, for a classic event there (a delete): the one
 * the mirror already judged that event against (its row), or the one a classic move took to `title` whose WikiOS move
 * away beat it and is still owed to MediaWiki. Null when classic has no such page there.
 */
export async function articleClassicHasAt(
  title: string,
  event: LogEvent
): Promise<HeldElsewhere | null> {
  const ruled = await conflictWonBy(`mwlog:${event.logid}`);
  if (ruled?.articleId) {
    const changes = ruled.overwritten.filter((change) => change.side === "wikios");
    return { articleId: ruled.articleId, changes };
  }
  const moved = await db.wikiLog.findFirst({
    where: {
      logType: "move",
      mwLogId: { not: null },
      articleId: { not: null },
      params: { path: ["target_title"], equals: title },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { articleId: true },
  });
  if (!moved?.articleId) return null;
  const owed = await operationChanges({ articleId: moved.articleId, kind: "move" });
  const changes = owed.map(({ change }) => change);
  return changes.length > 0 ? { articleId: moved.articleId, changes } : null;
}

/**
 * The rule's verdict on a classic delete against what the deleter never saw of the article in WikiOS
 * (`wikiosChangesAgainstDelete`, plus `also`: a WikiOS change the caller knows the delete met, such as a move already
 * sent); the newest of them stands. Null when they never met.
 */
export async function judgeClassicDelete(
  articleId: string,
  event: LogEvent,
  also: readonly PageChange[] = []
): Promise<CollisionVerdict | null> {
  const found = await wikiosChangesAgainstDelete(articleId, new Date(event.timestamp));
  // a change in both lists is one change: the rule lists a ref once
  const against = [...found, ...also].sort((a, b) => a.at.getTime() - b.at.getTime());
  const standing = against.at(-1);
  if (!standing) return null;
  const incoming = await classicChangeOfEvent(event, "delete");
  return decideCollision(SOURCE, articleId, {
    incoming,
    standing,
    incomingBranch: [incoming],
    standingBranch: against,
  });
}
