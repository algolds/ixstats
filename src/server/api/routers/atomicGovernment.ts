import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

export const atomicGovernmentRouter = createTRPCRouter({
  // Get all government components for a country
  getComponents: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.governmentComponent.findMany({
        where: {
          countryId: input.countryId,
          isActive: true,
        },
        orderBy: {
          effectivenessScore: "desc",
        },
      });
    }),
});
