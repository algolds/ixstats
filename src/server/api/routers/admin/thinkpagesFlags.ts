/**
 * ThinkPages flag moderation queue (SL-10): flags users raise with `thinkpages.flagPost`, grouped
 * by post. An admin dismisses the flags (the post stays) or removes the post; either way every
 * open flag on that post is resolved.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import { deleteThinkpagesPost } from "~/server/shared/thinkpages-post-delete";

const MAX_REASONS = 5;

export const adminThinkpagesFlagsRouter = createTRPCRouter({
  /** Posts with open flags, most flagged first (then most recently flagged). */
  listFlaggedPosts: adminProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(50) }).default({ limit: 50 }))
    .query(async ({ ctx, input }) => {
      const flags = await ctx.db.postFlag.findMany({
        where: { status: "open" },
        orderBy: { createdAt: "desc" },
        select: { postId: true, reason: true, createdAt: true },
      });

      const groups = new Map<string, { count: number; reasons: string[]; lastFlaggedAt: Date }>();
      for (const flag of flags) {
        const group = groups.get(flag.postId) ?? {
          count: 0,
          reasons: [],
          lastFlaggedAt: flag.createdAt,
        };
        group.count++;
        const reason = flag.reason?.trim();
        if (reason && group.reasons.length < MAX_REASONS) group.reasons.push(reason);
        groups.set(flag.postId, group);
      }

      const ranked = [...groups.entries()]
        .sort(
          ([, a], [, b]) =>
            b.count - a.count || b.lastFlaggedAt.getTime() - a.lastFlaggedAt.getTime()
        )
        .slice(0, input.limit);

      const posts = ranked.length
        ? await ctx.db.thinkpagesPost.findMany({
            where: { id: { in: ranked.map(([postId]) => postId) } },
            select: {
              id: true,
              content: true,
              visibility: true,
              createdAt: true,
              account: { select: { username: true, displayName: true } },
            },
          })
        : [];
      const byId = new Map(posts.map((post) => [post.id, post]));

      return {
        totalOpen: flags.length,
        items: ranked.map(([postId, group]) => {
          const post = byId.get(postId);
          return {
            postId,
            flagCount: group.count,
            reasons: group.reasons,
            lastFlaggedAt: group.lastFlaggedAt,
            post: post
              ? {
                  content: post.content.slice(0, 500),
                  visibility: post.visibility,
                  createdAt: post.createdAt,
                  authorUsername: post.account?.username ?? null,
                  authorDisplayName: post.account?.displayName ?? null,
                }
              : null,
          };
        }),
      };
    }),

  /**
   * Resolve every open flag on a post: `dismiss` keeps the post, `remove` deletes it (a post that
   * no longer exists just has its flags closed).
   */
  resolveFlaggedPost: adminProcedure
    .input(z.object({ postId: z.string().min(1), action: z.enum(["dismiss", "remove"]) }))
    .mutation(async ({ ctx, input }) => {
      const open = await ctx.db.postFlag.count({
        where: { postId: input.postId, status: "open" },
      });
      if (open === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No open flags for this post" });
      }

      let removed = false;
      if (input.action === "remove") {
        const post = await ctx.db.thinkpagesPost.findUnique({
          where: { id: input.postId },
          select: {
            id: true,
            accountId: true,
            content: true,
            parentPostId: true,
            repostOfId: true,
            pollId: true,
          },
        });
        if (post) {
          await deleteThinkpagesPost(ctx.db, post);
          removed = true;
        }
      }

      const resolved = await ctx.db.postFlag.updateMany({
        where: { postId: input.postId, status: "open" },
        data: {
          status: input.action === "remove" ? "removed" : "dismissed",
          resolvedAt: new Date(),
          resolvedBy: ctx.auth?.userId ?? null,
        },
      });

      return { resolved: resolved.count, removed };
    }),
});
