/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories rely on the ambient global.
jest.mock("~/server/db", () => ({ __esModule: true, db: { marker: "db" } }));
jest.mock("~/lib/lorewards/trophy-cards", () => ({
  mintTrophyCards: jest.fn().mockResolvedValue({ minted: 4 }),
  grantUnownedTrophyCards: jest.fn().mockResolvedValue({ granted: 2 }),
}));

import { describe, it, expect } from "@jest/globals";
import { db } from "~/server/db";
import { grantUnownedTrophyCards, mintTrophyCards } from "~/lib/lorewards/trophy-cards";
import { syncTrophyCards } from "~/lib/lorewards/sync";

describe("syncTrophyCards", () => {
  it("mints the new places first, then grants the unowned cards, and reports both", async () => {
    jest.spyOn(console, "log").mockImplementation(() => undefined);

    expect(await syncTrophyCards()).toEqual({ minted: 4, granted: 2 });

    expect(mintTrophyCards).toHaveBeenCalledWith(db);
    expect(grantUnownedTrophyCards).toHaveBeenCalledWith(db);
    expect(jest.mocked(mintTrophyCards).mock.invocationCallOrder[0]).toBeLessThan(
      jest.mocked(grantUnownedTrophyCards).mock.invocationCallOrder[0]!
    );
  });
});
