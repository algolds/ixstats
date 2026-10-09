/**
 * Action-linked posts and story chains (docs/superpowers/specs/2026-10-07-action-linked-posts-design.md).
 * Thin: validates, binds the caller's country, calls ~/server/modules/action-links, maps ActionLinkError.
 * Post link sync is not exposed here: the forum's post writer calls syncPostActionLinks on save.
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
  rateLimitedMutationProcedure,
} from "~/server/api/trpc";
import {
  ActionLinkError,
  addPostToChain,
  appendChainToWiki,
  createChain,
  linkedPosts,
  myChains,
  removePostFromChain,
  reviewChain,
  reviewQueue,
  submitChain,
} from "~/server/modules/action-links";

function mapError(error: Error): never {
  if (error instanceof ActionLinkError) throw new TRPCError({ code: error.code, message: error.message });
  throw error;
}

function requireCountry(user: { countryId?: string | null } | null | undefined): string {
  if (!user?.countryId) throw new TRPCError({ code: "FORBIDDEN", message: "Story chains belong to a nation" });
  return user.countryId;
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
          ...(input.search ? { title: { contains: input.search, mode: "insensitive" as const } } : {}),
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
      return rows.map(({ countryId, ...r }) => ({ ...r, country: countryId ? (byId.get(countryId) ?? null) : null }));
    }),

  linkedPosts: publicProcedure
    .input(z.object({ activityId: id }))
    .query(({ ctx, input }) => linkedPosts(ctx.db, input.activityId)),

  myChains: protectedProcedure.query(({ ctx }) => myChains(ctx.db, requireCountry(ctx.user))),

  createChain: rateLimitedMutationProcedure
    .input(z.object({ title: z.string().trim().min(1).max(200) }))
    .mutation(({ ctx, input }) => createChain(ctx.db, requireCountry(ctx.user), input.title).catch(mapError)),

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
    .input(z.object({ storylineId: id, approve: z.boolean(), note: z.string().trim().max(1000).optional() }))
    .mutation(({ ctx, input }) =>
      reviewChain(ctx.db, ctx.user, input, (storylineId) =>
        appendChainToWiki(ctx.db, storylineId).then(() => undefined)
      ).catch(mapError)
    ),
});
