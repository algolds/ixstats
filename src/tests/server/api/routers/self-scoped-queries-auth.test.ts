// `jest` is deliberately NOT imported from "@jest/globals" here — see the note in
// trpc-impersonation.test.ts: the jest.mock() factories below call jest.fn() inline, and
// jest.mock() calls are hoisted above imports, so importing `jest` under that same name would
// shadow the ambient global those hoisted factories rely on.
jest.mock("~/lib/vault/vault-service", () => ({
  __esModule: true,
  vaultService: {
    getBalance: jest.fn().mockResolvedValue({
      credits: 100,
      lifetimeEarned: 100,
      lifetimeSpent: 0,
      vaultLevel: 1,
      vaultXp: 0,
    }),
  },
}));
jest.mock("~/lib/cache/advanced-cache-system", () => ({
  __esModule: true,
  globalCache: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn(),
    delete: jest.fn(),
  },
}));
jest.mock("~/lib/activity", () => ({
  __esModule: true,
  generateAndPostCitizenReaction: jest.fn(),
}));
jest.mock("~/lib/ai", () => ({
  __esModule: true,
  analyzePostSentiment: jest.fn(),
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { vaultBalanceCreditsRouter } from "~/server/api/routers/vault/balance-credits";
import { notificationsUserRouter } from "~/server/api/routers/notifications/user";
import { thinkpagesFeedRouter } from "~/server/api/routers/thinkpages/feed";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockDb } from "~/tests/helpers/transactional-mock-db";
import { vaultService } from "~/lib/vault/vault-service";

const createVaultCaller = createCallerFactory(vaultBalanceCreditsRouter);
const createNotificationsCaller = createCallerFactory(notificationsUserRouter);
const createThinkpagesCaller = createCallerFactory(thinkpagesFeedRouter);

describe("Self-scoped vault/notification queries (Finding 6)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("vault.getBalance takes identity from ctx.auth.userId, never from input", async () => {
    const db = createMockDb();
    const ctx = createMockRouterContext({
      auth: { userId: "user_self" },
      user: { id: "db_self", clerkUserId: "user_self", role: { name: "user", level: 100 } },
      db,
    });
    const caller = createVaultCaller(ctx as never);

    await caller.getBalance();

    expect(vaultService.getBalance).toHaveBeenCalledWith("user_self", expect.anything());
  });

  it("notifications.getUnreadCount ignores a spoofed input.userId and never queries the victim for an anonymous caller", async () => {
    const db = createMockDb();
    const ctx = createMockRouterContext({ auth: null, user: null, db });
    const caller = createNotificationsCaller(ctx as never);

    const result = await caller.getUnreadCount({ userId: "victim" } as never);

    expect(result).toEqual({ count: 0 });
    expect(db.user.findFirst).not.toHaveBeenCalled();
  });

  it("rejects an anonymous caller for thinkpages.calculateCountryMoodMetrics", async () => {
    const db = createMockDb();
    const ctx = createMockRouterContext({ auth: null, user: null, db });
    const caller = createThinkpagesCaller(ctx as never);

    await expect(caller.calculateCountryMoodMetrics()).rejects.toThrow();
  });

  it("rejects an anonymous caller for thinkpages.triggerCitizenReaction", async () => {
    const db = createMockDb();
    const ctx = createMockRouterContext({ auth: null, user: null, db });
    const caller = createThinkpagesCaller(ctx as never);

    await expect(caller.triggerCitizenReaction({ postId: "p" })).rejects.toThrow();
  });
});
