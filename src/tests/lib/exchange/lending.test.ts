/**
 * Lending terms and the no-self-dealing rule (spec §11a): a nation's owner sets the extra spread and a per-company cap
 * on domestic credit lines, which apply to every domestic company alike, the owner's own included. The treasury won't
 * award its tenders to a company the owner founded or holds shares in.
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

import { awardContract } from "~/lib/exchange/contracts";
import { borrowCredit } from "~/lib/exchange/credit";
import { setLendingTerms } from "~/lib/exchange/lending";
import { listRealmNations } from "~/lib/exchange/queries";
import { runCompanyOperations } from "~/lib/exchange/operations";
import { invalidateExchangeConfigCache } from "~/lib/vault/exchange-config";
import { invalidateVaultConfigCache } from "~/lib/vault/vault-perks";
import { createFakeExchangeDb, type FakeDb } from "~/tests/helpers/fake-exchange-db";

const REALM = "default";
const NATION = "nation_a";
let fake: FakeDb;

function setup(owner: string, companyOver: Record<string, number | string> = {}) {
  invalidateExchangeConfigCache();
  invalidateVaultConfigCache();
  fake = createFakeExchangeDb({
    user: ["alice", "bob"].map((id) => ({ id, clerkUserId: `c_${id}`, countryId: null })),
    exchangeWallet: ["alice", "bob"].map((userId) => ({
      id: `w_${userId}`,
      userId,
      sovereigns: 5000,
      lifetimeEarned: 5000,
      lifetimeSpent: 0,
    })),
    country: [
      {
        id: NATION,
        name: "Caphiria",
        realmId: REALM,
        economicTier: "Developed",
        ownerUserId: owner,
      },
    ],
    company: [
      {
        id: "co1",
        name: "Alice Works",
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
        ...companyOver,
      },
    ],
    nationTreasury: [{ id: "t_a", countryId: NATION, realmId: REALM, balance: 10_000 }],
    systemConfig: [],
  });
}

const treasury = () => fake.tables.nationTreasury!.find((t) => t.countryId === NATION)!;
const borrow = (amount: number, requestId = `r-${amount}`) =>
  borrowCredit(fake.client, { userId: "alice", companyId: "co1", amount, requestId });

describe("setLendingTerms", () => {
  it("lets only the owner set terms, within bounds", async () => {
    setup("bob");
    await expect(
      setLendingTerms(fake.client, { userId: "alice", countryId: NATION, spread: 0.01, cap: 1000 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      setLendingTerms(fake.client, { userId: "bob", countryId: NATION, spread: 0.2, cap: 1000 })
    ).rejects.toMatchObject({ code: "INVALID_AMOUNT" });
    await setLendingTerms(fake.client, {
      userId: "bob",
      countryId: NATION,
      spread: 0.03,
      cap: 100_000,
    });
    expect(treasury()).toMatchObject({ lendingSpread: 0.03, companyCreditCap: 100_000 });
  });
});

describe("terms on credit lines", () => {
  it("caps each company's line at the treasury's cap", async () => {
    setup("bob");
    treasury().companyCreditCap = 100;
    await expect(borrow(150)).rejects.toThrow(/past its limit/);
    expect(treasury().balance).toBe(10_000);
  });

  it("charges the extra spread in the tick's interest", async () => {
    const interestAt = async (spread: number) => {
      setup("bob", { capital: 50_000, creditDrawn: 10_000 });
      treasury().lendingSpread = spread;
      await runCompanyOperations(fake.client, Date.now());
      return (fake.tables.nationTreasuryEntry ?? [])
        .filter((e) => e.type === "INTEREST")
        .reduce((s, e) => s + e.amount, 0);
    };
    const base = await interestAt(0);
    const raised = await interestAt(0.03);
    // 10,000 × 0.03 ÷ 1,460 ticks ≈ ₷0.21 more each tick.
    expect(raised - base).toBeCloseTo(0.21, 1);
  });
});

describe("no self-dealing", () => {
  it("still lends to the owner's company, at the same published terms (owner ruling 2026-11-07)", async () => {
    setup("alice");
    treasury().lendingSpread = 0.02;
    const result = await borrow(500);
    expect(result.rate).toBeCloseTo(0.13, 10); // 5% + B spread 6% + 2%
    expect(treasury().balance).toBe(9_500);
  });

  it("won't award the owner's tender to the owner's company", async () => {
    setup("alice");
    fake.tables.contract = [
      {
        id: "k1",
        realmId: REALM,
        type: "B2G",
        title: "Bridge",
        sectorKey: "services",
        value: 500,
        status: "OPEN",
        endIxTime: Date.now() - 1000,
        createdIxTime: Date.now() - 10_000,
        issuerCountryId: NATION,
        issuerUserId: "alice",
        issuerCompanyId: null,
        escrow: 500,
        fundedBy: "TREASURY",
        winnerCompanyId: null,
      },
    ];
    fake.tables.contractBid = [
      {
        id: "b1",
        contractId: "k1",
        companyId: "co1",
        amount: 400,
        createdIxTime: 1,
        outcome: null,
      },
    ];
    await expect(
      awardContract(fake.client, { userId: "alice", contractId: "k1", bidId: "b1" })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

describe("the terms reach the company controls", () => {
  it("lists each realm nation with its lending terms (defaults when it has no treasury)", async () => {
    setup("bob");
    treasury().lendingSpread = 0.03;
    treasury().companyCreditCap = 50_000;
    fake.tables.country!.push({
      id: "nation_b",
      name: "Urcea",
      realmId: REALM,
      economicTier: "Developed",
    });
    const nations = await listRealmNations(fake.client, REALM);
    expect(nations.find((n) => n.id === NATION)).toMatchObject({
      lendingSpread: 0.03,
      companyCreditCap: 50_000,
    });
    expect(nations.find((n) => n.id === "nation_b")).toMatchObject({
      lendingSpread: 0,
      companyCreditCap: 250_000,
    });
  });
});
