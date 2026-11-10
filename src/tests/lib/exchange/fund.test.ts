/**
 * The wealth fund (spec §11a): a per-nation fund account that trades through the ordinary engine. The owner moves ₷
 * between treasury and fund (capped at half the treasury), and the fund may not buy its owner's companies, its own
 * bonds, or more than 25% of a company. The fund account never shows on leaderboards or receives notices.
 */
jest.mock("~/lib/notifications/api", () => ({
  notificationAPI: { create: jest.fn(async () => "n1") },
}));
jest.mock("~/lib/system/job-lock", () => ({
  withJobLock: jest.fn(async (_db: unknown, _name: string, fn: () => Promise<unknown>) => ({
    ran: true,
    result: await fn(),
  })),
}));

import { notificationAPI } from "~/lib/notifications/api";
import { withJobLock } from "~/lib/system/job-lock";
import { buyBondListing, buyBondPrimary, listBondUnits } from "~/lib/exchange/bonds";
import {
  FUND_USER_PREFIX,
  depositToFund,
  ensureFundUser,
  fundTrade,
  withdrawFromFund,
} from "~/lib/exchange/fund";
import { sendExchangeNotices } from "~/lib/exchange/notify";
import { buyShares, cancelListing, listShares, placeBuyOrder } from "~/lib/exchange/shares";
import { getLeaderboards, getNationPage } from "~/lib/exchange/terminal";
import { invalidateExchangeConfigCache } from "~/lib/vault/exchange-config";
import { invalidateVaultConfigCache } from "~/lib/vault/vault-perks";
import { createFakeExchangeDb, type FakeDb } from "~/tests/helpers/fake-exchange-db";

const NA = "na";
const FUND = `${FUND_USER_PREFIX}${NA}`;
let fake: FakeDb;
let seq = 0;
const rid = () => `request-${++seq}`;

function company(id: string, founderId: string) {
  return {
    id,
    name: id === "co1" ? "Alice Works" : "Bob Steel",
    founderId,
    realmId: "default",
    sectorKey: "industry",
    subIndustryKey: "heavy_manufacturing",
    hqCountryId: NA,
    capital: 1000_00n,
    fairValue: 1000_00n,
    standing: 0,
    contractsWonValue: 0n,
    decisionValue: 0n,
    sharesIssued: 1000,
    sharesOutstanding: 1000,
    creditDrawn: 0n,
    creditRating: "A",
    tradingOpen: true,
    status: "ACTIVE",
  };
}

function setup(balance = 10_000) {
  invalidateExchangeConfigCache();
  invalidateVaultConfigCache();
  fake = createFakeExchangeDb({
    user: ["alice", "bob"].map((id) => ({ id, clerkUserId: `c_${id}`, countryId: null })),
    exchangeWallet: ["alice", "bob"].map((userId) => ({
      id: `w_${userId}`,
      userId,
      sovereigns: 50_000_00n,
      lifetimeEarned: 50_000_00n,
      lifetimeSpent: 0n,
    })),
    country: [
      { id: NA, name: "Caphiria", realmId: "default", ownerUserId: "alice" },
      { id: "nb", name: "Urcea", realmId: "default", ownerUserId: "bob" },
    ],
    nationTreasury: [
      { id: "t_na", countryId: NA, realmId: "default", balance: BigInt(Math.round(balance * 100)) },
      { id: "t_nb", countryId: "nb", realmId: "default", balance: 5000_00n },
    ],
    company: [company("co1", "alice"), company("co2", "bob")],
    shareholding: [
      { id: "sh1", companyId: "co1", ownerUserId: "alice", shares: 1000, avgCost: 1 },
      { id: "sh2", companyId: "co2", ownerUserId: "bob", shares: 1000, avgCost: 1 },
    ],
    nationBond: [
      {
        id: "b_nb",
        countryId: "nb",
        realmId: "default",
        issuerUserId: "bob",
        faceValue: 100,
        unitsIssued: 100,
        unitsSold: 0,
        couponRate: 0.05,
        termWeeks: 4,
        weeksPaid: 0,
        status: "OPEN",
        issuedAt: new Date(),
      },
      {
        id: "b_na",
        countryId: NA,
        realmId: "default",
        issuerUserId: "alice",
        faceValue: 100,
        unitsIssued: 100,
        unitsSold: 0,
        couponRate: 0.05,
        termWeeks: 4,
        weeksPaid: 0,
        status: "OPEN",
        issuedAt: new Date(),
      },
    ],
    systemConfig: [],
  });
}

