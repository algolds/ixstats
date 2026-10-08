/** @jest-environment node */
/**
 * Recruiter achievements count the player's approved invited claims (`RealmClaim.invitedByUserId`):
 * Recruiter (1), Envoy (5), Founder's Hand (25). They are account-level and pay nothing: no IxCredits,
 * no cards (owner ruling: achievements only).
 */

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
import { getAchievementById } from "~/lib/achievements/definitions";
import {
  ACCOUNT_LEVEL_ACHIEVEMENT_IDS,
  ACCOUNT_LEVEL_METRICS,
  RECRUITER_ACHIEVEMENT_IDS,
} from "~/lib/achievements/scope";
import { syncAchievements } from "~/lib/achievements/sync";
import { achievementService } from "~/lib/achievements/service";
import { getBonusConfig, grantBonus, VAULT_BONUS_DEFAULTS } from "~/lib/vault/vault-bonus";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const CLERK_ID = "clerk_recruiter";
const LADDER = [
  ["social-recruiter", "Recruiter", 1],
  ["social-envoy", "Envoy", 5],
  ["social-founders-hand", "Founder's Hand", 25],
] as const;

interface SyncedRow {
  key: string;
  title: string;
  category: string;
  rarity: string;
  conditionJson: string;
  rewardsJson: string;
}

async function syncedRows(): Promise<Map<string, SyncedRow>> {
  const db = createMockPrisma();
  jest.spyOn(console, "log").mockImplementation(() => {});
  await syncAchievements(db as never);
  const calls = db.achievement.upsert.mock.calls as [{ create: SyncedRow }][];
  return new Map(calls.map(([args]) => [args.create.key, args.create]));
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getBonusConfig).mockResolvedValue(VAULT_BONUS_DEFAULTS);
});

describe("recruiter achievement definitions", () => {
  it.each(LADDER)("%s (%s) unlocks at %d recruits, not one fewer", (id, title, threshold) => {
    const def = getAchievementById(id);
    expect(def).toMatchObject({ title, category: "Social" });
    expect(def!.condition({ recruitedCount: threshold } as never)).toBe(true);
    expect(def!.condition({ recruitedCount: threshold - 1 } as never)).toBe(false);
    expect(def!.condition({} as never)).toBe(false);
  });

  it("are account-level, read only recruitedCount and climb in rarity", () => {
    expect(ACCOUNT_LEVEL_METRICS.has("recruitedCount")).toBe(true);
    for (const [id] of LADDER) {
      expect(ACCOUNT_LEVEL_ACHIEVEMENT_IDS.has(id)).toBe(true);
      expect(RECRUITER_ACHIEVEMENT_IDS.has(id)).toBe(true);
    }
    expect(LADDER.map(([id]) => getAchievementById(id)!.rarity)).toEqual([
      "Common",
      "Uncommon",
      "Rare",
    ]);
  });

  it("sync as recruitedCount rules with no credits or cards", async () => {
    const rows = await syncedRows();
    for (const [id, , threshold] of LADDER) {
      const row = rows.get(id)!;
      expect(JSON.parse(row.conditionJson)).toEqual({
        metric: "recruitedCount",
        operator: ">=",
        value: threshold,
      });
      expect(JSON.parse(row.rewardsJson)).toEqual({ credits: 0, cardIds: [] });
    }
  });
});

describe("evaluating recruiter achievements", () => {
  async function setup(recruited: number) {
    const rows = await syncedRows();
    const db = createMockPrisma();
    db.user.findUnique.mockResolvedValue({
      id: "db_recruiter",
      createdAt: new Date(),
      countryId: null,
    });
    db.userAchievement.findMany.mockResolvedValue([]);
    db.thinkpagesPost.count.mockResolvedValue(0);
    db.cardOwnership.count.mockResolvedValue(0);
    db.cardOwnership.findMany.mockResolvedValue([]);
    db.realmClaim.count.mockResolvedValue(recruited);
    db.achievement.findMany.mockResolvedValue(
      LADDER.map(([id]) => ({
        ...rows.get(id)!,
        description: "",
        points: 10,
        iconUrl: null,
        triggerType: "SOCIAL",
        isActive: true,
      }))
    );
    return db;
  }

  it("counts the user's approved invited claims", async () => {
    const db = await setup(0);
    await achievementService.checkAndUnlock(CLERK_ID, null, db as never);
    expect(db.realmClaim.count).toHaveBeenCalledWith({
      where: { invitedByUserId: "db_recruiter", status: "approved" },
    });
  });

  it.each([
    [0, []],
    [1, ["social-recruiter"]],
    [4, ["social-recruiter"]],
    [5, ["social-envoy", "social-recruiter"]],
    [25, ["social-envoy", "social-founders-hand", "social-recruiter"]],
  ])("%d recruits unlock %j", async (recruited, expected) => {
    const db = await setup(recruited);
    const unlocked = await achievementService.checkAndUnlock(CLERK_ID, null, db as never);
    expect(unlocked.sort()).toEqual(expected);
  });

  it("pays no IxCredits for a recruiter unlock", async () => {
    const db = await setup(25);
    await achievementService.checkAndUnlock(CLERK_ID, null, db as never);
    expect(db.userAchievement.create).toHaveBeenCalledTimes(3);
    expect(grantBonus).not.toHaveBeenCalled();
  });
});
