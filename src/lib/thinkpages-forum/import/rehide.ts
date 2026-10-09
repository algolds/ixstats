/**
 * Delta re-hide (phase 4, I7): content already imported that XenForo has since moderated or deleted (between the
 * first export and read-only, step 9b). A rerun never re-imports it, so the plan lists it here and the writer sets
 * `hidden: true` on the native rows: never un-hides, never deletes. Pure.
 *   A thread hides when XenForo now has it moderated or deleted, or its first post moderated or deleted (phase 3
 *   never hides a first post alone).
 *   A reply hides when XenForo now has it moderated or deleted.
 * Rows the database already holds hidden are left out, so a rerun plans nothing. The attachments of every post in a
 * thread hidden now, and of every reply hidden now, are listed so their media assets turn restricted in the same run.
 */
import type { XfPost, XfThread } from "./xenforo-types";

/** One imported thread to re-hide: the thread row, its replies, or both, in one transaction. */
export interface RehideThread {
  /** The native thread id. */
  threadId: string;
  xenforoThreadId: number;
  /** Set `hidden: true` on the thread row. */
  thread: boolean;
  /** XenForo ids of imported replies to hide. */
  posts: number[];
}

export interface RehidePlan {
  threads: RehideThread[];
  /** XenForo attachment ids whose media assets turn restricted. */
  attachmentIds: number[];
}

/** What the database holds of earlier imports (`ImportDbState`). */
export interface RehideDbState {
  existingPosts: ReadonlySet<number>;
  /** XenForo ids of imported threads the database holds as hidden. */
  hiddenThreads: ReadonlySet<number>;
  /** XenForo ids of imported posts the database holds as hidden. */
  hiddenPosts: ReadonlySet<number>;
}

export const emptyRehide = (): RehidePlan => ({ threads: [], attachmentIds: [] });

const withdrawn = (state: string) => state === "moderated" || state === "deleted";

/** XenForo post id → its attachment ids (the post's own list and the snapshot's entries). */
export function attachmentsByPost(
  posts: Iterable<XfPost>,
  entries: Iterable<{ attachment_id: number; post_id: number }>
): Map<number, number[]> {
  const out = new Map<number, Set<number>>();
  const add = (postId: number, id: number) => {
    const set = out.get(postId) ?? new Set<number>();
    set.add(id);
    out.set(postId, set);
  };
  for (const post of posts)
    for (const a of post.Attachments ?? []) add(post.post_id, a.attachment_id);
  for (const entry of entries) add(entry.post_id, entry.attachment_id);
  return new Map([...out].map(([postId, ids]) => [postId, [...ids]]));
}

/** Adds the thread's re-hide to `plan` (nothing when it is not imported or nothing changed). */
export function planRehide(
  plan: RehidePlan,
  input: {
    thread: XfThread;
    posts: readonly XfPost[];
    existingId: string | null;
    db: RehideDbState;
    attachments: ReadonlyMap<number, readonly number[]>;
  }
): void {
  const { thread, posts, existingId, db } = input;
  if (!existingId) return;
  const first = posts.find((p) => p.is_first_post) ?? posts[0];
  const threadWithdrawn =
    withdrawn(thread.discussion_state) || (first !== undefined && withdrawn(first.message_state));
  const hideThread = threadWithdrawn && !db.hiddenThreads.has(thread.thread_id);
  const replies = posts.filter(
    (p) =>
      p !== first &&
      withdrawn(p.message_state) &&
      db.existingPosts.has(p.post_id) &&
      !db.hiddenPosts.has(p.post_id)
  );
  if (!hideThread && !replies.length) return;
  for (const post of hideThread ? posts : replies) {
    plan.attachmentIds.push(...(input.attachments.get(post.post_id) ?? []));
  }
  plan.threads.push({
    threadId: existingId,
    xenforoThreadId: thread.thread_id,
    thread: hideThread,
    posts: replies.map((p) => p.post_id),
  });
}
