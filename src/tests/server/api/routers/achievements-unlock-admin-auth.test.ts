// `jest` is deliberately NOT imported from "@jest/globals" — the hoisted jest.mock() factory
// below relies on the ambient global (see trpc-impersonation.test.ts).
jest.mock("~/lib/achievements/service", () => ({
  __esModule: true,
  achievementService: {
    unlockSpecific: jest.fn().mockResolvedValue(true),
    checkAndUnlock: jest.fn().mockResolvedValue([]),
  },
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { achievementsManagementRouter } from "~/server/api/routers/achievements/management";
import { achievementService } from "~/lib/achievements/service";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockDb } from "~/tests/helpers/transactional-mock-db";

const createCaller = createCallerFactory(achievementsManagementRouter);

const unlockInput = {
  userId: "victim_clerk_id",
  achievementId: "first_steps",
  title: "First Steps",
};

describe("achievements.unlock is admin-only", () => {
  beforeEach(() => {
    (achievementService.unlockSpecific as jest.Mock).mockClear();
  });

  it("rejects an ordinary user granting an achievement to another user, and grants nothing", async () => {
    const db = createMockDb();
    const caller = createCaller(
      createMockRouterContext({
        auth: { userId: "user_1" },
        user: { id: "db1", clerkUserId: "user_1", role: { name: "user", level: 100 } },
        db,
      }) as never
    );

    await expect(caller.unlock(unlockInput)).rejects.toThrow(/Admin privileges required/);
    expect(achievementService.unlockSpecific).not.toHaveBeenCalled();
  });

  it("rejects an ordinary user granting an achievement to themselves", async () => {
    const db = createMockDb();
    const caller = createCaller(
      createMockRouterContext({
        auth: { userId: "user_1" },
        user: { id: "db1", clerkUserId: "user_1", role: { name: "user", level: 100 } },
        db,
      }) as never
    );

    await expect(caller.unlock({ ...unlockInput, userId: "user_1" })).rejects.toThrow(
      /Admin privileges required/
    );
    expect(achievementService.unlockSpecific).not.toHaveBeenCalled();
  });

  it("lets an admin grant an achievement", async () => {
    const db = createMockDb();
    const caller = createCaller(
      createMockRouterContext({
        auth: { userId: "admin_1" },
        user: { id: "db_admin", clerkUserId: "admin_1", role: { name: "admin", level: 10 } },
        db,
      }) as never
    );

    const result = await caller.unlock(unlockInput);

    expect(achievementService.unlockSpecific).toHaveBeenCalledWith(
      "victim_clerk_id",
      "first_steps",
      db
    );
    expect(result.creditsEarned).toBe(5);
  });
});
