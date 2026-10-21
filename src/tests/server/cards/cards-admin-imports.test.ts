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
import { crawlImportTitles } from "~/server/modules/cards/cards.import-crawl";
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
});
