/**
 * The IxCredits ⇄ Sovereign bridge (D5, docs/specs/2026-10-06-exchange-economy-design.md §2):
 * rate and fee, the daily cap, the convert-out allowance, kill switches, idempotency.
 * Runs the real vault and Exchange ledgers against the in-memory database.
 */
jest.mock("~/server/modules/forum", () => ({
  syncUserToForum: jest.fn().mockResolvedValue(true),
}));

import { convert, quoteConversion } from "~/lib/exchange/conversion";
import { invalidateExchangeConfigCache } from "~/lib/vault/exchange-config";
import { invalidateVaultConfigCache } from "~/lib/vault/vault-perks";
import { createFakeExchangeDb, type FakeDb } from "~/tests/helpers/fake-exchange-db";

let fake: FakeDb;

function setup(config: Record<string, string> = {}, credits = 1000) {
  invalidateExchangeConfigCache();
  invalidateVaultConfigCache();
  fake = createFakeExchangeDb({
    user: [{ id: "u1", clerkUserId: "clerk_1" }],
    myVault: [{ id: "v1", userId: "u1", credits, lastDailyReset: new Date() }],
    // Created up front: the fake can't model Postgres making a racing insert wait on an
    // uncommitted one (wallet-creation races are covered in exchange-wallet-safety.test.ts).
    exchangeWallet: [
      { id: "w1", userId: "u1", sovereigns: 1000, lifetimeEarned: 1000, lifetimeSpent: 0 },
    ],
    systemConfig: Object.entries(config).map(([key, value]) => ({ key, value })),
  });
}

const credits = () => fake.tables.myVault![0]!.credits as number;
const sovereigns = () => fake.tables.exchangeWallet![0]!.sovereigns as number;
const run = (
  direction: "CONVERT_IN" | "CONVERT_OUT",
  amount: number,
  requestId = `req-${Math.random()}`
) => convert(fake.client, { userId: "u1", direction, amount, requestId });

beforeEach(() => {
  jest.spyOn(console, "log").mockImplementation(() => {});
  setup();
});
afterEach(() => jest.restoreAllMocks());

describe("quoteConversion", () => {
  it("takes the fee in ₷ and rounds the payout down", () => {
    expect(quoteConversion("CONVERT_IN", 100, { convertRate: 1, convertFee: 0.05 })).toMatchObject({
      ixCredits: 100,
      sovereigns: 95,
      fee: 5,
    });
    expect(quoteConversion("CONVERT_OUT", 95, { convertRate: 1, convertFee: 0.05 })).toMatchObject({
      sovereigns: 95,
      fee: 4.75,
      ixCredits: 90.25,
    });
    expect(quoteConversion("CONVERT_IN", 7, { convertRate: 1.5, convertFee: 0.1 }).sovereigns).toBe(
      9.45
    );
  });
});

describe("convert in", () => {
  it("debits IxC, credits ₷ and logs the conversion", async () => {
    const r = await run("CONVERT_IN", 100);
    expect(r).toMatchObject({ ixCredits: 100, sovereigns: 95, fee: 5, alreadyApplied: false });
    expect(credits()).toBe(900);
    expect(sovereigns()).toBe(1095); // 1,000 starting balance + 95
    expect(fake.tables.conversionLog).toHaveLength(1);
    const ixc = fake.tables.vaultTransaction!.find((t) => t.type === "SPEND_EXCHANGE");
    expect(ixc).toMatchObject({ credits: -100, source: "EXCHANGE_CONVERT_IN" });
  });

  it("applies a retried request once, even when the retries race", async () => {
    const results = await Promise.all([1, 2, 3].map(() => run("CONVERT_IN", 100, "same-request")));
    expect(results.filter((r) => !r.alreadyApplied)).toHaveLength(1);
    expect(credits()).toBe(900);
    expect(sovereigns()).toBe(1095);
    expect(fake.tables.conversionLog).toHaveLength(1);
  });

  it("refuses more IxC than the vault holds and changes nothing", async () => {
    await expect(run("CONVERT_IN", 5000)).rejects.toMatchObject({ code: "INSUFFICIENT_CREDITS" });
    expect(credits()).toBe(1000);
    expect(fake.tables.conversionLog ?? []).toHaveLength(0);
  });

  it("enforces the daily cap, also against concurrent requests", async () => {
    setup({ exchange_convert_daily_limit: "150" });
    const results = await Promise.allSettled([run("CONVERT_IN", 100), run("CONVERT_IN", 100)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toMatchObject({ code: "DAILY_CAP_REACHED" });
    expect(credits()).toBe(900);
  });
});

describe("convert out", () => {
  it("only lets ₷ that were converted in go back to IxC", async () => {
    // The 1,000 ₷ starting balance is not convertible.
    await expect(run("CONVERT_OUT", 100)).rejects.toMatchObject({ code: "LIMIT_REACHED" });

    await run("CONVERT_IN", 100); // +95 ₷ allowance
    const out = await run("CONVERT_OUT", 95);
    expect(out).toMatchObject({ sovereigns: 95, ixCredits: 90.25 });
    expect(credits()).toBe(990.25);
    expect(sovereigns()).toBe(1000);
    // Credits coming back are not play: no vault XP, not counted as earned today.
    expect(fake.tables.myVault![0]!.vaultXp ?? 0).toBe(0);
    expect(fake.tables.myVault![0]!.todayEarned ?? 0).toBe(0);

    await expect(run("CONVERT_OUT", 1)).rejects.toMatchObject({ code: "LIMIT_REACHED" });
  });

  it("stops when the vault earning kill switch is off, rolling the ₷ debit back", async () => {
    setup({ vault_isEarningEnabled: "false" });
    await run("CONVERT_IN", 100);
    await expect(run("CONVERT_OUT", 50)).rejects.toMatchObject({ code: "EARNING_DISABLED" });
    expect(sovereigns()).toBe(1095);
    expect(fake.tables.conversionLog).toHaveLength(1);
  });
});

describe("feature flag", () => {
  it("refuses while the Exchange is switched off", async () => {
    setup({ vault_isExchangeEnabled: "false" });
    await expect(run("CONVERT_IN", 100)).rejects.toMatchObject({ code: "DISABLED" });
    expect(credits()).toBe(1000);
  });

  it("refuses in vault maintenance mode", async () => {
    setup({ vault_isMaintenanceMode: "true" });
    await expect(run("CONVERT_IN", 100)).rejects.toMatchObject({ code: "MAINTENANCE" });
  });
});
