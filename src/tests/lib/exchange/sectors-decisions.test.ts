/**
 * Exchange phase 2: sector indices, sector funds and company decisions
 * (docs/specs/2026-10-06-exchange-economy-design.md §8). Indices move a capped step from
 * real activity; fund rebalancing conserves every cent; a position can't be sold twice or
 * flipped inside the hold; a decision is paid once and applied once.
 */
jest.mock("~/lib/exchange/notify", () => ({
  notifyExchange: jest.fn(),
  sendExchangeNotices: jest.fn(),
}));
import { DAY_MS } from "~/lib/exchange/contracts";
import { resolveDueDecisions, submitDecision } from "~/lib/exchange/decisions";
import {
  buySectorUnits,
  computeSectorIndices,
  getSectorMarket,
  macroTiltOf,
  macroWeightsOf,
  nextIndexValue,
  rebalanceFunds,
  sellSectorUnits,
  setSectorDmModifier,
} from "~/lib/exchange/sectors";
import { invalidateExchangeConfigCache } from "~/lib/vault/exchange-config";
import { invalidateVaultConfigCache } from "~/lib/vault/vault-perks";
import { createFakeExchangeDb, type FakeDb } from "~/tests/helpers/fake-exchange-db";

let fake: FakeDb;
let seq = 0;
const rid = () => `request-${++seq}`;
const cents = (n: number) => Math.round(n * 100);

function setup() {
  invalidateExchangeConfigCache();
  invalidateVaultConfigCache();
  fake = createFakeExchangeDb({
    user: ["alice", "bob"].map((id) => ({ id, clerkUserId: `c_${id}` })),
    exchangeWallet: ["alice", "bob"].map((userId) => ({
      id: `w_${userId}`,
      userId,
      sovereigns: 5000,
      lifetimeEarned: 5000,
      lifetimeSpent: 0,
    })),
    company: [
      {
        id: "co",
        realmId: "default",
        founderId: "alice",
        name: "Alice Works",
        sectorKey: "industry",
        capital: 20_000,
        standing: 2,
        contractsWonValue: 0,
        decisionValue: 0,
        sharesIssued: 1000,
        sharesOutstanding: 1000,
        status: "ACTIVE",
      },
    ],
    systemConfig: [],
  });
}

const sov = (userId: string) =>
  fake.tables.exchangeWallet!.find((w) => w.userId === userId)!.sovereigns as number;
const index = (key: string) => fake.tables.sectorIndex!.find((i) => i.sectorKey === key)!;
const company = () => fake.tables.company!.find((c) => c.id === "co")!;
const fundCents = () =>
  (fake.tables.sectorIndex ?? []).reduce((s, i) => s + cents(i.fundSovereigns), 0);
const walletCents = () => fake.tables.exchangeWallet!.reduce((s, w) => s + cents(w.sovereigns), 0);
/** Push this user's sector-buy ledger rows back past the 24-hour hold. */
function ageBuys(userId: string) {
  for (const t of fake.tables.exchangeTransaction ?? []) {
    if (t.walletId === `w_${userId}` && t.type === "SECTOR_BUY") {
      t.createdAt = new Date(Date.now() - 2 * DAY_MS);
    }
  }
}

beforeEach(setup);

