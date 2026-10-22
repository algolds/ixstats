/** @jest-environment node */
/**
 * Card XP: `grantCardXp` grants a source's amount inside the caller's transaction, within the per-copy UTC daily cap,
 * by a compare-and-swap that re-reads and retries and gives up writing nothing; the holding tick gives every held
 * copy its daily XP in one statement that claims the day, so a day never ticks twice; a level is 1 to 10 at 1,000 XP.
 *
 * Folds holding-xp and levels.
 */
import { clearEconomyConfigCache } from "~/lib/cards/economy-config";
import { grantCardXp } from "~/lib/cards/xp-utils";
import { Prisma } from "@prisma/client";
import { runHoldingXpTick } from "~/server/modules/cards/holding-xp";
import { clampLevel, levelForXp } from "~/lib/cards/levels";

const NOW = new Date("2026-11-02T12:00:00Z");
const TODAY = new Date("2026-11-02T00:00:00Z");
const YESTERDAY = new Date("2026-11-01T00:00:00Z");

interface XpRow {
  level: number;
  experience: number;
  xpDay: Date | null;
  xpToday: number;
}

function makeTx(row: XpRow | null, stored: Array<{ key: string; value: string }> = []) {
  return {
    systemConfig: { findMany: jest.fn().mockResolvedValue(stored) },
    cardOwnership: {
      findUnique: jest.fn().mockResolvedValue(row),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    cardExperienceEvent: { create: jest.fn().mockResolvedValue({}) },
  };
}

beforeEach(() => clearEconomyConfigCache());

describe("grantCardXp", () => {
  it("grants the source's amount from the Economy tab and logs an event", async () => {
    const tx = makeTx({ level: 1, experience: 990, xpDay: null, xpToday: 0 });
    const result = await grantCardXp(tx as never, "own_1", "TRADE", '{"tradeId":"t1"}', NOW);
    expect(result).toEqual({
      prevLevel: 1,
      newLevel: 2,
      prevXP: 990,
      newXP: 1015,
      leveledUp: true,
      xpGained: 25,
    });
    expect(tx.cardOwnership.updateMany).toHaveBeenCalledWith({
      where: { id: "own_1", experience: 990, xpToday: 0 },
      data: { experience: 1015, level: 2, xpToday: 25, xpDay: TODAY },
    });
    expect(tx.cardExperienceEvent.create).toHaveBeenCalledWith({
      data: {
        ownershipId: "own_1",
        amount: 25,
        resultLevel: 2,
        resultXP: 1015,
        source: "TRADE",
        metadata: '{"tradeId":"t1"}',
      },
    });
  });
  it("stops at the daily cap per copy and writes nothing once it is reached", async () => {
    const capped = makeTx({ level: 3, experience: 2400, xpDay: TODAY, xpToday: 100 });
    expect(await grantCardXp(capped as never, "own_1", "AUCTION_WIN", undefined, NOW)).toEqual({
      prevLevel: 3,
      newLevel: 3,
      prevXP: 2400,
      newXP: 2400,
      leveledUp: false,
      xpGained: 0,
    });
    expect(capped.cardOwnership.updateMany).not.toHaveBeenCalled();
    expect(capped.cardExperienceEvent.create).not.toHaveBeenCalled();

    const partial = makeTx({ level: 3, experience: 2400, xpDay: TODAY, xpToday: 80 });
    expect(
      (await grantCardXp(partial as never, "own_1", "AUCTION_WIN", undefined, NOW)).xpGained
    ).toBe(20);
    expect(partial.cardOwnership.updateMany).toHaveBeenCalledWith({
      where: { id: "own_1", experience: 2400, xpToday: 80 },
      data: { experience: 2420, level: 3, xpToday: 100, xpDay: TODAY },
    });
  });

  it("starts a new UTC day's cap at zero", async () => {
    const tx = makeTx({ level: 3, experience: 2400, xpDay: YESTERDAY, xpToday: 100 });
    expect((await grantCardXp(tx as never, "own_1", "TRADE", undefined, NOW)).xpGained).toBe(25);
    expect(tx.cardOwnership.updateMany).toHaveBeenCalledWith({
      where: { id: "own_1", experience: 2400, xpToday: 100 },
      data: { experience: 2425, level: 3, xpToday: 25, xpDay: TODAY },
    });
  });
  it("re-reads and retries when another grant changed the copy first", async () => {
    const tx = makeTx({ level: 1, experience: 0, xpDay: null, xpToday: 0 });
    tx.cardOwnership.findUnique
      .mockResolvedValueOnce({ level: 1, experience: 0, xpDay: null, xpToday: 0 })
      .mockResolvedValueOnce({ level: 1, experience: 95, xpDay: TODAY, xpToday: 95 });
    tx.cardOwnership.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });

    const result = await grantCardXp(tx as never, "own_1", "PACK_OPEN", undefined, NOW);

    expect(result).toMatchObject({ prevXP: 95, newXP: 100, xpGained: 5 });
    expect(tx.cardOwnership.findUnique).toHaveBeenCalledTimes(2);
    expect(tx.cardOwnership.updateMany).toHaveBeenLastCalledWith({
      where: { id: "own_1", experience: 95, xpToday: 95 },
      data: { experience: 100, level: 1, xpToday: 100, xpDay: TODAY },
    });
    expect(tx.cardExperienceEvent.create).toHaveBeenCalledTimes(1);
  });

  it("gives up after three conflicting grants, writing no event", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const tx = makeTx({ level: 2, experience: 1500, xpDay: null, xpToday: 0 });
    tx.cardOwnership.updateMany.mockResolvedValue({ count: 0 });

    expect(await grantCardXp(tx as never, "own_1", "TRADE", undefined, NOW)).toMatchObject({
      prevXP: 1500,
      newXP: 1500,
      xpGained: 0,
      leveledUp: false,
    });
    expect(tx.cardOwnership.updateMany).toHaveBeenCalledTimes(3);
    expect(tx.cardExperienceEvent.create).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("own_1"));
    warn.mockRestore();
  });
});

