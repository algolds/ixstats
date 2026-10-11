/**
 * Action-linked posts and story chains (docs/superpowers/specs/2026-10-07-action-linked-posts-design.md).
 * Thin: validates, binds the caller's country, calls ~/server/modules/action-links, maps ActionLinkError.
 * Post link sync is not exposed here: the forum's post writer calls syncPostActionLinks on save.
 * Backlinks (`discussions`, `discussionCounts`) read through the forum module's visibility rules.
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
  rateLimitedMutationProcedure,
  rateLimitedPublicProcedure,
} from "~/server/api/trpc";
import { directiveActivityId } from "~/lib/action-links";
import {
  ActionLinkError,
  addPostToChain,
  appendChainToWiki,
  createChain,
  myChains,
  removePostFromChain,
  reviewChain,
  reviewQueue,
  submitChain,
} from "~/server/modules/action-links";
import {
  discussionCountsOf,
  discussionsOf,
  forumActorOf,
  type ForumUserSource,
  type ForumViewer,
  type ScopeDb,
} from "~/server/modules/thinkpages-forum";

function mapError(error: Error): never {
  if (error instanceof ActionLinkError)
    throw new TRPCError({ code: error.code, message: error.message });
  throw error;
}

function requireCountry(user: { countryId?: string | null } | null | undefined): string {
  if (!user?.countryId)
    throw new TRPCError({ code: "FORBIDDEN", message: "Story chains belong to a nation" });
  return user.countryId;
}

/** The signed-in user as the forum's viewer (with what they moderate); null for a visitor. */
function viewerOf(db: ScopeDb, user: ForumUserSource | null | undefined): Promise<ForumViewer> {
  return user ? forumActorOf(db, user) : Promise.resolve(null);
}

const id = z.string().min(1).max(64);
const postInput = z.object({
  storylineId: id,
  // Native only: the XenForo forum is retired (phase 4b), so no new link can name one of its posts.
  postSource: z.enum(["native"]),
  postRef: z.string().min(1).max(64),
});

export const actionLinksRouter = createTRPCRouter({
  myActivities: protectedProcedure
    .input(z.object({ search: z.string().trim().max(100).optional() }))
    .query(({ ctx, input }) =>
      ctx.db.activityFeed.findMany({
        where: {
          countryId: requireCountry(ctx.user),
          visibility: "public",
          ...(input.search
            ? { title: { contains: input.search, mode: "insensitive" as const } }
            : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 30,
        select: { id: true, title: true, type: true, createdAt: true },
      })
    ),

  activityCards: publicProcedure
    .input(z.object({ ids: z.array(id).max(50) }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db.activityFeed.findMany({
        where: { id: { in: input.ids }, visibility: "public" },
        select: { id: true, title: true, type: true, createdAt: true, countryId: true },
      });
      const countryIds = [...new Set(rows.flatMap((r) => (r.countryId ? [r.countryId] : [])))];
      const countries = countryIds.length
        ? await ctx.db.country.findMany({
            where: { id: { in: countryIds } },
            select: { id: true, name: true, slug: true, flag: true },
          })
        : [];
      const byId = new Map(countries.map((c) => [c.id, c]));
      return rows.map(({ countryId, ...r }) => ({
        ...r,
        country: countryId ? (byId.get(countryId) ?? null) : null,
      }));
    }),

  /** The public ActivityFeed row of a committed directive, null when it has none (a draft, an abandoned one, an older one). */
  directiveActivity: publicProcedure
    .input(z.object({ intentId: id }))
    .query(async ({ ctx, input }) => {
      const row = await ctx.db.activityFeed.findFirst({
        where: { id: directiveActivityId(input.intentId), visibility: "public" },
        select: { id: true },
      });
      return row ? { activityId: row.id } : null;
    }),

  /** The visible posts that link an action, newest link first, 20 per page (the forum's own visibility rules). */
  discussions: rateLimitedPublicProcedure
    .input(z.object({ activityId: id, cursor: z.string().min(1).max(128).optional() }))
    .query(async ({ ctx, input }) =>
      discussionsOf(ctx.db, await viewerOf(ctx.db, ctx.user), input)
    ),

  /** Visible discussion counts for up to 50 actions, batched. */
  discussionCounts: rateLimitedPublicProcedure
    .input(z.object({ activityIds: z.array(id).max(50) }))
    .query(async ({ ctx, input }) =>
      discussionCountsOf(ctx.db, await viewerOf(ctx.db, ctx.user), input.activityIds)
    ),

  myChains: protectedProcedure.query(({ ctx }) => myChains(ctx.db, requireCountry(ctx.user))),

  createChain: rateLimitedMutationProcedure
    .input(z.object({ title: z.string().trim().min(1).max(200) }))
    .mutation(({ ctx, input }) =>
      createChain(ctx.db, requireCountry(ctx.user), input.title).catch(mapError)
    ),

  addPostToChain: rateLimitedMutationProcedure
    .input(postInput)
    .mutation(({ ctx, input }) =>
      addPostToChain(ctx.db, { ...input, countryId: requireCountry(ctx.user) }).catch(mapError)
    ),

  removePostFromChain: rateLimitedMutationProcedure
    .input(postInput)
    .mutation(({ ctx, input }) =>
      removePostFromChain(ctx.db, { ...input, countryId: requireCountry(ctx.user) }).catch(mapError)
    ),

  submitChain: rateLimitedMutationProcedure
    .input(z.object({ storylineId: id, wikiPageTitle: z.string().trim().min(1).max(255) }))
    .mutation(({ ctx, input }) =>
      submitChain(ctx.db, ctx, { ...input, countryId: requireCountry(ctx.user) }).catch(mapError)
    ),

  reviewQueue: protectedProcedure.query(({ ctx }) => reviewQueue(ctx.db, ctx.user)),

  reviewChain: rateLimitedMutationProcedure
    .input(
      z.object({
        storylineId: id,
        approve: z.boolean(),
        note: z.string().trim().max(1000).optional(),
      })
    )
    .mutation(({ ctx, input }) =>
      reviewChain(ctx.db, ctx.user, input, (storylineId) =>
        appendChainToWiki(ctx.db, storylineId).then(() => undefined)
      ).catch(mapError)
    ),
});
