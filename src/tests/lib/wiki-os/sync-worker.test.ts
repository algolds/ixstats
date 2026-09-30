/** @jest-environment node */
/**
 * NEW-4: the export worker stamps the Postgres revision with the MediaWiki revision id it pushed,
 * so the inbound sync recognises the bot's revision as that edit instead of importing a duplicate.
 */
const mockExecuteWrite = jest.fn();
const mockArticleUpdateMany = jest.fn();
const mockRevisionUpdateMany = jest.fn();

jest.mock("~/lib/wiki-os/adapters/mediawiki/write-service", () => ({
  __esModule: true,
  executeMediaWikiWrite: (...a: unknown[]) => mockExecuteWrite(...a),
  updateRevisionActor: jest.fn().mockResolvedValue(true),
}));
jest.mock("~/server/db", () => ({
  db: {
    wikiArticle: { updateMany: (...a: unknown[]) => mockArticleUpdateMany(...a) },
    wikiRevision: { updateMany: (...a: unknown[]) => mockRevisionUpdateMany(...a) },
  },
}));

import { MediaWikiExportWorker } from "~/lib/wiki-os/adapters/mediawiki/sync-worker";

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const job = {
  slug: "Foo",
  title: "Foo",
  wikitext: "body",
  authorWikiUsername: "Alice",
  revisionId: "rev-1",
};

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.SKIP_MEDIAWIKI_SYNC;
  mockArticleUpdateMany.mockResolvedValue({ count: 1 });
  mockRevisionUpdateMany.mockResolvedValue({ count: 1 });
});

test("stamps the exported Postgres revision with the MediaWiki revision id", async () => {
  mockExecuteWrite.mockResolvedValue({ success: true, revisionId: 555 });

  MediaWikiExportWorker.enqueue(job);
  await flush();

  expect(mockRevisionUpdateMany).toHaveBeenCalledWith({
    where: { id: "rev-1", mwRevId: null },
    data: { mwRevId: 555 },
  });
  expect(mockArticleUpdateMany).toHaveBeenCalledWith(
    expect.objectContaining({ data: expect.objectContaining({ mwLatestRevId: 555 }) })
  );
});

test("does not touch revisions when MediaWiki reports no new revision", async () => {
  mockExecuteWrite.mockResolvedValue({ success: true, noChange: true });

  MediaWikiExportWorker.enqueue(job);
  await flush();

  expect(mockRevisionUpdateMany).not.toHaveBeenCalled();
});
