/**
 * Corporate operations on the market tick and the Central Bank credit line (Exchange Phase 3):
 * the operating P&L and HQ tax, the realm's revenue budget, the tick marker that keeps a retry
 * from minting twice, charges capped at capital, and the credit line's limit, rating floor,
 * distress refusal and repayment.
 */
jest.mock("~/lib/exchange/notify", () => ({
  notifyExchange: jest.fn(),
  sendExchangeNotices: jest.fn(),
}));
jest.mock("~/lib/exchange/macro", () => ({
  ...jest.requireActual("~/lib/exchange/macro"),
  countryMacroOf: () => ({
    corporateTaxRate: 0.2,
    capGainsTaxRate: 0.1,
    tariffFor: () => 0,
    growth: 0,
    interestRate: 0.05,
    inflation: 0,
    governmentEfficiency: 0.5,
    economicTier: "Developed",
    sectorShares: { agriculture: 0, industry: 0, services: 0, government: 0 },
    hasRecordedSector: false,
  }),
}));
import { notifyExchange } from "~/lib/exchange/notify";
import { borrowRateOf, borrowCredit, creditLimitFor, repayCredit } from "~/lib/exchange/credit";
import {
  operatingTickKey,
  runCompanyOperations,
  scaledRevenuesCents,
} from "~/lib/exchange/operations";
import { ExchangeError } from "~/lib/vault/exchange-service";
import { invalidateExchangeConfigCache } from "~/lib/vault/exchange-config";
import { invalidateVaultConfigCache } from "~/lib/vault/vault-perks";
import { createFakeExchangeDb, type FakeDb } from "~/tests/helpers/fake-exchange-db";

type Row = Record<string, string | number | boolean | null>;

const REALM = "default";
const NATION = "nation_a";
const HOUR_MS = 60 * 60 * 1000;
const TICK_MS = 6 * HOUR_MS;
const T0 = Date.now();

let fake: FakeDb;

function company(id: string, overrides: Row = {}): Row {
  return {
    id,
    name: id,
    realmId: REALM,
    founderId: "alice",
    sectorKey: "services",
    subIndustryKey: "software_media",
    hqCountryId: NATION,
    capital: 0,
    standing: 0,
    decisionValue: 10_000,
    creditDrawn: 0,
    creditRating: "B",
    contractsWonValue: 0,
    lastTickNetIncome: 0,
    status: "ACTIVE",
    ...overrides,
  };
}

function setup(companies: Row[], extra: Record<string, Row[]> = {}): void {
  invalidateExchangeConfigCache();
  invalidateVaultConfigCache();
  jest.mocked(notifyExchange).mockClear();
  fake = createFakeExchangeDb({
    user: ["alice", "bob", "carol"].map((id) => ({ id, clerkUserId: `c_${id}` })),
    exchangeWallet: ["alice", "bob", "carol"].map((userId) => ({
      id: `w_${userId}`,
      userId,
      sovereigns: 0n,
      lifetimeEarned: 0n,
      lifetimeSpent: 0n,
    })),
    country: [{ id: NATION, realmId: REALM, economicTier: "Developed" }],
    company: companies,
    ...extra,
  });
}

const co = (id: string) => fake.tables.company!.find((c) => c.id === id)!;
const treasury = () => fake.tables.nationTreasury?.find((t) => t.countryId === NATION);
const treasuryBalance = () => (treasury() ? Number(treasury()!.balance) / 100 : 0);
const run = (nowMs = T0) => runCompanyOperations(fake.client, nowMs);
const notices = () => jest.mocked(notifyExchange).mock.calls.flatMap(([list]) => list);

