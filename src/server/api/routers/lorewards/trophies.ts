/**
 * Lorewards trophies: today's race, and a wiki user's wins, streak and trophy cards (public), plus the viewer's
 * own with what Loreward bonuses have paid them.
 */
import { z } from "zod/v4";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
  rateLimitedPublicProcedure,
} from "~/server/api/trpc";
import { loadPassportHandleById } from "~/server/modules/identity/identity.passport-handle";
import { loadPassportSettings } from "~/server/modules/identity/identity.privacy";
import { loadMyTrophies, myRaceRank, viewerNames } from "~/lib/lorewards/my-trophies";
import { verifiedLorewardUser } from "~/lib/lorewards/resolve-user";
import { getTodayRace, type TodayRace } from "~/lib/lorewards/today-race";
import { loadTrophies, lorewardCreditsPaid } from "~/lib/lorewards/trophy-summary";

/** How long `getMyTrophies` waits for a cold race before it leaves the rank out. */
const RACE_WAIT_MS = 2_000;

/**
 * The viewer's rank in today's race (`rankOf`). The race scores a whole UTC day, so it never holds the trophies
 * back: the race and the rank lookup share one two-second budget, and a slow or failed run only leaves the rank out.
 */
async function rankInTodayRace(
  rankOf: (race: TodayRace) => Promise<number | null>
): Promise<number | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const waited = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), RACE_WAIT_MS);
  });
  try {
    return await Promise.race([getTodayRace().then(rankOf), waited]);
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
   * A wiki user's trophies (rate-limited: any name can be asked for). The cards are those held by the account
   * that verified the name, and are left out when that account hides its Vault cards on its passport.
   */
  getTrophies: rateLimitedPublicProcedure
    .input(z.object({ username: z.string().min(1).max(200) }))
    .query(async ({ ctx, input }) => {
      const holder = await verifiedLorewardUser(ctx.db, input.username);
      const showCards = holder ? (await loadPassportSettings(holder)).visibility.vaultCards : false;
      return loadTrophies(
        ctx.db,
        input.username,
        showCards ? holder : null,
        loadPassportHandleById
      );
    }),

  /**
   * The viewer's trophies (`loadMyTrophies`: only the places the payout rule pays to them), what Loreward bonuses
   * paid, and today's rank.
   */
  getMyTrophies: protectedProcedure.query(async ({ ctx }) => {
    const names = await viewerNames(ctx.db, ctx.user.id);
    const mine = await loadMyTrophies(ctx.db, ctx.user.id, names);
    if (!mine.wikiUsername) return { ...mine, paid: 0, todayRank: null };

    const [paid, todayRank] = await Promise.all([
      lorewardCreditsPaid(ctx.db, ctx.user.id),
      rankInTodayRace((race) => myRaceRank(ctx.db, race, names, ctx.user.id)),
    ]);
    return { ...mine, paid, todayRank };
  }),
});
