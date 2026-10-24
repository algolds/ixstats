/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories rely on the ambient global.
//
// The OOL syncs store a weekly under its ISO week (design decision 18), keeping its real first day and range, and never
// write one week's places over another week stored on the same ISO key. Every sync ends by settling: the hourly OOL
// backfill the entries it wrote, the daily full sync every place (decision 17).
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    wikiArticle: { findFirst: jest.fn() },
    lorewardEntry: {},
    lorewardUserStats: { upsert: jest.fn() },
  },
}));
jest.mock("~/lib/lorewards/ool-parser", () => ({
  OOL_YEARS: [2023],
  parseActiveMembers: jest.fn(() => []),
  parseAnnualWinners: jest.fn(() => []),
  parseOOLPage: jest.fn(),
}));
jest.mock("~/lib/lorewards/settle", () => ({
  NOTHING_SETTLED: { minted: 0, granted: 0, paid: 0, refused: 0, payoutsEnabled: true },
  settleLorewardPlaces: jest.fn(),
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { db } from "~/server/db";
import { parseOOLPage } from "~/lib/lorewards/ool-parser";
import { NOTHING_SETTLED, settleLorewardPlaces } from "~/lib/lorewards/settle";
import { backfillCurrentYearFromOOL, fullSync, syncFromOOLPages } from "~/lib/lorewards/sync";
import { entryStore, storedEntry, type StoredEntry } from "~/tests/helpers/loreward-entry-store";

const mocked = db as unknown as {
  wikiArticle: { findFirst: jest.Mock };
  lorewardEntry: ReturnType<typeof entryStore>;
  lorewardUserStats: { upsert: jest.Mock };
};

type ParsedEntry = ReturnType<typeof parseOOLPage>[number];

let rows: StoredEntry[];

function store(initial: StoredEntry[]) {
  rows = initial;
  Object.assign(mocked.lorewardEntry, entryStore(rows));
}

const fromPage = (over: Partial<ParsedEntry> = {}): ParsedEntry => ({
  date: "2026-08-24",
  type: "weekly",
  winnerUser: "Urcea",
  winnerPage: "Isurians",
  runnerUpUser: null,
  runnerUpPage: null,
  ...over,
});

/** The W13 the bot stored: the Monday-start week of 23 March, won by Rumahoki. */
const botW13 = () =>
  storedEntry({
    id: "w13",
    type: "weekly",
    date: "2026-W13",
    dateStart: "2026-03-23",
    dateEnd: "2026-03-29",
    winnerUser: "Rumahoki",
    winnerPage: "Rumahoki's page",
  });

const ANOTHER_WEEK =
  "[Lorewards] OOL week 2026-03-22 is stored as another week (2026-W13): not written";

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
  jest.spyOn(console, "log").mockImplementation(() => undefined);
  mocked.wikiArticle.findFirst.mockResolvedValue({ wikitext: "the OOL page" });
  jest.mocked(parseOOLPage).mockReturnValue([]);
  jest.mocked(settleLorewardPlaces).mockResolvedValue(NOTHING_SETTLED);
  store([]);
});

describe("backfillCurrentYearFromOOL", () => {
  it("stores a new weekly under its ISO week, with its range", async () => {
    jest.mocked(parseOOLPage).mockReturnValue([fromPage()]);

    await backfillCurrentYearFromOOL();

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      date: "2026-W35",
      type: "weekly",
      dateStart: "2026-08-24",
      dateEnd: "2026-08-30",
      winnerUser: "Urcea",
      winnerPage: "Isurians",
    });
  });

  it("writes nothing for a page week that is another contest on the same ISO week", async () => {
    store([botW13()]);
    jest
      .mocked(parseOOLPage)
      .mockReturnValue([fromPage({ date: "2026-03-22", winnerUser: "Urcea" })]);

    const result = await backfillCurrentYearFromOOL();

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ winnerUser: "Rumahoki", dateStart: "2026-03-23" });
    expect(console.warn).toHaveBeenCalledWith(ANOTHER_WEEK);
    expect(result.entries).toBe(0);
    expect(settleLorewardPlaces).toHaveBeenCalledWith({ entryIds: [] });
  });

  it("skips a weekly whose date is not a day", async () => {
    jest.mocked(parseOOLPage).mockReturnValue([fromPage({ date: "2026-02-30" })]);

    expect((await backfillCurrentYearFromOOL()).entries).toBe(0);
    expect(rows).toHaveLength(0);
  });

  it("settles exactly the entries it wrote", async () => {
    store([storedEntry({ id: "d1", winnerUser: "Bo" })]);
    jest
      .mocked(parseOOLPage)
      .mockReturnValue([
        fromPage({ type: "daily", date: "2026-10-16", winnerUser: "Amy" }),
        fromPage(),
        fromPage({ type: "daily", date: "2026-10-17", winnerUser: null }),
      ]);
    const settled = { minted: 1, granted: 1, paid: 2, refused: 0, payoutsEnabled: true };
    jest.mocked(settleLorewardPlaces).mockResolvedValue(settled);

    expect(await backfillCurrentYearFromOOL()).toEqual({ entries: 2, settled });
    expect(settleLorewardPlaces).toHaveBeenCalledTimes(1);
    expect(settleLorewardPlaces).toHaveBeenCalledWith({ entryIds: ["d1", "new-2"] });
    expect(rows[0]).toMatchObject({ winnerUser: "Amy" });
    // The names it stored are recomputed
    expect(mocked.lorewardUserStats.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { username: "Urcea" } })
    );
  });
});

describe("syncFromOOLPages", () => {
  it("keeps a Sunday-start history week's first day under its ISO week", async () => {
    jest.mocked(parseOOLPage).mockReturnValue([fromPage({ date: "2023-01-01" })]);

    expect(await syncFromOOLPages()).toBe(1);

    expect(jest.mocked(parseOOLPage)).toHaveBeenCalledWith("the OOL page", 2023);
    expect(rows[0]).toMatchObject({
      date: "2023-W01",
      type: "weekly",
      dateStart: "2023-01-01",
      dateEnd: "2023-01-07",
      winnerUser: "Urcea",
    });
  });

  it("writes nothing over another week stored on the same ISO key", async () => {
    store([botW13()]);
    jest.mocked(parseOOLPage).mockReturnValue([fromPage({ date: "2026-03-22" })]);

    expect(await syncFromOOLPages()).toBe(0);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ winnerUser: "Rumahoki" });
    expect(console.warn).toHaveBeenCalledWith(ANOTHER_WEEK);
  });
});

describe("fullSync", () => {
  it("settles every place and returns what it settled", async () => {
    const settled = { minted: 3, granted: 2, paid: 1, refused: 0, payoutsEnabled: true };
    jest.mocked(settleLorewardPlaces).mockResolvedValue(settled);

    expect(await fullSync()).toEqual({ members: 0, oolEntries: 0, users: 0, settled });
    expect(settleLorewardPlaces).toHaveBeenCalledTimes(1);
    expect(settleLorewardPlaces).toHaveBeenCalledWith();
  });
});
