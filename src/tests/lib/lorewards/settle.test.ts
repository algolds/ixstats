/** @jest-environment node */
/**
 * The settle step: mint the missing trophy cards, give the waiting ones, then pay the unpaid places, over every place
 * or a scope of entries. A step that throws counts 0 and the next step still runs.
 */
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: { lorewardEntry: { findMany: jest.fn() } },
}));
jest.mock("~/lib/lorewards/trophy-cards", () => ({
  mintTrophyCards: jest.fn(),
  grantUnownedTrophyCards: jest.fn(),
}));
jest.mock("~/lib/lorewards/payout", () => ({ grantLorewardBonuses: jest.fn() }));

import { beforeEach, describe, expect, it } from "@jest/globals";
import { db } from "~/server/db";
import { grantLorewardBonuses } from "~/lib/lorewards/payout";
import { grantUnownedTrophyCards, mintTrophyCards } from "~/lib/lorewards/trophy-cards";
import { entryIdsOfName, NOTHING_SETTLED, settleLorewardPlaces } from "~/lib/lorewards/settle";

const findMany = db.lorewardEntry.findMany as unknown as jest.Mock;

/**
 * The card steps each ran on `db` with `ids`; `db` is checked by identity, as a deep PrismaClient compare overflows the
 * type checker.
 */
function expectCardSteps(ids: string[] | undefined): void {
  for (const calls of [
    jest.mocked(mintTrophyCards).mock.calls,
    jest.mocked(grantUnownedTrophyCards).mock.calls,
  ]) {
    expect(calls[0]?.[0] === db).toBe(true);
    expect(calls[0]?.[1]).toEqual(ids);
  }
}

beforeEach(() => {
  jest.mocked(mintTrophyCards).mockReset().mockResolvedValue({ minted: 1 });
  jest.mocked(grantUnownedTrophyCards).mockReset().mockResolvedValue({ granted: 0 });
  jest
    .mocked(grantLorewardBonuses)
    .mockReset()
    .mockResolvedValue({ paid: 0, refused: 0, enabled: true });
  findMany.mockReset().mockResolvedValue([]);
});

describe("settleLorewardPlaces", () => {
  it("mints, grants, then pays over the scope, and keeps going when a step throws", async () => {
    jest.mocked(mintTrophyCards).mockRejectedValue(new Error("mint down"));
    jest.mocked(grantUnownedTrophyCards).mockResolvedValue({ granted: 2 });
    jest.mocked(grantLorewardBonuses).mockResolvedValue({ paid: 3, refused: 1, enabled: true });
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);

    expect(await settleLorewardPlaces({ entryIds: ["e1"] })).toEqual({
      minted: 0,
      granted: 2,
      paid: 3,
      refused: 1,
      payoutsEnabled: true,
    });
    expectCardSteps(["e1"]);
    expect(grantLorewardBonuses).toHaveBeenCalledWith({ entryIds: ["e1"] });
    expect(error).toHaveBeenCalledWith("[Lorewards] settle mint failed:", expect.any(Error));
    error.mockRestore();
  });

  it("runs the steps in order: mint, then grant, then pay", async () => {
    await settleLorewardPlaces();
    const order = [mintTrophyCards, grantUnownedTrophyCards, grantLorewardBonuses].map(
      (step) => jest.mocked(step).mock.invocationCallOrder[0]!
    );
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("settles every place with no scope", async () => {
    jest.mocked(grantLorewardBonuses).mockResolvedValue({ paid: 0, refused: 0, enabled: false });
    expect(await settleLorewardPlaces()).toEqual({
      minted: 1,
      granted: 0,
      paid: 0,
      refused: 0,
      payoutsEnabled: false,
    });
    expectCardSteps(undefined);
    expect(grantLorewardBonuses).toHaveBeenCalledWith({});
  });

  it("counts a failed grant or payment as 0, and logs which step failed", async () => {
    jest.mocked(grantUnownedTrophyCards).mockRejectedValue(new Error("grant down"));
    jest.mocked(grantLorewardBonuses).mockRejectedValue(new Error("pay down"));
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);

    expect(await settleLorewardPlaces()).toEqual({ ...NOTHING_SETTLED, minted: 1 });
    expect(error).toHaveBeenCalledWith("[Lorewards] settle grant failed:", expect.any(Error));
    expect(error).toHaveBeenCalledWith("[Lorewards] settle pay failed:", expect.any(Error));
    error.mockRestore();
  });

  it("does nothing for an empty scope", async () => {
    expect(await settleLorewardPlaces({ entryIds: [] })).toEqual(NOTHING_SETTLED);
    expect(NOTHING_SETTLED).toEqual({
      minted: 0,
      granted: 0,
      paid: 0,
      refused: 0,
      payoutsEnabled: true,
    });
    expect(mintTrophyCards).not.toHaveBeenCalled();
    expect(grantUnownedTrophyCards).not.toHaveBeenCalled();
    expect(grantLorewardBonuses).not.toHaveBeenCalled();
    expect(findMany).not.toHaveBeenCalled();
  });
});

describe("entryIdsOfName", () => {
  it("finds a name's approved contest entries under every spelling, in either place", async () => {
    findMany.mockResolvedValue([{ id: "e1" }, { id: "e2" }]);

    expect(await entryIdsOfName(db, "Foo bar")).toEqual(["e1", "e2"]);
    const spellings = { in: ["Foo bar", "Foo_bar"] };
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: "approved",
          type: { in: ["daily", "weekly", "monthly"] },
          OR: [{ winnerUser: spellings }, { runnerUpUser: spellings }],
        },
        take: 500,
      })
    );
  });

  it("reads past one page", async () => {
    const page = Array.from({ length: 500 }, (_, i) => ({ id: `e${String(i).padStart(3, "0")}` }));
    findMany.mockResolvedValueOnce(page).mockResolvedValueOnce([{ id: "last" }]);
    expect(await entryIdsOfName(db, "Foo_bar")).toHaveLength(501);
    expect(findMany).toHaveBeenCalledTimes(2);
  });
});
