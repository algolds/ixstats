/**
 * Exchange phase 2: the share market and dividends (docs/specs/2026-10-06-exchange-economy-design.md
 * §8). Founder-only controls, listings that can't oversell, buyers that can't overdraw,
 * retries applied once, and dividends that split capital to the cent with nothing created
 * or lost.
 */
jest.mock("~/lib/exchange/notify", () => ({
  notifyExchange: jest.fn(),
  sendExchangeNotices: jest.fn(),
}));

import { dissolveCompany } from "~/lib/exchange/companies";
import { declareDividend } from "~/lib/exchange/dividends";
import { notifyExchange } from "~/lib/exchange/notify";
import { splitProRata } from "~/lib/exchange/ownership";
import {
  buyShares,
  cancelListing,
  issueShares,
  listShares,
  setShareTrading,
} from "~/lib/exchange/shares";
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
      sovereigns: wallets,
      lifetimeEarned: wallets,
      lifetimeSpent: 0,
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
  fake.tables.exchangeWallet!.find((w) => w.userId === userId)!.sovereigns as number;
const cents = (n: number) => Math.round(n * 100);
const company = () => fake.tables.company!.find((c) => c.id === "co")!;
const holding = (userId: string) =>
  (fake.tables.shareholding ?? []).find((h) => h.ownerUserId === userId)?.shares ?? 0;
const listing = (id: string) => fake.tables.shareListing!.find((l) => l.id === id)!;
/** Every ₷ in wallets and company capital, in cents. */
const totalCents = () =>
  fake.tables.exchangeWallet!.reduce((s, w) => s + cents(w.sovereigns), 0) +
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
});

describe("dissolving a company with outside shareholders", () => {
  it("cancels listings and pays the capital out pro rata, founder taking the remainder", async () => {
    setup({ alice: 334, bob: 333, carol: 333 });
    await listShares(fake.client, {
      userId: "carol",
      companyId: "co",
      shares: 100,
      pricePerShare: 1,
      requestId: rid(),
    });
    const before = totalCents();
    const r = await dissolveCompany(fake.client, { userId: "alice", companyId: "co" });
    expect(company()).toMatchObject({ status: "DELISTED", capital: 0 });
    // 100,000 cents: bob and carol 33,300 each, alice 33,400.
    expect(sov("bob")).toBe(5333);
    expect(sov("carol")).toBe(5333);
    expect(r.returned).toBe(334);
    expect(holding("carol")).toBe(333);
    expect(totalCents()).toBe(before);
  });
});
