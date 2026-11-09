/**
 * Exchange phase 2 and 3: the share market (order book, capital gains) and dividends
 * (docs/specs/2026-10-06-exchange-economy-design.md, docs/specs/2026-11-01-exchange-phase-3-design.md).
 * Founder-only controls, listings that can't oversell, buyers that can't overdraw,
 * retries applied once, and dividends that split capital to the cent with nothing created
 * or lost.
 */
jest.mock("~/lib/exchange/notify", () => ({
  notifyExchange: jest.fn(),
  sendExchangeNotices: jest.fn(),
}));
jest.mock("~/lib/exchange/guards", () => ({
  __esModule: true,
  ...jest.requireActual("~/lib/exchange/guards"),
}));
jest.mock("~/lib/exchange/treasury", () => ({
  __esModule: true,
  ...jest.requireActual("~/lib/exchange/treasury"),
}));
jest.mock("~/lib/vault/exchange-service", () => ({
  __esModule: true,
  ...jest.requireActual("~/lib/vault/exchange-service"),
}));

import { dissolveCompany, dissolveCompanyTx } from "~/lib/exchange/companies";
import * as guards from "~/lib/exchange/guards";
import type { Db } from "~/lib/exchange/guards";
import { declareDividend } from "~/lib/exchange/dividends";
import { notifyExchange } from "~/lib/exchange/notify";
import { splitProRata } from "~/lib/exchange/ownership";
import {
  buyShares,
  cancelBuyOrder,
  cancelListing,
  getOrderBook,
  issueShares,
  listShares,
  matchCompanyOrders,
  placeBuyOrder,
  returnBuyOrders,
  setShareTrading,
} from "~/lib/exchange/shares";
import * as treasuryModule from "~/lib/exchange/treasury";
import * as exchangeService from "~/lib/vault/exchange-service";
import { invalidateExchangeConfigCache } from "~/lib/vault/exchange-config";
import { invalidateVaultConfigCache } from "~/lib/vault/vault-perks";
import { createFakeExchangeDb, type FakeDb } from "~/tests/helpers/fake-exchange-db";

let fake: FakeDb;
let seq = 0;
const rid = () => `request-${++seq}`;
const USERS = ["alice", "bob", "carol", "dave"];

/** Alice founded "co" (1,000 capital, trading open) and holds `aliceShares`; others as given. */
function setup(holdings: Record<string, number> = { alice: 1000 }, wallets = 5000) {
  invalidateExchangeConfigCache();
  invalidateVaultConfigCache();
  const outstanding = Object.values(holdings).reduce((s, n) => s + n, 0);
  fake = createFakeExchangeDb({
    user: USERS.map((id) => ({ id, clerkUserId: `c_${id}` })),
    exchangeWallet: USERS.map((userId) => ({
      id: `w_${userId}`,
      userId,
      sovereigns: BigInt(Math.round(wallets * 100)),
      lifetimeEarned: BigInt(Math.round(wallets * 100)),
      lifetimeSpent: 0n,
    })),
    company: [
      {
        id: "co",
        founderId: "alice",
        name: "Alice Works",
        sectorKey: "industry",
        capital: 1000,
        fairValue: 1000,
        standing: 0,
        contractsWonValue: 0,
        decisionValue: 0,
        sharesIssued: outstanding,
        sharesOutstanding: outstanding,
        tradingOpen: true,
        status: "ACTIVE",
      },
    ],
    shareholding: Object.entries(holdings).map(([ownerUserId, shares]) => ({
      id: `sh_${ownerUserId}`,
      companyId: "co",
      ownerUserId,
      shares,
      avgCost: 1,
    })),
    systemConfig: [],
  });
}

const sov = (userId: string) =>
  Number(fake.tables.exchangeWallet!.find((w) => w.userId === userId)!.sovereigns) / 100;
const cents = (n: number) => Math.round(n * 100);
const company = () => fake.tables.company!.find((c) => c.id === "co")!;
const holding = (userId: string) =>
  (fake.tables.shareholding ?? []).find((h) => h.ownerUserId === userId)?.shares ?? 0;
const listing = (id: string) => fake.tables.shareListing!.find((l) => l.id === id)!;
/** Every ₷ in wallets and company capital, in cents. */
const totalCents = () =>
  fake.tables.exchangeWallet!.reduce((s, w) => s + Number(w.sovereigns), 0) +
  fake.tables.company!.reduce((s, c) => s + cents(c.capital), 0);
