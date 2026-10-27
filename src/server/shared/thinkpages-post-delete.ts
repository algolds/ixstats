import type { PrismaClient } from "@prisma/client";
import { invalidateFeeds } from "./thinkpages-post-utils";

type DeleteDb = Pick<PrismaClient, "thinkpagesPost" | "thinkpagesAccount" | "poll">;

interface DeletablePost {
  id: string;
  accountId: string;
  content: string;
  parentPostId: string | null;
  repostOfId: string | null;
  pollId?: string | null;
}

/**
 * Hard-deletes a ThinkPages post. Used by `thinkpages.deletePost` (owner or moderator) and the
 * admin flag queue's "remove post" (SL-10). Replies become top-level posts, plain reposts of it
 * are deleted, the parent's / original's counters and the author's post count are kept in step,
 * an attached poll and the mirrored Discord message are deleted, and the feed caches dropped.
 */
export async function deleteThinkpagesPost(db: DeleteDb, post: DeletablePost) {
  // Replies are kept as orphans (prevents the FK constraint).
  await db.thinkpagesPost.updateMany({
    where: { parentPostId: post.id },
    data: { parentPostId: null },
  });

  // Reposts have no standalone value.
  const repostCount = await db.thinkpagesPost.count({ where: { repostOfId: post.id } });
  if (repostCount > 0) {
    await db.thinkpagesPost.deleteMany({ where: { repostOfId: post.id } });
  }

  const discordMessageId = post.content.match(/\[DiscordMsg:(\d+)\]/)?.[1];

  // PostReaction, PostMention, MediaAttachment and view days cascade.
  const deletedPost = await db.thinkpagesPost.delete({ where: { id: post.id } });

  // Keep the parent / original post's engagement counters in step (never below zero).
  if (post.parentPostId) {
    await db.thinkpagesPost.updateMany({
      where: { id: post.parentPostId, replyCount: { gt: 0 } },
      data: { replyCount: { decrement: 1 } },
    });
  }
  if (post.repostOfId) {
    await db.thinkpagesPost.updateMany({
      where: { id: post.repostOfId, repostCount: { gt: 0 } },
      data: { repostCount: { decrement: 1 } },
    });
  }

  if (post.pollId) {
    await db.poll.delete({ where: { id: post.pollId } }).catch((err: unknown) => {
      console.error("[ThinkPages] Failed to delete associated poll:", err);
    });
  }

  await db.thinkpagesAccount.update({
    where: { id: post.accountId },
    data: { postCount: { decrement: 1 + repostCount } },
  });

  if (discordMessageId) {
    try {
      const { deleteDiscordMessage } = await import("~/lib/discord/ixtwitter-sync");
      deleteDiscordMessage(discordMessageId).catch((err: unknown) =>
        console.error("[ThinkPages] Delete Discord msg promise error:", err)
      );
    } catch (error) {
      console.error("[ThinkPages] Failed to trigger Discord delete:", error);
    }
  }

  await invalidateFeeds();
  return deletedPost;
}
