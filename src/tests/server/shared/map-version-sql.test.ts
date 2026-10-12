/** @jest-environment node */
/**
 * The expression invalidateRealmMap uses to move Realm.mapVersion, evaluated by Postgres: one past the old version, and
 * never below the epoch second, so a database restored to an older state (versions back near 0) jumps past every number
 * its URLs, browsers and tile folders ever carried. Runs only with TILES_DB_URL set (like tiles-db.test.ts); the SQL
 * is a read-only SELECT of the expression, with the column replaced by a literal.
 */
import { PrismaClient } from "@prisma/client";
import { invalidateRealmMap } from "~/server/shared/map-invalidation";

const url = process.env.TILES_DB_URL;
const run = url ? describe : describe.skip;

/** The new-version expression from the statement the code really sends: the text after `SET "mapVersion" =`. */
async function newVersionExpression(): Promise<string> {
  const queryRaw = jest.fn().mockResolvedValue([{ mapVersion: 1 }]);
  await invalidateRealmMap({ $queryRaw: queryRaw } as never, "default");
  const sql = (queryRaw.mock.calls[0][0] as string[]).join("?");
  const expression = /SET "mapVersion" = (.+) WHERE/.exec(sql)?.[1];
  if (!expression) throw new Error(`no version expression in: ${sql}`);
  return expression;
}

run("Realm.mapVersion bump, evaluated by Postgres", () => {
  const db = new PrismaClient({ datasourceUrl: url });
  afterAll(() => db.$disconnect());

  async function next(old: number): Promise<{ next: number; epoch: number }> {
    const expression = (await newVersionExpression()).replaceAll('"mapVersion"', String(old));
    const [row] = await db.$queryRawUnsafe<Array<{ next: number; epoch: number }>>(
      `SELECT (${expression})::int AS next, (extract(epoch from now()))::int AS epoch`
    );
    return row!;
  }

  it("jumps past the epoch when the counter is lower, as after a restore", async () => {
    for (const old of [0, 7, 1_000_000]) {
      const { next: version, epoch } = await next(old);
      expect(version).toBeGreaterThanOrEqual(epoch);
    }
  });

  it("goes up by one once the counter is at or above the epoch", async () => {
    const { epoch } = await next(0);
    expect((await next(epoch + 1000)).next).toBe(epoch + 1001);
  });

  it("fits the column (a 32-bit integer) today", async () => {
    expect((await next(0)).next).toBeLessThan(2 ** 31);
  });
});
