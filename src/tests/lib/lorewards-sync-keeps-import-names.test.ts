/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories rely on the ambient global.
//
// The current-year OOL sync overwrites each entry's names with the page's. A `wikios>` name pays only the WikiOS
// account behind its edits, while a plain name pays whoever verifies that MediaWiki account, so the page must never
// turn a stored `wikios>` name into a plain one.
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    wikiArticle: { findFirst: jest.fn() },
    lorewardEntry: { findMany: jest.fn(), upsert: jest.fn() },
    lorewardUserStats: { upsert: jest.fn() },
  },
}));
jest.mock("~/lib/lorewards/ool-parser", () => ({
  OOL_YEARS: [],
  parseActiveMembers: jest.fn(() => []),
  parseAnnualWinners: jest.fn(() => []),
  parseOOLPage: jest.fn(),
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { db } from "~/server/db";
import { parseOOLPage } from "~/lib/lorewards/ool-parser";
import { syncCurrentWinners } from "~/lib/lorewards/sync";

interface Stored {
  date: string;
  type: string;
  winnerUser: string | null;
  runnerUpUser: string | null;
}

const mocked = db as unknown as {
  wikiArticle: { findFirst: jest.Mock };
  lorewardEntry: { findMany: jest.Mock; upsert: jest.Mock };
  lorewardUserStats: { upsert: jest.Mock };
};

const fromPage = (winnerUser: string, runnerUpUser: string | null = null) => ({
  date: "2026-10-16",
  type: "daily" as const,
  winnerUser,
  winnerPage: "Seneca front",
  runnerUpUser,
  runnerUpPage: null,
});

/** The stored entries; the sync asks for the `wikios>` ones, and `recomputeUserStats` for a name's places. */
function storing(rows: Stored[]) {
  mocked.lorewardEntry.findMany.mockImplementation(
    async ({ where }: { where: { OR: Array<{ winnerUser?: { startsWith?: string } }> } }) =>
      where.OR[0]?.winnerUser?.startsWith ? rows : []
  );
}

const updates = () =>
  mocked.lorewardEntry.upsert.mock.calls.map(
    ([args]: [{ update: { winnerUser: string | null; runnerUpUser: string | null } }]) => ({
      winnerUser: args.update.winnerUser,
      runnerUpUser: args.update.runnerUpUser,
    })
  );

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
  jest.spyOn(console, "log").mockImplementation(() => undefined);
  mocked.wikiArticle.findFirst.mockResolvedValue({ wikitext: "the OOL page" });
});

describe("syncCurrentWinners", () => {
  it("keeps a stored wikios> name when the OOL page gives the plain label", async () => {
    storing([
      {
        date: "2026-10-16",
        type: "daily",
        winnerUser: "wikios>Kir Republic",
        runnerUpUser: "wikios>Tierrador",
      },
    ]);
    jest.mocked(parseOOLPage).mockReturnValue([fromPage("Kir Republic", null)]);

    await syncCurrentWinners(true);

    expect(updates()).toEqual([
      { winnerUser: "wikios>Kir Republic", runnerUpUser: "wikios>Tierrador" },
    ]);
    // The stats are recomputed under the name the entry keeps.
    expect(mocked.lorewardEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ winnerUser: "wikios>Kir Republic" }, { runnerUpUser: "wikios>Kir Republic" }],
        }),
      })
    );
  });

  it("still takes the page's plain names, and its own wikios> names, everywhere else", async () => {
    storing([
      { date: "2026-10-16", type: "daily", winnerUser: "wikios>Kir Republic", runnerUpUser: "Bo" },
    ]);
    jest.mocked(parseOOLPage).mockReturnValue([fromPage("wikios>Kir_Republic", "Urcea")]);

    await syncCurrentWinners(true);

    expect(updates()).toEqual([{ winnerUser: "wikios>Kir_Republic", runnerUpUser: "Urcea" }]);
  });
});
