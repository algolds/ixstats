/** @jest-environment node */
/**
 * Crawling pages for the Imports tab: a category's articles, a Commons category's image files, a whole wiki or a
 * pasted list, each marked when it already has a card, the ones with no card first, read paced within a time budget.
 * A wiki that refuses is reported, never read as "no pages". Queuing a manual import audits it and starts a run.
 */
jest.mock("~/lib/cards/lore-card-discovery", () => ({
  loreCardDiscovery: { fetchCategoryMembers: jest.fn(), fetchAllMainNamespacePages: jest.fn() },
}));
jest.mock("~/server/modules/cards/cards.import-jobs", () => ({
  MAX_IMPORT_TITLES: 2000,
  createImportJob: jest.fn(),
  kickImportRunner: jest.fn(),
}));

import { TRPCError } from "@trpc/server";
import { loreCardDiscovery } from "~/lib/cards/lore-card-discovery";
import { DiscoveryStopped } from "~/lib/realms/sources/wiki-discovery-client";
import { createImportJob, kickImportRunner } from "~/server/modules/cards/cards.import-jobs";
import {
  CRAWL_BUDGET_MS,
  MAX_CRAWL,
  MAX_SCAN,
  crawlImportTitles,
  startManualImport,
} from "~/server/modules/cards/cards.import-crawl";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const members = jest.mocked(loreCardDiscovery.fetchCategoryMembers);
const everyPage = jest.mocked(loreCardDiscovery.fetchAllMainNamespacePages);

const dbWithCarded = (keys: string[]) =>
  createMockPrisma({ $queryRaw: jest.fn().mockResolvedValue(keys.map((key) => ({ key }))) });

const listed = (titles: string[], truncated = false) => ({ titles, truncated });
/** The reach a crawl reads the wiki's list with: MAX_SCAN titles, paced, within its budget. */
const crawlReach = {
  limit: MAX_SCAN,
  deadline: expect.any(Number),
  pace: expect.any(Function),
};

/** The TRPCError a crawl rejects with. */
async function refusal(promise: Promise<object>): Promise<TRPCError> {
  const error = await promise.then(
    () => null,
    (reason: Error) => reason
  );
  if (!(error instanceof TRPCError)) throw new Error("the crawl did not refuse");
  return error;
}

beforeEach(() => jest.clearAllMocks());
afterEach(() => jest.restoreAllMocks());

