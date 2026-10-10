/**
 * The engagement procedures (docs/superpowers/specs/2026-10-10-thinkpages-forum-unread-notifications-design.md),
 * merged into `thinkpagesForum`: read marks here, watch, lists, nav counts and mention suggestions as later tasks add
 * them. Thin, as the rest of the forum router: validates, maps the signed-in user to the module's viewer and calls
 * ~/server/modules/thinkpages-forum.
 */
import { z } from "zod";
import { MENTION_NAME_MAX, MENTION_SUGGEST_MIN } from "~/lib/thinkpages-forum/mentions";
import {
  createTRPCRouter,
  rateLimitedMutationProcedure,
  readOnlyProcedure,
} from "~/server/api/trpc";
import {
  forumNavCounts,
  listNewPosts,
  listWatched,
  markAllRead,
  markCategoryRead,
  markRealmBoardRead,
  markThreadRead,
  mentionSuggestions,
  unwatchThread,
  watchThread,
  type AuthorsDb,
  type ThreadListing,
} from "~/server/modules/thinkpages-forum";
import { actorOf, authorMaps, categoryKey, id, mapError, memberOf, page, realm } from "./viewer";

/** A list page with the display data of its authors and last posters (a persona by name, never its player). */
async function withAuthors(db: AuthorsDb, listing: ThreadListing) {
  const posters = listing.threads.flatMap((thread) => thread.lastPoster ?? []);
  return { ...listing, authors: await authorMaps(db, [...listing.threads, ...posters]) };
}

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

  /** Watches a thread the caller may read (NOT_FOUND otherwise, the realm board included). */
  watchThread: rateLimitedMutationProcedure
    .input(z.object({ threadId: id }))
    .mutation(async ({ ctx, input }) =>
      watchThread(ctx.db, await actorOf(ctx.db, ctx.user), input.threadId).catch(mapError)
    ),

  unwatchThread: rateLimitedMutationProcedure
    .input(z.object({ threadId: id }))
    .mutation(({ ctx, input }) => unwatchThread(ctx.db, memberOf(ctx.user).id, input.threadId)),

  /** New posts: unread threads of the last 30 days across the boards the caller can see, newest first. */
  newPosts: readOnlyProcedure
    .input(z.object({ page }))
    .query(async ({ ctx, input }) =>
      withAuthors(ctx.db, await listNewPosts(ctx.db, await actorOf(ctx.db, ctx.user), input.page))
    ),

  /** Watched: the caller's watched threads, unread first, then by last post. */
  watchedThreads: readOnlyProcedure
    .input(z.object({ page }))
    .query(async ({ ctx, input }) =>
      withAuthors(ctx.db, await listWatched(ctx.db, await actorOf(ctx.db, ctx.user), input.page))
    ),

  /** The sidebar's badges, polled every 60 seconds: unread watched threads and new board messages. */
  navCounts: readOnlyProcedure.query(async ({ ctx }) =>
    forumNavCounts(ctx.db, await actorOf(ctx.db, ctx.user))
  ),

  /** @mention autocomplete: up to 6 handles and personas by prefix (public data; 2 to 24 characters, plus an optional @). */
  mentionSuggestions: readOnlyProcedure
    .input(
      z.object({
        q: z
          .string()
          .trim()
          .min(MENTION_SUGGEST_MIN)
          .max(MENTION_NAME_MAX + 1),
      })
    )
    .query(({ ctx, input }) => mentionSuggestions(ctx.db, input.q)),
});
