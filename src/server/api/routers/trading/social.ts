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
import { hiddenLinkedNames } from "~/server/shared/privacy-permissions";

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

      // A Discord tag or wiki name its owner hid (SL-4) is neither shown nor matched on.
      const hidden = await hiddenLinkedNames(
        ctx.db,
        users.map((u) => u.clerkUserId)
      );
      const needle = query.toLowerCase();
      const has = (value: string | null | undefined) =>
        Boolean(value?.toLowerCase().includes(needle));

      return users
        .map((user) => ({
          user,
          wiki: hidden.wiki.has(user.clerkUserId) ? null : user.wikiUsername,
          discord: hidden.discord.has(user.clerkUserId) ? null : user.discordUsername,
        }))
        .filter(
          ({ user, wiki, discord }) =>
            has(user.country?.name) ||
            has(user.country?.leader) ||
            has(user.forumUsername) ||
            has(wiki) ||
            has(discord)
        )
        .map(({ user, wiki, discord }) => ({
          id: user.clerkUserId,
          dbId: user.id,
          countryName: user.country?.name || "Unknown Country",
          leader: user.country?.leader || "Unknown Leader",
          economicTier: user.country?.economicTier || "Unknown",
          username: user.forumUsername || wiki || discord || "Unnamed Player",
          flag: user.country?.flag || null,
        }));
    }),
});
