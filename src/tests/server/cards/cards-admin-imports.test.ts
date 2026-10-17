/** @jest-environment node */
/** The Imports tab's procedures: admin only, the crawl answering a job's worth by default, the actor on a start. */
jest.mock("~/server/modules/cards/cards.import-crawl", () => ({
  CRAWL_MODES: ["category", "all", "titles"],
  MAX_CRAWL: 2000,
  MAX_SCAN: 10000,
  crawlImportTitles: jest.fn(),
  startManualImport: jest.fn(),
}));
jest.mock("~/server/modules/cards/cards.import-jobs", () => ({
  MAX_IMPORT_TITLES: 2000,
  cancelImportJob: jest.fn(),
  importJobItems: jest.fn(),
  kickImportRunner: jest.fn(),
  listImportJobs: jest.fn(),
  retryImportJob: jest.fn(),
}));

import { createCallerFactory } from "~/server/api/trpc";
import { cardsAdminImportsRouter } from "~/server/api/routers/cards/admin/imports";
import { crawlImportTitles, startManualImport } from "~/server/modules/cards/cards.import-crawl";
import { kickImportRunner, retryImportJob } from "~/server/modules/cards/cards.import-jobs";
import { createMockPrisma } from "~/tests/helpers/mock-db";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const callerAs = (db: ReturnType<typeof createMockPrisma>, role: "admin" | "user") =>
  createCallerFactory(cardsAdminImportsRouter)(
    createMockRouterContext({
      db,
      auth: { userId: "clerk_x" },
      user: {
        id: "db_x",
        clerkUserId: "clerk_x",
        role: role === "admin" ? { name: "admin", level: 10 } : { name: "user", level: 100 },
      },
    }) as never
  );

beforeEach(() => jest.clearAllMocks());

describe("cards.admin.imports", () => {
  it("refuses a player", async () => {
    await expect(
      callerAs(createMockPrisma(), "user").crawl({ source: "ixwiki", mode: "all" })
    ).rejects.toThrow(/Admin privileges required/);
    expect(crawlImportTitles).not.toHaveBeenCalled();
  });

  it("crawls up to a job's worth of pages unless asked for fewer", async () => {
    jest.mocked(crawlImportTitles).mockResolvedValue({ entries: [], truncated: false });
    const db = createMockPrisma();
    await callerAs(db, "admin").crawl({ source: "iiwiki", mode: "category", category: "Elm" });
    expect(crawlImportTitles).toHaveBeenCalledWith(db, {
      source: "iiwiki",
      mode: "category",
      category: "Elm",
      limit: 2000,
    });
  });

  it("queues an import as the signed-in admin", async () => {
    jest.mocked(startManualImport).mockResolvedValue({ jobId: "job_1", queued: 1 });
    const db = createMockPrisma();
    await expect(
      callerAs(db, "admin").start({
        source: "commons",
        label: "Category:Flags",
        titles: ["File:A.svg"],
      })
    ).resolves.toEqual({ jobId: "job_1", queued: 1 });
    expect(startManualImport).toHaveBeenCalledWith(
      db,
      { dbId: "db_x", clerkId: "clerk_x" },
      { source: "commons", label: "Category:Flags", titles: ["File:A.svg"] }
    );
  });

  it("starts a run after a retry, and on resume", async () => {
    const db = createMockPrisma();
    await callerAs(db, "admin").retry({ jobId: "job_1" });
    expect(retryImportJob).toHaveBeenCalledWith(db, "job_1");
    await callerAs(db, "admin").resume();
    expect(kickImportRunner).toHaveBeenCalledTimes(2);
  });
});
