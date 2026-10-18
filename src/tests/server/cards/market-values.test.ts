/** @jest-environment node */
/**
 * The card-values cron: market medians per card and finish from the sales record, then every card's reference value
 * in one statement under the revalue lock, with a history row for each card whose value moved.
 */
jest.mock("~/server/db", () => ({ db: {} }));

import { Prisma } from "@prisma/client";
import { db as appDb } from "~/server/db";
import { nsBankValueSql } from "~/lib/cards/ns-bank-sql";
import { CARD_VALUATION_DEFAULTS, getValuationConfig } from "~/lib/cards/valuation";
import {
  mediansBySale,
  recomputeMarketValues,
  runCardMarketValues,
} from "~/server/modules/cards/market-values";

const NOW = new Date("2026-11-02T00:00:00Z");

type RawCall = Parameters<typeof Prisma.sql>;

/** A raw call as one SQL text with its parameters written in, so a test reads which number feeds which branch. */
function inlined(call: RawCall): string {
  const sql = Prisma.sql(...call);
  return sql.text.replace(/\$(\d+)/g, (_match, n: string) => String(sql.values[Number(n) - 1]));
}

/** A client whose transaction runs on itself and records the order of its lock, config read and writes. */
function makeDb(
  saleRows: Array<{ cardId: string; finish: string; price: number }>,
  {
    changed = [{ id: "card_1", value: 210 }],
    config = [] as Array<{ key: string; value: string }>,
  } = {}
) {
  const order: string[] = [];
  const step =
    <T>(name: string, result: T) =>
    async () => {
      order.push(name);
      return result;
    };
  const db = {
    $executeRaw: jest.fn<Promise<number>, RawCall>(step("lock", 1)),
    systemConfig: { findMany: jest.fn(step("read", config)) },
    $queryRaw: jest
      .fn<Promise<object[]>, RawCall>()
      .mockImplementationOnce(step("sales", saleRows))
      .mockImplementationOnce(step("update", changed)),
    cardMarketPrice: {
      deleteMany: jest.fn(step("delete", { count: 0 })),
      createMany: jest.fn(step("create", { count: saleRows.length })),
    },
    cardValueHistory: { createMany: jest.fn(step("history", { count: changed.length })) },
    $transaction: jest.fn(
      async (
        run: (tx: object) => Promise<object>,
        _options: { timeout: number }
      ): Promise<object> => run(db)
    ),
  };
  return { db, order };
}

const salesSql = (db: ReturnType<typeof makeDb>["db"]) => db.$queryRaw.mock.calls[0]!;
const valueSql = (db: ReturnType<typeof makeDb>["db"]) => inlined(db.$queryRaw.mock.calls[1]!);

describe("market medians", () => {
  it("takes the median per card and finish", () => {
    expect(
      mediansBySale([
        { cardId: "card_1", finish: "STANDARD", price: 100 },
        { cardId: "card_1", finish: "STANDARD", price: 300 },
        { cardId: "card_1", finish: "STANDARD", price: 200 },
        { cardId: "card_1", finish: "FOIL", price: 900 },
        { cardId: "card_2", finish: "STANDARD", price: 40 },
      ])
    ).toEqual([
      { cardId: "card_1", finish: "STANDARD", median: 200, sales: 3 },
      { cardId: "card_1", finish: "FOIL", median: 900, sales: 1 },
      { cardId: "card_2", finish: "STANDARD", median: 40, sales: 1 },
    ]);
  });

  it("has no median without sales", () => {
    expect(mediansBySale([])).toEqual([]);
  });
});

