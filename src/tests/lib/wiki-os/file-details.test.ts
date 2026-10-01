/** @jest-environment node */
/**
 * Plan 411: what a File: page shows below the file: its upload history (the log of its uploads, newest first, with the facts
 * each upload recorded) and "File usage" (the live pages that use it). A deleted file shows neither.
 */
const mockLogs = jest.fn();
const mockLinks = jest.fn();
const mockLinkCount = jest.fn();
const mockArchived = jest.fn();
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    wikiLog: { findMany: (...a: unknown[]) => mockLogs(...a) },
    wikiImageLink: {
      findMany: (...a: unknown[]) => mockLinks(...a),
      count: (...a: unknown[]) => mockLinkCount(...a),
    },
  },
}));
jest.mock("~/lib/wiki-os/core/archived-titles", () => ({
  __esModule: true,
  archivedTitlesAmong: (...a: unknown[]) => mockArchived(...a),
}));
jest.mock("~/lib/wiki-os/core/media-asset-service", () => ({
  __esModule: true,
  MediaAssetService: { findAsset: jest.fn() },
}));
jest.mock("~/lib/wiki-os/core/article-repository", () => ({
  __esModule: true,
  ArticleRepository: { findMissingTitles: jest.fn() },
}));

import {
  getFileDetails,
  FILE_HISTORY_SHOWN,
  FILE_USAGE_SHOWN,
} from "~/lib/wiki-os/core/file-page-service";

const log = (over: Record<string, unknown> = {}) => ({
  createdAt: new Date("2026-09-30T12:00:00Z"),
  actorName: "Heku",
  comment: "A better flag",
  action: "overwrite",
  params: {
    filename: "Flag of Eurth.png",
    sha1: "x",
    size: 5000,
    width: 640,
    height: 480,
    mime: "image/png",
  },
  ...over,
});

beforeEach(() => {
  mockLogs.mockReset().mockResolvedValue([]);
  mockLinks.mockReset().mockResolvedValue([]);
  mockLinkCount.mockReset().mockResolvedValue(0);
  mockArchived.mockReset().mockResolvedValue(new Set());
});

describe("getFileDetails", () => {
  it("lists the uploads newest first with what each recorded, and the pages that use the file", async () => {
    mockLogs.mockResolvedValue([
      log(),
      log({
        createdAt: new Date("2026-09-01T08:30:00Z"),
        actorName: "Mod",
        comment: null,
        action: "upload",
        params: { size: 100, width: null, height: null, mime: "image/png" },
      }),
    ]);
    mockLinks.mockResolvedValue([
      { article: { title: "Eurth" } },
      { article: { title: "Flags of the world" } },
    ]);
    mockLinkCount.mockResolvedValue(2);

    const details = await getFileDetails("File:Flag_of_Eurth.png");

    expect(details).toEqual({
      history: [
        {
          at: "2026-09-30T12:00:00.000Z",
          user: "Heku",
          comment: "A better flag",
          action: "overwrite",
          width: 640,
          height: 480,
          size: 5000,
          mime: "image/png",
        },
        {
          at: "2026-09-01T08:30:00.000Z",
          user: "Mod",
          comment: null,
          action: "upload",
          width: null,
          height: null,
          size: 100,
          mime: "image/png",
        },
      ],
      usage: [
        { title: "Eurth", urlPath: "Eurth" },
        { title: "Flags of the world", urlPath: "Flags_of_the_world" },
      ],
      usageTotal: 2,
    });
    expect(mockLogs).toHaveBeenCalledWith({
      where: { logType: "upload", title: "File:Flag of Eurth.png" },
      orderBy: { createdAt: "desc" },
      take: FILE_HISTORY_SHOWN,
      select: expect.any(Object),
    });
    // only live pages that use it, by the file's name as the link table holds it
    expect(mockLinks).toHaveBeenCalledWith({
      where: {
        fileName: "Flag of Eurth.png",
        article: { source: "ixwiki", status: { not: "ARCHIVED" } },
      },
      orderBy: { article: { title: "asc" } },
      take: FILE_USAGE_SHOWN,
      select: { article: { select: { title: true } } },
    });
  });

  it("reads a log row of another shape as unknown facts, not as a failure", async () => {
    mockLogs.mockResolvedValue([log({ params: { size: "huge" } }), log({ params: null })]);

    const details = await getFileDetails("Flag.png");

    expect(details?.history.map((version) => [version.width, version.size, version.mime])).toEqual([
      [null, null, null],
      [null, null, null],
    ]);
  });

  it("says how many pages use the file when more are used than listed", async () => {
    mockLinks.mockResolvedValue([{ article: { title: "Eurth" } }]);
    mockLinkCount.mockResolvedValue(340);

    const details = await getFileDetails("Flag.png");

    expect(details?.usage).toHaveLength(1);
    expect(details?.usageTotal).toBe(340);
  });

  it("has an empty history for a file WikiOS has no upload log of, and no usage for a file nothing uses", async () => {
    expect(await getFileDetails("Old.png")).toEqual({ history: [], usage: [], usageTotal: 0 });
  });

  it("is null for a file whose File: page was deleted, and for a name that is no file name", async () => {
    mockArchived.mockResolvedValue(new Set(["File:Gone.png"]));

    expect(await getFileDetails("Gone.png")).toBeNull();
    expect(await getFileDetails("a[b.png")).toBeNull();
    expect(mockLogs).not.toHaveBeenCalled();
  });
});