describe("crawlImportTitles", () => {
  it("crawls a category's articles, paced within its budget, and marks pages that already have a card", async () => {
    members.mockResolvedValue(listed(["Union Assembly", "Elm", "Union_Assembly"]));
    const before = Date.now();
    const result = await crawlImportTitles(dbWithCarded(["elm"]) as never, {
      source: "iiwiki",
      mode: "category",
      category: "Category: Elm",
      limit: 500,
    });
    expect(members).toHaveBeenCalledWith("Elm", "iiwiki", crawlReach);
    const { deadline } = members.mock.calls[0]![2];
    expect(deadline).toBeGreaterThanOrEqual(before + CRAWL_BUDGET_MS);
    expect(deadline).toBeLessThanOrEqual(Date.now() + CRAWL_BUDGET_MS);
    expect(result).toEqual({
      entries: [
        { title: "Union Assembly", carded: false },
        { title: "Elm", carded: true },
      ],
      truncated: false,
    });
  });

  it("lists the pages with no card first, so a big category keeps offering the ones left", async () => {
    members.mockResolvedValue(listed(["Ash", "Birch", "Cedar"]));
    const result = await crawlImportTitles(dbWithCarded(["ash"]) as never, {
      source: "ixwiki",
      mode: "category",
      category: "Trees",
      limit: 2,
    });
    expect(result).toEqual({
      entries: [
        { title: "Birch", carded: false },
        { title: "Cedar", carded: false },
      ],
      truncated: true,
    });
  });

  it("crawls every page of a wiki", async () => {
    everyPage.mockResolvedValue(listed(["Elm"]));
    const result = await crawlImportTitles(dbWithCarded([]) as never, {
      source: "althistory",
      mode: "all",
      limit: MAX_CRAWL,
    });
    expect(everyPage).toHaveBeenCalledWith("althistory", crawlReach);
    expect(result.entries).toEqual([{ title: "Elm", carded: false }]);
  });

  it("crawls a Commons category's files that can be card art", async () => {
    members.mockResolvedValue(
      listed(["File:Flag of Ireland.svg", "File:Anthem of Ireland.ogg", "File:Treaty scan.pdf"])
    );
    const result = await crawlImportTitles(dbWithCarded([]) as never, {
      source: "commons",
      mode: "category",
      category: "Flags of Europe",
      limit: 500,
    });
    expect(members).toHaveBeenCalledWith("Flags of Europe", "commons", crawlReach);
    expect(result).toEqual({
      entries: [{ title: "File:Flag of Ireland.svg", carded: false }],
      truncated: false,
    });
  });

  it("says when the wiki's list was cut, though every title read fits", async () => {
    members.mockResolvedValue(listed(["File:Flag.svg"], true));
    const result = await crawlImportTitles(dbWithCarded([]) as never, {
      source: "commons",
      mode: "category",
      category: "Flags",
      limit: MAX_CRAWL,
    });
    expect(result).toEqual({
      entries: [{ title: "File:Flag.svg", carded: false }],
      truncated: true,
    });
  });

  it("reads a pasted list, adding and capitalising the File: name for Commons and dropping invalid titles", async () => {
    const result = await crawlImportTitles(dbWithCarded([]) as never, {
      source: "commons",
      mode: "titles",
      titles: ["Flag_of_Ireland.svg", "file:flag of Ireland.svg", "a|b", "Score.pdf"],
      limit: 500,
    });
    expect(result).toEqual({
      entries: [{ title: "File:Flag of Ireland.svg", carded: false }],
      truncated: false,
    });
    expect(members).not.toHaveBeenCalled();
  });

  it("says when the wiki had more pages than the limit", async () => {
    members.mockResolvedValue(listed(["A", "B", "C"]));
    const result = await crawlImportTitles(dbWithCarded([]) as never, {
      source: "ixwiki",
      mode: "category",
      category: "X",
      limit: 2,
    });
    expect(result.entries).toHaveLength(2);
    expect(result.truncated).toBe(true);
  });

  it("asks nothing for a category mode with no category, or every page of Commons", async () => {
    const db = dbWithCarded([]);
    await expect(
      crawlImportTitles(db as never, {
        source: "iiwiki",
        mode: "category",
        category: " ",
        limit: 5,
      })
    ).resolves.toEqual({ entries: [], truncated: false });
    await expect(
      crawlImportTitles(db as never, { source: "commons", mode: "all", limit: 5 })
    ).resolves.toEqual({ entries: [], truncated: false });
    expect(members).not.toHaveBeenCalled();
    expect(everyPage).not.toHaveBeenCalled();
    expect(db.$queryRaw).not.toHaveBeenCalled();
  });

  it("reports a wiki that refuses, by name, instead of finding no pages", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    members.mockRejectedValue(
      new DiscoveryStopped({ kind: "blocked", status: 403, message: "HTTP 403" })
    );
    const error = await refusal(
      crawlImportTitles(dbWithCarded([]) as never, {
        source: "iiwiki",
        mode: "category",
        category: "Elm",
        limit: 5,
      })
    );
    expect(error.code).toBe("BAD_GATEWAY");
    expect(error.message).toBe("IIWiki stopped answering (HTTP 403).");
  });

  it("reports any other failed read as the wiki's, without its raw reason", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    members.mockRejectedValue(new Error("Wikimedia Commons answered HTTP 502."));
    const error = await refusal(
      crawlImportTitles(dbWithCarded([]) as never, {
        source: "commons",
        mode: "category",
        category: "Flags",
        limit: 5,
      })
    );
    expect(error.code).toBe("BAD_GATEWAY");
    expect(error.message).toBe("Could not read Wikimedia Commons. Try again later.");
  });
});

describe("startManualImport", () => {
  it("queues the job for the admin, audits it and starts a run", async () => {
    jest.mocked(createImportJob).mockResolvedValue({ jobId: "job_1", queued: 2 });
    const db = createMockPrisma();
    const result = await startManualImport(
      db as never,
      { dbId: "db_admin", clerkId: "clerk_admin" },
      { source: "althistory", label: "Category:Nations", titles: ["A", "B"] }
    );
    expect(result).toEqual({ jobId: "job_1", queued: 2 });
    expect(createImportJob).toHaveBeenCalledWith(db, {
      source: "althistory",
      kind: "MANUAL",
      label: "Category:Nations",
      titles: ["A", "B"],
      requestedBy: "db_admin",
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "CARD_IMPORT",
        userId: "clerk_admin",
        target: "job_1",
        details: "Queued 2 pages from AltHistory Wiki: Category:Nations",
      }),
    });
    expect(kickImportRunner).toHaveBeenCalledWith(db);
  });

  it("counts Commons files as files", async () => {
    jest.mocked(createImportJob).mockResolvedValue({ jobId: "job_2", queued: 1 });
    const db = createMockPrisma();
    await startManualImport(
      db as never,
      { dbId: "db_admin", clerkId: "clerk_admin" },
      { source: "commons", label: "Category:Flags", titles: ["File:Flag.svg"] }
    );
    expect(db.auditLog.create.mock.calls[0]![0].data.details).toBe(
      "Queued 1 file from Wikimedia Commons: Category:Flags"
    );
  });
});
