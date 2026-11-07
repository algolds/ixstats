/** @jest-environment node */
/**
 * The Exchange terminal router: a signed-out visitor can watch every public page, the portfolio needs sign-in, and a
 * public page's answer carries no user id or email.
 */
jest.mock("~/lib/exchange/notify", () => ({
  notifyExchange: jest.fn(),
  sendExchangeNotices: jest.fn(),
}));
jest.mock("~/lib/cache", () => ({
  __esModule: true,
  ...jest.requireActual("~/lib/cache"),
  rateLimiter: { isEnabled: () => false, check: jest.fn() },
}));

import { appRouter } from "~/server/api/root";
import { createCallerFactory } from "~/server/api/trpc";
import { createFakeExchangeDb } from "~/tests/helpers/fake-exchange-db";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const createCaller = createCallerFactory(appRouter);

function signedOutCaller() {
  const fake = createFakeExchangeDb({
    user: [{ id: "alice", clerkUserId: "c_alice", email: "alice@example.com" }],
    country: [{ id: "na", name: "Caphiria", realmId: "default", ownerUserId: "alice" }],
    company: [
      {
        id: "co",
        founderId: "alice",
        name: "Caphirian Steel",
        realmId: "default",
        sectorKey: "industry",
        subIndustryKey: "heavy_manufacturing",
        hqCountryId: "na",
        capital: 1000,
        fairValue: 1000,
        standing: 0,
        contractsWonValue: 0,
        decisionValue: 0,
        sharesOutstanding: 1000,
        creditDrawn: 0,
        creditRating: "A",
        lastTradePrice: null,
        lastTickNetIncome: 0,
        status: "ACTIVE",
      },
    ],
    shareholding: [{ id: "sh", companyId: "co", ownerUserId: "alice", shares: 1000, avgCost: 1 }],
    systemConfig: [],
  });
  return createCaller(
    createMockRouterContext({
      db: fake.client,
      auth: null,
      user: null,
      rateLimitIdentifier: "ip:203.0.113.7",
    }) as never
  );
}

beforeEach(() => {
  for (const level of ["log", "info", "warn"] as const)
    jest.spyOn(console, level).mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe("the terminal, signed out", () => {
  it("serves the front page and the markets", async () => {
    const caller = signedOutCaller();
    await expect(caller.exchange.frontPage({})).resolves.toMatchObject({
      realm: { id: "default" },
    });
    await expect(caller.exchange.markets({ kind: "companies" })).resolves.toEqual([
      expect.objectContaining({ id: "co", name: "Caphirian Steel" }),
    ]);
  });

  it("keeps the portfolio behind sign-in", async () => {
    await expect(signedOutCaller().exchange.portfolio({})).rejects.toThrow(/Authentication required/);
  });

  it("answers a company page with no user id or email", async () => {
    const json = JSON.stringify(await signedOutCaller().exchange.companyPage({ companyId: "co" }));
    for (const leak of [
      "alice",
      "founderId",
      "ownerUserId",
      "issuerUserId",
      "sellerUserId",
      "@example.com",
    ]) {
      expect(json).not.toContain(leak);
    }
  });
});
