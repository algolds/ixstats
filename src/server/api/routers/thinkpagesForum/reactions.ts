/**
 * Forum reactions (docs/superpowers/specs/2026-10-10-thinkpages-forum-reactions-design.md), merged into
 * `thinkpagesForum`. Thin: validates, maps the signed-in user to the module's viewer, calls
 * ~/server/modules/thinkpages-forum and maps ForumError to TRPCError. A new reaction runs the owner's notice hook, and a
 * reaction on a realm board message publishes its new counts to the board's room; neither is awaited and neither can
 * fail the write.
 */
import { z } from "zod";
import { isReactionType, REACTION_TYPE_MAX } from "~/lib/thinkpages-forum/reactions";
import { createTRPCRouter, publicProcedure, rateLimitedMutationProcedure } from "~/server/api/trpc";
import {
  afterReaction,
  listReactors,
  publishBoardPost,
  reactToPost,
  unreactToPost,
} from "~/server/modules/thinkpages-forum";
import { getThinkPagesBroadcaster } from "~/server/websocket-server";
import { actorOf, hookFailed, id, mapError, viewerOf } from "./viewer";

const reactionType = z
  .string()
  .max(REACTION_TYPE_MAX)
  .refine(isReactionType, "That reaction is not available.");

export const thinkpagesForumReactionsRouter = createTRPCRouter({
  /** Sets the caller's reaction to a thread post or board message: adds it, or switches their earlier one. */
  react: rateLimitedMutationProcedure
    .input(z.object({ postId: id, type: reactionType }))
    .mutation(async ({ ctx, input }) => {
      const actor = await actorOf(ctx.db, ctx.user);
      const change = await reactToPost(ctx.db, actor, input).catch(mapError);
      if (change.created) void afterReaction(ctx.db, actor, input.postId).catch(hookFailed);
      if (change.board) {
        void publishBoardPost(ctx.db, getThinkPagesBroadcaster(), input.postId, "updated");
      }
      return { counts: change.counts, mine: change.mine };
    }),

  /** Takes the caller's reaction back (needs only that they can read the post). */
  unreact: rateLimitedMutationProcedure
    .input(z.object({ postId: id }))
    .mutation(async ({ ctx, input }) => {
      const actor = await actorOf(ctx.db, ctx.user);
      const change = await unreactToPost(ctx.db, actor, input).catch(mapError);
      if (change.board) {
        void publishBoardPost(ctx.db, getThinkPagesBroadcaster(), input.postId, "updated");
      }
      return { counts: change.counts, mine: change.mine };
    }),

  /** Who reacted, for whoever can read the post: up to 50 per type, newest first. */
  reactors: publicProcedure
    .input(z.object({ postId: id, type: reactionType.optional() }))
    .query(async ({ ctx, input }) =>
      listReactors(ctx.db, await viewerOf(ctx.db, ctx.user), input).catch(mapError)
    ),
});
