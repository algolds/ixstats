/**
 * Lorewards trophies: today's race, and a wiki user's wins, streak and trophy cards (public), plus the viewer's
 * own with what Loreward bonuses have paid them.
 */
import { z } from "zod/v4";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";
import { resolveLorewardUser } from "~/lib/lorewards/resolve-user";
import { getTodayRace } from "~/lib/lorewards/today-race";
import {
  loadTrophies,
  lorewardCreditsPaid,
  NO_TROPHIES,
  todayRankOf,
} from "~/lib/lorewards/trophy-summary";

export const lorewardsTrophiesRouter = createTRPCRouter({
  /** The top ten of today's UTC race (scored live, cached for ten minutes). */
  getTodayRace: publicProcedure.query(() => getTodayRace()),

  /** A wiki user's trophies; the cards are those held by the account that verified the name. */
  getTrophies: publicProcedure
    .input(z.object({ username: z.string().min(1).max(200) }))
    .query(async ({ ctx, input }) => {
      const userId = await resolveLorewardUser(ctx.db, input.username);
      return loadTrophies(ctx.db, input.username, userId);
    }),

  /** The viewer's trophies through their verified IxWiki link, what Loreward bonuses paid, and today's rank. */
  getMyTrophies: protectedProcedure.query(async ({ ctx }) => {
    const link = await ctx.db.wikiAccountLink.findFirst({
      where: { userId: ctx.user.id, source: "ixwiki", verifiedAt: { not: null } },
      select: { username: true },
    });
    if (!link) return { wikiUsername: null, ...NO_TROPHIES, paid: 0, todayRank: null };

    const [trophies, paid, race] = await Promise.all([
      loadTrophies(ctx.db, link.username, ctx.user.id),
      lorewardCreditsPaid(ctx.db, ctx.user.id),
      getTodayRace(),
    ]);
    return {
      wikiUsername: link.username,
      ...trophies,
      paid,
      todayRank: todayRankOf(race, link.username),
    };
  }),
});
