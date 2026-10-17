/** @jest-environment node */
/** The daily lore import queues a job per switched-on wiki; nothing goes live (cards refresh spec §2.1). */
jest.mock("~/server/modules/cards/cards.import-jobs", () => ({ createImportJob: jest.fn() }));
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: { systemConfig: { findMany: jest.fn() } },
}));
jest.mock("~/lib/cards/lore-card-discovery", () => ({
  loreCardDiscovery: { fetchRandomArticlesWithImages: jest.fn() },
}));

import { db as appDb } from "~/server/db";
import { loreCardDiscovery } from "~/lib/cards/lore-card-discovery";
import { createImportJob } from "~/server/modules/cards/cards.import-jobs";
import {
  queueDailyImports,
  queueDailyLoreImports,
} from "~/server/modules/cards/cards.daily-import";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const create = jest.mocked(createImportJob);
const setting = (key: string, enabled: boolean, count: number) => ({
  key,
  value: JSON.stringify({ enabled, count }),
});

describe("queueDailyImports", () => {
  beforeEach(() => jest.clearAllMocks());

  it("queues image-required jobs for the switched-on wikis, leaving out pages with a card", async () => {
    const db = createMockPrisma({
      $queryRaw: jest.fn().mockResolvedValue([{ key: "carded page" }]),
    });
    db.systemConfig.findMany.mockResolvedValue([
      setting("card_daily_import_ixwiki", false, 20),
      setting("card_daily_import_iiwiki", true, 2),
    ]);
    const random = jest
      .fn()
      .mockResolvedValue(["Carded_page", "Fresh one", "Fresh two", "Fresh three"]);
    const queued = await queueDailyImports(db as never, random);
    expect(random).toHaveBeenCalledTimes(1);
    expect(random).toHaveBeenCalledWith(6, "iiwiki");
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(db, {
      source: "iiwiki",
      kind: "DAILY",
      label: "Daily IIWiki import",
      titles: ["Fresh one", "Fresh two"],
      requestedBy: null,
      requireImage: true,
    });
    expect(queued).toEqual({ iiwiki: 2 });
  });

  it("draws again while it has too few fresh pages, at most five times, counting a page once", async () => {
    const db = createMockPrisma({ $queryRaw: jest.fn().mockResolvedValue([]) });
    db.systemConfig.findMany.mockResolvedValue([
      setting("card_daily_import_ixwiki", true, 30),
      setting("card_daily_import_iiwiki", false, 20),
    ]);
    const random = jest
      .fn()
      .mockResolvedValueOnce(["Elm", "Oak"])
      .mockResolvedValue(["elm", "Ash"]);
    const queued = await queueDailyImports(db as never, random);
    expect(random).toHaveBeenCalledTimes(5);
    expect(random).toHaveBeenCalledWith(50, "ixwiki");
    expect(create).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        source: "ixwiki",
        label: "Daily IxWiki import",
        titles: ["Elm", "Oak", "Ash"],
      })
    );
    expect(queued).toEqual({ ixwiki: 3 });
  });

  it("queues nothing for a wiki that gives no pages, or one set to zero a day", async () => {
    const db = createMockPrisma({ $queryRaw: jest.fn().mockResolvedValue([]) });
    db.systemConfig.findMany.mockResolvedValue([
      setting("card_daily_import_ixwiki", true, 0),
      setting("card_daily_import_iiwiki", true, 20),
    ]);
    const random = jest.fn().mockResolvedValue([]);
    const queued = await queueDailyImports(db as never, random);
    expect(random).toHaveBeenCalledTimes(1);
    expect(random).toHaveBeenCalledWith(50, "iiwiki");
    expect(create).not.toHaveBeenCalled();
    expect(queued).toEqual({ iiwiki: 0 });
  });

  it("goes on to the next wiki when one fails", async () => {
    const db = createMockPrisma({ $queryRaw: jest.fn().mockResolvedValue([]) });
    db.systemConfig.findMany.mockResolvedValue([]);
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const failure = new Error("ixwiki down");
    const random = jest.fn().mockRejectedValueOnce(failure).mockResolvedValue(["Elm"]);
    const queued = await queueDailyImports(db as never, random);
    expect(queued).toEqual({ ixwiki: 0, iiwiki: 1 });
    expect(error).toHaveBeenCalledWith("[Daily card import] ixwiki failed:", failure);
    error.mockRestore();
  });
});

describe("queueDailyLoreImports", () => {
  it("queues against the app's database with the wikis' random image-bearing pages", async () => {
    jest.mocked(appDb.systemConfig.findMany).mockResolvedValue([] as never);
    const random = jest.mocked(loreCardDiscovery.fetchRandomArticlesWithImages);
    random.mockResolvedValue([]);
    await expect(queueDailyLoreImports()).resolves.toEqual({ ixwiki: 0, iiwiki: 0 });
    expect(random).toHaveBeenCalledWith(50, "ixwiki");
    expect(random).toHaveBeenCalledWith(50, "iiwiki");
  });
});
