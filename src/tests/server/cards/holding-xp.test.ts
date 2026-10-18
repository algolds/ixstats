/** @jest-environment node */
import { Prisma } from "@prisma/client";
import { clearEconomyConfigCache } from "~/lib/cards/economy-config";
import { runHoldingXpTick } from "~/server/modules/cards/holding-xp";

const NOW = new Date("2026-11-02T03:30:00Z");
const DAY_KEY = "cards_holding_tick_day";

interface FindManyArgs {
  where: { key: { in?: string[]; startsWith?: string } };
}

function makeDb(lastDay: string | null, economy: Array<{ key: string; value: string }> = []) {
  return {
    systemConfig: {
      findMany: jest.fn().mockImplementation(async ({ where }: FindManyArgs) => {
        if (where.key.in) return lastDay ? [{ key: DAY_KEY, value: lastDay }] : [];
        return economy;
      }),
    },
    $executeRaw: jest.fn().mockResolvedValue(42),
  };
}

const flat = (sql: string) => sql.replace(/\s+/g, " ").trim();

/** The one statement the tick ran, fragments and all, as Postgres receives it. */
function statementOf(db: ReturnType<typeof makeDb>): Prisma.Sql {
  const [strings, ...values] = db.$executeRaw.mock.calls[0] as Parameters<typeof Prisma.sql>;
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
    expect(db.$executeRaw).toHaveBeenCalledTimes(1);
    const { sql, values } = statementOf(db);
    // The day is claimed only when it is later than the last one stored, in the statement that ticks the copies
    expect(flat(sql)).toContain(
      flat(`WITH claim AS (
        INSERT INTO "SystemConfig" ("id", "key", "value", "description", "updatedAt")
        VALUES (gen_random_uuid()::text, ?, ?, ?, now())
        ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = now()
          WHERE "SystemConfig"."value" < EXCLUDED."value"
        RETURNING 1
      )
      UPDATE "CardOwnership" o SET`)
    );
    expect(sql).toContain("WHERE EXISTS (SELECT 1 FROM claim)");
    expect(sql).not.toContain("card_experience_events");
    expect(values.slice(0, 3)).toEqual([DAY_KEY, "2026-11-02", expect.any(String)]);
  });

  it("ticks each held copy of an unretired card within its daily cap, worked out from the row it updates", async () => {
    const db = makeDb(null, [
      { key: "card_economy_xp_holding_tick", value: "7" },
      { key: "card_economy_xp_daily_cap_per_copy", value: "60" },
    ]);
    await runHoldingXpTick(db as never, NOW);
    const { sql, values } = statementOf(db);
    // Every term reads `o`, never a snapshot taken before the update, so a grant that lands on the copy first is
    // counted when Postgres re-checks the row.
    const today = `(CASE WHEN o."xpDay" = ?::date THEN o."xpToday" ELSE 0 END)`;
    const grant = `LEAST(?::int, ?::int - ${today})`;
    expect(flat(sql)).toContain(
      flat(`UPDATE "CardOwnership" o SET
        "experience" = o."experience" + ${grant},
        "level" = LEAST(?::int, (o."experience" + ${grant}) / ?::int + 1),
        "xpToday" = ${today} + ${grant},
        "xpDay" = ?::date
      FROM "cards" c
      WHERE EXISTS (SELECT 1 FROM claim)
        AND c."id" = o."cardId" AND NOT c."isRetired"
        AND o."acquiredAt" <= ?
        AND ${grant} > 0`)
    );
    const day = "2026-11-02";
    const tick = [7, 60, day];
    expect(values.slice(3)).toEqual([
      ...tick,
      10,
      ...tick,
      1000,
      day,
      ...tick,
      day,
      new Date("2026-11-01T03:30:00Z"),
      ...tick,
    ]);
  });

  it("skips a day it already ticked", async () => {
    const db = makeDb("2026-11-02");
    expect(await runHoldingXpTick(db as never, NOW)).toEqual({
      day: "2026-11-02",
      copies: 0,
      skipped: true,
    });
    expect(db.$executeRaw).not.toHaveBeenCalled();
  });

  it("never ticks a day before the last one it ticked", async () => {
    const db = makeDb("2026-11-03");
    expect(await runHoldingXpTick(db as never, NOW)).toMatchObject({ skipped: true, copies: 0 });
    expect(db.$executeRaw).not.toHaveBeenCalled();
  });
});
