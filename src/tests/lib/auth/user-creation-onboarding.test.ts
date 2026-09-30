/**
 * IxnayID onboarding: creating the account pays the new-player bonus and queues the first
 * achievement evaluation; an existing account does neither. The Vault balance read pays
 * the bonus to older accounts that never received it.
 */

jest.mock("@clerk/nextjs/server", () => ({ clerkClient: jest.fn() }));
jest.mock("~/lib/vault/vault-bonus", () => ({
  grantNewPlayerBonus: jest.fn().mockResolvedValue({ granted: true, amount: 5000 }),
  NEW_PLAYER_BONUS_ON_VAULT_OPEN: true,
}));
jest.mock("~/lib/achievements/queue", () => ({ queueAchievementCheck: jest.fn() }));
jest.mock("~/lib/vault/vault-service", () => ({
  vaultService: { getBalance: jest.fn().mockResolvedValue({ credits: 5000 }) },
}));
jest.mock("~/lib/cache", () => ({
  ...jest.requireActual("~/lib/cache"),
  globalCache: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
  },
}));

import { UserManagementService } from "~/lib/auth/user-management-service";
import { grantNewPlayerBonus } from "~/lib/vault/vault-bonus";
import { queueAchievementCheck } from "~/lib/achievements/queue";
import { vaultService } from "~/lib/vault/vault-service";
import { createCallerFactory } from "~/server/api/trpc";
import { vaultBalanceCreditsRouter } from "~/server/api/routers/vault/balance-credits";
import { createMockPrisma } from "~/tests/helpers/mock-db";
import { createMockRouterContext } from "~/tests/helpers/router-context";

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "log").mockImplementation(() => {});
});

describe("UserManagementService.getOrCreateUser onboarding", () => {
  it("pays the new-player bonus and queues achievements when it creates the account", async () => {
    const db = createMockPrisma();
    db.user.findUnique.mockResolvedValue(null);
    db.role.findUnique.mockResolvedValue({ id: "role_user" });
    db.user.create.mockResolvedValue({ id: "user_new", clerkUserId: "clerk_new", role: null });

    const user = await new UserManagementService(db as never).getOrCreateUser("clerk_new");

    expect(user?.id).toBe("user_new");
    expect(grantNewPlayerBonus).toHaveBeenCalledWith(db, "user_new", "account_created");
    expect(queueAchievementCheck).toHaveBeenCalledWith("user_new");
  });

  it("does nothing for an account that already exists", async () => {
    const db = createMockPrisma();
    db.user.findUnique.mockResolvedValue({ id: "user_old", clerkUserId: "clerk_old" });

    await new UserManagementService(db as never).getOrCreateUser("clerk_old");

    expect(grantNewPlayerBonus).not.toHaveBeenCalled();
    expect(queueAchievementCheck).not.toHaveBeenCalled();
  });
});

describe("vault.getBalance", () => {
  it("pays an older account its missing new-player bonus before reading the balance", async () => {
    const db = createMockPrisma();
    const caller = createCallerFactory(vaultBalanceCreditsRouter)(
      createMockRouterContext({
        db,
        user: { id: "user_db_id_1", clerkUserId: "test_user_clerk_id", countryId: null },
      }) as never
    );

    const balance = await caller.getBalance();

    expect(grantNewPlayerBonus).toHaveBeenCalledWith(db, "test_user_clerk_id", "vault_opened");
    const grantOrder = jest.mocked(grantNewPlayerBonus).mock.invocationCallOrder[0]!;
    const readOrder = jest.mocked(vaultService.getBalance).mock.invocationCallOrder[0]!;
    expect(grantOrder).toBeLessThan(readOrder);
    expect(balance).toEqual({ credits: 5000 });
  });
});
