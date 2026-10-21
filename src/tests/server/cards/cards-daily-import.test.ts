/** @jest-environment node */
/**
 * The daily lore import queues a job per switched-on wiki, once a day; nothing goes live (cards refresh spec §2.1).
 * A wiki whose draw fails queues nothing and fails the cron run by name, after the other wikis are queued
 * (spike-sources.md, rule 5).
 */
jest.mock("~/server/modules/cards/cards.import-jobs", () => ({ createImportJob: jest.fn() }));
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    systemConfig: { findMany: jest.fn() },
    cardImportJob: { findFirst: jest.fn() },
    $queryRaw: jest.fn(),
  },
}));
jest.mock("~/lib/cards/lore-card-discovery", () => ({
  loreCardDiscovery: { fetchRandomArticlesWithImages: jest.fn() },
}));
import { createImportJob } from "~/server/modules/cards/cards.import-jobs";
import { queueDailyImports } from "~/server/modules/cards/cards.daily-import";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const create = jest.mocked(createImportJob);
const setting = (key: string, enabled: boolean, count: number) => ({
  key,
  value: JSON.stringify({ enabled, count }),
});
beforeEach(() => jest.clearAllMocks());

describe("queueDailyImports", () => {
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
    const run = await queueDailyImports(db as never, random);
    expect(random).toHaveBeenCalledTimes(5);
    expect(random).toHaveBeenCalledWith(90, "ixwiki");
    expect(create).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        source: "ixwiki",
        label: "Daily IxWiki import",
        titles: ["Elm", "Oak", "Ash"],
      })
    );
    expect(run.queued).toEqual({ ixwiki: 3 });
  });
  it("queues one batch a day: a wiki with a daily job since UTC midnight is skipped", async () => {
    const db = createMockPrisma({ $queryRaw: jest.fn().mockResolvedValue([]) });
    db.systemConfig.findMany.mockResolvedValue([]);
    db.cardImportJob.findFirst.mockImplementation(
      async ({ where }: { where: { source: string } }) =>
        where.source === "ixwiki" ? { id: "job_today" } : null
    );
    const random = jest.fn().mockResolvedValue(["Elm"]);
    const run = await queueDailyImports(db as never, random, new Date("2026-10-17T02:00:05Z"));

    expect(db.cardImportJob.findFirst).toHaveBeenCalledWith({
      where: {
        kind: "DAILY",
        source: "ixwiki",
        createdAt: { gte: new Date("2026-10-17T00:00:00Z") },
      },
      select: { id: true },
    });
    expect(random).toHaveBeenCalledTimes(5);
    expect(random.mock.calls.every(([, source]) => source === "iiwiki")).toBe(true);
    expect(run).toEqual({ queued: { iiwiki: 1 }, failed: {} });
  });
});