describe("index arithmetic", () => {
  it("rebalancing funds conserves every cent and favours the faster-growing sector", () => {
    const out = rebalanceFunds([
      { sectorKey: "a", cents: 100_00, growth: 1.05 },
      { sectorKey: "b", cents: 100_00, growth: 0.95 },
      { sectorKey: "c", cents: 0, growth: 1.05 },
    ]);
    expect(out.get("a")! + out.get("b")! + out.get("c")!).toBe(200_00);
    expect(out.get("a")!).toBeGreaterThan(out.get("b")!);
    expect(out.get("c")).toBe(0);

    let seed = 3;
    const rand = (n: number) => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      return seed % n;
    };
    for (let run = 0; run < 300; run++) {
      const funds = ["agriculture", "industry", "services", "government"].map((k) => ({
        sectorKey: k,
        cents: rand(3) === 0 ? 0 : rand(5_000_000),
        growth: 0.95 + rand(1000) / 10_000,
      }));
      const total = funds.reduce((s, f) => s + f.cents, 0);
      const next = rebalanceFunds(funds);
      expect([...next.values()].reduce((s, c) => s + c, 0)).toBe(total);
      for (const c of next.values()) expect(Number.isInteger(c) && c >= 0).toBe(true);
    }
  });
});
describe("sector funds", () => {
  it("buys at the unit price and sells everything back for the whole fund", async () => {
    const r = await buySectorUnits(fake.client, {
      userId: "bob",
      realmId: "default",
      sectorKey: "services",
      amount: 300,
      requestId: rid(),
    });
    expect(r).toMatchObject({ units: 300, sovereigns: 300 });
    expect(sov("bob")).toBe(4700);
    expect(index("services")).toMatchObject({ fundSovereigns: 300, unitsOutstanding: 300 });

    await expect(
      sellSectorUnits(fake.client, {
        userId: "bob",
        realmId: "default",
        sectorKey: "services",
        fraction: 1,
        requestId: rid(),
      })
    ).rejects.toMatchObject({ code: "CONFLICT" }); // inside the 24-hour hold

    ageBuys("bob");
    const sold = await sellSectorUnits(fake.client, {
      userId: "bob",
      realmId: "default",
      sectorKey: "services",
      fraction: 1,
      requestId: rid(),
    });
    expect(sold.sovereigns).toBe(300);
    expect(sov("bob")).toBe(5000);
    expect(index("services")).toMatchObject({ fundSovereigns: 0, unitsOutstanding: 0 });
  });

  it("rebalancing moves ₷ between fund holders and never creates any", async () => {
    await buySectorUnits(fake.client, {
      userId: "alice",
      realmId: "default",
      sectorKey: "industry",
      amount: 1000,
      requestId: rid(),
    });
    await buySectorUnits(fake.client, {
      userId: "bob",
      realmId: "default",
      sectorKey: "services",
      amount: 1000,
      requestId: rid(),
    });
    const before = walletCents() + fundCents();
    await computeSectorIndices(fake.client); // base run
    company().capital = 200_000;
    await computeSectorIndices(fake.client); // industry +5%
    expect(index("industry").fundSovereigns).toBeGreaterThan(1000);
    expect(index("services").fundSovereigns).toBeLessThan(1000);
    expect(walletCents() + fundCents()).toBe(before);

    ageBuys("alice");
    ageBuys("bob");
    await sellSectorUnits(fake.client, {
      userId: "alice",
      realmId: "default",
      sectorKey: "industry",
      fraction: 1,
      requestId: rid(),
    });
    await sellSectorUnits(fake.client, {
      userId: "bob",
      realmId: "default",
      sectorKey: "services",
      fraction: 1,
      requestId: rid(),
    });
    expect(fundCents()).toBe(0);
    expect(walletCents()).toBe(before);
    expect(sov("alice")).toBeGreaterThan(5000);
    expect(sov("bob")).toBeLessThan(5000);
  });

  it("two racing sales of the same position pay out once", async () => {
    await buySectorUnits(fake.client, {
      userId: "bob",
      realmId: "default",
      sectorKey: "agriculture",
      amount: 500,
      requestId: rid(),
    });
    await buySectorUnits(fake.client, {
      userId: "alice",
      realmId: "default",
      sectorKey: "agriculture",
      amount: 500,
      requestId: rid(),
    });
    ageBuys("bob");
    const results = await Promise.allSettled(
      [1, 2].map(() =>
        sellSectorUnits(fake.client, {
          userId: "bob",
          realmId: "default",
          sectorKey: "agriculture",
          fraction: 1,
          requestId: rid(),
        })
      )
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(sov("bob")).toBe(5000);
    expect(index("agriculture").fundSovereigns).toBe(500);
  });

  it("a buy that would overdraw the wallet moves nothing", async () => {
    await expect(
      buySectorUnits(fake.client, {
        userId: "bob",
        realmId: "default",
        sectorKey: "industry",
        amount: 6000,
        requestId: rid(),
      })
    ).rejects.toMatchObject({ code: "INSUFFICIENT_SOVEREIGNS" });
    expect(sov("bob")).toBe(5000);
    expect(index("industry").fundSovereigns).toBe(0);
  });

  it("a retried buy (same requestId, even concurrent) is applied once", async () => {
    const requestId = rid();
    const results = await Promise.all(
      [1, 2, 3].map(() =>
        buySectorUnits(fake.client, {
          userId: "bob",
          realmId: "default",
          sectorKey: "industry",
          amount: 100,
          requestId,
        })
      )
    );
    expect(results.filter((r) => !r.alreadyApplied)).toHaveLength(1);
    expect(sov("bob")).toBe(4900);
    expect(index("industry").fundSovereigns).toBe(100);
  });
});

describe("realm-scoped sectors", () => {
  const rowOf = (realmId: string, sectorKey: string) =>
    fake.tables.sectorIndex!.find((i) => i.realmId === realmId && i.sectorKey === sectorKey)!;

  it("moves each realm's index only on its own companies", async () => {
    fake.tables.realm = [{ id: "alpha", status: "active" }];
    fake.tables.company!.push({
      id: "co_alpha",
      realmId: "alpha",
      founderId: "bob",
      name: "Alpha Works",
      sectorKey: "industry",
      capital: 20_000,
      standing: 0,
      status: "ACTIVE",
    });
    await computeSectorIndices(fake.client); // base run
    fake.tables.company!.find((c) => c.id === "co_alpha")!.capital = 200_000;
    await computeSectorIndices(fake.client);
    expect(rowOf("alpha", "industry").value).toBe(1050);
    expect(rowOf("default", "industry").value).toBe(1000);
  });

  it("keeps a sector position to the realm it was bought in", async () => {
    await buySectorUnits(fake.client, {
      userId: "bob",
      realmId: "default",
      sectorKey: "industry",
      amount: 300,
      requestId: rid(),
    });
    const home = await getSectorMarket(fake.client, "bob", "default");
    const other = await getSectorMarket(fake.client, "bob", "alpha");
    expect(home.find((s) => s.sectorKey === "industry")!.position).toMatchObject({ units: 300 });
    expect(other.find((s) => s.sectorKey === "industry")!.position).toBeNull();
    await expect(
      sellSectorUnits(fake.client, {
        userId: "bob",
        realmId: "alpha",
        sectorKey: "industry",
        fraction: 1,
        requestId: rid(),
      })
    ).rejects.toMatchObject({ code: "INVALID_AMOUNT" });
  });
});

describe("sector levers", () => {
  it("clamps the DM modifier to its range and audits each change", async () => {
    const set = (value: number) =>
      setSectorDmModifier(fake.client, {
        realmId: "default",
        sectorKey: "industry",
        value,
        actorUserId: "alice",
      });
    expect((await set(5)).dmModifier).toBe(2);
    expect((await set(-3)).dmModifier).toBe(-0.5);
    expect((await set(0.25)).dmModifier).toBe(0.25);
    await expect(set(Number.NaN)).rejects.toMatchObject({ code: "INVALID_AMOUNT" });
    expect(fake.tables.adminAuditLog).toHaveLength(3);
  });

  it("the macro tilt moves an index target by at most 10%", () => {
    expect(macroTiltOf(0)).toBe(-0.1);
    expect(macroTiltOf(0.25)).toBe(0);
    expect(macroTiltOf(1)).toBe(0.1);
    let up = 1000;
    let down = 1000;
    for (let run = 0; run < 40; run++) {
      up = nextIndexValue(up, 20_000, 20_000, 0, 1);
      down = nextIndexValue(down, 20_000, 20_000, 0, 0);
    }
    expect(up).toBe(1100);
    expect(down).toBe(900);
  });

  it("weights each macro sector by its share of realm GDP, or equally without GDP", () => {
    const shares = (agriculture: number, industry: number) => ({
      agriculture,
      industry,
      services: 0,
      government: 0,
    });
    const byGdp = macroWeightsOf([
      { nominalGDP: 300, sectorShares: shares(0.5, 0), hasRecordedSector: true },
      { nominalGDP: 100, sectorShares: shares(0, 1), hasRecordedSector: true },
    ]);
    expect(byGdp.agriculture).toBeCloseTo(0.375);
    expect(byGdp.industry).toBeCloseTo(0.25);
    const equal = macroWeightsOf([
      { nominalGDP: null, sectorShares: shares(0.5, 0), hasRecordedSector: true },
      { nominalGDP: null, sectorShares: shares(0, 1), hasRecordedSector: true },
    ]);
    expect(equal.agriculture).toBeCloseTo(0.25);
    expect(equal.industry).toBeCloseTo(0.5);
    expect(macroWeightsOf([]).services).toBe(0.25);
  });
});

describe("company decisions", () => {
  const later = () => Date.now() + 2 * DAY_MS;

  it("pays an expansion from capital now and applies it once, after the delay", async () => {
    await expect(
      submitDecision(fake.client, {
        userId: "bob",
        companyId: "co",
        type: "EXPAND",
        amount: 500,
        requestId: rid(),
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const requestId = rid();
    await submitDecision(fake.client, {
      userId: "alice",
      companyId: "co",
      type: "EXPAND",
      amount: 500,
      requestId,
    });
    expect(company().capital).toBe(19_500);
    // A retry is the same decision; a different one waits for this to resolve.
    const again = await submitDecision(fake.client, {
      userId: "alice",
      companyId: "co",
      type: "EXPAND",
      amount: 500,
      requestId,
    });
    expect(again.alreadyApplied).toBe(true);
    await expect(
      submitDecision(fake.client, {
        userId: "alice",
        companyId: "co",
        type: "EXPAND",
        amount: 100,
        requestId: rid(),
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(company().capital).toBe(19_500);

    expect(await resolveDueDecisions(fake.client)).toBe(0); // too soon
    const at = later();
    expect(await resolveDueDecisions(fake.client, at)).toBe(1);
    expect(await resolveDueDecisions(fake.client, at)).toBe(0); // never twice
    expect(company().decisionValue).toBe(500);
    expect(company().fairValue).toBe(19_500 + 200 + 500);
  });
  it("can't spend more capital than the company holds", async () => {
    await expect(
      submitDecision(fake.client, {
        userId: "alice",
        companyId: "co",
        type: "EXPAND",
        amount: 30_000,
        requestId: rid(),
      })
    ).rejects.toMatchObject({ code: "INSUFFICIENT_SOVEREIGNS" });
    expect(fake.tables.companyDecision ?? []).toHaveLength(0);
  });

  it("waits one real day, stamped on real time", async () => {
    const before = Date.now();
    await submitDecision(fake.client, {
      userId: "alice",
      companyId: "co",
      type: "EXPAND",
      amount: 500,
      requestId: rid(),
    });
    const submitted = fake.tables.companyDecision![0]!.submittedIxTime as number;
    expect(submitted).toBeGreaterThanOrEqual(before);
    expect(submitted).toBeLessThanOrEqual(Date.now());
    expect(await resolveDueDecisions(fake.client, submitted + 0.5 * DAY_MS)).toBe(0);
    expect(await resolveDueDecisions(fake.client, submitted + 1.5 * DAY_MS)).toBe(1);
  });

  /** Government efficiency is stored as a percent (0 to 100). */
  const hqAt = (percent: number) => {
    fake.tables.country = [
      { id: "nation_a", name: "Aria", realmId: "default", governmentalEfficiency: percent },
    ];
    company().hqCountryId = "nation_a";
  };
  const treasuryOf = (countryId: string) =>
    fake.tables.nationTreasury?.find((t) => t.countryId === countryId)?.balance ?? 0;

  it("an efficiency RND adds 1.15 times the spend to plant and one point of standing", async () => {
    await submitDecision(fake.client, {
      userId: "alice",
      companyId: "co",
      type: "RND",
      amount: 1000,
      focus: "efficiency",
      requestId: rid(),
    });
    expect(company().capital).toBe(19_000);
    await resolveDueDecisions(fake.client, later());
    expect(company()).toMatchObject({ decisionValue: 1150, standing: 3 });
    expect(fake.tables.companyDecision![0]!.effect).toEqual({
      focus: "efficiency",
      decisionValueDelta: 1150,
      standingDelta: 1,
    });
  });

  it("an RND spends 250 to 250,000 on a chosen focus", async () => {
    for (const amount of [249, 250_001]) {
      await expect(
        submitDecision(fake.client, {
          userId: "alice",
          companyId: "co",
          type: "RND",
          amount,
          focus: "efficiency",
          requestId: rid(),
        })
      ).rejects.toMatchObject({ code: "INVALID_AMOUNT" });
    }
    await expect(
      submitDecision(fake.client, {
        userId: "alice",
        companyId: "co",
        type: "RND",
        amount: 250,
        requestId: rid(),
      })
    ).rejects.toMatchObject({ code: "INVALID_AMOUNT" });
    expect(fake.tables.companyDecision ?? []).toHaveLength(0);
    await submitDecision(fake.client, {
      userId: "alice",
      companyId: "co",
      type: "RND",
      amount: 250,
      focus: "efficiency",
      requestId: rid(),
    });
    expect(company().capital).toBe(19_750);
  });

  async function resolveBreakthrough(decisionId: string) {
    setup();
    fake.tables.companyDecision = [
      {
        id: decisionId,
        companyId: "co",
        type: "RND",
        payload: { requestId: "r", cost: 1000, amount: 1000, focus: "breakthrough" },
        effect: null,
        submittedIxTime: Date.now() - 2 * DAY_MS,
        appliedIxTime: null,
      },
    ];
    await resolveDueDecisions(fake.client);
    return fake.tables.companyDecision![0]!.effect as Record<string, number | string>;
  }

  it("a breakthrough roll depends only on the decision, so resolving it again gives the same result", async () => {
    const first = await resolveBreakthrough("dec_fixed");
    const second = await resolveBreakthrough("dec_fixed");
    expect(second).toEqual(first);
    expect(first).toMatchObject({ focus: "breakthrough" });
    expect([0.6, 1.35, 2.1]).toContain(first.multiplier);
    expect(first.decisionValueDelta).toBeCloseTo(1000 * (first.multiplier as number), 2);
    const standingFor = new Map([
      [0.6, 1],
      [1.35, 2],
      [2.1, 3],
    ]);
    expect(first.standingDelta).toBe(standingFor.get(first.multiplier as number));
  });

  async function breakthroughMix(percent: number) {
    setup();
    hqAt(percent);
    fake.tables.companyDecision = Array.from({ length: 300 }, (_, i) => ({
      id: `dec_${i}`,
      companyId: "co",
      type: "RND",
      payload: { requestId: `r${i}`, cost: 1000, amount: 1000, focus: "breakthrough" },
      effect: null,
      submittedIxTime: Date.now() - 2 * DAY_MS,
      appliedIxTime: null,
    }));
    await resolveDueDecisions(fake.client);
    const mix = { low: 0, mid: 0, top: 0 };
    for (const d of fake.tables.companyDecision!) {
      const m = (d.effect as { multiplier: number }).multiplier;
      if (m === 0.6) mix.low++;
      else if (m === 1.35) mix.mid++;
      else mix.top++;
    }
    return mix;
  }

  it("a strong HQ government shifts breakthrough odds toward the top outcome", async () => {
    const weak = await breakthroughMix(1);
    const strong = await breakthroughMix(100);
    expect(strong.low).toBeLessThan(weak.low);
    expect(strong.top).toBeGreaterThan(weak.top);
  });

  it("a LOBBY sends half its cost to the HQ nation's treasury and burns the rest", async () => {
    hqAt(50);
    await submitDecision(fake.client, {
      userId: "alice",
      companyId: "co",
      type: "LOBBY",
      target: "b2g",
      requestId: rid(),
    });
    expect(company().capital).toBe(19_500);
    expect(treasuryOf("nation_a")).toBe(250);
    expect(company().capital + treasuryOf("nation_a")).toBe(19_750);
    expect(fake.tables.nationTreasuryEntry).toEqual([
      expect.objectContaining({ type: "LOBBY", amount: 250, countryId: "nation_a" }),
    ]);
  });

  it("a LOBBY with no HQ burns the whole cost", async () => {
    await submitDecision(fake.client, {
      userId: "alice",
      companyId: "co",
      type: "LOBBY",
      target: "sector",
      requestId: rid(),
    });
    expect(company().capital).toBe(19_500);
    expect(fake.tables.nationTreasury ?? []).toHaveLength(0);
  });

  it("a LOBBY sets its buff for 14 days from when it resolves", async () => {
    await submitDecision(fake.client, {
      userId: "alice",
      companyId: "co",
      type: "LOBBY",
      target: "tax_relief",
      requestId: rid(),
    });
    const at = later();
    await resolveDueDecisions(fake.client, at);
    expect(company()).toMatchObject({
      lobbyBuffType: "tax_relief",
      lobbyBuffUntilIxTime: at + 14 * DAY_MS,
    });
  });

  it("a PRICE decision costs 200 and sets the pricing strategy once it resolves", async () => {
    await expect(
      submitDecision(fake.client, {
        userId: "alice",
        companyId: "co",
        type: "PRICE",
        strategy: "cheap" as "undercut",
        requestId: rid(),
      })
    ).rejects.toMatchObject({ code: "INVALID_AMOUNT" });
    await submitDecision(fake.client, {
      userId: "alice",
      companyId: "co",
      type: "PRICE",
      strategy: "premium",
      requestId: rid(),
    });
    expect(company().capital).toBe(19_800);
    await resolveDueDecisions(fake.client, later());
    expect(company().pricingStrategy).toBe("premium");
  });

  it("ENTER_SECTOR defaults to the new sector's first sub-industry and checks any sub-industry given", async () => {
    await expect(
      submitDecision(fake.client, {
        userId: "alice",
        companyId: "co",
        type: "ENTER_SECTOR",
        sectorKey: "services",
        subIndustryKey: "agribusiness",
        requestId: rid(),
      })
    ).rejects.toMatchObject({ code: "INVALID_AMOUNT" });
    await submitDecision(fake.client, {
      userId: "alice",
      companyId: "co",
      type: "ENTER_SECTOR",
      sectorKey: "services",
      requestId: rid(),
    });
    expect(company().capital).toBe(19_500);
    await resolveDueDecisions(fake.client, later());
    expect(company()).toMatchObject({ sectorKey: "services", subIndustryKey: "finance_insurance" });
  });

  it("(c) a queued EXPAND resolved while the company is DISTRESSED leaves appliedIxTime null and retries once ACTIVE", async () => {
    const { decision } = await submitDecision(fake.client, {
      userId: "alice",
      companyId: "co",
      type: "EXPAND",
      amount: 1000,
      requestId: rid(),
    });
    expect(company().capital).toBe(19_000);

    company().status = "DISTRESSED";
    const t1 = later();
    expect(await resolveDueDecisions(fake.client, t1)).toBe(0);
    const rowAfterDistressed = fake.tables.companyDecision!.find((d) => d.id === decision.id)!;
    expect(rowAfterDistressed.appliedIxTime).toBeNull();
    expect(company().decisionValue).toBe(0);

    company().status = "ACTIVE";
    expect(await resolveDueDecisions(fake.client, t1 + DAY_MS)).toBe(1);
    const rowAfterActive = fake.tables.companyDecision!.find((d) => d.id === decision.id)!;
    expect(rowAfterActive.appliedIxTime).toBe(t1 + DAY_MS);
    expect(company().decisionValue).toBe(1000);
  });
});
