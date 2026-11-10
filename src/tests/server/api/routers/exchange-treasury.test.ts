/** @jest-environment node */
/**
 * The treasury router's corporate summary: tender bids are sealed, so only the issuing nation sees an amount, and no
 * company row names its founder.
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

const companySelects: Array<Record<string, unknown>> = [];

function callerFor(userId: string) {
  const fake = createFakeExchangeDb({
    user: [
      { id: "alice", clerkUserId: "c_alice", email: "alice@example.com", countryId: null },
      { id: "bob", clerkUserId: "c_bob", email: "bob@example.com", countryId: null },
    ],
    country: [{ id: "na", name: "Caphiria", realmId: "default", ownerUserId: "alice" }],
    company: [
      {
        id: "co",
        founderId: "bob",
        name: "Caphirian Steel",
        realmId: "default",
        sectorKey: "industry",
        subIndustryKey: "heavy_manufacturing",
        hqCountryId: "na",
        capital: 1000_00n,
        fairValue: 1000_00n,
        status: "ACTIVE",
      },
    ],
    systemConfig: [],
  });
  // The fake ignores nested selects, so serve the tender with its sealed bids directly.
  const db = new Proxy(fake.client, {
    get(target, prop: string) {
      if (prop === "contract") {
        return {
          findMany: async () => [
            {
              id: "t1",
              title: "Road repairs",
              sectorKey: "industry",
              value: 5000_00n,
              fundedBy: "TREASURY",
              status: "OPEN",
              endIxTime: new Date(),
              linkedDirectiveId: null,
              linkedIssueId: null,
              bids: [
                { id: "b1", amount: 4200_00n },
                { id: "b2", amount: 3900_00n },
              ],
            },
          ],
        };
      }
      if (prop === "company") {
        return {
          ...target.company,
          findMany: (args: { select: Record<string, unknown> }) => {
            companySelects.push(args.select);
            return target.company.findMany(args);
          },
        };
      }
      return target[prop];
    },
  });
  return createCaller(
    createMockRouterContext({
      db,
      auth: { userId: `c_${userId}` },
      user: { id: userId, clerkUserId: `c_${userId}`, countryId: null },
    }) as never
  );
}

beforeEach(() => {
  for (const level of ["log", "info", "warn"] as const)
    jest.spyOn(console, level).mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe("getRealmCorporateSummary", () => {
  it("shows the issuing nation's owner the lowest bid", async () => {
    const summary = await callerFor("alice").exchange.getRealmCorporateSummary({ countryId: "na" });
    expect(summary.openTenders).toEqual([
      expect.objectContaining({ id: "t1", bidCount: 2, lowestBid: 3900 }),
    ]);
  });

  it("keeps the amounts from anyone else, and names no founder", async () => {
    const summary = await callerFor("bob").exchange.getRealmCorporateSummary({ countryId: "na" });
    expect(summary.openTenders).toEqual([
      expect.objectContaining({ id: "t1", bidCount: 2, lowestBid: null }),
    ]);
    expect(companySelects.at(-1)).toBeDefined();
    expect(companySelects.at(-1)).not.toHaveProperty("founderId");
  });
});
