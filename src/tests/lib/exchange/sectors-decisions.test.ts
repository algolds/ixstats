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

import { computeFairValue } from "~/lib/exchange/companies";
import { DAY_MS } from "~/lib/exchange/contracts";
import { resolveDueDecisions, submitDecision } from "~/lib/exchange/decisions";
import { runExchangeMarketTick } from "~/lib/exchange/market";
import {
  MAX_STEP,
  buySectorUnits,
  computeSectorIndices,
  nextIndexValue,
  rebalanceFunds,
  sellSectorUnits,
} from "~/lib/exchange/sectors";
import { IxTime } from "~/lib/ixtime";
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
  it("moves at most MAX_STEP per run toward the activity target", () => {
    expect(nextIndexValue(1000, 10_000, 10_000)).toBe(1000);
    expect(nextIndexValue(1000, 1_000_000, 0)).toBe(1000 * (1 + MAX_STEP));
    expect(nextIndexValue(1000, 0, 1_000_000)).toBe(1000 * (1 - MAX_STEP));
    expect(nextIndexValue(1000, 11_000, 10_000)).toBe(1000 * (21_000 / 20_000));
    expect(nextIndexValue(100, 0, 1_000_000)).toBe(100); // the floor
  });

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

  it("fair value follows the sector index and applied decisions", () => {
    const base = { capital: 1000, contractsWonValue: 400, standing: 2, decisionValue: 0 };
    expect(computeFairValue(base).fairValue).toBe(1000 + 100 + 200); // the MVP formula
    expect(computeFairValue(base, 1100).fairValue).toBe(1430);
    expect(computeFairValue({ ...base, decisionValue: 500 }, 1000).fairValue).toBe(1800);
    expect(computeFairValue(base, 100).sectorFactor).toBe(0.5); // held to 0.5 .. 2
  });
});

describe("computeSectorIndices", () => {
  it("captures the base on the first run, then steps toward activity and records history", async () => {
    const now = IxTime.getCurrentIxTime();
    await computeSectorIndices(fake.client, now);
    expect(index("industry")).toMatchObject({ value: 1000, baseTotal: 20_200 });
    expect(fake.tables.sectorIndexHistory).toHaveLength(4);

    company().capital = 200_000; // a huge deposit
    await computeSectorIndices(fake.client, now + 1);
    expect(index("industry").value).toBe(1050); // capped at +5%
    expect(index("services").value).toBe(1000);
    expect(fake.tables.sectorIndexHistory).toHaveLength(8);
  });

  it("the market tick refreshes fair values against the new index", async () => {
    await runExchangeMarketTick(fake.client);
    company().capital = 200_000;
    const r = await runExchangeMarketTick(fake.client);
    expect(r.indices.find((i) => i.sector === "industry")?.value).toBe(1050);
    expect(company().fairValue).toBe(Math.round((200_000 + 200) * 1.05 * 100) / 100);
  });
});

describe("sector funds", () => {
  it("buys at the unit price and sells everything back for the whole fund", async () => {
    const r = await buySectorUnits(fake.client, {
      userId: "bob",
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
        sectorKey: "services",
        fraction: 1,
        requestId: rid(),
      })
    ).rejects.toMatchObject({ code: "CONFLICT" }); // inside the 24-hour hold

    ageBuys("bob");
    const sold = await sellSectorUnits(fake.client, {
      userId: "bob",
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
      sectorKey: "industry",
      amount: 1000,
      requestId: rid(),
    });
    await buySectorUnits(fake.client, {
      userId: "bob",
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
      sectorKey: "industry",
      fraction: 1,
      requestId: rid(),
    });
    await sellSectorUnits(fake.client, {
      userId: "bob",
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
      sectorKey: "agriculture",
      amount: 500,
      requestId: rid(),
    });
    await buySectorUnits(fake.client, {
      userId: "alice",
      sectorKey: "agriculture",
      amount: 500,
      requestId: rid(),
    });
    ageBuys("bob");
    const results = await Promise.allSettled(
      [1, 2].map(() =>
        sellSectorUnits(fake.client, {
          userId: "bob",
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

describe("company decisions", () => {
  const later = () => IxTime.getCurrentIxTime() + 2 * DAY_MS * IxTime.getTimeMultiplier();

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

  it("moves a company to another sector", async () => {
    await expect(
      submitDecision(fake.client, {
        userId: "alice",
        companyId: "co",
        type: "ENTER_SECTOR",
        sectorKey: "industry",
        requestId: rid(),
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await submitDecision(fake.client, {
      userId: "alice",
      companyId: "co",
      type: "ENTER_SECTOR",
      sectorKey: "services",
      requestId: rid(),
    });
    expect(company().capital).toBe(19_500);
    await resolveDueDecisions(fake.client, later());
    expect(company().sectorKey).toBe("services");
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
});
