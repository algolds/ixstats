/** @jest-environment node */
/**
 * Background achievement evaluation: the queue fed by one-line hooks at event sites, the
 * worker that drains it, the `achievements-evaluate` cron job, and the `/achievements`
 * sync for a user with no country.
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

import {
  inMemoryQueueLength,
  MAX_IN_MEMORY_QUEUE,
  queueAchievementCheck,
  resetAchievementQueue,
} from "~/lib/achievements/queue";
import { achievementService } from "~/lib/achievements/service";
import {
  ACHIEVEMENT_EVAL_ACTIVE_WINDOW_MS,
  evaluateRecentlyActiveUsers,
} from "~/lib/achievements/evaluate-cron";
import { eventBus } from "~/lib/event-bus";
import { getBonusConfig, grantBonus, VAULT_BONUS_DEFAULTS } from "~/lib/vault/vault-bonus";
import { createCallerFactory } from "~/server/api/trpc";
import { achievementsManagementRouter } from "~/server/api/routers/achievements/management";
import { createMockPrisma } from "~/tests/helpers/mock-db";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const welcome = {
  key: "gen-welcome",
  title: "Welcome to IxStats",
  description: "Create your account",
  category: "General",
  rarity: "Common",
  points: 5,
  iconUrl: null,
  triggerType: "GENERAL",
  conditionJson: JSON.stringify({ metric: "always_true", operator: "==", value: true }),
  rewardsJson: null,
  isActive: true,
};

function accountDb(user: { id: string; clerkUserId: string; countryId: string | null }) {
  const db = createMockPrisma();
  db.user.findFirst.mockResolvedValue(user);
  db.user.findUnique.mockResolvedValue({ ...user, createdAt: new Date() });
  db.thinkpagesPost.count.mockResolvedValue(0);
  db.cardOwnership.count.mockResolvedValue(0);
  db.achievement.findMany.mockResolvedValue([welcome]);
  return db;
}

beforeEach(() => {
  jest.clearAllMocks();
  resetAchievementQueue();
  jest.mocked(getBonusConfig).mockResolvedValue(VAULT_BONUS_DEFAULTS);
});

describe("queueAchievementCheck", () => {
  it("is safe to call from any event site", () => {
    expect(() => queueAchievementCheck(undefined)).not.toThrow();
    expect(() => queueAchievementCheck(null)).not.toThrow();
    expect(inMemoryQueueLength()).toBe(0);

    queueAchievementCheck("user_1");
    queueAchievementCheck("user_1"); // already waiting → dropped
    queueAchievementCheck("user_1", "country_1");
    expect(inMemoryQueueLength()).toBe(2);
  });

  it("caps the in-process queue", () => {
    for (let i = 0; i < MAX_IN_MEMORY_QUEUE + 5; i++) queueAchievementCheck(`u${i}`);
    expect(inMemoryQueueLength()).toBe(MAX_IN_MEMORY_QUEUE);
  });

  it("is fed by the event bus, with or without a country", () => {
    eventBus.publish("user:signup", { userId: "clerk_2" });
    eventBus.publish("country:updated", { userId: "clerk_3", countryId: "c3" });
    eventBus.publish("country:updated", { countryId: "c3" }); // no user → ignored
    expect(inMemoryQueueLength()).toBe(2);
  });
});

describe("AchievementService queue worker", () => {
  it("evaluates a queued user by internal id against their active country, and pays", async () => {
    const db = accountDb({ id: "user_db_1", clerkUserId: "clerk_1", countryId: null });
    const checkSpy = jest.spyOn(achievementService, "checkAndUnlock");
    queueAchievementCheck("user_db_1");

    const unlocked = await achievementService.processNextQueueItem(db as never);

    expect(checkSpy).toHaveBeenCalledWith("clerk_1", null, db);
    expect(unlocked).toEqual(["gen-welcome"]);
    expect(grantBonus).toHaveBeenCalledWith(
      db,
      "clerk_1",
      "bonus:achievement:gen-welcome",
      100,
      expect.objectContaining({ oneTime: true })
    );
    expect(inMemoryQueueLength()).toBe(0);
    checkSpy.mockRestore();
  });

  it("uses the active country when the hook named none", async () => {
    const db = accountDb({ id: "user_db_1", clerkUserId: "clerk_1", countryId: "c_active" });
    const checkSpy = jest.spyOn(achievementService, "checkAndUnlock").mockResolvedValue([]);
    queueAchievementCheck("clerk_1");

    await achievementService.processNextQueueItem(db as never);

    expect(checkSpy).toHaveBeenCalledWith("clerk_1", "c_active", db);
    checkSpy.mockRestore();
  });

  it("lets the same user be queued again once processed", async () => {
    const db = accountDb({ id: "user_db_1", clerkUserId: "clerk_1", countryId: null });
    queueAchievementCheck("user_db_1");
    await achievementService.processNextQueueItem(db as never);

    queueAchievementCheck("user_db_1");
    expect(inMemoryQueueLength()).toBe(1);
  });

  it("returns null when idle and skips unknown users", async () => {
    const db = createMockPrisma();
    expect(await achievementService.processNextQueueItem(db as never)).toBeNull();

    queueAchievementCheck("ghost");
    expect(await achievementService.processNextQueueItem(db as never)).toEqual([]);
  });
});

describe("achievements-evaluate cron", () => {
  it("evaluates recently active users, with and without a country", async () => {
    const now = new Date("2026-09-30T12:00:00Z");
    const db = createMockPrisma();
    db.user.findMany.mockResolvedValue([
      { clerkUserId: "clerk_a", countryId: "c_a" },
      { clerkUserId: "clerk_b", countryId: null },
    ]);
    const checkSpy = jest
      .spyOn(achievementService, "checkAndUnlock")
      .mockResolvedValueOnce(["gen-one-week"])
      .mockResolvedValueOnce(["gen-welcome", "social-first-thinkpage"]);

    const result = await evaluateRecentlyActiveUsers(db as never, { now });

    expect(db.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          lastSeenAt: { gte: new Date(now.getTime() - ACHIEVEMENT_EVAL_ACTIVE_WINDOW_MS) },
          isActive: true,
        },
      })
    );
    expect(checkSpy).toHaveBeenNthCalledWith(1, "clerk_a", "c_a", db);
    expect(checkSpy).toHaveBeenNthCalledWith(2, "clerk_b", null, db);
    expect(result).toEqual({ usersEvaluated: 2, achievementsUnlocked: 3, failures: 0 });
    checkSpy.mockRestore();
  });
});

describe("achievements.syncMyCollectorAchievements", () => {
  it("evaluates a user with no country instead of refusing", async () => {
    const db = accountDb({ id: "db1", clerkUserId: "clerk_nc", countryId: null });
    const caller = createCallerFactory(achievementsManagementRouter)(
      createMockRouterContext({
        db,
        auth: { userId: "clerk_nc" },
        user: { id: "db1", clerkUserId: "clerk_nc", countryId: null },
      }) as never
    );

    const res = await caller.syncMyCollectorAchievements();

    expect(res).toEqual({ success: true, unlocked: ["gen-welcome"], countryEvaluated: false });
  });
});
