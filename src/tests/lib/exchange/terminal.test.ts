/**
 * Terminal read models (terminal.ts): the front page, markets, object pages, portfolio and leaderboards. Public pages
 * never carry a user id; an empty realm still renders.
 */
jest.mock("~/lib/exchange/notify", () => ({
  notifyExchange: jest.fn(),
  sendExchangeNotices: jest.fn(),
}));

import {
  changePct,
  getBondPage,
  getCompanyPage,
  getFrontPage,
  getNationPage,
  getPortfolio,
  realmIndexSeries,
} from "~/lib/exchange/terminal";
import { invalidateExchangeConfigCache } from "~/lib/vault/exchange-config";
import { createFakeExchangeDb, type FakeDb } from "~/tests/helpers/fake-exchange-db";

const DAY = 24 * 60 * 60 * 1000;
let fake: FakeDb;

function setup(withCompany = true) {
  invalidateExchangeConfigCache();
  const now = Date.now();
  fake = createFakeExchangeDb({
    user: ["alice", "bob"].map((id) => ({
      id,
      clerkUserId: `c_${id}`,
      email: `${id}@example.com`,
    })),
    exchangeWallet: [
      { id: "w_bob", userId: "bob", sovereigns: 300, lifetimeEarned: 300, lifetimeSpent: 0 },
    ],
    country: [
      {
        id: "na",
        name: "Caphiria",
        realmId: "default",
        ownerUserId: "alice",
        currencyExchangeRate: null,
      },
    ],
    realm: [],
    company: withCompany
      ? [
          {
            id: "co",
            founderId: "alice",
            name: "Caphirian Steel",
            realmId: "default",
            sectorKey: "industry",
            subIndustryKey: "heavy_manufacturing",
            hqCountryId: "na",
            capital: 1000,
            fairValue: 1100,
            standing: 1,
            contractsWonValue: 0,
            decisionValue: 0,
            sharesIssued: 1000,
            sharesOutstanding: 1000,
            creditDrawn: 0,
            creditRating: "A",
            lastTradePrice: null,
            lastTickNetIncome: 0,
            status: "ACTIVE",
            tradingOpen: true,
          },
        ]
      : [],
    companyValueHistory: withCompany
      ? [
          {
            id: "h1",
            companyId: "co",
            fairValue: 1000,
            recordedIxTime: now - 2 * DAY,
            recordedAt: new Date(now - 2 * DAY),
          },
        ]
      : [],
    shareholding: withCompany
      ? [
          { id: "sh_a", companyId: "co", ownerUserId: "alice", shares: 700, avgCost: 1 },
          { id: "sh_b", companyId: "co", ownerUserId: "bob", shares: 300, avgCost: 1 },
        ]
      : [],
    systemConfig: [],
  });
}

describe("realmIndexSeries", () => {
  it("weights the sectors at each time, normalising the weights", () => {
    const history = [
      { sectorKey: "industry", value: 1200, recordedIxTime: 1 },
      { sectorKey: "services", value: 800, recordedIxTime: 1 },
    ];
    const weights = { agriculture: 0, industry: 0.75, services: 0.25, government: 0 };
    expect(realmIndexSeries(history, weights)).toEqual([{ t: 1, value: 1100 }]);
    const doubled = { agriculture: 0, industry: 1.5, services: 0.5, government: 0 };
    expect(realmIndexSeries(history, doubled)).toEqual([{ t: 1, value: 1100 }]);
    expect(realmIndexSeries([], weights)).toEqual([]);
  });
});

describe("changePct", () => {
  it("is null without a base and a percent otherwise", () => {
    expect(changePct(0, 5)).toBeNull();
    expect(changePct(null, 5)).toBeNull();
    expect(changePct(100, 110)).toBeCloseTo(10, 10);
  });
});

describe("getFrontPage", () => {
  it("renders an empty realm at 1,000 with empty lists", async () => {
    setup(false);
    const page = await getFrontPage(fake.client, "default");
    expect(page.index).toEqual({ value: 1000, changePct: null, series: [] });
    expect(page).toMatchObject({ movers: [], bonds: [], news: [], activity: [] });
    expect(page.realm).toEqual({ id: "default", name: "Ixnay" });
  });

  it("lists a company whose value moved as a mover", async () => {
    setup();
    const page = await getFrontPage(fake.client, "default");
    expect(page.movers).toEqual([
      expect.objectContaining({ companyId: "co", name: "Caphirian Steel" }),
    ]);
    expect(page.movers[0]!.changePct).toBeCloseTo(10, 5);
  });
});

