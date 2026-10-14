/**
 * Lorewards trophies: today's race, and a wiki user's wins, streak and trophy cards (public), plus the viewer's
 * own with what Loreward bonuses have paid them.
 */
import { z } from "zod/v4";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";
import { loadPassportSettings } from "~/server/modules/identity/identity.privacy";
import { resolveLorewardUser } from "~/lib/lorewards/resolve-user";
import { getTodayRace } from "~/lib/lorewards/today-race";
import {
  loadTrophies,
  lorewardCreditsPaid,
  NO_TROPHIES,
  todayRankOf,
} from "~/lib/lorewards/trophy-summary";

/** How long `getMyTrophies` waits for a cold race before it leaves the rank out. */
const RACE_WAIT_MS = 2_000;

/**
 * The wiki user's rank in today's race. The race scores a whole UTC day, so it never holds the trophies
 * back: a slow or failed run only leaves the rank out.
 */
async function rankInTodayRace(wikiUsername: string): Promise<number | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const waited = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), RACE_WAIT_MS);
  });
  try {
    const race = await Promise.race([getTodayRace(), waited]);
    return race ? todayRankOf(race, wikiUsername) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export const lorewardsTrophiesRouter = createTRPCRouter({
  /** The top ten of today's UTC race (scored live, cached for ten minutes). */
  getTodayRace: publicProcedure.query(() => getTodayRace()),

  /**
   * A wiki user's trophies; the cards are those held by the account that verified the name, and are left out
   * when that account hides its Vault cards on its passport.
   */
  getTrophies: publicProcedure
    .input(z.object({ username: z.string().min(1).max(200) }))
    .query(async ({ ctx, input }) => {
      const resolved = await resolveLorewardUser(ctx.db, input.username);
      const showCards = resolved
        ? (await loadPassportSettings(resolved)).visibility.vaultCards
        : false;
      return loadTrophies(ctx.db, input.username, showCards ? resolved : null);
    }),

  /** The viewer's trophies through their verified IxWiki link, what Loreward bonuses paid, and today's rank. */
  getMyTrophies: protectedProcedure.query(async ({ ctx }) => {
    const link = await ctx.db.wikiAccountLink.findFirst({
      where: { userId: ctx.user.id, source: "ixwiki", verifiedAt: { not: null } },
      select: { username: true },
    });
    if (!link) return { wikiUsername: null, ...NO_TROPHIES, paid: 0, todayRank: null };

    const [trophies, paid, todayRank] = await Promise.all([
      loadTrophies(ctx.db, link.username, ctx.user.id),
      lorewardCreditsPaid(ctx.db, ctx.user.id),
      rankInTodayRace(link.username),
    ]);
    return { wikiUsername: link.username, ...trophies, paid, todayRank };
  }),
});
