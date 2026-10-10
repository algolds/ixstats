/**
 * The realm board's procedures (docs/superpowers/specs/2026-10-10-thinkpages-realm-board-design.md), merged into
 * `thinkpagesForum`. Thin, as the rest of the forum router: validates, maps the signed-in user to the module's
 * viewer, calls ~/server/modules/thinkpages-forum and maps ForumError (a slow-mode wait rides along as
 * `data.context.retryAfterSeconds`, see `mapError`). Access, slow mode and the character cap are the module's.
 */
import { z } from "zod";
import {
  BOARD_MAX_PAGE_SIZE,
  BOARD_PAGE_SIZE,
  isSlowModeSeconds,
} from "~/lib/thinkpages-forum/board";
import { createTRPCRouter, publicProcedure, rateLimitedMutationProcedure } from "~/server/api/trpc";
import {
  continueInThread,
  editBoardMessage,
  getBoard,
  MAX_POST_HTML,
  postBoardMessage,
  TITLE_MAX,
  TITLE_MIN,
  updateBoardSettings,
} from "~/server/modules/thinkpages-forum";
import { actorOf, categoryKey, id, mapError, realm, viewerOf } from "./viewer";

const html = z.string().max(MAX_POST_HTML);

export const thinkpagesForumBoardRouter = createTRPCRouter({
  /** A realm's live board, newest message first; `before` is the id of the oldest message already loaded. */
  getBoard: publicProcedure
    .input(
      z.object({
        realm,
        before: id.optional(),
        limit: z.number().int().min(1).max(BOARD_MAX_PAGE_SIZE).default(BOARD_PAGE_SIZE),
      })
    )
    .query(async ({ ctx, input }) =>
      getBoard(ctx.db, await viewerOf(ctx.db, ctx.user), input.realm, {
        before: input.before,
        limit: input.limit,
      }).catch(mapError)
    ),

  postBoardMessage: rateLimitedMutationProcedure
    .input(
      z.object({
        realm,
        html,
        personaId: id.nullish(),
        replyToPostId: id.nullish(),
      })
    )
    .mutation(async ({ ctx, input }) =>
      postBoardMessage(ctx.db, await actorOf(ctx.db, ctx.user), input).catch(mapError)
    ),

  /** The author's edit, within 15 minutes of posting. */
  editBoardMessage: rateLimitedMutationProcedure
    .input(z.object({ postId: id, html }))
    .mutation(async ({ ctx, input }) =>
      editBoardMessage(ctx.db, await actorOf(ctx.db, ctx.user), input).catch(mapError)
    ),

  /** The author, or a moderator of the realm, moves a message into a new thread and leaves a link behind. */
  continueInThread: rateLimitedMutationProcedure
    .input(
      z.object({
        postId: id,
        title: z.string().trim().min(TITLE_MIN).max(TITLE_MAX),
        categoryKey: categoryKey.optional(),
      })
    )
    .mutation(async ({ ctx, input }) =>
      continueInThread(ctx.db, await actorOf(ctx.db, ctx.user), input).catch(mapError)
    ),

  /** Founder, site admin or an officer with the `board` power: visitors and slow mode. */
  updateBoardSettings: rateLimitedMutationProcedure
    .input(
      z.object({
        realmId: id,
        visitorsAllowed: z.boolean().optional(),
        slowModeSeconds: z
          .number()
          .int()
          .refine(isSlowModeSeconds, "Slow mode is off, 10, 30, 60 or 300 seconds")
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) =>
      updateBoardSettings(ctx.db, await actorOf(ctx.db, ctx.user), input.realmId, input).catch(
        mapError
      )
    ),
});
