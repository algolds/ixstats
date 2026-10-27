/**
 * Public equipped cosmetics (VT-12): lets any viewer render another player's equipped glow,
 * badge and frame. Batched so a page of authors costs one call, not one per author.
 * Returns render data only; wallet, purchases and inventory never leave the server.
 */
import { z } from "zod";
import { createTRPCRouter, rateLimitedPublicProcedure } from "~/server/api/trpc";
import { loadPublicCosmetics, MAX_PUBLIC_COSMETICS_LOOKUP } from "~/lib/vault/public-cosmetics";

export const vaultPublicCosmeticsRouter = createTRPCRouter({
  getEquippedCosmeticsFor: rateLimitedPublicProcedure
    .input(
      z.object({
        /** Internal `User.id` or Clerk id. */
        userIds: z.array(z.string().min(1).max(191)).max(MAX_PUBLIC_COSMETICS_LOOKUP).default([]),
      })
    )
    .query(({ ctx, input }) => loadPublicCosmetics(ctx.db, input)),
});
