/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories rely on the ambient global.
//
// An admin override of a Loreward place (cards refresh §2.4) marks the entries it writes (`overriddenAt`), and its
// trophy moves with it. No sync writes those places again: not the current year's OOL backfill, not the history sync's
// write over a weekly's ISO-keyed row. Everything else still syncs. The mark is checked in the write itself, so an
// override that commits while a sync runs is never written over (nor then frozen by its own mark).
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
import { backfillCurrentYearFromOOL, syncFromOOLPages } from "~/lib/lorewards/sync";
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

/**
 * An override of `row` to Cy and Dee commits just before the sync's first write to the table, after every read the
 * sync made: the sync read the row unmarked.
 */
function overrideCommitsMidSync(row: StoredEntry) {
  const land = () => Object.assign(row, { ...CY_AND_DEE, overriddenAt: OVERRIDDEN });
  const { updateMany, upsert } = mocked.lorewardEntry;
  const [updatedMany, upserted] = [
    updateMany.getMockImplementation()!,
    upsert.getMockImplementation()!,
  ];
  updateMany.mockImplementationOnce(async (args) => {
    land();
    return updatedMany(args);
  });
  upsert.mockImplementationOnce(async (args) => {
    land();
    return upserted(args);
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
  jest.spyOn(console, "log").mockImplementation(() => undefined);
  mocked.wikiArticle.findFirst.mockResolvedValue({ wikitext: "the OOL page" });
  jest.mocked(parseOOLPage).mockReturnValue([]);
});

describe("backfillCurrentYearFromOOL", () => {
  it("keeps an override's places", async () => {
    store([overriddenDaily()]);
    jest.mocked(parseOOLPage).mockReturnValue([fromPage()]);

    await backfillCurrentYearFromOOL();

    expect(places(rows[0])).toEqual(CY_AND_DEE);
  });

  it("keeps an override that commits after the page's entries were read", async () => {
    store([overriddenDaily({ overriddenAt: null })]);
    jest.mocked(parseOOLPage).mockReturnValue([fromPage()]);
    overrideCommitsMidSync(rows[0]!);

    await backfillCurrentYearFromOOL();

    expect(places(rows[0])).toEqual(CY_AND_DEE);
  });
  it("keeps an override's places on the ISO-keyed row of its weekly", async () => {
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

    await backfillCurrentYearFromOOL();

    expect(rows).toHaveLength(1);
    expect(places(rows[0])).toEqual(CY_AND_DEE);
  });

  it("still writes the places of an entry no override wrote", async () => {
    store([overriddenDaily({ overriddenAt: null })]);
    jest.mocked(parseOOLPage).mockReturnValue([fromPage()]);

    await backfillCurrentYearFromOOL();

    expect(places(rows[0])).toMatchObject({ winnerUser: "Amy", runnerUpUser: "Bee" });
  });
});

describe("syncFromOOLPages", () => {
  it("keeps an override's places on the ISO-keyed row of its weekly", async () => {
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
});
