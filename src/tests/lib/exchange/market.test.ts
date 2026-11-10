/**
 * The Exchange market tick (Exchange Phase 3): a second run inside the same tick mints no
 * stipend and moves no company's capital, so a retried cron run is harmless.
 */
jest.mock("~/lib/exchange/notify", () => ({
  notifyExchange: jest.fn(),
  sendExchangeNotices: jest.fn(),
}));
jest.mock("~/lib/system/job-lock", () => ({
  withJobLock: jest.fn(async (_db: unknown, _name: string, fn: () => Promise<unknown>) => ({
    ran: true,
    result: await fn(),
  })),
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
import { runExchangeMarketTick } from "~/lib/exchange/market";
import { withJobLock } from "~/lib/system/job-lock";
import { invalidateExchangeConfigCache } from "~/lib/vault/exchange-config";
import { invalidateVaultConfigCache } from "~/lib/vault/vault-perks";
import { exchangeAdminRouter } from "~/server/api/routers/exchange/admin";
import { createFakeExchangeDb, type FakeDb } from "~/tests/helpers/fake-exchange-db";

const NATION = "nation_a";
let fake: FakeDb;

function setup() {
  invalidateExchangeConfigCache();
  invalidateVaultConfigCache();
  fake = createFakeExchangeDb({
    user: [{ id: "alice", clerkUserId: "c_alice" }],
    exchangeWallet: [
      { id: "w_alice", userId: "alice", sovereigns: 0n, lifetimeEarned: 0n, lifetimeSpent: 0n },
    ],
    country: [{ id: NATION, realmId: "default", economicTier: "Developed" }],
    company: [
      {
        id: "co1",
        name: "Acme",
        realmId: "default",
        founderId: "alice",
        sectorKey: "services",
        subIndustryKey: "software_media",
        hqCountryId: NATION,
        status: "ACTIVE",
        decisionValue: 10_000_00n,
        capital: 0n,
        standing: 0,
        contractsWonValue: 0n,
        lastTickNetIncome: 0n,
        creditDrawn: 0n,
        creditRating: "B",
      },
    ],
  });
}

describe("runExchangeMarketTick", () => {
  beforeEach(() => setup());

  it("mints the nation's stipend once for the tick, however often the tick runs", async () => {
    const first = await runExchangeMarketTick(fake.client);
    expect(first.stipendsMinted).toBe(62.5);
    const capital = fake.tables.company![0]!.capital;

    const second = await runExchangeMarketTick(fake.client);
    expect(second.stipendsMinted).toBe(0);
    expect(fake.tables.nationTreasury).toEqual([
      expect.objectContaining({ countryId: NATION, balance: 112_50n }),
    ]);
    expect((fake.tables.nationTreasuryEntry ?? []).filter((e) => e.type === "TAX")).toHaveLength(1);
    expect(fake.tables.company![0]!.capital).toBe(capital);
  });

  it("runs bond payments and policy headlines and reports both", async () => {
    const result = await runExchangeMarketTick(fake.client);
    expect(result.bonds).toEqual({ couponsPaid: 0, matured: 0, defaulted: 0 });
    expect(result.policyHeadlines).toBe(0);
    expect(fake.tables.exchangeNationSnapshot).toEqual([
      expect.objectContaining({ countryId: NATION }),
    ]);
  });

  it("(d) running runExchangeMarketTick twice within one operating tick leaves sector index values and fundSovereigns as after the first run", async () => {
    fake.tables.company![0]!.capital = 200_000_00n;
    fake.tables.sectorIndex = [
      {
        id: "idx_services",
        realmId: "default",
        sectorKey: "services",
        name: "Services",
        value: 1000,
        dmModifier: 0,
        fundSovereigns: 1000_00n,
        totalUnits: 1000,
        computedIxTime: null,
      },
    ];
    fake.tables.sectorPosition = [
      {
        id: "pos_alice",
        userId: "alice",
        realmId: "default",
        sectorKey: "services",
        units: 1000,
        costBasis: 1000,
      },
    ];
    await runExchangeMarketTick(fake.client);
    const afterFirst = fake.tables.sectorIndex!.map((s) => ({
      sectorKey: s.sectorKey,
      value: s.value,
      fundSovereigns: s.fundSovereigns,
    }));
    await runExchangeMarketTick(fake.client);
    const afterSecond = fake.tables.sectorIndex!.map((s) => ({
      sectorKey: s.sectorKey,
      value: s.value,
      fundSovereigns: s.fundSovereigns,
    }));
    expect(afterSecond).toEqual(afterFirst);
  });

  it("adminRunMarketTick uses the exchange-market job lock and rejects with CONFLICT when already running", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const spy = jest.mocked(withJobLock).mockResolvedValueOnce({ ran: false });
    const caller = exchangeAdminRouter.createCaller({
      db: fake.client,
      auth: { userId: "c_alice" } as never,
      user: { id: "alice", clerkUserId: "c_alice", role: { name: "admin", level: 0 } } as never,
      headers: new Headers(),
    });
    await expect(caller.adminRunMarketTick()).rejects.toMatchObject({
      code: "CONFLICT",
      message: "The market tick is already running",
    });
    expect(spy).toHaveBeenCalledWith(
      expect.anything(),
      "exchange-market",
      expect.any(Function),
      { timeoutMs: 30 * 60_000 }
    );
    warnSpy.mockRestore();
    errSpy.mockRestore();
  });
});
