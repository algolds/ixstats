/** @jest-environment node */
/**
 * Achievements pay IxCredits through the vault ledger, so each unlock must pay exactly once. Nia joined ten days ago
 * and has no nation. The queue worker (fed by her User.id, as the event hooks do) unlocks her account achievements,
 * keyed by her Clerk id, and pays each once; the cron's next pass, a run racing another, and a held unlock pay
 * nothing; the Vault board shows what each unlock actually paid, and the public leaderboard names players without a
 * Clerk id. A loader whose query fails leaves its rules unmet and the evaluation carries on.
 *
 * Retired (Legacy) achievements never unlock, even with a stale rule met and the row switched back on, but what a
 * player already holds counts toward the hunter tier, which cascades in the same evaluation. Country achievements
 * need the nation: Omar's shrinking economy earns Stonks only when his nation is evaluated, and a nation that is gone
 * falls back to account-level achievements. Recruiting climbs Recruiter / Envoy / Founder's Hand at 1, 5 and 25
 * distinct approved recruits and pays nothing.
 *
 * Folds account-achievements, background-evaluation, legacy-achievements, recruiter-achievements,
 * achievements-player-board, vidmaster-pack and metric-registry's loader cases. The metric thresholds and the
 * definitions' integrity are one table per family in lib/achievements/metric-thresholds.test.ts.
 */
let mockDb: unknown;
jest.mock("~/server/db", () => ({
  get db() {
    return mockDb;
  },
}));
jest.mock("~/lib/notifications/hooks", () => ({
  __esModule: true,
  notificationHooks: { onAchievementUnlock: jest.fn().mockResolvedValue(undefined) },
}));

import packs from "../../../../prisma/seeds/data/card-packs.json";
import { evaluateRecentlyActiveUsers } from "~/lib/achievements/evaluate-cron";
import { queueAchievementCheck, resetAchievementQueue } from "~/lib/achievements/queue";
import { achievementService } from "~/lib/achievements/service";
import { syncAchievements, VIDMASTER_REWARD_PACK_ID } from "~/lib/achievements/sync";
import { achievementsProgressRouter } from "~/server/api/routers/achievements/progress";
import { createCallerFactory } from "~/server/api/trpc";
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";
import { creditsOf, ledgerOf } from "~/tests/helpers/money-world";
import { addIxnay, addNation } from "~/tests/helpers/nation-world";
import { createMockCallerContext } from "~/tests/helpers/router-context";

const board = createCallerFactory(achievementsProgressRouter);
const DAY = 86_400_000;
const RECRUITER_KEYS = ["social-recruiter", "social-envoy", "social-founders-hand"];

interface Totals {
  userId: string;
  totalPoints: number;
  achievementCount: number;
  rareAchievements: number;
}

let db: MemoryPrisma;

/** A member who signed up `days` ago, with an empty vault. */
async function member(id: string, days = 10) {
  await db.user.create({
    data: {
      id,
      clerkUserId: `${id}-clerk`,
      createdAt: new Date(Date.now() - days * DAY),
      lastSeenAt: new Date(),
    },
  });
  await db.myVault.create({ data: { userId: id, credits: 0 } });
  return { id, clerk: `${id}-clerk` };
}

/** The achievement payouts in a member's ledger, as [achievement key, credits]. */
async function payouts(userId: string) {
  return (await ledgerOf(db as never, userId))
    .filter((e) => e.source?.startsWith("bonus:achievement:"))
    .map((e) => [e.source!.slice("bonus:achievement:".length), e.credits] as const);
}

const unlockedKeys = async (clerk: string) =>
  (await db.userAchievement.findMany({ where: { userId: clerk } }))
    .map((u) => u.achievementId)
    .sort();

const as = (who: { id: string; clerk: string } | null) =>
  createMockCallerContext({
    db,
    auth: who ? { userId: who.clerk } : null,
    user: who ? { id: who.id, clerkUserId: who.clerk } : null,
    rateLimitIdentifier: `${who?.id}-${Math.random()}`,
  });