const treasury = (id = NA) => fake.tables.nationTreasury!.find((t) => t.countryId === id)!;
const fundCash = () =>
  Number(fake.tables.exchangeWallet!.find((w) => w.userId === FUND)?.sovereigns ?? 0n) / 100;
const deposit = (amount: number) =>
  depositToFund(fake.client, { userId: "alice", countryId: NA, amount, requestId: rid() });

beforeEach(() => setup());

describe("the fund account", () => {
  it("is created once, with a wallet, and remembered on the treasury", async () => {
    await ensureFundUser(fake.client, NA);
    await ensureFundUser(fake.client, NA);
    expect(fake.tables.user!.filter((u) => u.id === FUND)).toHaveLength(1);
    expect(fake.tables.exchangeWallet!.filter((w) => w.userId === FUND)).toHaveLength(1);
    expect(treasury().fundUserId).toBe(FUND);
  });
});

describe("deposit and withdraw", () => {
  it("moves ₷ from the treasury into the fund and back", async () => {
    await deposit(1000);
    expect(treasury().balance).toBe(9000_00n);
    expect(fundCash()).toBe(1000);
    await withdrawFromFund(fake.client, {
      userId: "alice",
      countryId: NA,
      amount: 400,
      requestId: rid(),
    });
    expect(treasury().balance).toBe(9400_00n);
    expect(fundCash()).toBe(600);
  });

  it("refuses a deposit that takes the fund past half, moving nothing", async () => {
    await deposit(4000);
    await expect(deposit(1001)).rejects.toMatchObject({ code: "LIMIT_REACHED" });
    expect(treasury().balance).toBe(6000_00n);
    expect(fundCash()).toBe(4000);
  });

  it("lets only the owner move the fund", async () => {
    await expect(
      depositToFund(fake.client, { userId: "bob", countryId: NA, amount: 100, requestId: rid() })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("what the fund may buy", () => {
  beforeEach(async () => {
    await deposit(5000);
  });
  const trade = (order: Parameters<typeof fundTrade>[1]["order"]) =>
    fundTrade(fake.client, { userId: "alice", countryId: NA, order, requestId: rid() });

  it("refuses the owner's own company, moving nothing", async () => {
    await expect(
      trade({ kind: "shares-buy", companyId: "co1", shares: 10, maxPricePerShare: 2 })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(fundCash()).toBe(5000);
  });

  it("refuses its own nation's bonds", async () => {
    await expect(trade({ kind: "bond-buy", bondId: "b_na", units: 5 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("refuses a stake past 25% of a company", async () => {
    await expect(
      trade({ kind: "shares-buy", companyId: "co2", shares: 251, maxPricePerShare: 2 })
    ).rejects.toMatchObject({
      code: "LIMIT_REACHED",
    });
  });

  it("buys another nation's bonds with fund cash, held by the fund", async () => {
    await trade({ kind: "bond-buy", bondId: "b_nb", units: 5 });
    expect(fundCash()).toBe(4500);
    expect(fake.tables.bondHolding).toEqual([
      expect.objectContaining({ bondId: "b_nb", ownerUserId: FUND, units: 5 }),
    ]);
    expect(
      (fake.tables.exchangeNewsItem ?? []).some(
        (n) => n.headline === "Caphiria Treasury bought 5 Urcea bonds"
      )
    ).toBe(true);
  });

  it("cancels its own share bid and returns the escrow, refusing non-owners and others' orders", async () => {
    await trade({ kind: "shares-buy", companyId: "co2", shares: 100, maxPricePerShare: 2 });
    expect(fundCash()).toBe(4800);
    const fundOrderId = fake.tables.shareBuyOrder!.find((o) => o.buyerUserId === FUND)!.id;
    await expect(
      fundTrade(fake.client, {
        userId: "bob",
        countryId: NA,
        order: { kind: "shares-cancel-bid", orderId: fundOrderId },
        requestId: rid(),
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const { orderId: bobOrderId } = await placeBuyOrder(fake.client, {
      userId: "bob",
      companyId: "co1",
      shares: 10,
      maxPricePerShare: 2,
      requestId: rid(),
    });
    await expect(trade({ kind: "shares-cancel-bid", orderId: bobOrderId! })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await trade({ kind: "shares-cancel-bid", orderId: fundOrderId });
    expect(fundCash()).toBe(5000);
  });

  it("cancels its own share listing and bond listing", async () => {
    await listShares(fake.client, {
      userId: "bob",
      companyId: "co2",
      shares: 100,
      pricePerShare: 2,
      requestId: rid(),
    });
    await trade({ kind: "shares-buy", companyId: "co2", shares: 100, maxPricePerShare: 2 });
    await trade({ kind: "shares-sell", companyId: "co2", shares: 40, pricePerShare: 1.1 });
    const shareListingId = fake.tables.shareListing!.find(
      (l) => l.sellerUserId === FUND && l.status === "OPEN"
    )!.id;
    await trade({ kind: "shares-cancel-listing", listingId: shareListingId });
    expect(
      fake.tables.shareholding!.find((s) => s.companyId === "co2" && s.ownerUserId === FUND)?.shares
    ).toBe(100);

    await trade({ kind: "bond-buy", bondId: "b_nb", units: 20 });
    await trade({ kind: "bond-sell", bondId: "b_nb", units: 8, pricePerUnit: 102 });
    expect(fake.tables.bondHolding!.find((b) => b.ownerUserId === FUND)?.units).toBe(12);
    const bondListingId = fake.tables.bondListing!.find((l) => l.sellerUserId === FUND)!.id;
    await trade({ kind: "bond-cancel-listing", listingId: bondListingId });
    expect(fake.tables.bondHolding!.find((b) => b.ownerUserId === FUND)?.units).toBe(20);
  });

  it("refuses explicit takes by the nation's owner on a fund share or bond listing", async () => {
    await listShares(fake.client, {
      userId: "bob",
      companyId: "co2",
      shares: 50,
      pricePerShare: 1,
      requestId: rid(),
    });
    await trade({ kind: "shares-buy", companyId: "co2", shares: 50, maxPricePerShare: 1 });
    await trade({ kind: "shares-sell", companyId: "co2", shares: 20, pricePerShare: 1 });
    const shareListingId = fake.tables.shareListing!.find(
      (l) => l.sellerUserId === FUND && l.status === "OPEN"
    )!.id;
    await expect(
      buyShares(fake.client, {
        userId: "alice",
        listingId: shareListingId,
        shares: 10,
        requestId: rid(),
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await trade({ kind: "bond-buy", bondId: "b_nb", units: 10 });
    await trade({ kind: "bond-sell", bondId: "b_nb", units: 5, pricePerUnit: 100 });
    const bondListingId = fake.tables.bondListing!.find((l) => l.sellerUserId === FUND)!.id;
    await expect(
      buyBondListing(fake.client, {
        userId: "alice",
        listingId: bondListingId,
        units: 2,
        requestId: rid(),
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("skips insider pairs when crossing the share book, filling third-party orders at worse prices", async () => {
    // Give alice 20 shares of co2 so she can post a cheaper ask than bob's.
    fake.tables.shareholding!.push({
      id: "sh_alice_co2",
      companyId: "co2",
      ownerUserId: "alice",
      shares: 20,
      avgCost: 1,
    });
    const aliceAsk = await listShares(fake.client, {
      userId: "alice",
      companyId: "co2",
      shares: 20,
      pricePerShare: 1,
      requestId: rid(),
    });
    const bobAsk = await listShares(fake.client, {
      userId: "bob",
      companyId: "co2",
      shares: 15,
      pricePerShare: 2,
      requestId: rid(),
    });
    const res = await placeBuyOrder(fake.client, {
      userId: FUND,
      companyId: "co2",
      shares: 20,
      maxPricePerShare: 3,
      requestId: rid(),
    });
    expect(res).toMatchObject({ sharesBought: 15, sharesResting: 5 });
    expect(fake.tables.shareListing!.find((l) => l.id === aliceAsk.listing.id)).toMatchObject({
      shares: 20,
      status: "OPEN",
    });
    expect(fake.tables.shareListing!.find((l) => l.id === bobAsk.listing.id)).toMatchObject({
      shares: 0,
      status: "FILLED",
    });

    // Reverse direction: fund ask skips alice's higher bid and fills bob's lower bid.
    await cancelListing(fake.client, { userId: "alice", listingId: aliceAsk.listing.id });
    await placeBuyOrder(fake.client, {
      userId: "alice",
      companyId: "co2",
      shares: 10,
      maxPricePerShare: 1.2,
      requestId: rid(),
    });
    await placeBuyOrder(fake.client, {
      userId: "bob",
      companyId: "co2",
      shares: 10,
      maxPricePerShare: 1.1,
      requestId: rid(),
    });
    await trade({ kind: "shares-sell", companyId: "co2", shares: 15, pricePerShare: 1 });
    expect(
      fake.tables.shareBuyOrder!.find((o) => o.buyerUserId === "alice" && o.companyId === "co2")
    ).toMatchObject({ shares: 10, status: "OPEN" });
    expect(
      fake.tables.shareBuyOrder!.find((o) => o.buyerUserId === "bob" && o.companyId === "co2")
    ).toMatchObject({ shares: 0, status: "FILLED" });
  });

  it("skips the owner's cheapest bond listing on fund bond-buy, or throws LIMIT_REACHED if none remain", async () => {
    fake.tables.user!.push({ id: "carol", clerkUserId: "c_carol", countryId: null });
    fake.tables.exchangeWallet!.push({
      id: "w_carol",
      userId: "carol",
      sovereigns: 50_000_00n,
      lifetimeEarned: 50_000_00n,
      lifetimeSpent: 0n,
    });
    // Sell out b_nb primary issue (50 to alice, 50 to carol).
    await buyBondPrimary(fake.client, {
      userId: "alice",
      bondId: "b_nb",
      units: 50,
      requestId: rid(),
    });
    await buyBondPrimary(fake.client, {
      userId: "carol",
      bondId: "b_nb",
      units: 50,
      requestId: rid(),
    });
    const { listingId: aliceListing } = await listBondUnits(fake.client, {
      userId: "alice",
      bondId: "b_nb",
      units: 10,
      pricePerUnit: 95,
      requestId: rid(),
    });
    await expect(trade({ kind: "bond-buy", bondId: "b_nb", units: 5 })).rejects.toMatchObject({
      code: "LIMIT_REACHED",
    });

    const { listingId: carolListing } = await listBondUnits(fake.client, {
      userId: "carol",
      bondId: "b_nb",
      units: 10,
      pricePerUnit: 105,
      requestId: rid(),
    });
    await trade({ kind: "bond-buy", bondId: "b_nb", units: 5 });
    expect(fake.tables.bondListing!.find((l) => l.id === aliceListing)?.units).toBe(10);
    expect(fake.tables.bondListing!.find((l) => l.id === carolListing)?.units).toBe(5);
  });

  it("refuses fund share or bond listings outside ±20% of fair or face value and allows inside", async () => {
    await listShares(fake.client, {
      userId: "bob",
      companyId: "co2",
      shares: 50,
      pricePerShare: 1,
      requestId: rid(),
    });
    await trade({ kind: "shares-buy", companyId: "co2", shares: 50, maxPricePerShare: 1 });
    // co2 fairValue = 1000, sharesOutstanding = 1000 → fair = ₷1 (band ₷0.8–₷1.2).
    await expect(
      trade({ kind: "shares-sell", companyId: "co2", shares: 10, pricePerShare: 0.79 })
    ).rejects.toMatchObject({
      code: "LIMIT_REACHED",
      message: "The wealth fund sells within 20% of fair value: ₷0.8–₷1.2",
    });
    await expect(
      trade({ kind: "shares-sell", companyId: "co2", shares: 10, pricePerShare: 1.21 })
    ).rejects.toMatchObject({
      code: "LIMIT_REACHED",
      message: "The wealth fund sells within 20% of fair value: ₷0.8–₷1.2",
    });
    await trade({ kind: "shares-sell", companyId: "co2", shares: 10, pricePerShare: 0.8 });
    await trade({ kind: "shares-sell", companyId: "co2", shares: 10, pricePerShare: 1.2 });

    await trade({ kind: "bond-buy", bondId: "b_nb", units: 10 });
    await expect(
      trade({ kind: "bond-sell", bondId: "b_nb", units: 2, pricePerUnit: 79.99 })
    ).rejects.toMatchObject({
      code: "LIMIT_REACHED",
      message: "The wealth fund sells within 20% of fair value: ₷80–₷120",
    });
    await expect(
      trade({ kind: "bond-sell", bondId: "b_nb", units: 2, pricePerUnit: 120.01 })
    ).rejects.toMatchObject({
      code: "LIMIT_REACHED",
      message: "The wealth fund sells within 20% of fair value: ₷80–₷120",
    });
    await trade({ kind: "bond-sell", bondId: "b_nb", units: 2, pricePerUnit: 80 });
    await trade({ kind: "bond-sell", bondId: "b_nb", units: 2, pricePerUnit: 120 });
  });

  it("buys nothing the second time when a fund bond-buy is retried after the primary issue sold out", async () => {
    fake.tables.user!.push({ id: "carol", clerkUserId: "c_carol", countryId: null });
    fake.tables.exchangeWallet!.push({
      id: "w_carol",
      userId: "carol",
      sovereigns: 50_000_00n,
      lifetimeEarned: 50_000_00n,
      lifetimeSpent: 0n,
    });
    const requestId = rid();
    await fundTrade(fake.client, {
      userId: "alice",
      countryId: NA,
      order: { kind: "bond-buy", bondId: "b_nb", units: 5 },
      requestId,
    });
    expect(fundCash()).toBe(4500);

    // Carol buys the remaining 95 primary units and lists 10 on the secondary market.
    await buyBondPrimary(fake.client, {
      userId: "carol",
      bondId: "b_nb",
      units: 95,
      requestId: rid(),
    });
    const { listingId } = await listBondUnits(fake.client, {
      userId: "carol",
      bondId: "b_nb",
      units: 10,
      pricePerUnit: 100,
      requestId: rid(),
    });

    // Retry with the same requestId: primary is now sold out, but it must not take the secondary listing.
    await fundTrade(fake.client, {
      userId: "alice",
      countryId: NA,
      order: { kind: "bond-buy", bondId: "b_nb", units: 5 },
      requestId,
    });
    expect(fundCash()).toBe(4500);
    expect(fake.tables.bondHolding!.find((b) => b.ownerUserId === FUND)?.units).toBe(5);
    expect(fake.tables.bondListing!.find((l) => l.id === listingId)?.units).toBe(10);
  });

  it("rejects with CONFLICT when the per-nation fund lease is already held", async () => {
    jest.mocked(withJobLock).mockResolvedValueOnce({ ran: false });
    await expect(trade({ kind: "bond-buy", bondId: "b_nb", units: 5 })).rejects.toMatchObject({
      code: "CONFLICT",
      message: "The wealth fund is busy; try again",
    });
  });
});

describe("public holdings", () => {
  it("shows the fund's holdings on the nation page", async () => {
    await deposit(2000);
    await fundTrade(fake.client, {
      userId: "alice",
      countryId: NA,
      order: { kind: "bond-buy", bondId: "b_nb", units: 5 },
      requestId: rid(),
    });
    const page = await getNationPage(fake.client, NA);
    expect(page?.fund?.bonds).toEqual([expect.objectContaining({ bondId: "b_nb", units: 5 })]);
    expect(page?.fund?.wallet).toBe(1500);
    expect((await getNationPage(fake.client, "nb"))?.fund).toBeNull();
  });
});

describe("the fund stays out of player surfaces", () => {
  it("never shows on the investor leaderboard", async () => {
    await deposit(2000);
    await fundTrade(fake.client, {
      userId: "alice",
      countryId: NA,
      order: { kind: "bond-buy", bondId: "b_nb", units: 5 },
      requestId: rid(),
    });
    const boards = await getLeaderboards(fake.client, "default");
    expect(boards.investors).toHaveLength(2); // alice and bob, not the fund
  });

  it("gets no notifications", async () => {
    jest.mocked(notificationAPI.create).mockClear();
    await sendExchangeNotices([
      { userId: FUND, title: "Dividend", message: "x" },
      { userId: "alice", title: "Dividend", message: "x" },
    ]);
    expect(jest.mocked(notificationAPI.create).mock.calls.map(([n]) => n.userId)).toEqual([
      "alice",
    ]);
  });
});
