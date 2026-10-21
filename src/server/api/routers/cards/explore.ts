/** Explore: every realm's approved cards with their art, the ones the viewer has not collected marked (spec §2.3). */
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {
  ExploreQuerySchema,
  ExploreRegionsQuerySchema,
  exploreGrid,
  exploreRegions,
  exploreShelves,
} from "~/lib/cards/hub/explore";

export const cardsExploreRouter = createTRPCRouter({
  exploreShelves: protectedProcedure.query(({ ctx }) => exploreShelves(ctx.db, ctx.user.id)),
  exploreGrid: protectedProcedure
    .input(ExploreQuerySchema)
    .query(({ ctx, input }) => exploreGrid(ctx.db, ctx.user.id, input)),
  exploreRegions: protectedProcedure
    .input(ExploreRegionsQuerySchema.optional())
    .query(({ ctx, input }) => exploreRegions(ctx.db, input?.search)),
});
