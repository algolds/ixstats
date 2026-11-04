/**
 * The Exchange market tick (Exchange Phase 3): a second run inside the same tick mints no
 * stipend and moves no company's capital, so a retried cron run is harmless.
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
import { runExchangeMarketTick } from "~/lib/exchange/market";
import { invalidateExchangeConfigCache } from "~/lib/vault/exchange-config";
import { invalidateVaultConfigCache } from "~/lib/vault/vault-perks";
import { createFakeExchangeDb, type FakeDb } from "~/tests/helpers/fake-exchange-db";

const NATION = "nation_a";
let fake: FakeDb;

function setup() {
  invalidateExchangeConfigCache();
  invalidateVaultConfigCache();
  fake = createFakeExchangeDb({
    user: [{ id: "alice", clerkUserId: "c_alice" }],
    exchangeWallet: [
      { id: "w_alice", userId: "alice", sovereigns: 0, lifetimeEarned: 0, lifetimeSpent: 0 },
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
        decisionValue: 10_000,
        capital: 0,
        standing: 0,
        contractsWonValue: 0,
        lastTickNetIncome: 0,
        creditDrawn: 0,
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
      expect.objectContaining({ countryId: NATION, balance: 112.5 }),
    ]);
    expect((fake.tables.nationTreasuryEntry ?? []).filter((e) => e.type === "TAX")).toHaveLength(1);
    expect(fake.tables.company![0]!.capital).toBe(capital);
  });
});
