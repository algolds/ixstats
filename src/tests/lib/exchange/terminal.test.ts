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
  getLeaderboards,
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
      { id: "w_bob", userId: "bob", sovereigns: 300_00n, lifetimeEarned: 300_00n, lifetimeSpent: 0n },
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
            recordedIxTime: now - 1.5 * DAY,
            recordedAt: new Date(now - 1.5 * DAY),
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

  it("ignores history rows older than 2 days when computing company moves", async () => {
    setup();
    const now = Date.now();
    fake.tables.companyValueHistory = [
      {
        id: "h_old",
        companyId: "co",
        fairValue: 500,
        recordedIxTime: now - 3 * DAY,
        recordedAt: new Date(now - 3 * DAY),
      },
    ];
    const page = await getFrontPage(fake.client, "default", now);
    expect(page.movers).toEqual([]);
    const companyPage = await getCompanyPage(fake.client, "co", null, now);
    expect(companyPage?.changePct).toBeNull();
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

  it("yields the 120 newest history rows in ascending order when a company has 300 rows", async () => {
    setup();
    const now = Date.now();
    const rows = Array.from({ length: 300 }, (_, i) => ({
      id: `h_${i}`,
      companyId: "co",
      fairValue: 1000 + i,
      recordedIxTime: now - (300 - i) * 60_000,
      recordedAt: new Date(now - (300 - i) * 60_000),
    }));
    const history = {
      findMany: async (args: { orderBy?: { recordedAt: "asc" | "desc" }; take?: number }) => {
        const dir = args.orderBy?.recordedAt === "desc" ? -1 : 1;
        return [...rows]
          .sort((a, b) => dir * (a.recordedAt.getTime() - b.recordedAt.getTime()))
          .slice(0, args.take ?? rows.length);
      },
    };
    const db = new Proxy(fake.client, {
      get: (target, prop) => (prop === "companyValueHistory" ? history : target[prop]),
    });
    const page = await getCompanyPage(db, "co", null, now);
    expect(page?.valueHistory).toHaveLength(120);
    expect(page?.valueHistory[0]?.value).toBe(1180);
    expect(page?.valueHistory.at(-1)?.value).toBe(1299);
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

describe("getLeaderboards", () => {
  it("matches getPortfolio().totalValue per user across shares, bonds and sector units and excludes other realms' holders", async () => {
    setup();
    const now = Date.now();
    fake.tables.user!.push({ id: "carol", clerkUserId: "c_carol", email: "carol@example.com" });
    fake.tables.exchangeWallet = [
      { id: "w_alice", userId: "alice", sovereigns: 150_00n, lifetimeEarned: 150_00n, lifetimeSpent: 0n },
      { id: "w_bob", userId: "bob", sovereigns: 300_00n, lifetimeEarned: 300_00n, lifetimeSpent: 0n },
      { id: "w_carol", userId: "carol", sovereigns: 9000_00n, lifetimeEarned: 9000_00n, lifetimeSpent: 0n },
    ];
    fake.tables.country!.push({
      id: "nb",
      name: "Otherland",
      realmId: "other",
      ownerUserId: "carol",
      currencyExchangeRate: null,
    });
    fake.tables.nationTreasury = [
      { id: "t_na", countryId: "na", realmId: "default", balance: 500, creditRating: "AA" },
      { id: "t_nb", countryId: "nb", realmId: "other", balance: 800, creditRating: "A" },
    ];
    fake.tables.company!.push({
      id: "co_other",
      founderId: "carol",
      name: "Other Corp",
      realmId: "other",
      sectorKey: "services",
      subIndustryKey: "software_media",
      hqCountryId: "nb",
      capital: 2000,
      fairValue: 2400,
      standing: 1,
      contractsWonValue: 0,
      decisionValue: 0,
      sharesIssued: 1000,
      sharesOutstanding: 1000,
      creditDrawn: 0,
      creditRating: "A",
      lastTradePrice: 2.5,
      lastTickNetIncome: 0,
      status: "ACTIVE",
      tradingOpen: true,
    });
    fake.tables.shareholding!.push({
      id: "sh_c",
      companyId: "co_other",
      ownerUserId: "carol",
      shares: 1000,
      avgCost: 2,
    });
    fake.tables.nationBond = [
      {
        id: "b_def",
        countryId: "na",
        realmId: "default",
        issuerUserId: "alice",
        faceValue: 100,
        unitsIssued: 50,
        unitsSold: 10,
        couponRate: 0.06,
        termWeeks: 8,
        weeksPaid: 1,
        status: "OPEN",
        lastTradePrice: 102.5,
        issuedAt: new Date(now - 7 * DAY),
      },
      {
        id: "b_other",
        countryId: "nb",
        realmId: "other",
        issuerUserId: "carol",
        faceValue: 100,
        unitsIssued: 50,
        unitsSold: 20,
        couponRate: 0.08,
        termWeeks: 10,
        weeksPaid: 0,
        status: "OPEN",
        lastTradePrice: null,
        issuedAt: new Date(now),
      },
    ];
    fake.tables.bondListing = [
      {
        id: "bl_def",
        bondId: "b_def",
        sellerUserId: "alice",
        units: 2,
        unitsListed: 2,
        pricePerUnit: 101.25,
        status: "OPEN",
      },
    ];
    fake.tables.bondHolding = [
      { id: "bh_b", bondId: "b_def", ownerUserId: "bob", units: 4, avgCost: 100 },
      { id: "bh_c", bondId: "b_other", ownerUserId: "carol", units: 10, avgCost: 100 },
    ];
    fake.tables.sectorIndex = [
      {
        id: "si_def",
        realmId: "default",
        sectorKey: "industry",
        label: "Industry",
        value: 1200,
        fundSovereigns: 375,
        unitsOutstanding: 250,
      },
      {
        id: "si_other",
        realmId: "other",
        sectorKey: "services",
        label: "Services",
        value: 1500,
        fundSovereigns: 600,
        unitsOutstanding: 300,
      },
    ];
    fake.tables.sectorPosition = [
      {
        id: "sp_a",
        ownerUserId: "alice",
        realmId: "default",
        sectorKey: "industry",
        units: 40,
        avgCost: 1,
      },
      {
        id: "sp_b",
        ownerUserId: "bob",
        realmId: "default",
        sectorKey: "industry",
        units: 60,
        avgCost: 1,
      },
      {
        id: "sp_c",
        ownerUserId: "carol",
        realmId: "other",
        sectorKey: "services",
        units: 100,
        avgCost: 1,
      },
    ];

    const [boards, alicePortfolio, bobPortfolio, otherBoards, carolPortfolio] = await Promise.all([
      getLeaderboards(fake.client, "default", now),
      getPortfolio(fake.client, "alice", "default", now),
      getPortfolio(fake.client, "bob", "default", now),
      getLeaderboards(fake.client, "other", now),
      getPortfolio(fake.client, "carol", "other", now),
    ]);

    const expectedDefault = [alicePortfolio.totalValue, bobPortfolio.totalValue].sort(
      (a, b) => b - a
    );
    expect(boards.investors).toEqual(
      expectedDefault.map((value, i) => ({ label: `Investor #${i + 1}`, value }))
    );
    expect(otherBoards.investors).toEqual([{ label: "Investor #1", value: carolPortfolio.totalValue }]);
  });
});
