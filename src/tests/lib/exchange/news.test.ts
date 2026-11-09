/**
 * Business news and live activity (news.ts): published inside the move's transaction, once per key, never naming a
 * user; headlines alert the subject's watchers after the move commits.
 */
jest.mock("~/lib/exchange/notify", () => ({
  notifyExchange: jest.fn(),
  sendExchangeNotices: jest.fn(),
}));

import { declareDividend } from "~/lib/exchange/dividends";
import { recordTrade } from "~/lib/exchange/fills";
import type { Db } from "~/lib/exchange/guards";
import { alertWatchers, listNews, publishNewsTx, type PublishNewsInput } from "~/lib/exchange/news";
import { notifyExchange } from "~/lib/exchange/notify";
import { invalidateExchangeConfigCache } from "~/lib/vault/exchange-config";
import { invalidateVaultConfigCache } from "~/lib/vault/vault-perks";
import { createFakeExchangeDb, type FakeDb } from "~/tests/helpers/fake-exchange-db";

let fake: FakeDb;
const inTx = <T>(fn: (tx: Db) => Promise<T>): Promise<T> => fake.client.$transaction(fn);
const news = () => fake.tables.exchangeNewsItem ?? [];

function setup() {
  invalidateExchangeConfigCache();
  invalidateVaultConfigCache();
  fake = createFakeExchangeDb({
    user: ["alice", "bob"].map((id) => ({ id, clerkUserId: `c_${id}` })),
    exchangeWallet: ["alice", "bob"].map((userId) => ({
      id: `w_${userId}`,
      userId,
      sovereigns: 5000_00n,
      lifetimeEarned: 5000_00n,
      lifetimeSpent: 0n,
    })),
    company: [
      {
        id: "co",
        founderId: "alice",
        name: "Alice Works",
        realmId: "default",
        sectorKey: "industry",
        capital: 1000,
        fairValue: 1000,
        standing: 0,
        contractsWonValue: 0,
        decisionValue: 0,
        sharesIssued: 1000,
        sharesOutstanding: 1000,
        tradingOpen: true,
        status: "ACTIVE",
        lastTradePrice: 500,
      },
    ],
    shareholding: [{ id: "sh_a", companyId: "co", ownerUserId: "alice", shares: 1000, avgCost: 1 }],
    systemConfig: [],
  });
}

const base = (over: Partial<PublishNewsInput> = {}): PublishNewsInput => ({
  realmId: "default",
  kind: "dividend",
  prominence: "HEADLINE",
  sourceKind: "COMPANY",
  sourceId: "co",
  headline: "Alice Works pays a dividend",
  companyId: "co",
  key: "news:dividend:co:1",
  ...over,
});

beforeEach(() => {
  setup();
  jest.mocked(notifyExchange).mockClear();
});

describe("publishNewsTx", () => {
  it("publishes a key once and returns the headline only the first time", async () => {
    const first = await inTx((tx) => publishNewsTx(tx, base()));
    const again = await inTx((tx) => publishNewsTx(tx, base()));
    expect(first).toMatchObject({ headline: "Alice Works pays a dividend", companyId: "co" });
    expect(again).toBeNull();
    expect(news()).toHaveLength(1);
  });

  it("returns null for activity, which never alerts", async () => {
    expect(
      await inTx((tx) => publishNewsTx(tx, base({ prominence: "ACTIVITY", key: "k2" })))
    ).toBeNull();
    expect(news()).toHaveLength(1);
  });
});

describe("engine events", () => {
  it("a dividend makes one headline naming the company and no user", async () => {
    await declareDividend(fake.client, {
      userId: "alice",
      companyId: "co",
      amount: 100,
      requestId: "req-div-1",
    });
    const items = news().filter((n) => n.kind === "dividend");
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      prominence: "HEADLINE",
      companyId: "co",
      sourceKind: "COMPANY",
    });
    expect(items[0]!.headline).toContain("Alice Works");
    expect(JSON.stringify(items[0])).not.toMatch(/alice"|bob"/);
  });

  it("a trade is activity, and a large one is also a headline, with the price move", async () => {
    await inTx((tx) => recordTrade(tx, "co", 600, 1, "fill-1"));
    await inTx((tx) => recordTrade(tx, "co", 600, 10, "fill-2"));
    const trades = news().filter((n) => n.kind === "trade");
    expect(trades.map((t) => t.prominence)).toEqual(["ACTIVITY", "HEADLINE"]);
    expect(trades[0]!.headline).toBe("1 share of Alice Works traded at ₷600");
    expect(trades[0]!.movePct).toBeCloseTo(20, 5);
  });
});

describe("listNews", () => {
  it("returns one subject's items, newest first", async () => {
    await inTx((tx) => publishNewsTx(tx, base({ key: "a", headline: "first" })));
    await inTx((tx) => publishNewsTx(tx, base({ key: "b", headline: "other", companyId: "zz" })));
    await inTx((tx) => publishNewsTx(tx, base({ key: "c", headline: "second" })));
    // Distinct times (the fake stamps in the same millisecond).
    news().forEach((n, i) => (n.createdAt = new Date(1_000_000 + i * 1000)));
    const rows = await listNews(fake.client, { realmId: "default", subject: { companyId: "co" } });
    expect(rows.map((r) => r.headline)).toEqual(["second", "first"]);
  });
});

describe("alertWatchers", () => {
  it("alerts each watcher of a headline's subject, linking the story", async () => {
    fake.tables.exchangeWatch = [
      { id: "w1", userId: "bob", subjectKind: "COMPANY", subjectId: "co" },
      { id: "w2", userId: "alice", subjectKind: "NATION", subjectId: "elsewhere" },
    ];
    const sent = await alertWatchers(fake.client, [
      { id: "n1", headline: "Alice Works pays", companyId: "co" },
    ]);
    expect(sent).toBe(1);
    expect(notifyExchange).toHaveBeenCalledWith([
      expect.objectContaining({ userId: "bob", href: "/exchange/s/n1", title: "Alice Works pays" }),
    ]);
  });
});