describe("tick operating P&L", () => {
  it("books revenue, upkeep and HQ tax, and sends the tax to the treasury", async () => {
    setup([company("co1")]);
    await run();
    expect(co("co1")).toMatchObject({
      capital: 200,
      lastTickRevenue: 315,
      lastTickExpenses: 65,
      lastTickTax: 50,
      lastTickNetIncome: 200,
    });
    expect(treasuryBalance()).toBe(50);
    expect(fake.tables.nationTreasuryEntry).toEqual([
      expect.objectContaining({ type: "TAX", amount: 50_00n, countryId: NATION }),
    ]);
  });

  it("pays no tax, and no treasury money moves, when the company has no home nation", async () => {
    setup([company("co1", { hqCountryId: null })]);
    await run();
    expect(co("co1")).toMatchObject({ capital: 250, lastTickTax: 0, lastTickNetIncome: 250 });
    expect(fake.tables.nationTreasuryEntry ?? []).toHaveLength(0);
  });

  it("cuts the HQ tax rate by a quarter only while the tax relief lasts", async () => {
    setup([
      company("relieved", { lobbyBuffType: "tax_relief", lobbyBuffUntilIxTime: T0 + HOUR_MS }),
    ]);
    await run();
    expect(co("relieved").lastTickTax).toBe(37.5);

    setup([company("lapsed", { lobbyBuffType: "tax_relief", lobbyBuffUntilIxTime: T0 - 1 })]);
    await run();
    expect(co("lapsed").lastTickTax).toBe(50);
  });
});

describe("realm revenue budget", () => {
  it("caps the realm's minted revenue and scales each company pro rata", async () => {
    setup([
      company("a", { hqCountryId: null }),
      company("b", { hqCountryId: null }),
      company("c", { hqCountryId: null }),
    ]);
    const summary = await run();
    const minted = ["a", "b", "c"].reduce((sum, id) => sum + co(id).lastTickRevenue, 0);
    expect(minted).toBeLessThanOrEqual(500);
    expect(minted).toBeGreaterThan(499.9);
    expect(co("a").lastTickRevenue).toBe(166.66);
    expect(summary.revenueMinted).toBeLessThanOrEqual(500);
  });

  it("leaves revenue unscaled while the realm is under its budget", () => {
    expect(scaledRevenuesCents([100, 200], 500)).toEqual([100, 200]);
  });

  it("scales a gross total down to a sum at or under the budget", () => {
    const scaled = scaledRevenuesCents([31_500, 31_500, 31_500], 50_000);
    expect(scaled).toEqual([16_666, 16_666, 16_666]);
    expect(scaled.reduce((sum, c) => sum + c, 0)).toBeLessThanOrEqual(50_000);
  });

  it("gives every company nothing when the budget is zero", () => {
    expect(scaledRevenuesCents([31_500, 9_000], 0)).toEqual([0, 0]);
  });
});

describe("tick retries", () => {
  it("mints nothing new when the same tick runs again", async () => {
    setup([company("co1", { hqCountryId: null })]);
    await run();
    const capital = co("co1").capital;
    const again = await run();
    expect(co("co1").capital).toBe(capital);
    expect(again.revenueMinted).toBe(0);
    const markers = (fake.tables.systemConfig ?? []).filter((r) =>
      String(r.key).startsWith("exchange-operations:")
    );
    expect(markers).toHaveLength(1);
  });

  it("runs the next tick as a new tick and mints again", async () => {
    setup([company("co1", { hqCountryId: null })]);
    await run();
    const after = co("co1").capital;
    await run(T0 + TICK_MS);
    expect(co("co1").capital).toBeGreaterThan(after);
    expect(operatingTickKey(T0 + TICK_MS)).not.toBe(operatingTickKey(T0));
  });
});

describe("distress on a tick", () => {
  it("pays what the company has, not more, and moves it to distress", async () => {
    setup([company("co1", { hqCountryId: null, capital: 20 })], {
      systemConfig: [{ key: "exchange_realm_operating_budget", value: "0" }],
    });
    await run();
    expect(co("co1")).toMatchObject({
      status: "DISTRESSED",
      capital: 0,
      distressedSinceIxTime: T0,
    });
    expect(notices()).toEqual([
      expect.objectContaining({ userId: "alice", priority: "high", title: "co1 is in distress" }),
    ]);
  });
});