describe("recomputeMarketValues", () => {
  it("reads only the last N priced sales within the window, then rebuilds prices and reference values", async () => {
    const { db } = makeDb([{ cardId: "card_1", finish: "STANDARD", price: 210 }]);
    expect(await recomputeMarketValues(db as never, NOW)).toEqual({ prices: 1, updated: 1 });

    const sales = inlined(salesSql(db));
    expect(sales).toContain('row_number() OVER (PARTITION BY e."cardId", e.finish');
    expect(sales).toContain("e.price IS NOT NULL AND e.finish IS NOT NULL");
    expect(sales).toContain("e.action IN (AUCTION_END,AUCTION_BUYOUT,LISTING_SALE)");
    expect(sales).toContain(`WHERE rn <= ${CARD_VALUATION_DEFAULTS.medianSales}::int`);
    // The 30-day window
    expect(salesSql(db)).toContainEqual(new Date("2026-10-03T00:00:00Z"));

    expect(db.cardMarketPrice.deleteMany).toHaveBeenCalledWith({});
    expect(db.cardMarketPrice.createMany).toHaveBeenCalledWith({
      data: [{ cardId: "card_1", finish: "STANDARD", median: 210, sales: 1, computedAt: NOW }],
    });

    const values = valueSql(db);
    expect(values).toContain(`UPDATE cards c SET "marketValue" = v.value`);
    expect(values).toContain(
      `LEFT JOIN card_market_prices p ON p."cardId" = c2.id AND p.finish = 'STANDARD'`
    );
    expect(db.cardValueHistory.createMany).toHaveBeenCalledWith({
      data: [{ cardId: "card_1", value: 210, recordedAt: NOW }],
    });
  });

  it("breaks a tie between sales at the same moment by id, so a run takes the same last N every time", async () => {
    const { db } = makeDb([]);
    await recomputeMarketValues(db as never, NOW);
    expect(inlined(salesSql(db))).toContain(`ORDER BY e."createdAt" DESC, e.id DESC) AS rn`);
  });

  it("reads only sales of cards that still exist, so one orphan sale can never fail the price rebuild", async () => {
    // card_transfer_events.cardId has no foreign key; card_market_prices.cardId has one
    const { db } = makeDb([]);
    await recomputeMarketValues(db as never, NOW);
    const sales = inlined(salesSql(db)).replace(/\s+/g, " ");
    expect(sales).toContain(`FROM card_transfer_events e JOIN cards c ON c.id = e."cardId" WHERE`);
  });

  it("runs one at a time: it takes the revalue lock, reads the stored config, then writes, in one transaction", async () => {
    const { db, order } = makeDb([{ cardId: "card_1", finish: "STANDARD", price: 210 }]);
    await recomputeMarketValues(db as never, NOW);
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), { timeout: 60_000 });
    expect(order).toEqual(["lock", "read", "sales", "delete", "create", "update", "history"]);
    const lock = inlined(db.$executeRaw.mock.calls[0]!);
    expect(lock).toBe("SELECT pg_advisory_xact_lock(7336::int, 0)");
  });

  it("reads the stored config, not this process's cached copy", async () => {
    await getValuationConfig({
      systemConfig: { findMany: jest.fn().mockResolvedValue([]) },
    } as never);
    const { db } = makeDb([], {
      config: [
        { key: "card_valuation_floor_rare", value: "120" },
        { key: "card_valuation_median_days", value: "10" },
      ],
    });
    await recomputeMarketValues(db as never, NOW);
    expect(valueSql(db)).toContain("WHEN 'RARE' THEN 120::float8");
    expect(salesSql(db)).toContainEqual(new Date("2026-10-23T00:00:00Z"));
  });

  it("gives each rarity its floor and each type its multiple, as referenceValue does", async () => {
    // A distinct number for each, so a swapped branch shows
    const stored: Array<[string, string]> = [
      ["floor_common", "11"],
      ["floor_uncommon", "31"],
      ["floor_rare", "101"],
      ["floor_ultra_rare", "301"],
      ["floor_epic", "1001"],
      ["floor_legendary", "3001"],
      ["mult_special", "2.1"],
      ["mult_nation", "1.6"],
      ["mult_trophy", "0.26"],
      ["ns_premium", "1.7"],
    ];
    const { db } = makeDb([], {
      config: stored.map(([key, value]) => ({ key: `card_valuation_${key}`, value })),
    });
    await recomputeMarketValues(db as never, NOW);
    const sql = valueSql(db).replace(/\s+/g, " ");
    expect(sql).toContain(
      "(CASE c2.rarity::text WHEN 'LEGENDARY' THEN 3001::float8 WHEN 'EPIC' THEN 1001::float8 " +
        "WHEN 'ULTRA_RARE' THEN 301::float8 WHEN 'RARE' THEN 101::float8 WHEN 'UNCOMMON' THEN 31::float8 " +
        "ELSE 11::float8 END)"
    );
    expect(sql).toContain(
      `(CASE c2."cardType"::text WHEN 'SPECIAL' THEN 2.1::float8 WHEN 'NATION' THEN 1.6::float8 ` +
        "WHEN 'TROPHY' THEN 0.26::float8 ELSE 1 END)"
    );
    // The market median at Standard, and an NS card's bank value × the premium until a copy of it first sells here
    expect(sql).toContain("COALESCE(p.median, 0)");
    expect(sql).toContain(
      `CASE WHEN c2."cardType"::text = 'NS' AND c2."firstSoldAt" IS NULL ` +
        `THEN COALESCE(${nsBankValueSql("c2").sql}, 0) * 1.7::float8 ELSE 0 END`
    );
  });

  it("rounds to the cent as referenceValue does, and rewrites only cards whose value moved", async () => {
    const { db } = makeDb([]);
    await recomputeMarketValues(db as never, NOW);
    const sql = valueSql(db).replace(/\s+/g, " ");
    expect(sql).toMatch(
      /SELECT c2\.id, FLOOR\(GREATEST\(.*\) \* 100 \+ 0\.5\) \/ 100 AS value FROM cards c2/
    );
    expect(sql).toContain(`WHERE v.id = c.id AND c."marketValue" IS DISTINCT FROM v.value`);
    expect(sql).toContain("RETURNING c.id, v.value");
  });

  it("rebuilds an empty price table and writes no history when no value moved", async () => {
    const { db } = makeDb([], { changed: [] });
    expect(await recomputeMarketValues(db as never, NOW)).toEqual({ prices: 0, updated: 0 });
    expect(db.cardMarketPrice.deleteMany).toHaveBeenCalledWith({});
    expect(db.cardMarketPrice.createMany).toHaveBeenCalledWith({ data: [] });
    expect(db.cardValueHistory.createMany).not.toHaveBeenCalled();
  });

  it("is the cron's job over the app client", async () => {
    const { db } = makeDb([]);
    const app = appDb as never as typeof db;
    Object.assign(app, db);
    expect(await runCardMarketValues()).toEqual({ prices: 0, updated: 1 });
    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });
});
