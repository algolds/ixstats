/**
 * Find a Realm adverts (docs/superpowers/specs/2026-10-10-thinkpages-forum-realm-adverts-design.md): which realms the
 * caller may advertise, a realm's advert, creating it and locking it. Merged into `thinkpagesForum`. Thin: validates,
 * maps the caller to the module's actor, maps ForumError to TRPCError.
 */
import { z } from "zod";
import { MAX_POST_WIKITEXT } from "~/lib/thinkpages-forum/wikitext-guards";
import {
  createTRPCRouter,
  protectedProcedure,
  rateLimitedMutationProcedure,
} from "~/server/api/trpc";
import {
  advertRealmsOf,
  advertStatus,
  afterThreadStarted,
  createAdvert,
  setAdvertLocked,
  TITLE_MAX,
  TITLE_MIN,
} from "~/server/modules/thinkpages-forum";
import { actorOf, hookFailed, id, mapError, realm } from "./viewer";

export const thinkpagesForumAdvertsRouter = createTRPCRouter({
  /** The realms the caller may advertise (founded, or served with the appearance power), with each one's advert thread id. */
  myAdvertRealms: protectedProcedure.query(async ({ ctx }) => ({
    realms: await advertRealmsOf(ctx.db, await actorOf(ctx.db, ctx.user)),
  })),

  /** A realm's advert thread id for its managers (the Manage page's Advert row). */
  advertFor: protectedProcedure
    .input(z.object({ realm }))
    .query(async ({ ctx, input }) =>
      advertStatus(ctx.db, await actorOf(ctx.db, ctx.user), input.realm).catch(mapError)
    ),

  /** Creates the realm's advert; CONFLICT (with `context.threadId`, unless a moderator hid it) when it already has one. */
  createAdvert: rateLimitedMutationProcedure
    .input(
      z.object({
        realm,
        title: z.string().trim().min(TITLE_MIN).max(TITLE_MAX),
        wikitext: z.string().max(MAX_POST_WIKITEXT),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const actor = await actorOf(ctx.db, ctx.user);
      const created = await createAdvert(ctx.db, actor, input).catch(mapError);
      void afterThreadStarted(ctx.db, actor, created).catch(hookFailed);
      return created;
    }),

  /** Officers lock their advert; only a moderator unlocks it. */
  setAdvertLocked: rateLimitedMutationProcedure
    .input(z.object({ threadId: id, locked: z.boolean() }))
    .mutation(async ({ ctx, input }) =>
      setAdvertLocked(ctx.db, await actorOf(ctx.db, ctx.user), input).catch(mapError)
    ),
});
