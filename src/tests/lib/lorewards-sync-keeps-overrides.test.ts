/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories rely on the ambient global.
//
// An admin override of a Loreward place (cards refresh §2.4) marks the entries it writes (`overriddenAt`), and its
// trophy moves with it. No sync writes those places again: not the bot's state file, not the current year's OOL page,
// not the OOL backfill's write over a state-keyed twin. Everything else still syncs.
jest.mock("fs", () => {
  const actual = jest.requireActual<typeof import("fs")>("fs");
  return { ...actual, readFileSync: jest.fn(actual.readFileSync) };
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

const OVERRIDDEN = new Date("2026-10-17T12:00:00.000Z");
let rows: StoredEntry[];

function store(initial: StoredEntry[]) {
  rows = initial;
  Object.assign(mocked.lorewardEntry, entryStore(rows));
}

/** The bot's state file the sync reads, or none (the read throws). */
function stateFile(state: object | null) {
  const actual = jest.requireActual<typeof import("fs")>("fs");
  (fs.readFileSync as unknown as jest.Mock).mockImplementation(
    (file: string, ...rest: [BufferEncoding]) => {
      if (!String(file).endsWith("lorewards-state.json")) return actual.readFileSync(file, ...rest);
      if (!state) throw new Error("no state file in tests");
      return JSON.stringify(state);
    }
  );
}

type ParsedEntry = ReturnType<typeof parseOOLPage>[number];

const fromPage = (over: Partial<ParsedEntry> = {}) => ({
  date: "2026-10-16",
  type: "daily" as ParsedEntry["type"],
  winnerUser: "Amy",
  winnerPage: "Amy's page",
  runnerUpUser: "Bee",
  runnerUpPage: "Bee's page",
  ...over,
});

/** The daily of 16 October as an override left it: Cy and Dee, marked. */
const overriddenDaily = (over: Partial<StoredEntry> = {}) =>
  storedEntry({
    id: "d1",
    winnerUser: "Cy",
    winnerPage: "Cy's page",
    runnerUpUser: "Dee",
    runnerUpPage: "Dee's page",
    winnerBytes: 42,
    overriddenAt: OVERRIDDEN,
    ...over,
  });

/** The state file's daily of 16 October, naming Amy and Bee. */
const stateDaily = {
  dailyResults: {
    "2026-10-16": {
      status: "approved",
      winner: { user: "Amy", page: "Amy's page", score: 90, bytesAdded: 9000 },
      runnerUp: { user: "Bee", page: "Bee's page", score: 80, bytesAdded: 8000 },
      editCount: 12,
    },
  },
};

const places = (row: StoredEntry | undefined) =>
  row && {
    winnerUser: row.winnerUser,
    winnerPage: row.winnerPage,
    runnerUpUser: row.runnerUpUser,
    runnerUpPage: row.runnerUpPage,
  };

const CY_AND_DEE = {
  winnerUser: "Cy",
  winnerPage: "Cy's page",
  runnerUpUser: "Dee",
  runnerUpPage: "Dee's page",
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
  jest.spyOn(console, "log").mockImplementation(() => undefined);
  mocked.wikiArticle.findFirst.mockResolvedValue({ wikitext: "the OOL page" });
  jest.mocked(parseOOLPage).mockReturnValue([]);
  stateFile(null);
});

describe("the state file", () => {
  it("keeps an override's places, scores and bytes, and still writes the rest of the result", async () => {
    store([overriddenDaily()]);
    stateFile(stateDaily);

    await syncCurrentWinners(true);

    expect(places(rows[0])).toEqual(CY_AND_DEE);
    expect(rows[0]).toMatchObject({ winnerBytes: 42, editCount: 12, overriddenAt: OVERRIDDEN });
    expect(mocked.lorewardEntry.findMany).toHaveBeenCalledWith({
      where: { overriddenAt: { not: null } },
      select: { date: true, type: true },
    });
  });

  it("keeps the winner an override gave a state-keyed weekly", async () => {
    store([
      storedEntry({
        id: "w-state",
        type: "weekly",
        date: "2026-W42",
        dateStart: "2026-10-12",
        winnerUser: "Cy",
        winnerPage: "Cy's page",
        overriddenAt: OVERRIDDEN,
      }),
    ]);
    stateFile({
      weeklyResults: {
        "2026-W42": {
          winner: { user: "Amy", page: "Amy's page", score: 1, bytesAdded: 1 },
          weekStart: "2026-10-12",
          weekEnd: "2026-10-18",
        },
      },
    });

    await syncCurrentWinners(true);

    expect(rows[0]).toMatchObject({
      winnerUser: "Cy",
      winnerPage: "Cy's page",
      dateEnd: "2026-10-18",
    });
  });

  it("still writes the places of an entry no override wrote", async () => {
    store([overriddenDaily({ overriddenAt: null })]);
    stateFile(stateDaily);

    await syncCurrentWinners(true);

    expect(places(rows[0])).toEqual({
      winnerUser: "Amy",
      winnerPage: "Amy's page",
      runnerUpUser: "Bee",
      runnerUpPage: "Bee's page",
    });
    expect(rows[0]).toMatchObject({ winnerBytes: 9000 });
  });
});

describe("the current year's OOL page", () => {
  it("keeps an override's places", async () => {
    store([overriddenDaily()]);
    jest.mocked(parseOOLPage).mockReturnValue([fromPage()]);

    await syncCurrentWinners(true);

    expect(places(rows[0])).toEqual(CY_AND_DEE);
  });

  it("keeps an override's places on the state-keyed twin it writes a weekly over", async () => {
    store([
      storedEntry({
        id: "w-state",
        type: "weekly",
        date: "2026-W42",
        dateStart: "2026-10-12",
        ...CY_AND_DEE,
        overriddenAt: OVERRIDDEN,
      }),
    ]);
    jest.mocked(parseOOLPage).mockReturnValue([fromPage({ type: "weekly", date: "2026-10-12" })]);

    await syncCurrentWinners(true);

    expect(rows).toHaveLength(1);
    expect(places(rows[0])).toEqual(CY_AND_DEE);
  });

  it("still writes the places of an entry no override wrote", async () => {
    store([overriddenDaily({ overriddenAt: null })]);
    jest.mocked(parseOOLPage).mockReturnValue([fromPage()]);

    await syncCurrentWinners(true);

    expect(places(rows[0])).toMatchObject({ winnerUser: "Amy", runnerUpUser: "Bee" });
  });
});

describe("syncFromOOLPages", () => {
  it("keeps an override's places on the state-keyed twin it writes a weekly over", async () => {
    store([
      storedEntry({
        id: "w-state",
        type: "weekly",
        date: "2026-W42",
        dateStart: "2026-10-12",
        ...CY_AND_DEE,
        overriddenAt: OVERRIDDEN,
      }),
    ]);
    jest.mocked(parseOOLPage).mockReturnValue([fromPage({ type: "weekly", date: "2026-10-12" })]);

    await syncFromOOLPages();

    expect(rows).toHaveLength(1);
    expect(places(rows[0])).toEqual(CY_AND_DEE);
  });

  it("still writes a twin no override wrote", async () => {
    store([
      storedEntry({
        id: "w-state",
        type: "weekly",
        date: "2026-W42",
        dateStart: "2026-10-12",
        ...CY_AND_DEE,
      }),
    ]);
    jest.mocked(parseOOLPage).mockReturnValue([fromPage({ type: "weekly", date: "2026-10-12" })]);

    await syncFromOOLPages();

    expect(places(rows[0])).toMatchObject({ winnerUser: "Amy", runnerUpUser: "Bee" });
  });
});
