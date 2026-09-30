/**
 * P2P Trading Router
 *
 * Provides endpoints for peer-to-peer card trading:
 * - Create trade offers
 * - Accept/decline/counter trades
 * - View active trades
 * - View trade history
 * - Cancel pending trades
 */

import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const tradingSocialRouter = createTRPCRouter({
  /**
   * Search potential trading partners by country name or username
   */
  searchTradingPartners: protectedProcedure
    .input(z.object({ query: z.string() }))
    .query(async ({ ctx, input }) => {
      const query = input.query.trim();
      if (query.length < 2) return [];

      const currentUserId = ctx.user.id;

      const users = await ctx.db.user.findMany({
        where: {
          id: { not: currentUserId },
          isActive: true,
          OR: [
            {
              country: {
                OR: [
                  { name: { contains: query, mode: "insensitive" } },
                  { leader: { contains: query, mode: "insensitive" } },
                ],
              },
            },
            {
              forumUsername: { contains: query, mode: "insensitive" },
            },
            {
              wikiUsername: { contains: query, mode: "insensitive" },
            },
            {
              discordUsername: { contains: query, mode: "insensitive" },
            },
          ],
        },
        include: {
          country: {
            select: {
              id: true,
              name: true,
              leader: true,
              economicTier: true,
              flag: true,
            },
          },
        },
        take: 15,
      });

      return users.map((user) => ({
        id: user.clerkUserId,
        dbId: user.id,
        countryName: user.country?.name || "Unknown Country",
        leader: user.country?.leader || "Unknown Leader",
        economicTier: user.country?.economicTier || "Unknown",
        username:
          user.forumUsername || user.wikiUsername || user.discordUsername || "Unnamed Player",
        flag: user.country?.flag || null,
      }));
    }),
});
