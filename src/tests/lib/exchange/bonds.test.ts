/**
 * Nation bonds (Exchange terminal R1, docs/specs/2026-11-06-exchange-overhaul-design.md §7): the owner issues, players
 * buy from the treasury or from each other, coupons are paid weekly from the treasury, principal in the last week, and
 * a treasury that can't pay defaults: holders get pro-rata cents, the nation is rated D and banned from issuing.
 */
jest.mock("~/lib/exchange/notify", () => ({
  notifyExchange: jest.fn(),
  sendExchangeNotices: jest.fn(),
}));

import {
  BOND_FACE,
  WEEK_MS,
  buyBondListing,
  buyBondPrimary,
  cancelBondListing,
  issueBond,
  listBondUnits,
  modelBondPrice,
  nationRatingFor,
  runBondPayments,
} from "~/lib/exchange/bonds";
import { invalidateExchangeConfigCache } from "~/lib/vault/exchange-config";
import { invalidateVaultConfigCache } from "~/lib/vault/vault-perks";
import { createFakeExchangeDb, type FakeDb } from "~/tests/helpers/fake-exchange-db";

let fake: FakeDb;
let seq = 0;
const rid = () => `request-${++seq}`;
const USERS = ["alice", "bob", "carol"];

function setup(treasuryBalance = 50_000) {
  invalidateExchangeConfigCache();
  invalidateVaultConfigCache();
  fake = createFakeExchangeDb({
    user: USERS.map((id) => ({ id, clerkUserId: `c_${id}`, countryId: null })),
    exchangeWallet: USERS.map((userId) => ({
      id: `w_${userId}`,
      userId,
      sovereigns: 200_000,
      lifetimeEarned: 200_000,
      lifetimeSpent: 0,
    })),
    country: [{ id: "na", name: "Caphiria", realmId: "default", ownerUserId: "alice" }],
    nationTreasury: [{ id: "t_na", countryId: "na", realmId: "default", balance: treasuryBalance }],
    systemConfig: [],
  });
}

const sov = (userId: string) =>
  fake.tables.exchangeWallet!.find((w) => w.userId === userId)!.sovereigns as number;
const treasury = () => fake.tables.nationTreasury!.find((t) => t.countryId === "na")!;
const bond = (id: string) => fake.tables.nationBond!.find((b) => b.id === id)!;
const holding = (userId: string) =>
  (fake.tables.bondHolding ?? []).find((h) => h.ownerUserId === userId)?.units ?? 0;
const news = (kind: string) => (fake.tables.exchangeNewsItem ?? []).filter((n) => n.kind === kind);

async function issue(units = 1000, couponRate = 0.1, termWeeks = 2) {
  const { bondId } = await issueBond(fake.client, {
    userId: "alice",
    countryId: "na",
    units,
    couponRate,
    termWeeks,
    requestId: rid(),
  });
  return bondId;
}

beforeEach(() => setup());

describe("nationRatingFor", () => {
  const base = {
    balance: 0,
    outstandingPrincipal: 0,
    growth: 0.02,
    governmentEfficiency: 0.6,
    banned: false,
  };
  it.each([
    [{ balance: 100, outstandingPrincipal: 100 }, "AAA"],
    [{ balance: 50, outstandingPrincipal: 100 }, "AA"],
    [{ balance: 25, outstandingPrincipal: 100 }, "A"],
    [{ balance: 10, outstandingPrincipal: 100 }, "BBB"],
    [{ balance: 5, outstandingPrincipal: 100 }, "B"],
    [{ balance: 1, outstandingPrincipal: 100 }, "CCC"],
  ])("rates coverage %o as %s", (over, rating) => {
    expect(nationRatingFor({ ...base, ...over })).toBe(rating);
  });

  it("drops a notch for shrinking growth and another for weak government, never below CCC", () => {
    expect(
      nationRatingFor({ ...base, balance: 100, outstandingPrincipal: 100, growth: -0.01 })
    ).toBe("AA");
    expect(
      nationRatingFor({
        ...base,
        balance: 100,
        outstandingPrincipal: 100,
        growth: -0.01,
        governmentEfficiency: 0.2,
      })
    ).toBe("A");
    expect(
      nationRatingFor({
        ...base,
        balance: 1,
        outstandingPrincipal: 100,
        growth: -1,
        governmentEfficiency: 0,
      })
    ).toBe("CCC");
  });

  it("rates a nation that owes nothing at the top, whatever its balance", () => {
    expect(nationRatingFor({ ...base, balance: 0, outstandingPrincipal: 0 })).toBe("AAA");
  });

  it("is D while the nation is banned after a default", () => {
    expect(nationRatingFor({ ...base, balance: 1e9, outstandingPrincipal: 1, banned: true })).toBe(
      "D"
    );
  });
});

