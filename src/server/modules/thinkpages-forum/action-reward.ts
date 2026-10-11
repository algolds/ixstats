/**
 * The forum's side of the action reward (spec section 5): after a thread, a reply or a board message is saved, the
 * links that save created may pay. Only a post anyone can read pays: a signed-out reader must be able to open it
 * (`canSeeThread` and `visibleRealmOf` for no viewer, and not hidden), so a Reports thread, a staff category, a hidden
 * post and a draft realm's board never earn, and a reward cannot be farmed in a place nobody sees. The actor must have
 * a nation (the same condition a token needs). The reward is private to the posting user, a persona post included.
 * Best effort: every failure is logged and reads as no reward, so a post is never failed by its reward.
 */
import type { PrismaClient } from "@prisma/client";
import type { ForumReward } from "~/lib/action-rewards";
import { grantActionLinkRewards } from "~/server/modules/action-links";
import { canSeeThread } from "./access";
import { visibleRealmOf } from "./reads";

export type ActionRewardDb = Pick<
  PrismaClient,
  "forumPost" | "realm" | "$transaction" | "systemConfig"
>;

/** Whether a signed-out reader could open the post: the rules of the thread, post and board reads, for no viewer. */
async function isPubliclyReadable(db: ActionRewardDb, postId: string): Promise<boolean> {
  const post = await db.forumPost.findUnique({
    where: { id: postId },
    select: {
      hidden: true,
      thread: {
        select: {
          authorUserId: true,
          hidden: true,
          category: {
            select: { id: true, scope: true, realmId: true, visibility: true },
          },
        },
      },
    },
  });
  if (!post || post.hidden) return false;
  const { category } = post.thread;
  if (!canSeeThread(null, post.thread, category)) return false;
  return (await visibleRealmOf(db, null, category)) !== undefined;
}

export async function rewardNewLinks(
  db: ActionRewardDb,
  actor: { id: string; countryId: string | null },
  postId: string,
  created: readonly string[]
): Promise<ForumReward | null> {
  if (created.length === 0 || !actor.countryId) return null;
  try {
    if (!(await isPubliclyReadable(db, postId))) return null;
    const amount = await grantActionLinkRewards(db, {
      userId: actor.id,
      countryId: actor.countryId,
      postSource: "native",
      postRef: postId,
      activityIds: created,
    });
    return amount > 0 ? { amount } : null;
  } catch (error) {
    console.error("[thinkpages-forum] Action reward failed:", error);
    return null;
  }
}
