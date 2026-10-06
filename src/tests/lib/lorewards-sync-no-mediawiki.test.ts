/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories rely on the ambient global.
//
// Plan 418 (A15): the Lorewards sync reads the OOL pages from Postgres alone. A page WikiOS does not hold is
// skipped (there is no MediaWiki fallback) once WikiOS v1 is on; before the cutover it is read from MediaWiki.
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    wikiArticle: { findFirst: jest.fn() },
    lorewardEntry: { findUnique: jest.fn(), create: jest.fn(), upsert: jest.fn() },
    lorewardUserStats: { upsert: jest.fn() },
  },
}));
jest.mock("~/lib/vault/vault-bonus", () => ({
  getBonusConfig: jest.fn().mockResolvedValue({ enabled: false, loreward: 0 }),
  grantBonus: jest.fn(),
}));

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { db } from "~/server/db";
import { syncFromMainOOLPage, syncFromOOLPages } from "~/lib/lorewards/sync";
import { installFetchGuard, type FetchGuard } from "~/tests/helpers/fetch-guard";

const mocked = db as unknown as {
  wikiArticle: { findFirst: jest.Mock };
  lorewardUserStats: { upsert: jest.Mock };
};

let guard: FetchGuard;
beforeEach(() => {
  jest.clearAllMocks();
  guard = installFetchGuard();
  mocked.wikiArticle.findFirst.mockResolvedValue(null);
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
  jest.spyOn(console, "log").mockImplementation(() => undefined);
});
afterEach(() => guard.restore());

describe("the OOL pages", () => {
  it("are read from the WikiOS article, never from MediaWiki", async () => {
    mocked.wikiArticle.findFirst.mockResolvedValue({
      wikitext: "{| class=wikitable\n|-\n! Member !! Score\n|-\n| [[User:Kir]] || 100\n|}",
    });

    await syncFromMainOOLPage();

    expect(mocked.wikiArticle.findFirst.mock.calls[0]?.[0].where).toMatchObject({
      source: "ixwiki",
      OR: expect.arrayContaining([{ title: "IxWiki:OOL" }, { title: "OOL" }]),
    });
    expect(guard.calls()).toEqual([]);
  });

  it("are skipped when WikiOS holds none: the sync does nothing and asks no wiki", async () => {
    expect(await syncFromMainOOLPage()).toBe(0);
    expect(await syncFromOOLPages()).toBe(0);

    expect(mocked.lorewardUserStats.upsert).not.toHaveBeenCalled();
    expect(guard.calls()).toEqual([]);
  });

  it("are skipped when the read fails, without asking a wiki", async () => {
    mocked.wikiArticle.findFirst.mockRejectedValue(new Error("db down"));

    expect(await syncFromMainOOLPage()).toBe(0);
    expect(guard.calls()).toEqual([]);
  });

  it("are skipped when the page holds no text (a stub), without asking a wiki", async () => {
    mocked.wikiArticle.findFirst.mockResolvedValue({ wikitext: "" });

    expect(await syncFromMainOOLPage()).toBe(0);
    expect(guard.calls()).toEqual([]);
  });

  it("before the WikiOS v1 cutover, a page WikiOS lacks is read from MediaWiki, as before v1", async () => {
    const was = process.env.WIKIOS_V1_ENABLED;
    process.env.WIKIOS_V1_ENABLED = "";
    try {
      expect(await syncFromMainOOLPage()).toBe(0); // the guard's MediaWiki answers throw: nothing to sync
      expect(guard.ixwikiCalls()).toHaveLength(1);
      expect(guard.ixwikiCalls()[0]).toContain("titles=IxWiki%3AOOL");
    } finally {
      process.env.WIKIOS_V1_ENABLED = was;
    }
  });
});