describe("modelBondPrice", () => {
  it("prices at par when the coupon pays the rating's yield", () => {
    // A: spread 0.02 over a 5% base rate.
    expect(
      modelBondPrice({
        faceValue: 100,
        couponRate: 0.07,
        rating: "A",
        baseRate: 0.05,
        weeksLeft: 10,
        defaulted: false,
      })
    ).toBe(100);
  });

  it("holds the price between 0.1× and 2× face, and a defaulted bond at 0.1×", () => {
    const p = (couponRate: number) =>
      modelBondPrice({
        faceValue: 100,
        couponRate,
        rating: "AAA",
        baseRate: 0.05,
        weeksLeft: 5200,
        defaulted: false,
      });
    expect(p(1)).toBe(200);
    expect(p(0)).toBe(10);
    expect(
      modelBondPrice({
        faceValue: 100,
        couponRate: 0.1,
        rating: "D",
        baseRate: 0.05,
        weeksLeft: 4,
        defaulted: true,
      })
    ).toBe(10);
  });
});

describe("issueBond", () => {
  it("lets only the nation's owner issue, and a retry returns the same bond", async () => {
    await expect(
      issueBond(fake.client, {
        userId: "bob",
        countryId: "na",
        units: 100,
        couponRate: 0.05,
        termWeeks: 4,
        requestId: rid(),
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const requestId = rid();
    const input = {
      userId: "alice",
      countryId: "na",
      units: 100,
      couponRate: 0.05,
      termWeeks: 4,
      requestId,
    };
    const a = await issueBond(fake.client, input);
    const b = await issueBond(fake.client, input);
    expect(b.bondId).toBe(a.bondId);
    expect(fake.tables.nationBond).toHaveLength(1);
    expect(news("bond_issued")[0]).toMatchObject({
      prominence: "HEADLINE",
      sourceKind: "NATION",
      countryId: "na",
      headline: "Caphiria issues ₷10,000 in 4-week bonds at 5%",
    });
  });

  it("refuses to take outstanding principal past four times the treasury cap", async () => {
    const id = await issue(1000);
    await buyBondPrimary(fake.client, { userId: "bob", bondId: id, units: 1000, requestId: rid() });
    // 100,000 sold of a 100,000 cap (4 × 25,000).
    await expect(issue(10)).rejects.toMatchObject({ code: "LIMIT_REACHED" });
  });

  it("counts unsold units against the cap, so unsold issues can't be stacked", async () => {
    await issue(500);
    await issue(500); // 100,000 issued, none sold: exactly the cap
    await expect(issue(10)).rejects.toMatchObject({ code: "LIMIT_REACHED" });
  });

  it("refuses to issue during a default ban", async () => {
    treasury().bondBanUntil = new Date(Date.now() + WEEK_MS);
    await expect(issue()).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("buyBondPrimary", () => {
  it("moves the units' face from the buyer to the treasury, once per request", async () => {
    const id = await issue();
    treasury().creditRating = "B"; // stale, so the re-rate after the sale shows
    const requestId = rid();
    await buyBondPrimary(fake.client, { userId: "bob", bondId: id, units: 10, requestId });
    await buyBondPrimary(fake.client, { userId: "bob", bondId: id, units: 10, requestId });
    expect(sov("bob")).toBe(200_000 - 10 * BOND_FACE);
    expect(treasury().balance).toBe(50_000 + 10 * BOND_FACE);
    expect(bond(id).unitsSold).toBe(10);
    expect(holding("bob")).toBe(10);
    expect(news("bond_bought")[0]!.headline).toBe("A private investor bought 10 Caphiria bonds");
    // Re-rated after the sale: 51,000 in the treasury covers the 1,000 outstanding.
    expect(treasury().creditRating).toBe("AAA");
  });

  it("adds a second purchase to the same holding at the blended cost", async () => {
    const id = await issue();
    await buyBondPrimary(fake.client, { userId: "bob", bondId: id, units: 10, requestId: rid() });
    await buyBondPrimary(fake.client, { userId: "bob", bondId: id, units: 30, requestId: rid() });
    expect((fake.tables.bondHolding ?? []).filter((h) => h.ownerUserId === "bob")).toEqual([
      expect.objectContaining({ units: 40, avgCost: 100 }),
    ]);
  });

  it("sells the last units to only one of two racing buyers", async () => {
    const id = await issue(10);
    const results = await Promise.allSettled(
      ["bob", "carol"].map((userId) =>
        buyBondPrimary(fake.client, { userId, bondId: id, units: 10, requestId: rid() })
      )
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.find((r) => r.status === "rejected")).toMatchObject({
      reason: { code: "LIMIT_REACHED" },
    });
    expect(bond(id).unitsSold).toBe(10);
  });
});

describe("a nation's insiders", () => {
  it("can't buy the nation's bonds from the treasury, owner or acting as the nation", async () => {
    const id = await issue();
    await expect(
      buyBondPrimary(fake.client, { userId: "alice", bondId: id, units: 10, requestId: rid() })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    fake.tables.user!.find((u) => u.id === "carol")!.countryId = "na";
    await expect(
      buyBondPrimary(fake.client, { userId: "carol", bondId: id, units: 10, requestId: rid() })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await buyBondPrimary(fake.client, { userId: "bob", bondId: id, units: 10, requestId: rid() });
    expect(holding("bob")).toBe(10);
    expect(holding("alice")).toBe(0);
    expect(sov("alice")).toBe(200_000);
  });

  it("can't buy them from another player's listing either", async () => {
    const id = await issue();
    await buyBondPrimary(fake.client, { userId: "bob", bondId: id, units: 50, requestId: rid() });
    const { listingId } = await listBondUnits(fake.client, {
      userId: "bob",
      bondId: id,
      units: 30,
      pricePerUnit: 100,
      requestId: rid(),
    });
    await expect(
      buyBondListing(fake.client, { userId: "alice", listingId, units: 10, requestId: rid() })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await buyBondListing(fake.client, { userId: "carol", listingId, units: 10, requestId: rid() });
    expect(holding("carol")).toBe(10);
    expect(holding("alice")).toBe(0);
  });
});

describe("listings", () => {
  it("escrows units, sells them at the listed price and returns the rest on cancel", async () => {
    const id = await issue();
    await buyBondPrimary(fake.client, { userId: "bob", bondId: id, units: 50, requestId: rid() });
    const { listingId } = await listBondUnits(fake.client, {
      userId: "bob",
      bondId: id,
      units: 30,
      pricePerUnit: 104,
      requestId: rid(),
    });
    expect(holding("bob")).toBe(20);
    await buyBondListing(fake.client, { userId: "carol", listingId, units: 10, requestId: rid() });
    expect(holding("carol")).toBe(10);
    expect(sov("carol")).toBe(200_000 - 1040);
    expect(sov("bob")).toBe(200_000 - 5000 + 1040);
    expect(bond(id).lastTradePrice).toBe(104);
    await cancelBondListing(fake.client, { userId: "bob", listingId });
    expect(holding("bob")).toBe(40);
  });
});

describe("runBondPayments", () => {
  it("pays a week's coupon once, then principal in the last week", async () => {
    const id = await issue(1000, 0.1, 2);
    await buyBondPrimary(fake.client, { userId: "bob", bondId: id, units: 100, requestId: rid() });
    const issuedAt = bond(id).issuedAt.getTime();
    const coupon = Math.floor(100 * 100 * 0.1 * (7 / 365) * 100) / 100; // 19.17

    await runBondPayments(fake.client, issuedAt + WEEK_MS);
    await runBondPayments(fake.client, issuedAt + WEEK_MS);
    expect(sov("bob")).toBeCloseTo(200_000 - 10_000 + coupon, 2);
    expect(bond(id).weeksPaid).toBe(1);

    await runBondPayments(fake.client, issuedAt + 2 * WEEK_MS);
    expect(sov("bob")).toBeCloseTo(200_000 + 2 * coupon, 2);
    expect(bond(id).status).toBe("MATURED");
    expect(news("bond_repaid")).toHaveLength(1);
  });

  it("defaults when the treasury can't pay: pro-rata cents, rating D, a 30-day ban and a headline", async () => {
    const id = await issue(1000, 0.1, 4);
    await buyBondPrimary(fake.client, { userId: "bob", bondId: id, units: 600, requestId: rid() });
    await buyBondPrimary(fake.client, {
      userId: "carol",
      bondId: id,
      units: 400,
      requestId: rid(),
    });
    treasury().balance = 50;
    const before = { bob: sov("bob"), carol: sov("carol") };
    const now = bond(id).issuedAt.getTime() + WEEK_MS;

    const result = await runBondPayments(fake.client, now);
    const paidBob = sov("bob") - before.bob;
    const paidCarol = sov("carol") - before.carol;
    expect(paidBob + paidCarol).toBeLessThanOrEqual(50);
    expect(paidBob).toBeCloseTo(30, 1);
    expect(paidCarol).toBeCloseTo(20, 1);
    expect(bond(id).status).toBe("DEFAULTED");
    expect(treasury().creditRating).toBe("D");
    expect(treasury().bondBanUntil.getTime()).toBeCloseTo(now + 30 * 24 * 3600 * 1000, -4);
    expect(news("bond_defaulted")).toHaveLength(1);
    expect(result.defaulted).toBe(1);

    await runBondPayments(fake.client, now + WEEK_MS);
    expect(sov("bob") - before.bob).toBeCloseTo(paidBob, 2);
  });
});
