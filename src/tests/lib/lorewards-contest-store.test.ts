/** @jest-environment node */
/**
 * The contest reads and the contest-place lock. Entries are read in pages of 500 by id (an explicit `take` keeps
 * `~/server/db`'s 1,000-row cap off), and inside a place's lock the contest's entries are read again.
 */
import { describe, it, expect } from "@jest/globals";
import { matches, storedEntry, type StoredEntry } from "~/tests/helpers/loreward-entry-store";
import {
  CONTEST_ENTRY_SELECT,
  contestsOfEntriesWhere,
  findContestEntries,
  holderStillRecordedTx,
  lockContestPlace,
} from "~/lib/lorewards/contest-store";

interface Page {
  where: { AND?: [object, { id: { gt: string } }] };
  select: object;
  orderBy: { id: "asc" };
  take: number;
}

/** A table of `count` entries whose findMany honours `orderBy: id`, `take` and an `id > after` keyset, as Prisma does. */
function pagedTable(count: number) {
  const rows = Array.from({ length: count }, (_, i) => ({ id: `e${String(i).padStart(5, "0")}` }));
  return {
    lorewardEntry: {
      findMany: jest.fn(async ({ where, take }: Page) => {
        const after = where.AND?.[1].id.gt;
        return rows.filter((row) => after === undefined || row.id > after).slice(0, take);
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
    expect(pages[1]).toMatchObject({
      where: { AND: [where, { id: { gt: "e00499" } }] },
      take: 500,
    });
    expect(pages[2]).toMatchObject({
      where: { AND: [where, { id: { gt: "e00999" } }] },
      take: 500,
    });
    expect(pages.every((page) => !("cursor" in page) && !("skip" in page))).toBe(true);
  });
});

describe("contestsOfEntriesWhere", () => {
  /** A table whose findMany answers the real `where` over `rows`. */
  type Where = Parameters<typeof matches>[1];
  const table = (rows: StoredEntry[]) => ({
    lorewardEntry: {
      findMany: jest.fn(async ({ where }: { where: Where }) =>
        rows.filter((row) => matches(row, where))
      ),
    },
  });
  const daily = storedEntry({ id: "d", date: "2026-10-16" });
  const iso = storedEntry({
    id: "w-iso",
    type: "weekly",
    date: "2026-W43",
    dateStart: "2026-10-19",
    dateEnd: "2026-10-25",
  });
  const twin = storedEntry({ id: "w-day", type: "weekly", date: "2026-10-19" });

  it("is null for no ids, and reads nothing", async () => {
    const db = table([daily]);
    expect(await contestsOfEntriesWhere(db as never, [])).toBeNull();
    expect(db.lorewardEntry.findMany).not.toHaveBeenCalled();
  });

  it("is null when no entry has one of the ids", async () => {
    expect(await contestsOfEntriesWhere(table([daily]) as never, ["gone"])).toBeNull();
  });

  it("is the OR of each found contest's entries, once per contest", async () => {
    const db = table([daily, iso, twin]);
    const where = await contestsOfEntriesWhere(db as never, ["d", "w-iso", "w-day"]);
    expect(where).toEqual({
      OR: [
        { type: "daily", date: "2026-10-16" },
        {
          type: "weekly",
          OR: [{ dateStart: "2026-10-19" }, { dateStart: null, date: "2026-10-19" }],
        },
      ],
    });
  });

  it("selects a contest's twin from either of its entries, and no other contest", async () => {
    const rows = [daily, iso, twin];
    for (const id of ["w-iso", "w-day"]) {
      const where = await contestsOfEntriesWhere(table(rows) as never, [id]);
      const selected = rows.filter((row) => where && matches(row, where as Where));
      expect(selected.map((row) => row.id)).toEqual(["w-iso", "w-day"]);
    }
  });
});

describe("holderStillRecordedTx", () => {
  const row = (id: string, over: object = {}) => ({
    id,
    type: "weekly",
    date: "2026-10-12",
    dateStart: null,
    dateEnd: null,
    winnerUser: "Amy",
    winnerPage: "Page",
    runnerUpUser: null,
    runnerUpPage: null,
    ...over,
  });
  /** The state-keyed twin of the weekly of 12 October. */
  const state = (over: object = {}) =>
    row("state", { date: "2026-W42", dateStart: "2026-10-12", dateEnd: "2026-10-18", ...over });
  const recheck = (rows: object[], recorded = { wikiUser: "Amy", page: "Page" }) => {
    const tx = { lorewardEntry: { findMany: jest.fn(async (_args: object) => rows) } };
    const ids = holderStillRecordedTx(
      tx as never,
      { type: "weekly", date: "2026-W42", dateStart: "2026-10-12" },
      "winner",
      recorded
    );
    return { tx, ids };
  };

  it("reads every entry of the contest through the transaction, whichever key each is stored under", async () => {
    const { tx, ids } = recheck([row("ool"), state()]);
    expect(await ids).toEqual(["ool", "state"]);
    expect(tx.lorewardEntry.findMany).toHaveBeenCalledWith({
      where: {
        type: "weekly",
        OR: [{ dateStart: "2026-10-12" }, { dateStart: null, date: "2026-10-12" }],
      },
      select: CONTEST_ENTRY_SELECT,
      orderBy: { id: "asc" },
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
