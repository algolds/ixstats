/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories rely on the ambient global.
//
// The OOL sync writes the page's names over stored entries. A `wikios>` name pays only the WikiOS account behind its
// edits, while a plain one pays whoever verifies that MediaWiki account, so the page never turns a stored `wikios>`
// name (or its page) plain. And a weekly or monthly the state file already holds under its own key is written in
// place, never stored a second time under its first day.
jest.mock("fs", () => {
  const actual = jest.requireActual<typeof import("fs")>("fs");
  return {
    ...actual,
    // The bot's state file is never read here: the sync's first step finds none.
    readFileSync: jest.fn((...args: Parameters<typeof actual.readFileSync>) => {
      if (String(args[0]).endsWith("lorewards-state.json"))
        throw new Error("no state file in tests");
      return actual.readFileSync(...args);
    }),
  };
});
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

import * as fs from "fs";
import { describe, it, expect, beforeEach } from "@jest/globals";
import { db } from "~/server/db";
import { parseOOLPage } from "~/lib/lorewards/ool-parser";
import { syncCurrentWinners, syncFromOOLPages } from "~/lib/lorewards/sync";
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

/** The weekly of 12 October as the state file stores it: keyed `2026-W42`, with its range. */
const stateWeekly = (over: Partial<StoredEntry> = {}) =>
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

describe("syncCurrentWinners", () => {
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

    await syncCurrentWinners(true);

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
    expect(jest.mocked(fs.readFileSync)).toHaveBeenCalledWith(
      expect.stringContaining("lorewards-state.json"),
      "utf-8"
    );
  });

  it("gives a kept wikios> name the page's page when it stored none", async () => {
    store([storedEntry({ id: "d1", winnerUser: "wikios>Kir Republic", winnerPage: null })]);
    jest.mocked(parseOOLPage).mockReturnValue([fromPage({ winnerPage: "Seneca front" })]);

    await syncCurrentWinners(true);

    expect(places(rows[0])).toMatchObject({
      winnerUser: "wikios>Kir Republic",
      winnerPage: "Seneca front",
    });
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

    await syncCurrentWinners(true);

    expect(places(rows[0])).toEqual({
      winnerUser: "wikios>Kir_Republic",
      winnerPage: "Tide charts",
      runnerUpUser: "Urcea",
      runnerUpPage: "Isurians",
    });
  });

  it("writes a weekly the state file holds under its own key, instead of storing a twin", async () => {
    store([stateWeekly()]);
    jest.mocked(parseOOLPage).mockReturnValue([
      fromPage({
        type: "weekly",
        date: "2026-10-12",
        winnerUser: "Urcea",
        winnerPage: "Isurians",
      }),
    ]);

    await syncCurrentWinners(true);

    expect(rows).toHaveLength(1);
    expect(places(rows[0])).toMatchObject({ winnerUser: "Urcea", winnerPage: "Isurians" });
    expect(mocked.lorewardEntry.upsert).not.toHaveBeenCalled();
  });

  it("keeps the state-keyed weekly's wikios> name and page when the page gives the plain label", async () => {
    store([stateWeekly({ winnerUser: "wikios>Kir Republic", winnerPage: "Seneca front" })]);
    jest
      .mocked(parseOOLPage)
      .mockReturnValue([fromPage({ type: "weekly", date: "2026-10-12", winnerPage: null })]);

    await syncCurrentWinners(true);

    expect(rows).toHaveLength(1);
    expect(places(rows[0])).toMatchObject({
      winnerUser: "wikios>Kir Republic",
      winnerPage: "Seneca front",
    });
  });
});

describe("syncFromOOLPages", () => {
  it("writes a weekly the state file holds under its own key, instead of inserting a twin", async () => {
    store([stateWeekly()]);
    jest
      .mocked(parseOOLPage)
      .mockReturnValue([fromPage({ type: "weekly", date: "2026-10-12", winnerUser: "Urcea" })]);

    await syncFromOOLPages();

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: "w-state", winnerUser: "Urcea" });
    expect(mocked.lorewardEntry.create).not.toHaveBeenCalled();
  });

  it("still inserts a contest it does not hold yet", async () => {
    store([]);
    jest.mocked(parseOOLPage).mockReturnValue([fromPage({ type: "weekly", date: "2026-10-12" })]);

    await syncFromOOLPages();

    expect(rows.map((row) => [row.type, row.date, row.winnerUser])).toEqual([
      ["weekly", "2026-10-12", "Kir Republic"],
    ]);
  });
});
