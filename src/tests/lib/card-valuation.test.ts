import {
  CARD_VALUATION_DEFAULTS as C,
  clearValuationCache,
  computeCardValue,
  getValuationConfig,
  rarityFloor,
  recomputeAllCardValues,
  setValuationConfig,
} from "~/lib/cards/valuation";

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
    expect(computeCardValue({ rarity: "COMMON", cardType: "NS", nsMarketValue: 1 }, C)).toBe(10);
  });

  test("valuable NS legendary floats above the floor via the premium", () => {
    // 5381 * 1.5 = 8071.5, well above the 3000 legendary floor
    expect(computeCardValue({ rarity: "LEGENDARY", cardType: "NS", nsMarketValue: 5381 }, C)).toBe(
      8071.5
    );
  });

  test("NS value is never lost (premium >= 1 means result >= raw NS value)", () => {
    const ns = 250;
    expect(
      computeCardValue({ rarity: "RARE", cardType: "NS", nsMarketValue: ns }, C)
    ).toBeGreaterThanOrEqual(ns);
  });

  test("native cards ride the floor curve with type multipliers", () => {
    expect(computeCardValue({ rarity: "RARE", cardType: "LORE" }, C)).toBe(rarityFloor(C, "RARE"));
    expect(computeCardValue({ rarity: "RARE", cardType: "SPECIAL" }, C)).toBe(100 * C.multSpecial);
    expect(computeCardValue({ rarity: "RARE", cardType: "NATION" }, C)).toBe(100 * C.multNation);
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