beforeEach(async () => {
  for (const level of ["log", "info", "warn", "error"] as const) {
    jest.spyOn(console, level).mockImplementation(() => undefined);
  }
  resetAchievementQueue();
  db = createMemoryPrisma();
  mockDb = db;
  // The platform loaders' raw aggregates: no posts and no wiki edits here. The Renaissance week query has no
  // handler, so that loader fails every evaluation and its rules stay unmet.
  db.store.onRaw(/AS day FROM "ThinkpagesPost"/, () => []);
  db.store.onRaw(/AS edits,/, () => []);
  // The leaderboard's totals, grouped as the SQL groups them
  db.store.onRaw(/FROM "UserAchievement" ua JOIN "Achievement" a/, (_values, _text, store) => {
    const achievements = new Map(store.rows("Achievement").map((a) => [String(a.key), a]));
    const totals = new Map<string, Totals>();
    for (const ua of store.rows("UserAchievement")) {
      const userId = String(ua.userId);
      const a = achievements.get(String(ua.achievementId));
      const t = totals.get(userId) ?? {
        userId,
        totalPoints: 0,
        achievementCount: 0,
        rareAchievements: 0,
      };
      t.totalPoints += Number(a?.points ?? 0);
      if (a?.isActive) t.achievementCount += 1;
      totals.set(userId, t);
    }
    return [...totals.values()].sort(
      (x, y) => y.totalPoints - x.totalPoints || x.userId.localeCompare(y.userId)
    );
  });
  await syncAchievements(db as never);
});
afterEach(() => jest.restoreAllMocks());

it("pays each of Nia's unlocks once, whichever run finds it, and shows what each paid", async () => {
  const nia = await member("nia");
  queueAchievementCheck(nia.id);
  const unlocked = await achievementService.processNextQueueItem(db as never);

  expect(unlocked?.sort()).toEqual(["gen-one-week", "gen-welcome"]);
  expect(await unlockedKeys(nia.clerk)).toEqual(["gen-one-week", "gen-welcome"]);
  const paid = await payouts(nia.id);
  expect(paid.map(([key]) => key).sort()).toEqual(["gen-one-week", "gen-welcome"]);
  expect(paid.every(([, credits]) => credits > 0)).toBe(true);
  const total = paid.reduce((sum, [, credits]) => sum + credits, 0);
  expect(await creditsOf(db as never, [nia.id])).toEqual({ nia: total });

  // The cron's next pass and a second worker run find nothing new and pay nothing
  expect(await evaluateRecentlyActiveUsers(db as never, { now: new Date() })).toMatchObject({
    achievementsUnlocked: 0,
    failures: 0,
  });
  queueAchievementCheck(nia.clerk);
  expect(await achievementService.processNextQueueItem(db as never)).toEqual([]);
  expect(await payouts(nia.id)).toHaveLength(2);

  // Two evaluations racing for a new member: each unlock is created once and paid once
  const ola = await member("ola");
  const [first, second] = await Promise.all([
    achievementService.checkAndUnlock(ola.clerk, null, db as never),
    achievementService.checkAndUnlock(ola.clerk, null, db as never),
  ]);
  expect([...first, ...second].sort()).toEqual(["gen-one-week", "gen-welcome"]);
  expect((await payouts(ola.id)).map(([key]) => key).sort()).toEqual([
    "gen-one-week",
    "gen-welcome",
  ]);

  // The board shows what each unlock paid; the public leaderboard never names a Clerk id
  const summary = await board(as(nia)).getMySummary();
  expect(summary.recent.map((r) => [r.key, r.reward]).sort()).toEqual([...paid].sort());
  await expect(board(as(null)).getMySummary()).rejects.toThrow(/Authentication required/);
  const leaders = await board(as(null)).getPlayerLeaderboard({ limit: 1 });
  expect(leaders).toHaveLength(1);
  expect(JSON.stringify(leaders)).not.toMatch(/-clerk/);
  expect(leaders[0]?.isViewer).toBe(false);

  // The Vidmaster achievements reward a pack that the seed creates
  expect(packs.map((pack) => pack.id)).toContain(VIDMASTER_REWARD_PACK_ID);
});

it("never unlocks a retired achievement, yet counts the Legacy ones held toward the hunter tier", async () => {
  const nia = await member("nia");
  const retired = (await db.achievement.findMany({ where: { isActive: false } })).map((a) => a.key);
  expect(retired).toContain("econ-growth-rocket");
  for (const key of retired.slice(0, 9)) {
    await db.userAchievement.create({
      data: {
        userId: nia.clerk,
        achievementId: key,
        title: key,
        description: "",
        category: "Nation",
        rarity: "Common",
      },
    });
  }

  // Nine held and two new make eleven: the hunter tier unlocks in the same evaluation
  const unlocked = await achievementService.checkAndUnlock(nia.clerk, null, db as never);
  expect(unlocked).toEqual(
    expect.arrayContaining(["gen-welcome", "gen-one-week", "gen-achievement-hunter"])
  );
  expect(unlocked.filter((key) => retired.includes(key))).toEqual([]);

  // A retired row switched back on, its stale rule met by a booming nation, still never unlocks
  await addIxnay(db as never);
  await addNation(db as never, { id: "boomland", name: "Boomland", baselineDate: new Date() });
  await db.country.update({
    where: { id: "boomland" },
    data: { adjustedGdpGrowth: 25, actualGdpGrowth: 25 },
  });
  await db.achievement.update({
    where: { key: "econ-growth-rocket" },
    data: {
      isActive: true,
      conditionJson: JSON.stringify({ metric: "adjustedGdpGrowth", operator: ">=", value: 10 }),
    },
  });
  const ben = await member("ben");
  expect(await achievementService.checkAndUnlock(ben.clerk, "boomland", db as never)).not.toContain(
    "econ-growth-rocket"
  );
  expect((await payouts(ben.id)).map(([key]) => key)).not.toContain("econ-growth-rocket");
});

