/**
 * The exchange router: admin procedures refuse members, failures map to tRPC codes,
 * and the procedures act as the signed-in user, never one named in the input.
 */
jest.mock("~/server/modules/forum", () => ({
  syncUserToForum: jest.fn().mockResolvedValue(true),
}));

import { createCallerFactory } from "~/server/api/trpc";
import { exchangeRouter } from "~/server/api/routers/exchange";
import { invalidateExchangeConfigCache } from "~/lib/vault/exchange-config";
import { invalidateVaultConfigCache } from "~/lib/vault/vault-perks";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createFakeExchangeDb, type FakeDb } from "~/tests/helpers/fake-exchange-db";

const createCaller = createCallerFactory(exchangeRouter);
const ME = "user_db_id_1"; // createMockRouterContext's default user

let fake: FakeDb;

function setup(config: Record<string, string> = {}) {
  invalidateExchangeConfigCache();
  invalidateVaultConfigCache();
  fake = createFakeExchangeDb({
    user: [
      { id: ME, clerkUserId: "test_user_clerk_id" },
      { id: "other", clerkUserId: "c_other" },
    ],
    myVault: [{ id: "v1", userId: ME, credits: 500, lastDailyReset: new Date() }],
    exchangeWallet: [
      { id: "w1", userId: ME, sovereigns: 1000, lifetimeEarned: 1000, lifetimeSpent: 0 },
    ],
    company: [
      {
        id: "co_other",
        founderId: "other",
        name: "Other Co",
        sectorKey: "services",
        capital: 900,
        status: "ACTIVE",
      },
    ],
    systemConfig: Object.entries(config).map(([key, value]) => ({ key, value })),
  });
  // An ordinary member: admin rights go to the admin/staff/owner roles or level <= 20.
  const user = { id: ME, clerkUserId: "test_user_clerk_id", role: { name: "user", level: 100 } };
  return createCaller(createMockRouterContext({ db: fake.client, user }) as never);
}

beforeEach(() => {
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe("exchange router", () => {
  it("refuses admin procedures to members", async () => {
    const caller = setup();
    // The admin middleware's ForbiddenError reaches a direct caller wrapped; match its message.
    await expect(
      caller.adminResolveDispute({ contractId: "k1", outcome: "PAY_CONTRACTOR", note: "pay them" })
    ).rejects.toThrow(/Admin privileges required/);
    await expect(
      caller.adminAdjustSovereigns({ targetUserId: ME, amount: 1_000_000, reason: "gift" })
    ).rejects.toThrow(/Admin privileges required/);
    expect(fake.tables.exchangeWallet![0]!.sovereigns).toBe(1000);
    await expect(
      caller.adminSaveExchangeConfig({
        charterFee: 0,
        activeCompanyCap: 20,
        convertRate: 100,
        convertFee: 0,
        convertDailyLimit: 1_000_000,
        seedSovereigns: 100_000,
      })
    ).rejects.toThrow(/Admin privileges required/);
  });

  it("maps a closed Exchange to PRECONDITION_FAILED", async () => {
    const caller = setup({ vault_isExchangeEnabled: "false" });
    await expect(
      caller.convert({ direction: "CONVERT_IN", amount: 10, requestId: "request-0001" })
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    const overview = await caller.getOverview();
    expect(overview.isOpen).toBe(false);
  });

  it("converts for the signed-in user", async () => {
    const caller = setup();
    await caller.convert({ direction: "CONVERT_IN", amount: 100, requestId: "request-0002" });
    expect(fake.tables.myVault![0]!.credits).toBe(400);
    const overview = await caller.getOverview();
    expect(overview.wallet.sovereigns).toBe(1095);
    expect(overview.conversion.convertOutAllowance).toBe(95);
  });

  it("won't move another player's company capital", async () => {
    const caller = setup();
    await expect(
      caller.withdrawFromCompany({ companyId: "co_other", amount: 900, requestId: "request-0003" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(fake.tables.company![0]!.capital).toBe(900);
  });
});
