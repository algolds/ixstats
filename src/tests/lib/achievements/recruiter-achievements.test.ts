/** @jest-environment node */
/**
 * Recruiter achievements count the player's distinct recruits (claimants of approved claims naming them as
 * inviter, `RealmClaim.invitedByUserId`): Recruiter (1), Envoy (5), Founder's Hand (25). They are
 * account-level, so a nation-less inviter queued by User.id unlocks them, and pay nothing: no IxCredits, no
 * cards (owner ruling: achievements only).
 */

jest.mock("~/server/db", () => {
  const { createMockPrisma } =
    jest.requireActual<typeof import("~/tests/helpers/mock-db")>("~/tests/helpers/mock-db");
  return { __esModule: true, db: createMockPrisma() };
});
jest.mock("~/lib/vault/vault-bonus", () => ({
  ...jest.requireActual("~/lib/vault/vault-bonus"),
  getBonusConfig: jest.fn(),
  grantBonus: jest.fn().mockResolvedValue({ granted: true, amount: 100 }),
}));
jest.mock("~/lib/cards/card-service", () => ({ awardAchievementCard: jest.fn() }));
jest.mock("~/lib/activity", () => ({
  ActivityHooks: { User: { onAchievementUnlocked: jest.fn().mockResolvedValue(undefined) } },
}));
jest.mock("~/lib/notifications/hooks", () => ({
  notificationHooks: { onAchievementUnlock: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock("~/lib/achievements/scaling", () => ({
  ...jest.requireActual("~/lib/achievements/scaling"),
  getScaleThresholds: jest.fn().mockResolvedValue({}),
}));

import { beforeEach, describe, expect, it } from "@jest/globals";
import { db } from "~/server/db";
import {
  getAchievementById,
  type CountryDataForAchievements,
  type ExtendedAchievementData,
} from "~/lib/achievements/definitions";
import { queueAchievementCheck, resetAchievementQueue } from "~/lib/achievements/queue";
import {
  ACCOUNT_LEVEL_ACHIEVEMENT_IDS,
  ACCOUNT_LEVEL_METRICS,
  RECRUITER_ACHIEVEMENT_IDS,
} from "~/lib/achievements/scope";
import { syncAchievements } from "~/lib/achievements/sync";
import { achievementService } from "~/lib/achievements/service";
import { getBonusConfig, grantBonus, VAULT_BONUS_DEFAULTS } from "~/lib/vault/vault-bonus";
import type { MockPrismaProxy } from "~/tests/helpers/mock-db";

/** The mocked client: `db` (typed as the PrismaClient) and its jest handles are the same object. */
const mockDb = jest.requireMock<{ db: MockPrismaProxy }>("~/server/db").db;

const CLERK_ID = "clerk_recruiter";
const USER_ID = "db_recruiter";
const LADDER = [
  ["social-recruiter", "Recruiter", 1],
  ["social-envoy", "Envoy", 5],
  ["social-founders-hand", "Founder's Hand", 25],
] as const;

/** A country for the definition conditions' data type; recruiter conditions never read it. */
const COUNTRY: CountryDataForAchievements = {
  id: "c1",
  currentTotalGdp: 0,
  currentGdpPerCapita: 0,
  currentPopulation: 0,
  economicTier: "Tier 5",
  adjustedGdpGrowth: 0,
  populationGrowthRate: 0,
  actualGdpGrowth: 0,
  createdAt: new Date(0),
};
const withRecruits = (recruitedCount?: number): ExtendedAchievementData => ({
  country: COUNTRY,
  recruitedCount,
});

interface SyncedRow {
  key: string;
  title: string;
  category: string;
  rarity: string;
  conditionJson: string;
  rewardsJson: string;
}

/** What `syncAchievements` writes for each built-in definition, by key. */
async function syncedRows(): Promise<Map<string, SyncedRow>> {
  jest.spyOn(console, "log").mockImplementation(() => {});
  mockDb.achievement.upsert.mockClear();
  await syncAchievements(db);
  const rows: SyncedRow[] = mockDb.achievement.upsert.mock.calls.map(
    ([args]: [{ create: SyncedRow }]) => args.create
  );
  return new Map(rows.map((row) => [row.key, row]));
}

/** `claimants`: the approved invited claims' claimant ids (the database answers them distinct). */
async function recruiterWith(claimants: string[], countryId: string | null = null) {
  const rows = await syncedRows();
  const user = { id: USER_ID, clerkUserId: CLERK_ID, createdAt: new Date(), countryId };
  mockDb.user.findUnique.mockResolvedValue(user);
  mockDb.user.findFirst.mockResolvedValue(user);
  mockDb.userAchievement.findMany.mockResolvedValue([]);
  mockDb.userAchievement.create.mockResolvedValue({});
  mockDb.thinkpagesPost.count.mockResolvedValue(0);
  mockDb.cardOwnership.count.mockResolvedValue(0);
  mockDb.cardOwnership.findMany.mockResolvedValue([]);
  mockDb.realmClaim.findMany.mockResolvedValue(
    [...new Set(claimants)].map((userId) => ({ userId }))
  );
  mockDb.achievement.findMany.mockResolvedValue(
    LADDER.map(([id]) => ({
      ...rows.get(id),
      description: "",
      points: 10,
      iconUrl: null,
      triggerType: "SOCIAL",
      isActive: true,
    }))
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  resetAchievementQueue();
  jest.mocked(getBonusConfig).mockResolvedValue(VAULT_BONUS_DEFAULTS);
});

describe("recruiter achievement definitions", () => {
  it.each(LADDER)("%s (%s) unlocks at %d recruits, not one fewer", (id, title, threshold) => {
    const def = getAchievementById(id);
    expect(def).toMatchObject({ title, category: "Social" });
    expect(def?.condition(withRecruits(threshold))).toBe(true);
    expect(def?.condition(withRecruits(threshold - 1))).toBe(false);
    expect(def?.condition(withRecruits())).toBe(false);
  });

  it("are account-level, read only recruitedCount and climb in rarity", () => {
    expect(ACCOUNT_LEVEL_METRICS.has("recruitedCount")).toBe(true);
    for (const [id] of LADDER) {
      expect(ACCOUNT_LEVEL_ACHIEVEMENT_IDS.has(id)).toBe(true);
      expect(RECRUITER_ACHIEVEMENT_IDS.has(id)).toBe(true);
    }
    expect(LADDER.map(([id]) => getAchievementById(id)?.rarity)).toEqual([
      "Common",
      "Uncommon",
      "Rare",
    ]);
  });

  it("sync as recruitedCount rules with no credits or cards", async () => {
    const rows = await syncedRows();
    for (const [id, , threshold] of LADDER) {
      const row = rows.get(id);
      expect(JSON.parse(row?.conditionJson ?? "{}")).toEqual({
        metric: "recruitedCount",
        operator: ">=",
        value: threshold,
      });
      expect(JSON.parse(row?.rewardsJson ?? "{}")).toEqual({ credits: 0, cardIds: [] });
    }
  });
});

describe("evaluating recruiter achievements", () => {
  it("counts the user's distinct recruits", async () => {
    await recruiterWith([]);
    await achievementService.checkAndUnlock(CLERK_ID, null, db);
    expect(mockDb.realmClaim.findMany).toHaveBeenCalledWith({
      where: { invitedByUserId: USER_ID, status: "approved" },
      distinct: ["userId"],
      select: { userId: true },
    });
  });

  it.each([
    [[], []],
    [["p1"], ["social-recruiter"]],
    [["p1", "p1", "p1", "p1", "p1"], ["social-recruiter"]],
    [
      ["p1", "p2", "p3", "p4", "p5"],
      ["social-envoy", "social-recruiter"],
    ],
    [
      Array.from({ length: 25 }, (_, n) => `p${n}`),
      ["social-envoy", "social-founders-hand", "social-recruiter"],
    ],
  ])("claimants %j unlock %j", async (claimants, expected) => {
    await recruiterWith(claimants);
    const unlocked = await achievementService.checkAndUnlock(CLERK_ID, null, db);
    expect(unlocked.sort()).toEqual(expected);
  });

  it("pays no IxCredits for a recruiter unlock", async () => {
    await recruiterWith(Array.from({ length: 25 }, (_, n) => `p${n}`));
    await achievementService.checkAndUnlock(CLERK_ID, null, db);
    expect(mockDb.userAchievement.create).toHaveBeenCalledTimes(3);
    expect(grantBonus).not.toHaveBeenCalled();
  });
});

describe("the queued check from an approval", () => {
  it("a nation-less inviter queued by User.id unlocks Recruiter with one recruit", async () => {
    await recruiterWith(["p1"]);
    queueAchievementCheck(USER_ID);

    const unlocked = await achievementService.processNextQueueItem();

    expect(unlocked).toEqual(["social-recruiter"]);
    expect(mockDb.user.findFirst).toHaveBeenCalledWith({
      where: { OR: [{ id: USER_ID }, { clerkUserId: USER_ID }] },
      select: { clerkUserId: true, countryId: true },
    });
    expect(mockDb.country.findUnique).not.toHaveBeenCalled();
    expect(mockDb.userAchievement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: CLERK_ID, achievementId: "social-recruiter" }),
    });
  });
});
