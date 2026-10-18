import type { CardRarity, CardType } from "@prisma/client";
import { getCardMarketValue } from "~/lib/cards/card-service";
import {
  CARD_VALUATION_DEFAULTS as C,
  clearValuationCache,
  getValuationConfig,
  rarityFloor,
  recomputeAllCardValues,
  referenceValue,
  setValuationConfig,
} from "~/lib/cards/valuation";

/** A card's reference value before any copy of it has sold here. */
const unsold = (rarity: CardRarity, cardType: CardType, nsBankValue: number | null = null) =>
  referenceValue({ rarity, cardType, firstSoldAt: null, nsBankValue, isRetired: false }, null, C);

/** A client whose revalue transaction records the order of its lock, config read and updates. */
function revalueDb(rows: Array<{ key: string; value: string }> = []) {
  const order: string[] = [];
  const tx = {
    $executeRaw: jest.fn(async (_sql: TemplateStringsArray, ..._values: number[]) => {
      order.push("lock");
      return 1;
    }),
    systemConfig: {
      findMany: jest.fn(async () => {
        order.push("read");
        return rows;
      }),
    },
    $executeRawUnsafe: jest.fn(async (_sql: string) => {
      order.push("update");
      return 1;
    }),
  };
  const db = {
    $transaction: jest.fn(
      async (revalue: (client: typeof tx) => Promise<{ updated: number }>, _options: object) =>
        revalue(tx)
    ),
  };
  return { db, tx, order };
}

const updateSql = (tx: ReturnType<typeof revalueDb>["tx"]) =>
  tx.$executeRawUnsafe.mock.calls.map(([sql]) => sql);

describe("card-valuation", () => {
  test("A Common NS card is lifted to the rarity floor, not stuck at NS bank value 1", () => {
    expect(unsold("COMMON", "NS", 1)).toBe(10);
  });

  test("valuable NS legendary floats above the floor via the premium", () => {
    // 5381 * 1.5 = 8071.5, well above the 3000 legendary floor
    expect(unsold("LEGENDARY", "NS", 5381)).toBe(8071.5);
  });

  test("NS value is never lost before a first sale (premium >= 1 means result >= raw NS value)", () => {
    const ns = 250;
    expect(unsold("RARE", "NS", ns)).toBeGreaterThanOrEqual(ns);
  });

  test("native cards ride the floor curve with type multipliers", () => {
    expect(unsold("RARE", "LORE")).toBe(rarityFloor(C, "RARE"));
    expect(unsold("RARE", "SPECIAL")).toBe(100 * C.multSpecial);
    expect(unsold("RARE", "NATION")).toBe(100 * C.multNation);
  });

  test("a card's market value drops the NS bank term once a copy of it has sold here", async () => {
    clearValuationCache();
    const card = {
      rarity: "COMMON",
      cardType: "NS",
      firstSoldAt: null,
      isRetired: false,
      metadata: { nsData: { market_value: "40" } },
    };
    const db = {
      systemConfig: { findMany: jest.fn().mockResolvedValue([]) },
      card: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(card)
          .mockResolvedValueOnce({ ...card, firstSoldAt: new Date("2026-11-01") }),
      },
    };
    await expect(getCardMarketValue(db as never, "card_1")).resolves.toBe(60);
    await expect(getCardMarketValue(db as never, "card_1")).resolves.toBe(10);
  });

  test("the recompute reads the NS bank value from metadata.nsData, for NS cards", async () => {
    const { db, tx } = revalueDb();
    await recomputeAllCardValues(db as never);
    const sql = updateSql(tx)[0]!;
    expect(sql).toContain(`WHEN "cardType" = 'NS'`);
    expect(sql).toContain(`metadata->'nsData'->>'market_value'`);
    expect(sql).not.toMatch(/stats|NS_IMPORT/);
    expect(tx.$executeRawUnsafe).toHaveBeenCalledTimes(6);
  });

  test("the recompute reads the stored config, not this process's cached copy", async () => {
    await getValuationConfig({
      systemConfig: { findMany: jest.fn().mockResolvedValue([]) },
    } as never);
    const { db, tx } = revalueDb([{ key: "card_valuation_floor_rare", value: "120" }]);
    await recomputeAllCardValues(db as never);
    expect(updateSql(tx).find((sql) => sql.includes("'RARE'"))).toContain("GREATEST(120,");
  });

  test("one revalue runs at a time: it takes its lock, then reads the config, then updates", async () => {
    const { db, tx, order } = revalueDb();
    await recomputeAllCardValues(db as never);
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), { timeout: 60_000 });
    expect(order).toEqual(["lock", "read", ...Array<string>(6).fill("update")]);
    const [strings, namespace] = tx.$executeRaw.mock.calls[0]!;
    expect(strings.join("?")).toContain("pg_advisory_xact_lock(");
    expect(namespace).toBe(7336);
  });

  test("the recompute rewrites only cards whose value changes", async () => {
    const { db, tx } = revalueDb();
    await recomputeAllCardValues(db as never);
    for (const sql of updateSql(tx)) {
      expect(sql).toMatch(/AND "marketValue" IS DISTINCT FROM CASE/);
    }
  });

  test("a setter in a transaction leaves the cache to its caller, which clears it after the commit", async () => {
    const read = { systemConfig: { findMany: jest.fn().mockResolvedValue([]) } };
    clearValuationCache();
    await getValuationConfig(read as never);
    await setValuationConfig({ systemConfig: { upsert: jest.fn() } } as never, "floorRare", 120);
    await getValuationConfig(read as never);
    expect(read.systemConfig.findMany).toHaveBeenCalledTimes(1);
    clearValuationCache();
    await getValuationConfig(read as never);
    expect(read.systemConfig.findMany).toHaveBeenCalledTimes(2);
    const app = { systemConfig: { upsert: jest.fn() }, $transaction: jest.fn() };
    await setValuationConfig(app as never, "floorRare", 120);
    await getValuationConfig(read as never);
    expect(read.systemConfig.findMany).toHaveBeenCalledTimes(3);
  });

  test("the config has no junk rate", () => {
    expect(C).not.toHaveProperty("junkRate");
  });
});
