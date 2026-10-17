/** Explore: every realm's approved cards, silhouettes for what the viewer has not collected (spec §2.3). */
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {
  ExploreQuerySchema,
  exploreGrid,
  exploreRegions,
  exploreShelves,
} from "~/lib/cards/hub/explore";

export const cardsExploreRouter = createTRPCRouter({
  exploreShelves: protectedProcedure.query(({ ctx }) => exploreShelves(ctx.db, ctx.user.id)),
  exploreGrid: protectedProcedure
    .input(ExploreQuerySchema)
    .query(({ ctx, input }) => exploreGrid(ctx.db, ctx.user.id, input)),
  exploreRegions: protectedProcedure.query(({ ctx }) => exploreRegions(ctx.db)),
});
