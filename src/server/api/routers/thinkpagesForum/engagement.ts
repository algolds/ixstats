/**
 * The engagement procedures (docs/superpowers/specs/2026-10-10-thinkpages-forum-unread-notifications-design.md),
 * merged into `thinkpagesForum`: read marks here, watch, lists, nav counts and mention suggestions as later tasks add
 * them. Thin, as the rest of the forum router: validates, maps the signed-in user to the module's viewer and calls
 * ~/server/modules/thinkpages-forum.
 */
import { z } from "zod";
import { createTRPCRouter, rateLimitedMutationProcedure } from "~/server/api/trpc";
import {
  markAllRead,
  markCategoryRead,
  markRealmBoardRead,
  markThreadRead,
} from "~/server/modules/thinkpages-forum";
import { actorOf, categoryKey, id, mapError, memberOf, page, realm } from "./viewer";

export const thinkpagesForumEngagementRouter = createTRPCRouter({
  /** The thread page was shown: the member has read up to its newest post on `page`. */
  markThreadRead: rateLimitedMutationProcedure
    .input(z.object({ threadId: id, page }))
    .mutation(async ({ ctx, input }) =>
      markThreadRead(ctx.db, await actorOf(ctx.db, ctx.user), input).catch(mapError)
    ),

  /** "Mark board read": the unread threads of one board (a realm's when `realm` is given). */
  markCategoryRead: rateLimitedMutationProcedure
    .input(z.object({ key: categoryKey, realm: realm.optional() }))
    .mutation(async ({ ctx, input }) =>
      markCategoryRead(ctx.db, await actorOf(ctx.db, ctx.user), input).catch(mapError)
    ),

  /** "Mark all read" on New posts: nothing before now is unread. */
  markAllRead: rateLimitedMutationProcedure.mutation(({ ctx }) =>
    markAllRead(ctx.db, memberOf(ctx.user).id)
  ),

  /** The realm landing was opened at the top: the realm board is read to its last message. */
  markRealmBoardRead: rateLimitedMutationProcedure
    .input(z.object({ realm }))
    .mutation(async ({ ctx, input }) =>
      markRealmBoardRead(ctx.db, await actorOf(ctx.db, ctx.user), input.realm).catch(mapError)
    ),
});
