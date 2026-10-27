/**
 * Pure patches of the cached `thinkpagesForum.thread` and `getBoard` pages for one post's reaction: the optimistic
 * update, the server's settle and the rollback all go through `Reduce`. A page that does not hold the post comes back
 * as the same object, so a cache that did not change is not written.
 */
import { applyReactionChange, type ReactionCounts } from "~/lib/thinkpages-forum/reactions";
import type { BoardData } from "../realm/types";
import type { ThreadData } from "../thread/types";

export interface ReactionState {
  counts: ReactionCounts;
  mine: string | null;
}
export type Reduce = (current: ReactionState) => ReactionState;

interface Reacted {
  id: string;
  reactions: ReactionCounts;
  myReaction: string | null;
}

/** The viewer's reaction becomes `type` (a switch, an add, or null: a removal). */
export const chooseReaction =
  (type: string | null): Reduce =>
  (current) => ({ counts: applyReactionChange(current.counts, current.mine, type), mine: type });

/** The server's counts and reaction replace what the page holds. */
export const settledReaction =
  (counts: ReactionCounts, mine: string | null): Reduce =>
  () => ({ counts, mine });

function readRows(rows: readonly Reacted[], postId: string): ReactionState | null {
  const row = rows.find((r) => r.id === postId);
  return row ? { counts: row.reactions, mine: row.myReaction } : null;
}

function patchRows<T extends Reacted>(
  rows: readonly T[],
  postId: string,
  reduce: Reduce
): T[] | null {
  const at = rows.findIndex((row) => row.id === postId);
  const row = rows[at];
  if (!row) return null;
  const next = reduce({ counts: row.reactions, mine: row.myReaction });
  return rows.map((r, i) =>
    i === at ? { ...r, reactions: next.counts, myReaction: next.mine } : r
  );
}

export const readThread = (data: ThreadData | undefined, postId: string): ReactionState | null =>
  data ? readRows(data.posts, postId) : null;

export const readBoard = (data: BoardData | undefined, postId: string): ReactionState | null =>
  data ? readRows(data.messages, postId) : null;

export function patchThread(
  data: ThreadData | undefined,
  postId: string,
  reduce: Reduce
): ThreadData | undefined {
  const posts = data ? patchRows(data.posts, postId, reduce) : null;
  return data && posts ? { ...data, posts } : data;
}

export function patchBoard(
  data: BoardData | undefined,
  postId: string,
  reduce: Reduce
): BoardData | undefined {
  const messages = data ? patchRows(data.messages, postId, reduce) : null;
  return data && messages ? { ...data, messages } : data;
}
