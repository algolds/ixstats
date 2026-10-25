/**
 * What the handlers of MediaWiki log events (inbound-log-events.ts, inbound-page-moves.ts) share: the event as a handler
 * gets it, what a handler decides, and the conflict rule (conflict-rule.ts) for a classic event against what WikiOS
 * changed and MediaWiki has not seen yet: the later change wins whatever its kind, and the loser is recorded in the
 * conflict log (whose settling tells its author).
 */
import type { Prisma } from "@prisma/client";
import {
  decideCollision,
  type ChangeAction,
  type CollisionVerdict,
  type PageChange,
} from "./conflict-rule";
import { recordConflict } from "./conflict-log";
import { classicChangeOfEvent } from "./conflict-sides";
import type { LogEvent } from "./inbound-mediawiki";
import type { CanonicalTitle } from "../core/title";

export const SOURCE = "ixwiki";

/** applied: acted on and logged; ignored: not ours to act on; skipped: could not be applied, and never will be. */
export type LogOutcome = "applied" | "ignored" | "skipped";

export type Tx = Prisma.TransactionClient;

/** One log event with its page, and who did it. */
export interface EventContext {
  event: LogEvent;
  /** The page (or `User:` page) the event is about, canonical; null when the title is not one. */
  canon: CanonicalTitle | null;
  /** The account holding the approved claim of the acting MediaWiki name, if anyone. */
  actorUserId: string | null;
}

/** What a handler decided: its outcome, and what to do once the transaction has committed. */
export interface Applied {
  outcome: LogOutcome;
  /** The article the event is about (its log row points at it). */
  articleId?: string | null;
  afterCommit?: () => Promise<void>;
}

export const IGNORED: Applied = { outcome: "ignored" };
export const SKIPPED: Applied = { outcome: "skipped" };

/**
 * Loaded on demand: page-management-service reaches the article view cache, which imports this sync, so
 * a static import would be a cycle at load time.
 */
export const pageManagement = () => import("../core/page-management-service");

/** A page as a verdict is recorded against it. */
export interface JudgedPage {
  id: string;
  title: string;
}

/** The rule's verdict on the classic event against WikiOS's `standing` change, `standingBranch` its changes since. */
export async function collide(
  event: LogEvent,
  action: ChangeAction,
  articleId: string,
  standing: PageChange,
  standingBranch: readonly PageChange[]
): Promise<CollisionVerdict> {
  const incoming = await classicChangeOfEvent(event, action);
  return decideCollision(SOURCE, articleId, {
    incoming,
    standing,
    incomingBranch: [incoming],
    standingBranch,
  });
}

/** The verdict against WikiOS's unseen changes (oldest first, the newest standing); null when there are none. */
export async function judgeEvent(
  event: LogEvent,
  action: ChangeAction,
  articleId: string,
  unseen: readonly PageChange[]
): Promise<CollisionVerdict | null> {
  const standing = unseen.at(-1);
  return standing ? collide(event, action, articleId, standing, unseen) : null;
}

export async function recordVerdict(
  tx: Tx,
  page: JudgedPage,
  verdict: CollisionVerdict
): Promise<void> {
  await recordConflict(tx, {
    source: SOURCE,
    articleId: page.id,
    title: page.title,
    verdict,
    baseRef: null,
  });
}

/** The classic event lost: WikiOS keeps what it has, and the event counts as applied, recorded with its author overwritten. */
export async function keepWikios(
  tx: Tx,
  page: JudgedPage,
  verdict: CollisionVerdict
): Promise<Applied> {
  await recordVerdict(tx, page, verdict);
  return { outcome: "applied", articleId: page.id };
}
