/** @jest-environment node */
/**
 * The contest reads and the contest-place lock. Entries are read in pages of 500 by id (an explicit `take` and
 * `cursor` keep `~/server/db`'s 1,000-row cap off), and inside a place's lock the contest's entries are read again.
 */
import { describe, it, expect } from "@jest/globals";
import {
  CONTEST_ENTRY_SELECT,
  contestEntryIds,
  findContestEntries,
  lockContestPlace,
} from "~/lib/lorewards/contest-store";

interface Page {
  where: object;
  select: object;
  orderBy: { id: "asc" };
  take: number;
  cursor?: { id: string };
  skip?: number;
}

/** A table of `count` entries whose findMany honours `orderBy: id`, `take`, `cursor` and `skip`, as Prisma does. */
function pagedTable(count: number) {
  const rows = Array.from({ length: count }, (_, i) => ({ id: `e${String(i).padStart(5, "0")}` }));
  return {
    lorewardEntry: {
      findMany: jest.fn(async ({ take, cursor, skip = 0 }: Page) => {
        const start = cursor ? rows.findIndex((row) => row.id === cursor.id) : 0;
        return rows.slice(start + skip, start + skip + take);
      }),
    },
  };
}

describe("findContestEntries", () => {
  it("reads every entry in pages of 500 by id, past the 1,000-row cap", async () => {
    const db = pagedTable(1203);
    const where = { status: "approved" };
    const rows = await findContestEntries(db as never, where);

    expect(rows).toHaveLength(1203);
    expect(new Set(rows.map((row) => row.id)).size).toBe(1203);
    const pages = db.lorewardEntry.findMany.mock.calls.map(([args]) => args);
    expect(pages).toHaveLength(3);
    expect(pages[0]).toEqual({
      where,
      select: CONTEST_ENTRY_SELECT,
      orderBy: { id: "asc" },
      take: 500,
    });
    expect(pages[1]).toMatchObject({ cursor: { id: "e00499" }, skip: 1, take: 500 });
    expect(pages[2]).toMatchObject({ cursor: { id: "e00999" }, skip: 1, take: 500 });
  });

  it("stops after one page when the table is smaller", async () => {
    const db = pagedTable(3);
    expect(await findContestEntries(db as never, {})).toHaveLength(3);
    expect(db.lorewardEntry.findMany).toHaveBeenCalledTimes(1);
  });
});

describe("contestEntryIds", () => {
  it("reads the ids of every entry of the contest, whichever key each is stored under", async () => {
    const tx = {
      lorewardEntry: { findMany: jest.fn(async () => [{ id: "ool" }, { id: "state" }]) },
    };
    const ids = await contestEntryIds(tx as never, {
      type: "weekly",
      date: "2026-W42",
      dateStart: "2026-10-12",
    });
    expect(ids).toEqual(["ool", "state"]);
    expect(tx.lorewardEntry.findMany).toHaveBeenCalledWith({
      where: {
        type: "weekly",
        OR: [{ dateStart: "2026-10-12" }, { dateStart: null, date: "2026-10-12" }],
      },
      select: { id: true },
    });
  });
});

describe("lockContestPlace", () => {
  it("takes the transaction-scoped advisory lock of the place's key", async () => {
    const tx = {
      $executeRaw: jest.fn(
        async (_strings: TemplateStringsArray, ..._values: Array<string | number>) => 0
      ),
    };
    await lockContestPlace(tx as never, "weekly:2026-10-12:winner");
    const [strings, ...values] = tx.$executeRaw.mock.calls[0]!;
    expect(strings.join("?")).toBe("SELECT pg_advisory_xact_lock(?::int, hashtext(?))");
    expect(values).toEqual([7332, "weekly:2026-10-12:winner"]);
  });
});
