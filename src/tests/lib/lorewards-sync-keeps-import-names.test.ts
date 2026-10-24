/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories rely on the ambient global.
//
// The OOL sync writes the page's names over stored entries. A `wikios>` name pays only the WikiOS account behind its
// edits, while a plain one pays whoever verifies that MediaWiki account, so the page never turns a stored `wikios>`
// name (or its page) plain. And a weekly is written over the row of its ISO week, never stored a second time under its
// first day.
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    wikiArticle: { findFirst: jest.fn() },
    lorewardEntry: {},
    lorewardUserStats: { upsert: jest.fn() },
  },
}));
jest.mock("~/lib/lorewards/ool-parser", () => ({
  OOL_YEARS: [2026],
  parseActiveMembers: jest.fn(() => []),
  parseAnnualWinners: jest.fn(() => []),
  parseOOLPage: jest.fn(),
}));
jest.mock("~/lib/lorewards/settle", () => ({
  settleLorewardPlaces: jest.fn(async () => ({
    minted: 0,
    granted: 0,
    paid: 0,
    refused: 0,
    payoutsEnabled: true,
  })),
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { db } from "~/server/db";
import { parseOOLPage } from "~/lib/lorewards/ool-parser";
import { backfillCurrentYearFromOOL } from "~/lib/lorewards/sync";
import { entryStore, storedEntry, type StoredEntry } from "~/tests/helpers/loreward-entry-store";

const mocked = db as unknown as {
  wikiArticle: { findFirst: jest.Mock };
  lorewardEntry: ReturnType<typeof entryStore>;
  lorewardUserStats: { upsert: jest.Mock };
};

let rows: StoredEntry[];

const fromPage = (over: Partial<ReturnType<typeof parseOOLPage>[number]> = {}) => ({
  date: "2026-10-16",
  type: "daily" as const,
  winnerUser: "Kir Republic",
  winnerPage: "Other page",
  runnerUpUser: null,
  runnerUpPage: null,
  ...over,
});

/** The weekly of 12 October as the bot stores it: keyed `2026-W42`, with its range. */
const isoWeekly = (over: Partial<StoredEntry> = {}) =>
  storedEntry({
    id: "w-state",
    type: "weekly",
    date: "2026-W42",
    dateStart: "2026-10-12",
    dateEnd: "2026-10-18",
    winnerUser: "Kir Republic",
    ...over,
  });

const places = (row: StoredEntry | undefined) =>
  row && {
    winnerUser: row.winnerUser,
    winnerPage: row.winnerPage,
    runnerUpUser: row.runnerUpUser,
    runnerUpPage: row.runnerUpPage,
  };

function store(initial: StoredEntry[]) {
  rows = initial;
  Object.assign(mocked.lorewardEntry, entryStore(rows));
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
  jest.spyOn(console, "log").mockImplementation(() => undefined);
  mocked.wikiArticle.findFirst.mockResolvedValue({ wikitext: "the OOL page" });
});

describe("backfillCurrentYearFromOOL", () => {
  it("keeps a stored wikios> name and its page when the OOL page gives the plain label", async () => {
    store([
      storedEntry({
        id: "d1",
        winnerUser: "wikios>Kir Republic",
        winnerPage: "Seneca front",
        runnerUpUser: "wikios>Tierrador",
        runnerUpPage: "Isurians",
      }),
    ]);
    jest.mocked(parseOOLPage).mockReturnValue([fromPage()]);

    await backfillCurrentYearFromOOL();

    expect(places(rows[0])).toEqual({
      winnerUser: "wikios>Kir Republic",
      winnerPage: "Seneca front",
      runnerUpUser: "wikios>Tierrador",
      runnerUpPage: "Isurians",
    });
    // The stats are recomputed under the name the entry keeps.
    expect(mocked.lorewardUserStats.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { username: "wikios>Kir Republic" } })
    );
  });
  it("still takes the page's plain names, and its own wikios> names, everywhere else", async () => {
    store([
      storedEntry({
        id: "d1",
        winnerUser: "wikios>Kir Republic",
        winnerPage: "Seneca front",
        runnerUpUser: "Bo",
      }),
    ]);
    jest.mocked(parseOOLPage).mockReturnValue([
      fromPage({
        winnerUser: "wikios>Kir_Republic",
        winnerPage: "Tide charts",
        runnerUpUser: "Urcea",
        runnerUpPage: "Isurians",
      }),
    ]);

    await backfillCurrentYearFromOOL();

    expect(places(rows[0])).toEqual({
      winnerUser: "wikios>Kir_Republic",
      winnerPage: "Tide charts",
      runnerUpUser: "Urcea",
      runnerUpPage: "Isurians",
    });
  });

  it("writes a weekly over the stored ISO-keyed row of its week", async () => {
    store([isoWeekly()]);
    jest.mocked(parseOOLPage).mockReturnValue([
      fromPage({
        type: "weekly",
        date: "2026-10-12",
        winnerUser: "Urcea",
        winnerPage: "Isurians",
      }),
    ]);

    await backfillCurrentYearFromOOL();

    expect(rows).toHaveLength(1);
    expect(places(rows[0])).toMatchObject({ winnerUser: "Urcea", winnerPage: "Isurians" });
    expect(mocked.lorewardEntry.upsert).not.toHaveBeenCalled();
  });
});
