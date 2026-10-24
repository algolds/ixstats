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
import { IXWIKI, ownerOfName } from "~/lib/identity/wiki-names";
import { loadMyTrophies, myRaceEntry, viewerNames } from "~/lib/lorewards/my-trophies";
import { getTodayRace, type TodayRace } from "~/lib/lorewards/today-race";
import { loadTrophies, lorewardCreditsPaid } from "~/lib/lorewards/trophy-summary";

/** How long a read of the viewer's race entry waits for a cold race before it leaves the entry out. */
const RACE_WAIT_MS = 2_000;

/**
 * A read over today's race (`read`). The race scores a whole UTC day, so it never holds a query back: the race and
 * the read share one two-second budget, and a slow or failed run only gives null.
 */
async function withinRaceBudget<T>(
  read: (race: TodayRace) => Promise<T | null>
): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const waited = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), RACE_WAIT_MS);
  });
  try {
    return await Promise.race([getTodayRace().then(read), waited]);
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
   * A wiki user's trophies (rate-limited: any name can be asked for). The cards are those held by the owner of
   * the name's approved claim while they show it (a hidden claim names no holder), and are left out when that
   * account hides its Vault cards on its passport.
   */
  getTrophies: rateLimitedPublicProcedure
    .input(z.object({ username: z.string().min(1).max(200) }))
    .query(async ({ ctx, input }) => {
      const holder = await ownerOfName(ctx.db, IXWIKI, input.username, { shown: true });
      const showCards = holder ? (await loadPassportSettings(holder)).visibility.vaultCards : false;
      return loadTrophies(
        ctx.db,
        input.username,
        showCards ? holder : null,
        loadPassportHandleById
      );
    }),

  /**
   * The viewer's trophies (`loadMyTrophies`: the cards their account owns, and only the places the payout rule pays
   * to them), what Loreward bonuses paid, and today's rank (null with no wiki name).
   */
  getMyTrophies: protectedProcedure.query(async ({ ctx }) => {
    const names = await viewerNames(ctx.db, ctx.user.id);
    const mine = await loadMyTrophies(ctx.db, ctx.user.id, names);
    const [paid, entry] = await Promise.all([
      lorewardCreditsPaid(ctx.db, ctx.user.id),
      mine.wikiUsername
        ? withinRaceBudget((race) => myRaceEntry(ctx.db, race, names, ctx.user.id))
        : null,
    ]);
    return { ...mine, paid, todayRank: entry?.rank ?? null };
  }),

  /** The viewer's own entry in today's race: null with no wiki name, or when the race is slow or failed. */
  getMyRace: protectedProcedure.query(async ({ ctx }) => {
    const names = await viewerNames(ctx.db, ctx.user.id);
    if (names.claimed.length === 0 && names.labels.length === 0) return { entry: null };
    const entry = await withinRaceBudget((race) => myRaceEntry(ctx.db, race, names, ctx.user.id));
    return { entry: entry ? { rank: entry.rank, score: entry.score } : null };
  }),
});
