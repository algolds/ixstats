/**
 * Policy headlines (policy.ts): the market tick compares each nation's business figures with the snapshot it took last
 * time and publishes one headline per change. A nation's first snapshot publishes nothing.
 */
jest.mock("~/lib/exchange/notify", () => ({
  notifyExchange: jest.fn(),
  sendExchangeNotices: jest.fn(),
}));

import {
  policyChanges,
  policyHeadline,
  runPolicyHeadlines,
  type PolicySnapshot,
} from "~/lib/exchange/policy";
import { createFakeExchangeDb, type FakeDb } from "~/tests/helpers/fake-exchange-db";

const snap = (over: Partial<PolicySnapshot> = {}): PolicySnapshot => ({
  corporateTaxRate: 0.15,
  capGainsTaxRate: 0.1,
  interestRate: 0.05,
  tariffs: { agriculture: 0, industry: 0.05, services: 0, government: 0 },
  ftaPartnerIds: [],
  ...over,
});

describe("policyChanges", () => {
  it("finds nothing on a nation's first snapshot", () => {
    expect(policyChanges(null, snap())).toEqual([]);
  });

  it("finds a tax change and words it by direction", () => {
    const changes = policyChanges(snap(), snap({ corporateTaxRate: 0.18 }));
    expect(changes).toEqual([{ field: "corporateTaxRate", from: 0.15, to: 0.18 }]);
    expect(policyHeadline("Caphiria", changes[0]!)).toBe("Caphiria raises corporate tax to 18%");
    expect(policyHeadline("Caphiria", { field: "interestRate", from: 0.05, to: 0.04 })).toBe(
      "Caphiria cuts its interest rate to 4%"
    );
  });

  it("finds a tariff change and a trade agreement signed or ended", () => {
    const tariffs = { agriculture: 0, industry: 0.12, services: 0, government: 0 };
    expect(policyChanges(snap(), snap({ tariffs }))).toEqual([
      { field: "tariff", sectorKey: "industry", from: 0.05, to: 0.12 },
    ]);
    expect(
      policyHeadline("Caphiria", { field: "tariff", sectorKey: "industry", from: 0.05, to: 0.12 })
    ).toBe("Caphiria sets its industry tariff at 12%");
    expect(policyChanges(snap(), snap({ ftaPartnerIds: ["ur"] }))).toEqual([
      { field: "fta", partnerId: "ur", change: "signed" },
    ]);
    expect(policyChanges(snap({ ftaPartnerIds: ["ur"] }), snap())).toEqual([
      { field: "fta", partnerId: "ur", change: "ended" },
    ]);
    expect(
      policyHeadline("Caphiria", { field: "fta", partnerId: "ur", change: "signed" }, "Urcea")
    ).toBe("Caphiria and Urcea sign a free-trade agreement");
  });

  it("ignores a wobble under 0.05 percentage points", () => {
    expect(policyChanges(snap(), snap({ corporateTaxRate: 0.1501 }))).toEqual([]);
  });
});

describe("runPolicyHeadlines", () => {
  let fake: FakeDb;
  beforeEach(() => {
    fake = createFakeExchangeDb({
      country: [{ id: "na", name: "Caphiria", realmId: "default", interestRates: 5 }],
      nationTreasury: [{ id: "t_na", countryId: "na", realmId: "default", balance: 0n }],
    });
  });

  it("publishes once per change, and nothing on the first snapshot or an unchanged nation", async () => {
    expect(await runPolicyHeadlines(fake.client, 1)).toEqual([]);
    expect(fake.tables.exchangeNationSnapshot).toHaveLength(1);
    expect(await runPolicyHeadlines(fake.client, 2)).toEqual([]);

    fake.tables.country![0]!.interestRates = 7;
    const published = await runPolicyHeadlines(fake.client, 3);
    expect(published.map((p) => p.headline)).toEqual(["Caphiria raises its interest rate to 7%"]);
    expect(await runPolicyHeadlines(fake.client, 4)).toEqual([]);
    expect((fake.tables.exchangeNewsItem ?? []).filter((n) => n.kind === "policy")).toHaveLength(1);
  });
});
