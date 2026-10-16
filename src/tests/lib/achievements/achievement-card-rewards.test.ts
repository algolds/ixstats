/** @jest-environment node */
/**
 * Code audit VT-17: achievement cards were never awarded. The seed imported a module that no
 * longer existed, so the commemorative Card rows were never created and every award failed
 * with "Card not found". The definitions now live next to the reward mapping, and an unlock
 * grants the card.
 */

jest.mock("~/lib/vault/vault-bonus", () => ({
  ...jest.requireActual("~/lib/vault/vault-bonus"),
  getBonusConfig: jest.fn(),
  grantBonus: jest.fn().mockResolvedValue({ granted: true, amount: 100 }),
}));
jest.mock("~/lib/activity", () => ({
  ActivityHooks: { User: { onAchievementUnlocked: jest.fn().mockResolvedValue(undefined) } },
}));
jest.mock("~/lib/notifications/hooks", () => ({
  notificationHooks: { onAchievementUnlock: jest.fn().mockResolvedValue(undefined) },
}));

import {
  COMMEMORATIVE_CARD_DEFINITIONS,
  listAchievementCardRewards,
} from "~/lib/achievements/card-rewards";
import { getAchievementById } from "~/lib/achievements/definitions";
import { syncAchievements } from "~/lib/achievements/sync";
import { achievementService } from "~/lib/achievements/service";
import { getBonusConfig, VAULT_BONUS_DEFAULTS } from "~/lib/vault/vault-bonus";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const CLERK_ID = "clerk_veteran";
const DAY = 24 * 60 * 60 * 1000;

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getBonusConfig).mockResolvedValue(VAULT_BONUS_DEFAULTS);
  jest.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe("commemorative card definitions", () => {
  it("define one SPECIAL card for every achievement card reward", () => {
    const defs = new Map(COMMEMORATIVE_CARD_DEFINITIONS.map((d) => [d.id, d]));
    expect(defs.size).toBe(COMMEMORATIVE_CARD_DEFINITIONS.length);
    const rewards = listAchievementCardRewards();
    expect(rewards.length).toBeGreaterThan(0);
    for (const { achievementId, cardId } of rewards) {
      expect(getAchievementById(achievementId)).toBeDefined();
      expect(defs.get(cardId)).toMatchObject({ cardType: "SPECIAL" });
    }
    expect(new Set(rewards.map((r) => r.cardId))).toEqual(new Set(defs.keys()));
  });

  it("defines every commemorative card bound, in Ixnay, with no stats", () => {
    for (const card of COMMEMORATIVE_CARD_DEFINITIONS) {
      expect(card).toMatchObject({ cardType: "SPECIAL", realmId: "default", isBound: true });
      expect(card).not.toHaveProperty("stats");
    }
  });
});

describe("unlocking an achievement with a card reward", () => {
  it("grants the commemorative card", async () => {
    // rewardsJson exactly as the boot-time sync stores it
    const syncDb = createMockPrisma();
    await syncAchievements(syncDb as never);
    const synced = syncDb.achievement.upsert.mock.calls
      .map(([args]: any[]) => args.create)
      .find((row: any) => row.key === "gen-one-year");
    expect(JSON.parse(synced.rewardsJson).cardIds).toEqual(["card-achievement-veteran"]);

    const db = createMockPrisma({ $executeRaw: jest.fn().mockResolvedValue(1) });
    // the helper's $transaction hands its callback the raw target; hand it the proxy so mintCopy reaches every model
    db.$transaction = jest.fn((cb: (tx: typeof db) => Promise<never>) => cb(db));
    db.user.findUnique.mockResolvedValue({
      id: "user_db_1",
      createdAt: new Date(Date.now() - 400 * DAY),
      countryId: null,
    });
    db.thinkpagesPost.count.mockResolvedValue(0);
    db.cardOwnership.count.mockResolvedValue(0);
    db.achievement.findMany.mockResolvedValue([{ ...synced, iconUrl: null }]);
    // awardAchievementCard: resolve the user, find the seeded card, create the ownership
    db.user.findFirst.mockResolvedValue({ id: "user_db_1", clerkUserId: CLERK_ID });
    db.card.findUnique.mockResolvedValue({ id: "card-achievement-veteran", title: "Veteran" });
    db.cardOwnership.create.mockImplementation(async ({ data }: any) => data);

    const unlocked = await achievementService.checkAndUnlock(CLERK_ID, null, db as never);

    expect(unlocked).toContain("gen-one-year");
    expect(db.cardOwnership.create).toHaveBeenCalledWith({
      data: {
        cardId: "card-achievement-veteran",
        ownerId: "user_db_1",
        serialNumber: 1,
        finish: "STANDARD",
      },
    });
    expect(db.cardTransferEvent.create).toHaveBeenCalledWith({
      data: { ownershipId: undefined, toUserId: "user_db_1", action: "ACHIEVEMENT" },
    });
  });
});
