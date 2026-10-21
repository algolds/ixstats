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
import { crawlImportTitles } from "~/server/modules/cards/cards.import-crawl";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const members = jest.mocked(loreCardDiscovery.fetchCategoryMembers);

const dbWithCarded = (keys: string[]) =>
  createMockPrisma({ $queryRaw: jest.fn().mockResolvedValue(keys.map((key) => ({ key }))) });

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