describe("Central Bank credit line", () => {
  const borrow = (amount: number, requestId = `r-${amount}`, userId = "alice") =>
    borrowCredit(fake.client, { userId, companyId: "co1", amount, requestId });
  const repay = (amount: number, requestId = `p-${amount}`, userId = "alice") =>
    repayCredit(fake.client, { userId, companyId: "co1", amount, requestId });

  beforeEach(() => {
    setup([company("co1", { capital: 0 })], {
      nationTreasury: [{ id: "t_a", countryId: NATION, realmId: REALM, balance: 10_000_00n }],
    });
  });

  it("draws against the limit at the HQ rate plus the rating spread", async () => {
    const result = await borrow(2000);
    expect(result).toMatchObject({ alreadyApplied: false, creditDrawn: 2000, creditLimit: 5000 });
    expect(result.rate).toBeCloseTo(0.11);
    expect(co("co1")).toMatchObject({ capital: 2000, creditDrawn: 2000 });
    expect(treasuryBalance()).toBe(8000);
  });

  it("refuses a draw that takes the line past its limit, and moves nothing", async () => {
    await borrow(3000);
    await expect(borrow(2001)).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(borrow(2001)).rejects.toThrow(/past its limit/);
    expect(co("co1")).toMatchObject({ capital: 3000, creditDrawn: 3000 });
    expect(treasuryBalance()).toBe(7000);
  });

  it.each([
    ["CCC", -2],
    ["D", -4],
  ])("refuses a company rated %s, below the B floor", async (_rating, standing) => {
    fake.tables.company!.find((c) => c.id === "co1")!.standing = standing;
    await expect(borrow(100)).rejects.toThrow(/below B/);
    expect(treasuryBalance()).toBe(10_000);
  });

  it("refuses a draw from a distressed company but lets it repay", async () => {
    await borrow(2000);
    co("co1").status = "DISTRESSED";
    co("co1").distressedSinceIxTime = T0;
    await expect(borrow(100)).rejects.toThrow(/in distress/);
    await expect(repay(500)).resolves.toMatchObject({ creditDrawn: 1500 });
  });

  it("repays part of the line into the treasury", async () => {
    await borrow(2000);
    const result = await repay(1500);
    expect(result).toMatchObject({ alreadyApplied: false, creditDrawn: 500, cured: false });
    expect(co("co1")).toMatchObject({ capital: 500, creditDrawn: 500 });
    expect(treasuryBalance()).toBe(9500);
  });

  it("refuses a repayment above the amount drawn, and moves nothing", async () => {
    await borrow(2000);
    co("co1").capital = 5000;
    await expect(repay(2500)).rejects.toBeInstanceOf(ExchangeError);
    await expect(repay(2500)).rejects.toThrow(/stands at/);
    expect(co("co1")).toMatchObject({ capital: 5000, creditDrawn: 2000 });
    expect(treasuryBalance()).toBe(8000);
  });

  it("cures a distressed company once its debt is covered", async () => {
    co("co1").status = "DISTRESSED";
    co("co1").distressedSinceIxTime = T0;
    co("co1").capital = 1000;
    co("co1").creditDrawn = 500;
    const result = await repay(500);
    expect(result).toMatchObject({ creditDrawn: 0, cured: true });
    expect(co("co1")).toMatchObject({ status: "ACTIVE", distressedSinceIxTime: null });
  });

  it("applies a retried draw once", async () => {
    await borrow(2000, "same-request");
    const retry = await borrow(2000, "same-request");
    expect(retry.alreadyApplied).toBe(true);
    expect(co("co1").creditDrawn).toBe(2000);
    expect(treasuryBalance()).toBe(8000);
  });
});

describe("credit line terms", () => {
  it("limits a company to half its productive plant plus a quarter of contract wins", () => {
    expect(creditLimitFor({ decisionValue: 10_000, contractsWonValue: 2000 })).toBe(5250);
  });

  it("caps the limit at 250,000", () => {
    expect(creditLimitFor({ decisionValue: 1_000_000, contractsWonValue: 0 })).toBe(250_000);
  });

  it("prices a borrower at the HQ rate clamped to 2–20% plus its spread", () => {
    expect(borrowRateOf(0.01, "AAA")).toBeCloseTo(0.025);
    expect(borrowRateOf(0.5, "A")).toBeCloseTo(0.22);
  });

  it("prices a D-rated borrower at the CCC rate", () => {
    expect(borrowRateOf(0.05, "D")).toBeCloseTo(0.15);
  });
});