describe("getCompanyPage", () => {
  it("names shareholders by role, never by user id or email", async () => {
    setup();
    const page = await getCompanyPage(fake.client, "co", null);
    expect(page?.shareholders.map((s) => s.label)).toEqual(["Founder", "Private investor"]);
    const json = JSON.stringify(page);
    for (const leak of ["alice", "bob", "founderId", "ownerUserId", "@example.com"])
      expect(json).not.toContain(leak);
  });
});

describe("getNationPage", () => {
  it("has no currency rate when MyCountry sets none", async () => {
    setup();
    const page = await getNationPage(fake.client, "na");
    expect(page).toMatchObject({ id: "na", name: "Caphiria", currencyRate: null });
    expect(page?.companies.map((c) => c.id)).toEqual(["co"]);
    expect(page?.viewer).toEqual({ watching: false });
  });

  it("knows when the viewer watches the nation", async () => {
    setup();
    fake.tables.exchangeWatch = [
      { id: "w1", userId: "bob", subjectKind: "NATION", subjectId: "na" },
    ];
    expect((await getNationPage(fake.client, "na", "bob"))?.viewer).toEqual({ watching: true });
  });
});

describe("getPortfolio", () => {
  it("lists a vote the holder owes, and drops it once cast", async () => {
    setup();
    fake.tables.companyProposal = [
      {
        id: "p1",
        companyId: "co",
        proposerUserId: "alice",
        type: "DISSOLVE",
        status: "OPEN",
        payload: {},
      },
    ];
    expect((await getPortfolio(fake.client, "bob", "default")).votesOwed).toEqual([
      expect.objectContaining({
        proposalId: "p1",
        companyId: "co",
        companyName: "Caphirian Steel",
      }),
    ]);
    fake.tables.companyVote = [
      { id: "v1", proposalId: "p1", voterUserId: "bob", support: true, shares: 300 },
    ];
    expect((await getPortfolio(fake.client, "bob", "default")).votesOwed).toEqual([]);
  });

  it("values the holdings with the wallet", async () => {
    setup();
    const portfolio = await getPortfolio(fake.client, "bob", "default");
    expect(portfolio.wallet).toBe(300);
    expect(portfolio.shares).toEqual([
      expect.objectContaining({ companyId: "co", shares: 300, value: 330 }),
    ]);
    expect(portfolio.totalValue).toBeCloseTo(630, 2);
  });
});

describe("bond prices", () => {
  it("read the nation's interest rate the same way whether it is stored as a percent or a fraction", async () => {
    const price = async (interestRates: number) => {
      setup(false);
      fake.tables.country![0]!.interestRates = interestRates;
      fake.tables.nationBond = [
        {
          id: "b1",
          countryId: "na",
          realmId: "default",
          issuerUserId: "alice",
          faceValue: 100,
          unitsIssued: 100,
          unitsSold: 0,
          couponRate: 0.07,
          termWeeks: 10,
          weeksPaid: 0,
          status: "OPEN",
          lastTradePrice: null,
          issuedAt: new Date(),
        },
      ];
      fake.tables.nationTreasury = [
        { id: "t", countryId: "na", realmId: "default", balance: 0, creditRating: "A" },
      ];
      return (await getBondPage(fake.client, "b1", null))?.bond.price;
    };
    expect(await price(0.05)).toBe(await price(5));
    expect(await price(5)).toBe(100);
  });
});

describe("the realm index history", () => {
  it("charts the newest points when the history is longer than the read limit", async () => {
    setup(false);
    const rows = Array.from({ length: 4001 }, (_, i) => ({
      sectorKey: "industry",
      value: i === 4000 ? 2000 : 1000,
      recordedIxTime: i + 1,
    }));
    // A history reader that honours orderBy and take, as Postgres does (the fake ignores orderBy).
    const history = {
      findMany: async (args: { orderBy?: { recordedIxTime: "asc" | "desc" }; take?: number }) => {
        const dir = args.orderBy?.recordedIxTime === "desc" ? -1 : 1;
        return [...rows]
          .sort((a, b) => dir * (a.recordedIxTime - b.recordedIxTime))
          .slice(0, args.take ?? rows.length);
      },
    };
    const db = new Proxy(fake.client, {
      get: (target, prop) => (prop === "sectorIndexHistory" ? history : target[prop]),
    });
    const page = await getFrontPage(db, "default");
    expect(page.index.series.at(-1)).toEqual({ t: 4001, value: 1250 });
  });
});