describe("the holding tick", () => {
  const NOW = new Date("2026-11-02T03:30:00Z");
  const DAY_KEY = "cards_holding_tick_day";

  interface FindManyArgs {
    where: { key: { in?: string[]; startsWith?: string } };
  }

  /**
   * A database whose stored tick day is `lastDay`. The tick's statement reports `outcome`, and claiming the day stores
   * it, as Postgres would.
   */
  function makeDb(
    lastDay: string | null,
    economy: Array<{ key: string; value: string }> = [],
    outcome: { claimed: boolean; copies: number } = { claimed: true, copies: 42 }
  ) {
    let stored = lastDay;
    return {
      systemConfig: {
        findMany: jest.fn().mockImplementation(async ({ where }: FindManyArgs) => {
          if (where.key.in) return stored ? [{ key: DAY_KEY, value: stored }] : [];
          return economy;
        }),
      },
      $queryRaw: jest
        .fn()
        .mockImplementation(async (_strings: TemplateStringsArray, ...values: string[]) => {
          if (outcome.claimed) stored = values[1] ?? null;
          return [outcome];
        }),
    };
  }

  const flat = (sql: string) => sql.replace(/\s+/g, " ").trim();

  /** The one statement the tick ran, fragments and all, as Postgres receives it. */
  function statementOf(db: ReturnType<typeof makeDb>): Prisma.Sql {
    const [strings, ...values] = db.$queryRaw.mock.calls[0] as Parameters<typeof Prisma.sql>;
    return Prisma.sql(strings, ...values);
  }

  beforeEach(() => clearEconomyConfigCache());

  describe("runHoldingXpTick", () => {
    it("ticks every copy held a day, in one statement that also claims the day, without event rows", async () => {
      const db = makeDb("2026-11-01");
      expect(await runHoldingXpTick(db as never, NOW)).toEqual({
        day: "2026-11-02",
        copies: 42,
        skipped: false,
      });
      expect(db.$queryRaw).toHaveBeenCalledTimes(1);
      const { sql, values } = statementOf(db);
      // The day is claimed only when it is later than the last one stored, in the statement that ticks the copies,
      // and the statement says whether it claimed the day as well as how many copies it ticked
      expect(flat(sql)).toContain(
        flat(`WITH claim AS (
          INSERT INTO "SystemConfig" ("id", "key", "value", "description", "updatedAt")
          VALUES (gen_random_uuid()::text, ?, ?, ?, now())
          ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = now()
            WHERE "SystemConfig"."value" < EXCLUDED."value"
          RETURNING 1
        ), ticked AS (
          UPDATE "CardOwnership" o SET`)
      );
      expect(flat(sql)).toMatch(
        /RETURNING 1 \) SELECT EXISTS \(SELECT 1 FROM claim\) AS claimed, \(SELECT count\(\*\) FROM ticked\)::int AS copies$/
      );
      expect(sql).not.toContain("card_experience_events");
      expect(values.slice(0, 3)).toEqual([DAY_KEY, "2026-11-02", expect.any(String)]);
    });
    it("skips a day it already ticked", async () => {
      const db = makeDb("2026-11-02");
      expect(await runHoldingXpTick(db as never, NOW)).toEqual({
        day: "2026-11-02",
        copies: 0,
        skipped: true,
      });
      expect(db.$queryRaw).not.toHaveBeenCalled();
    });
    it("never ticks a day before the last one it ticked", async () => {
      const db = makeDb("2026-11-03");
      expect(await runHoldingXpTick(db as never, NOW)).toMatchObject({ skipped: true, copies: 0 });
      expect(db.$queryRaw).not.toHaveBeenCalled();
    });
  });
});

describe("card levels", () => {
  describe("card levels", () => {
    it("is 1 to 10 from XP, 1,000 a level, and XP past the cap is kept", () => {
      expect(levelForXp(0)).toBe(1);
      expect(levelForXp(999)).toBe(1);
      expect(levelForXp(1000)).toBe(2);
      expect(levelForXp(9000)).toBe(10);
      expect(levelForXp(250_000)).toBe(10);
      expect(clampLevel(37)).toBe(10);
      expect(clampLevel(0)).toBe(1);
    });
  });
});