it("unlocks a country achievement only against the nation, and falls back when the nation is gone", async () => {
  await addIxnay(db as never);
  await addNation(db as never, { id: "omaria", name: "Omaria", baselineDate: new Date() });
  await db.country.update({
    where: { id: "omaria" },
    data: { adjustedGdpGrowth: -3, actualGdpGrowth: -3 },
  });
  const omar = await member("omar");

  expect(await achievementService.checkAndUnlock(omar.clerk, "gone", db as never)).not.toContain(
    "meme-stonks"
  );
  expect(await unlockedKeys(omar.clerk)).toEqual(["gen-one-week", "gen-welcome"]);
  expect(await achievementService.checkAndUnlock(omar.clerk, null, db as never)).toEqual([]);

  const withNation = await achievementService.checkAndUnlock(omar.clerk, "omaria", db as never);
  expect(withNation).toEqual(expect.arrayContaining(["meme-stonks", "gen-first-country"]));
  expect((await payouts(omar.id)).map(([key]) => key)).toEqual(
    expect.arrayContaining(["meme-stonks"])
  );
});

it.each([
  ["no recruit", 0, 1, []],
  ["one recruit", 1, 1, ["social-recruiter"]],
  ["one recruit approved in five realms", 1, 5, ["social-recruiter"]],
  ["five recruits", 5, 1, ["social-envoy", "social-recruiter"]],
  ["twenty-five recruits", 25, 1, ["social-envoy", "social-founders-hand", "social-recruiter"]],
] as const)(
  "an inviter with %s unlocks %j and is paid nothing for them",
  async (_case, recruits, realms, expected) => {
    const rae = await member("rae");
    for (let r = 0; r < realms; r++) {
      await db.realm.create({
        data: {
          id: `realm${r}`,
          slug: `realm${r}`,
          name: `Realm ${r}`,
          ownerId: "founder",
          status: "published",
        },
      });
    }
    for (let n = 0; n < recruits; n++) {
      const recruit = await member(`recruit${n}`);
      for (let r = 0; r < realms; r++) {
        await db.realmClaim.create({
          data: {
            realmId: `realm${r}`,
            userId: recruit.id,
            status: "approved",
            invitedByUserId: rae.id,
          },
        });
      }
    }
    // A pending claim is no recruit
    const pending = await member("pending");
    await db.realmClaim.create({
      data: { realmId: "realm0", userId: pending.id, status: "pending", invitedByUserId: rae.id },
    });

    queueAchievementCheck(rae.id);
    await achievementService.processNextQueueItem(db as never);

    expect((await unlockedKeys(rae.clerk)).filter((key) => RECRUITER_KEYS.includes(key))).toEqual(
      expected
    );
    expect((await payouts(rae.id)).filter(([key]) => RECRUITER_KEYS.includes(key))).toEqual([]);
  }
);

it("credits Lorewards wins only through a verified wiki link, never a bare or unverified wiki name", async () => {
  const nia = await member("nia");
  const ben = await member("ben");
  const cy = await member("cy");
  await db.user.update({ where: { id: "ben" }, data: { wikiUsername: "Ben Wiki" } });
  await db.wikiAccountLink.create({
    data: { userId: nia.id, source: "ixwiki", username: "Nia Wiki", verifiedAt: new Date() },
  });
  await db.wikiAccountLink.create({
    data: { userId: cy.id, source: "ixwiki", username: "Cy Wiki" },
  });
  for (const username of ["Nia Wiki", "Ben Wiki", "Cy Wiki"]) {
    await db.lorewardUserStats.create({
      data: { username, dailyWins: 5, weeklyWins: 0, monthlyWins: 0, totalScore: 50 } as never,
    });
  }

  const lorewards = async (who: { clerk: string }) =>
    (await achievementService.checkAndUnlock(who.clerk, null, db as never)).filter((key) =>
      key.startsWith("lorewards-")
    );
  expect((await lorewards(nia)).sort()).toEqual(["lorewards-daily-5", "lorewards-first"]);
  expect(await lorewards(ben)).toEqual([]);
  expect(await lorewards(cy)).toEqual([]);
});