const totalShares = () =>
  (fake.tables.shareholding ?? []).reduce((s, h) => s + h.shares, 0) +
  (fake.tables.shareListing ?? [])
    .filter((l) => l.status === "OPEN" && l.sellerUserId)
    .reduce((s, l) => s + l.shares, 0);

async function aliceLists(shares: number, pricePerShare: number) {
  const { listing: l } = await listShares(fake.client, {
    userId: "alice",
    companyId: "co",
    shares,
    pricePerShare,
    requestId: rid(),
  });
  return l.id as string;
}

beforeEach(() => {
  setup();
  jest.mocked(notifyExchange).mockClear();
});

describe("founder controls", () => {
  it("only the founder opens or closes trading, issues shares or pays dividends", async () => {
    await expect(
      setShareTrading(fake.client, { userId: "bob", companyId: "co", open: false })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      issueShares(fake.client, { userId: "bob", companyId: "co", shares: 10, requestId: rid() })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      declareDividend(fake.client, { userId: "bob", companyId: "co", amount: 10, requestId: rid() })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await setShareTrading(fake.client, { userId: "alice", companyId: "co", open: false });
    expect(company().tradingOpen).toBe(false);
  });
});

describe("secondary listings", () => {
  it("escrows the shares, sells part at the listed price and returns the rest on cancel", async () => {
    const id = await aliceLists(300, 2.5);
    expect(holding("alice")).toBe(700);
    const before = totalCents();

    const r = await buyShares(fake.client, {
      userId: "bob",
      listingId: id,
      shares: 100,
      requestId: rid(),
    });
    expect(r).toMatchObject({ shares: 100, cost: 250, alreadyApplied: false });
    expect(sov("bob")).toBe(4750);
    expect(sov("alice")).toBe(5250);
    expect(holding("bob")).toBe(100);
    expect(listing(id).shares).toBe(200);
    expect(totalCents()).toBe(before);
    expect(notifyExchange).toHaveBeenCalledWith([
      expect.objectContaining({ userId: "alice", title: expect.stringContaining("shares sold") }),
    ]);

    await expect(
      cancelListing(fake.client, { userId: "bob", listingId: id })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await cancelListing(fake.client, { userId: "alice", listingId: id });
    expect(holding("alice")).toBe(900);
    expect(totalShares()).toBe(1000);
  });

  it("refuses listing more shares than held, and buying your own listing", async () => {
    await expect(aliceLists(1001, 1)).rejects.toMatchObject({ code: "INVALID_AMOUNT" });
    const id = await aliceLists(10, 1);
    await expect(
      buyShares(fake.client, { userId: "alice", listingId: id, shares: 1, requestId: rid() })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("a buyer who can't pay moves nothing", async () => {
    const id = await aliceLists(100, 100); // ₷10,000 for all 100
    await expect(
      buyShares(fake.client, { userId: "bob", listingId: id, shares: 100, requestId: rid() })
    ).rejects.toMatchObject({ code: "INSUFFICIENT_SOVEREIGNS" });
    expect(sov("bob")).toBe(5000);
    expect(listing(id)).toMatchObject({ shares: 100, status: "OPEN" });
    expect(holding("bob")).toBe(0);
  });

  it("two buyers racing for the last shares: one gets them, nobody pays twice", async () => {
    const id = await aliceLists(100, 3);
    const before = totalCents();
    const results = await Promise.allSettled(
      ["bob", "carol", "dave"].map((userId) =>
        buyShares(fake.client, { userId, listingId: id, shares: 100, requestId: rid() })
      )
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(listing(id)).toMatchObject({ shares: 0, status: "FILLED" });
    expect(holding("bob") + holding("carol") + holding("dave")).toBe(100);
    expect(sov("alice")).toBe(5300);
    expect(totalCents()).toBe(before);
    expect(totalShares()).toBe(1000);
  });

  it("a retried purchase (same requestId, even concurrent) is applied once", async () => {
    const id = await aliceLists(100, 2);
    const requestId = rid();
    const results = await Promise.all(
      [1, 2, 3].map(() =>
        buyShares(fake.client, { userId: "bob", listingId: id, shares: 40, requestId })
      )
    );
    expect(results.filter((r) => !r.alreadyApplied)).toHaveLength(1);
    expect(holding("bob")).toBe(40);
    expect(sov("bob")).toBe(4920);
    expect(listing(id).shares).toBe(60);
  });
});

describe("primary issues", () => {
  it("an issue can at most double the shares", async () => {
    await expect(
      issueShares(fake.client, { userId: "alice", companyId: "co", shares: 1001, requestId: rid() })
    ).rejects.toMatchObject({ code: "LIMIT_REACHED" });
  });
});

describe("splitProRata", () => {
  it("never creates or loses a cent, whatever the holders and amount", () => {
    let seed = 7;
    const rand = (n: number) => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      return seed % n;
    };
    for (let run = 0; run < 500; run++) {
      const holders = Array.from({ length: 1 + rand(12) }, (_, i) => ({
        userId: `u${i}`,
        shares: 1 + rand(5000),
      }));
      const total = rand(10_000_000);
      const split = splitProRata(total, holders);
      const shareCount = holders.reduce((s, h) => s + h.shares, 0);
      expect(split.paidCents + split.remainderCents).toBe(total);
      expect(split.paidCents).toBe(split.payouts.reduce((s, p) => s + p.cents, 0));
      for (const p of split.payouts) {
        const h = holders.find((x) => x.userId === p.userId)!;
        expect(p.cents).toBe(Math.floor((total * h.shares) / shareCount));
      }
      expect(split.remainderCents).toBeLessThan(holders.length);
    }
  });
});

describe("dividends", () => {
  it("a retried declaration (same requestId, even concurrent) pays once", async () => {
    setup({ alice: 600, bob: 400 });
    const requestId = rid();
    const results = await Promise.all(
      [1, 2, 3].map(() =>
        declareDividend(fake.client, { userId: "alice", companyId: "co", amount: 100, requestId })
      )
    );
    expect(results.filter((r) => !r.alreadyApplied)).toHaveLength(1);
    expect(company().capital).toBe(900);
    expect(sov("bob")).toBe(5040);
    expect(fake.tables.companyDividend).toHaveLength(1);
  });

  it("racing dividends can't pay out more than the capital", async () => {
    setup({ alice: 500, bob: 500 });
    const results = await Promise.allSettled(
      [600, 600].map((amount) =>
        declareDividend(fake.client, { userId: "alice", companyId: "co", amount, requestId: rid() })
      )
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(company().capital).toBe(400);
    expect(sov("bob")).toBe(5300);
  });

  // Regression: withdrawals refused while new shares were on sale at a price set from the capital, but a dividend
  // didn't, so the founder could take the capital out through a dividend while the issue still sold at that price
  it("is refused while a primary issue is on sale, and paid once it is cancelled", async () => {
    setup({ alice: 950, bob: 50 });
    const issued = await issueShares(fake.client, {
      userId: "alice",
      companyId: "co",
      shares: 100,
      requestId: rid(),
    });
    const before = { capital: company().capital, alice: sov("alice"), bob: sov("bob") };

    await expect(
      declareDividend(fake.client, {
        userId: "alice",
        companyId: "co",
        amount: 500,
        requestId: rid(),
      })
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringMatching(/cancel the issue/),
    });
    expect({ capital: company().capital, alice: sov("alice"), bob: sov("bob") }).toEqual(before);
    expect(fake.tables.companyDividend ?? []).toHaveLength(0);

    await cancelListing(fake.client, { userId: "alice", listingId: issued.listing.id });
    await declareDividend(fake.client, {
      userId: "alice",
      companyId: "co",
      amount: 100,
      requestId: rid(),
    });
    expect(company().capital).toBe(before.capital - 100);
  });
});

describe("dissolving a company with outside shareholders", () => {
  it("refuses a direct dissolve when outside holders own >= 10%, and via a vote cancels listings and pays capital pro rata", async () => {
    setup({ alice: 334, bob: 333, carol: 333 });
    await listShares(fake.client, {
      userId: "carol",
      companyId: "co",
      shares: 100,
      pricePerShare: 1,
      requestId: rid(),
    });
    await expect(
      dissolveCompany(fake.client, { userId: "alice", companyId: "co" })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    const before = totalCents();
    const r = await fake.client.$transaction((tx: Db) =>
      dissolveCompanyTx(tx, { userId: "alice", companyId: "co", viaVote: true })
    );
    expect(company()).toMatchObject({ status: "DELISTED", capital: 0 });
    // 100,000 cents: bob and carol 33,300 each, alice 33,400.
    expect(sov("bob")).toBe(5333);
    expect(sov("carol")).toBe(5333);
    expect(r.returned).toBe(334);
    expect(holding("carol")).toBe(333);
    expect(totalCents()).toBe(before);
  });
});

const bid = (userId: string, shares: number, maxPricePerShare: number, requestId = rid()) =>
  placeBuyOrder(fake.client, { userId, companyId: "co", shares, maxPricePerShare, requestId });
const orders = () => fake.tables.shareBuyOrder ?? [];
const treasury = (countryId = "hq") =>
  (fake.tables.nationTreasury ?? []).find((t) => t.countryId === countryId);

/** Give the company an HQ nation that taxes capital gains at `capGains` percent. */
function setHq(capGains: number) {
  fake.tables.country = [
    {
      id: "hq",
      fiscalSystem: { exciseTaxRates: JSON.stringify([{ type: "capitalGains", rate: capGains }]) },
    },
  ];
  company().hqCountryId = "hq";
}

describe("bids", () => {
  it("fills at the resting ask price and refunds the difference", async () => {
    const before = totalCents();
    const id = await aliceLists(100, 2);
    const r = await bid("bob", 100, 5);
    expect(r).toMatchObject({ sharesBought: 100, sharesResting: 0, orderId: null });
    expect(sov("bob")).toBe(4800);
    expect(sov("alice")).toBe(5200);
    expect(holding("bob")).toBe(100);
    expect(listing(id)).toMatchObject({ shares: 0, status: "FILLED" });
    expect(company().lastTradePrice).toBe(2);
    expect(orders()).toHaveLength(0);
    expect(totalCents()).toBe(before);
  });

  it("takes the cheapest ask first, then the next at a higher price", async () => {
    setup({ alice: 500, bob: 300, carol: 200 });
    const bobAsk = await listShares(fake.client, {
      userId: "bob",
      companyId: "co",
      shares: 10,
      pricePerShare: 3,
      requestId: rid(),
    });
    const carolAsk = await listShares(fake.client, {
      userId: "carol",
      companyId: "co",
      shares: 10,
      pricePerShare: 2,
      requestId: rid(),
    });
    await bid("dave", 15, 5);
    expect(listing(carolAsk.listing.id as string)).toMatchObject({ shares: 0, status: "FILLED" });
    expect(listing(bobAsk.listing.id as string)).toMatchObject({ shares: 5, status: "OPEN" });
    expect(holding("dave")).toBe(15);
    // Escrow 75, refunded 30 (carol at 2) and 10 (bob at 3).
    expect(sov("dave")).toBe(4965);
    expect(sov("carol")).toBe(5020);
    expect(sov("bob")).toBe(5015);
  });

  it("rests with its escrow, then a matching ask fills it at the bid price", async () => {
    const before = totalCents();
    const r = await bid("bob", 50, 4);
    expect(r).toMatchObject({ sharesBought: 0, sharesResting: 50 });
    expect(sov("bob")).toBe(4800);
    expect(orders()[0]).toMatchObject({
      shares: 50,
      sharesOrdered: 50,
      escrow: 200,
      status: "OPEN",
    });

    await listShares(fake.client, {
      userId: "alice",
      companyId: "co",
      shares: 30,
      pricePerShare: 3.5,
      requestId: rid(),
    });
    expect(sov("alice")).toBe(5120);
    expect(holding("bob")).toBe(30);
    expect(holding("alice")).toBe(970);
    expect(orders()[0]).toMatchObject({ shares: 20, escrow: 80, status: "OPEN" });
    expect(company().lastTradePrice).toBe(4);
    expect(totalCents() + cents(orders()[0]!.escrow as number)).toBe(before);
    expect(totalShares()).toBe(1000);
  });

  it("cancelling refunds exactly the remaining escrow", async () => {
    const bidId = (await bid("bob", 50, 4)).orderId as string;
    await listShares(fake.client, {
      userId: "alice",
      companyId: "co",
      shares: 30,
      pricePerShare: 3.5,
      requestId: rid(),
    });
    await expect(
      cancelBuyOrder(fake.client, { userId: "alice", orderId: bidId })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(cancelBuyOrder(fake.client, { userId: "bob", orderId: bidId })).resolves.toEqual({
      refunded: 80,
    });
    expect(sov("bob")).toBe(4880);
    expect(orders()[0]).toMatchObject({ status: "CANCELLED", shares: 0, escrow: 0 });
    await expect(
      cancelBuyOrder(fake.client, { userId: "bob", orderId: bidId })
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("allows five open bids per company and no more", async () => {
    for (let i = 0; i < 5; i++) await bid("bob", 10, 1);
    await expect(bid("bob", 10, 1)).rejects.toMatchObject({ code: "LIMIT_REACHED" });
    expect(sov("bob")).toBe(4950);
    expect(orders()).toHaveLength(5);
  });

  it("refuses a bid that would fill the buyer's own listing", async () => {
    await aliceLists(10, 4);
    await expect(bid("alice", 10, 5)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(orders()).toHaveLength(0);
  });

  it("skips the seller's own bids when listing", async () => {
    await bid("alice", 10, 5);
    const r = await listShares(fake.client, {
      userId: "alice",
      companyId: "co",
      shares: 10,
      pricePerShare: 4,
      requestId: rid(),
    });
    expect(r.listing).toMatchObject({ shares: 10, status: "OPEN" });
    expect(orders()[0]).toMatchObject({ shares: 10, status: "OPEN" });
    expect(sov("alice")).toBe(4950);
  });

  it("refuses bids while trading is closed, but still cancels them", async () => {
    const bidId = (await bid("bob", 10, 2)).orderId as string;
    await setShareTrading(fake.client, { userId: "alice", companyId: "co", open: false });
    await expect(bid("carol", 10, 2)).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(cancelBuyOrder(fake.client, { userId: "bob", orderId: bidId })).resolves.toEqual({
      refunded: 20,
    });
    expect(sov("bob")).toBe(5000);
  });

  it("a retried bid (same requestId, even concurrent) is applied once", async () => {
    const requestId = rid();
    const results = await Promise.all([1, 2, 3].map(() => bid("bob", 10, 2, requestId)));
    expect(results.filter((r) => !r.alreadyApplied)).toHaveLength(1);
    expect(orders()).toHaveLength(1);
    expect(sov("bob")).toBe(4980);
  });

  it("a primary issue fills the resting bids it crosses, at the bid price, into capital", async () => {
    const before = totalCents();
    await bid("bob", 10, 2);
    await issueShares(fake.client, {
      userId: "alice",
      companyId: "co",
      shares: 100,
      requestId: rid(),
    });
    expect(holding("bob")).toBe(10);
    expect(orders()[0]).toMatchObject({ shares: 0, status: "FILLED" });
    expect(company()).toMatchObject({ capital: 1020, sharesOutstanding: 1010, lastTradePrice: 2 });
    expect(totalCents()).toBe(before);
    expect(totalShares()).toBe(1010);
  });

  it("aggregates the open book by price level", async () => {
    await aliceLists(10, 3);
    await aliceLists(5, 3);
    await bid("bob", 4, 1);
    await bid("carol", 6, 1);
    await bid("bob", 2, 2);
    const book = await getOrderBook(fake.client, "co");
    expect(book.asks).toEqual([{ price: 3, shares: 15, listings: 2 }]);
    expect(book.bids).toEqual([
      { price: 2, shares: 2, orders: 1 },
      { price: 1, shares: 10, orders: 2 },
    ]);
    expect(book.lastTradePrice).toBeNull();
  });

  it("a bid that fills in full doesn't count against the five open bids", async () => {
    for (let i = 0; i < 5; i++) await bid("bob", 10, 1);
    await aliceLists(10, 2);
    await expect(bid("bob", 10, 2)).resolves.toMatchObject({ sharesBought: 10, sharesResting: 0 });
    await expect(bid("bob", 10, 1)).rejects.toMatchObject({ code: "LIMIT_REACHED" });
    expect(orders()).toHaveLength(5);
  });

  it("records the last trade price and time on each fill", async () => {
    await aliceLists(10, 2);
    const before = Date.now();
    await bid("bob", 10, 2);
    expect(company()).toMatchObject({ lastTradePrice: 2 });
    expect(company().lastTradeIxTime as number).toBeGreaterThanOrEqual(before);
    await expect(getOrderBook(fake.client, "co")).resolves.toMatchObject({ lastTradePrice: 2 });
  });
});

describe("capital gains tax on secondary sales", () => {
  it("taxes the gain over average cost into the HQ treasury and nets the seller the rest", async () => {
    setHq(20);
    const before = totalCents();
    const id = await aliceLists(300, 3);
    await buyShares(fake.client, { userId: "bob", listingId: id, shares: 300, requestId: rid() });
    // Gross 900; gain over the average cost of 1 is 600; tax at 20% is 120.
    expect(sov("alice")).toBe(5780);
    expect(treasury()).toMatchObject({ balance: 120_00n, lifetimeTaxEarned: 120_00n });
    expect(totalCents() + Number(treasury()!.balance)).toBe(before);
  });

  it("owes nothing when the sale is below average cost", async () => {
    setHq(20);
    const id = await aliceLists(100, 0.5);
    await buyShares(fake.client, { userId: "bob", listingId: id, shares: 100, requestId: rid() });
    expect(sov("alice")).toBe(5050);
    expect(treasury()).toBeUndefined();
  });

  it("taxes a sale filled by a resting bid the same way", async () => {
    setHq(20);
    await aliceLists(300, 3);
    const before = totalCents();
    await bid("bob", 300, 3);
    expect(sov("alice")).toBe(5780);
    expect(treasury()).toMatchObject({ balance: 120_00n, lifetimeTaxEarned: 120_00n });
    expect(totalCents() + Number(treasury()!.balance)).toBe(before);
  });

  it("doesn't tax a primary issue, even with an HQ nation", async () => {
    setHq(20);
    await bid("bob", 10, 2);
    await issueShares(fake.client, {
      userId: "alice",
      companyId: "co",
      shares: 100,
      requestId: rid(),
    });
    expect(company().capital).toBe(1020);
    expect(treasury()).toBeUndefined();
  });

  it("owes no tax when the company has no HQ nation", async () => {
    const id = await aliceLists(300, 3);
    await buyShares(fake.client, { userId: "bob", listingId: id, shares: 300, requestId: rid() });
    expect(sov("alice")).toBe(5900);
    expect(fake.tables.nationTreasury ?? []).toHaveLength(0);
  });
});

describe("dividend credit cap and withholding", () => {
  it("refuses a dividend above half the capital above credit drawn", async () => {
    setup({ alice: 600, bob: 400 });
    company().creditDrawn = 600;
    await expect(
      declareDividend(fake.client, {
        userId: "alice",
        companyId: "co",
        amount: 300,
        requestId: rid(),
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(company().capital).toBe(1000);

    await declareDividend(fake.client, {
      userId: "alice",
      companyId: "co",
      amount: 200,
      requestId: rid(),
    });
    expect(company().capital).toBe(800);
    expect(sov("bob")).toBe(5080);
  });

  it("withholds from each holder into the HQ treasury exactly once", async () => {
    setup({ alice: 600, bob: 400 });
    setHq(20);
    const before = totalCents();
    const requestId = rid();
    const r = await declareDividend(fake.client, {
      userId: "alice",
      companyId: "co",
      amount: 100,
      requestId,
    });
    // Withholding is half the 20% gains rate: alice's 60 loses 6, bob's 40 loses 4.
    expect(r).toMatchObject({ paid: 100, alreadyApplied: false });
    expect(sov("alice")).toBe(5054);
    expect(sov("bob")).toBe(5036);
    expect(company().capital).toBe(900);
    expect(treasury()).toMatchObject({ balance: 10_00n, lifetimeTaxEarned: 10_00n });
    expect(totalCents() + Number(treasury()!.balance)).toBe(before);

    const again = await declareDividend(fake.client, {
      userId: "alice",
      companyId: "co",
      amount: 100,
      requestId,
    });
    expect(again.alreadyApplied).toBe(true);
    expect(treasury()!.balance).toBe(10_00n);
    expect(company().capital).toBe(900);
  });

  it("withholds to the cent and leaves the sub-cent remainder in capital", async () => {
    setup({ alice: 1, bob: 1, carol: 1 });
    setHq(15);
    const before = totalCents();
    const r = await declareDividend(fake.client, {
      userId: "alice",
      companyId: "co",
      amount: 1,
      requestId: rid(),
    });
    // ₷1 splits 33 cents each, with 1 cent left in capital; 7.5% withholding takes 2 cents each.
    expect(r.paid).toBe(0.99);
    expect(cents(sov("alice"))).toBe(500031);
    expect(cents(sov("bob"))).toBe(500031);
    expect(cents(sov("carol"))).toBe(500031);
    expect(cents(company().capital)).toBe(99901);
    expect(treasury()!.balance).toBe(6n);
    expect(totalCents() + Number(treasury()!.balance)).toBe(before);
  });
});

describe("lock ordering in matching and buy-order refunds", () => {
  it("locks all crossing party wallets in sorted order before the first capital-gains treasury lock", async () => {
    setup({ alice: 500, bob: 300, carol: 200 });
    setHq(20);
    // Carol's ask (price 2) ranks ahead of Alice's ask (price 3), so without pre-locking
    // Carol and Dave would lock first, then the HQ treasury, and only then Alice and Bob.
    fake.tables.shareListing = [
      {
        id: "ask_carol",
        companyId: "co",
        sellerUserId: "carol",
        shares: 10,
        sharesListed: 10,
        pricePerShare: 2,
        status: "OPEN",
        createdIxTime: 1,
      },
      {
        id: "ask_alice",
        companyId: "co",
        sellerUserId: "alice",
        shares: 10,
        sharesListed: 10,
        pricePerShare: 3,
        status: "OPEN",
        createdIxTime: 2,
      },
    ];
    fake.tables.shareBuyOrder = [
      {
        id: "bid_dave",
        companyId: "co",
        buyerUserId: "dave",
        shares: 10,
        sharesOrdered: 10,
        maxPricePerShare: 4,
        escrow: 40,
        status: "OPEN",
        createdIxTime: 1,
      },
      {
        id: "bid_bob",
        companyId: "co",
        buyerUserId: "bob",
        shares: 10,
        sharesOrdered: 10,
        maxPricePerShare: 3,
        escrow: 30,
        status: "OPEN",
        createdIxTime: 2,
      },
    ];

    const walletLocksBeforeTreasury: string[] = [];
    let treasuryLocked = false;
    const walletSpy = jest.spyOn(guards, "lockWallet").mockImplementation(async (tx, userId) => {
      if (!treasuryLocked) walletLocksBeforeTreasury.push(userId);
      return exchangeService.lockWallet(tx, userId);
    });
    const origTransfer = treasuryModule.transferToTreasuryTx;
    const treasurySpy = jest
      .spyOn(treasuryModule, "transferToTreasuryTx")
      .mockImplementation(async (tx, input) => {
        treasuryLocked = true;
        return origTransfer(tx, input);
      });

    try {
      await fake.client.$transaction((tx: Db) => matchCompanyOrders(tx, "co"));
    } finally {
      walletSpy.mockRestore();
      treasurySpy.mockRestore();
    }

    expect(treasuryLocked).toBe(true);
    expect(walletLocksBeforeTreasury).toEqual(["alice", "bob", "carol", "dave"]);
  });

  it("returnBuyOrders refunds open bids in sorted buyerUserId order", async () => {
    setup({ alice: 1000 });
    fake.tables.shareBuyOrder = [
      {
        id: "b_dave",
        companyId: "co",
        buyerUserId: "dave",
        shares: 5,
        sharesOrdered: 5,
        maxPricePerShare: 2,
        escrow: 10,
        status: "OPEN",
        createdIxTime: 1,
      },
      {
        id: "b_bob",
        companyId: "co",
        buyerUserId: "bob",
        shares: 5,
        sharesOrdered: 5,
        maxPricePerShare: 2,
        escrow: 10,
        status: "OPEN",
        createdIxTime: 2,
      },
      {
        id: "b_carol",
        companyId: "co",
        buyerUserId: "carol",
        shares: 5,
        sharesOrdered: 5,
        maxPricePerShare: 2,
        escrow: 10,
        status: "OPEN",
        createdIxTime: 3,
      },
      {
        id: "b_alice",
        companyId: "co",
        buyerUserId: "alice",
        shares: 5,
        sharesOrdered: 5,
        maxPricePerShare: 2,
        escrow: 10,
        status: "OPEN",
        createdIxTime: 4,
      },
    ];

    const refundedUsers: string[] = [];
    const origEarn = exchangeService.earnSovereignsTx;
    const earnSpy = jest
      .spyOn(exchangeService, "earnSovereignsTx")
      .mockImplementation(async (tx, input) => {
        refundedUsers.push(input.userId);
        return origEarn(tx, input);
      });

    try {
      const refunded = await fake.client.$transaction((tx: Db) => returnBuyOrders(tx, "co"));
      expect(refunded).toBe(40);
    } finally {
      earnSpy.mockRestore();
    }

    expect(refundedUsers).toEqual(["alice", "bob", "carol", "dave"]);
  });
});
