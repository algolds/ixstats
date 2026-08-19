// src/server/api/routers/card-xp.ts
// tRPC router for card XP / level progression

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { grantCardXp } from "~/lib/cards";

/**
 * Grant experience to a card ownership instance.
 * Formula: newXP = currentXP + amount; newLevel = floor(newXP / 1000) + 1
 */
export const cardXpRouter = createTRPCRouter({
  grantCardExperience: protectedProcedure
    .input(
      z.object({
        ownershipId: z.string().min(1),
        amount: z.number().int().min(1).max(10000),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      const ownership = await db.cardOwnership.findUnique({
        where: { id: input.ownershipId },
        select: { id: true, ownerId: true },
      });

      if (!ownership) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Card ownership record not found",
        });
      }

      if (ownership.ownerId !== ctx.auth.userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not own this card",
        });
      }

      return grantCardXp(db, input.ownershipId, input.amount);
    }),
});
