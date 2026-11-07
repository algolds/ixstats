/**
 * Distress and bankruptcy (Exchange Phase 3): a distressed company is held for 72 real hours,
 * then liquidated on a tick. The plant sells to the HQ treasury, the lender is paid first, and
 * the holders split the rest in whole cents with the founder taking the remainder.
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
import {
  DISTRESS_GRACE_MS,
  applyDistressTx,
  distressDecision,
  type DistressState,
  type LifecycleInput,
} from "~/lib/exchange/distress";
import { runCompanyOperations } from "~/lib/exchange/operations";
import { invalidateExchangeConfigCache } from "~/lib/vault/exchange-config";
import { invalidateVaultConfigCache } from "~/lib/vault/vault-perks";
import { createFakeExchangeDb, type FakeDb } from "~/tests/helpers/fake-exchange-db";

type Row = Record<string, string | number | boolean | null>;

const REALM = "default";
const NATION = "nation_a";
const HOUR_MS = 60 * 60 * 1000;
const T0 = Date.now();
const cents = (amount: number) => Math.round(amount * 100);

let fake: FakeDb;

function setup(overrides: Row = {}) {
  invalidateExchangeConfigCache();
  invalidateVaultConfigCache();
  fake = createFakeExchangeDb({
    user: ["alice", "bob", "carol"].map((id) => ({ id, clerkUserId: `c_${id}` })),
    exchangeWallet: ["alice", "bob", "carol"].map((userId) => ({
      id: `w_${userId}`,
      userId,
      sovereigns: 0,
      lifetimeEarned: 0,
      lifetimeSpent: 0,
    })),
    country: [{ id: NATION, realmId: REALM, economicTier: "Developed" }],
    nationTreasury: [{ id: "t_a", countryId: NATION, realmId: REALM, balance: 5000 }],
    company: [
      {
        id: "co1",
        name: "Acme",
        realmId: REALM,
        founderId: "alice",
        sectorKey: "services",
        subIndustryKey: "software_media",
        hqCountryId: NATION,
        capital: 0,
        standing: 0,
        decisionValue: 333.33,
        creditDrawn: 0,
        creditRating: "B",
        contractsWonValue: 0,
        lastTickNetIncome: 0,
        sharesIssued: 1000,
        sharesOutstanding: 1000,
        tradingOpen: false,
        status: "DISTRESSED",
        distressedSinceIxTime: T0,
        ...overrides,
      },
    ],
    shareholding: [
      { id: "s_alice", companyId: "co1", ownerUserId: "alice", shares: 500 },
      { id: "s_bob", companyId: "co1", ownerUserId: "bob", shares: 300 },
      { id: "s_carol", companyId: "co1", ownerUserId: "carol", shares: 200 },
    ],
    systemConfig: [{ key: "exchange_realm_operating_budget", value: "0" }],
  });
}

const co = () => fake.tables.company!.find((c) => c.id === "co1")!;
const treasuryBalance = () =>
  fake.tables.nationTreasury!.find((t) => t.countryId === NATION)!.balance as number;
const walletCents = (userId: string) =>
  cents(fake.tables.exchangeWallet!.find((w) => w.userId === userId)!.sovereigns as number);
const run = (nowMs: number) => runCompanyOperations(fake.client, nowMs);

describe("distressDecision", () => {
  const state = (over: Partial<DistressState> = {}): DistressState => ({
    status: "ACTIVE",
    distressedSinceIxTime: null,
    unpaid: false,
    capital: 100,
    creditDrawn: 0,
    creditLimit: 500,
    nowMs: T0,
    ...over,
  });

  it.each<[string, Partial<DistressState>, string]>([
    ["an active company with nothing unpaid", {}, "NONE"],
    ["an active company with a charge unpaid", { unpaid: true }, "DISTRESS"],
    ["an active company with capital below zero", { capital: -1 }, "DISTRESS"],
    ["an active company over its credit limit", { creditDrawn: 600 }, "DISTRESS"],
    [
      "a distressed company that is sound again",
      { status: "DISTRESSED", distressedSinceIxTime: T0 - HOUR_MS },
      "CURE",
    ],
    [
      "a distressed company still inside its grace",
      { status: "DISTRESSED", distressedSinceIxTime: T0 - DISTRESS_GRACE_MS + 1, unpaid: true },
      "NONE",
    ],
    [
      "a distressed company at the end of its grace",
      { status: "DISTRESSED", distressedSinceIxTime: T0 - DISTRESS_GRACE_MS, unpaid: true },
      "BANKRUPT",
    ],
    ["a bankrupt company", { status: "BANKRUPT", unpaid: true }, "NONE"],
  ])("gives %s the action %s", (_label, over, action) => {
    expect(distressDecision(state(over))).toBe(action);
  });

  it("gives the grace window 72 real hours", () => {
    expect(DISTRESS_GRACE_MS).toBe(72 * HOUR_MS);
  });
});

describe("72-hour bankruptcy", () => {
  beforeEach(() => setup());

  it("holds a distressed company for the full 72 hours", async () => {
    await run(T0 + 72 * HOUR_MS - 1);
    expect(co()).toMatchObject({ status: "DISTRESSED", decisionValue: 333.33 });
    expect(treasuryBalance()).toBe(5000);
    expect(walletCents("alice") + walletCents("bob") + walletCents("carol")).toBe(0);
  });

  it("liquidates at 72 hours: the HQ treasury buys the plant at 40 cents on the sovereign", async () => {
    await run(T0 + 72 * HOUR_MS);
    expect(co()).toMatchObject({
      status: "BANKRUPT",
      capital: 0,
      creditDrawn: 0,
      decisionValue: 0,
      distressedSinceIxTime: null,
      tradingOpen: false,
    });
    expect(
      (fake.tables.exchangeNewsItem ?? [])
        .filter((n) => n.companyId === "co1")
        .map((n) => [n.kind, n.prominence])
    ).toEqual([["bankruptcy", "HEADLINE"]]);
    expect(treasuryBalance()).toBeCloseTo(4866.67, 2);
    expect(fake.tables.nationTreasuryEntry).toEqual([
      expect.objectContaining({ type: "SPEND", amount: -133.33, source: "PLANT_RECOVERY:co1" }),
    ]);
  });

  it("splits the proceeds pro rata in whole cents, with the founder taking the remainder", async () => {
    await run(T0 + 72 * HOUR_MS);
    const paid = [walletCents("alice"), walletCents("bob"), walletCents("carol")];
    expect(paid).toEqual([6668, 3999, 2666]);
    expect(paid.reduce((sum, c) => sum + c, 0)).toBe(cents(133.33));
  });

  it("tells each holder and the founder what they received", async () => {
    await run(T0 + 72 * HOUR_MS);
    const messages = jest.mocked(notifyExchange).mock.calls.flatMap(([list]) => list);
    expect(messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: "alice", message: "Liquidation paid ₷66.68 to you." }),
        expect.objectContaining({ userId: "bob", title: "Acme went bankrupt" }),
        expect.objectContaining({ userId: "carol", title: "Acme went bankrupt" }),
      ])
    );
  });

  it("pays the lender before the holders, and pays the holders nothing once the debt takes all", async () => {
    setup({ creditDrawn: 1000 });
    await run(T0 + 72 * HOUR_MS);
    expect(co()).toMatchObject({ status: "BANKRUPT", creditDrawn: 0 });
    expect(walletCents("alice") + walletCents("bob") + walletCents("carol")).toBe(0);
    expect(fake.tables.nationTreasuryEntry).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "INTEREST", amount: 133.33, source: "LIQUIDATION:co1" }),
      ])
    );
  });
});

describe("the news feed", () => {
  it("headlines a company entering distress, once per entry", async () => {
    setup({ status: "ACTIVE", distressedSinceIxTime: null });
    const input: LifecycleInput = {
      company: co(),
      hq: null,
      cashCents: 0,
      creditDrawn: 0,
      tickKey: "t1",
      nowMs: T0,
    };
    await fake.client.$transaction((tx) => applyDistressTx(tx, "DISTRESS", input, []));
    expect(
      (fake.tables.exchangeNewsItem ?? []).map((n) => [n.kind, n.prominence, n.companyId])
    ).toEqual([["distress", "HEADLINE", "co1"]]);
  });
});
