/** @jest-environment node */
/** Cards refresh §3: the old inventory and library procedures are gone (the trade builder lists tradeables itself). */
jest.mock("~/server/db", () => ({ db: {} }));

import { cardsRouter } from "~/server/api/routers/cards";

describe("cards router security", () => {
  it("no longer has a junk procedure, the old card library, or the old inventory reads", () => {
    // Explore's catalogue keeps the library's promise: never a retired or pending card (explore.test.ts).
    const procedures = Object.keys(cardsRouter._def.procedures);
    expect(procedures).toContain("listMine");
    for (const gone of [
      "junkCards",
      "getNSCards",
      "getNSLibraryStats",
      "getMyCards",
      "getUserCards",
    ]) {
      expect(procedures).not.toContain(gone);
    }
  });
});
