/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories rely on the ambient global.
//
// Plan 416 item 6: public WikiOS endpoints must not hand out internals. The deleted-pages list is for
// those who may browse deleted pages; the audit log names actors by name, never by internal user id;
// `downloadFile` fetches only allowlisted hosts and at most 10 MB.
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: jest.requireActual("~/tests/helpers/fake-wiki-db").fakeWikiDb.db,
  isDatabaseReadOnly: true,
}));
jest.mock("~/lib/auth", () => ({
  __esModule: true,
  isSystemOwner: (id: string) => id === "user_owner",
  SYSTEM_OWNER_IDS: ["user_owner"],
  UserManagementService: jest.fn(),
}));
jest.mock("~/lib/wiki-os/core", () => ({
  __esModule: true,
  ArticleRepository: { findBySlug: jest.fn(), findMissingTitles: jest.fn() },
  MediaAssetService: { findAsset: jest.fn() },
  LinkGraphService: { getBacklinks: jest.fn().mockResolvedValue([]) },
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/parsoid", () => ({
  __esModule: true,
  getArticleHtml: jest.fn(),
  renderArticleViaMediaWiki: jest.fn(),
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/bridge", () => ({
  __esModule: true,
  getArticleWikitext: jest.fn(),
  resolveRedirect: jest.fn(),
  getInfobox: jest.fn(),
  getImageMeta: jest.fn(),
  getSiteStats: jest.fn(),
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/article-store", () => ({
  __esModule: true,
  getArticleWikitextShadow: jest.fn(),
  getArticleAuthors: jest.fn(),
}));
jest.mock("~/lib/wiki-os/core/native-search-service", () => ({
  __esModule: true,
  getArticleSummaryFromShadow: jest.fn(),
}));
jest.mock("~/lib/wiki-os/services/media-download", () => ({
  __esModule: true,
  downloadMedia: jest.fn(),
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { wikiosUtilitiesRouter } from "~/server/api/routers/wikios/utilities";
import { wikiosPageContentRouter } from "~/server/api/routers/wikios/page-content";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { fakeWikiDb } from "~/tests/helpers/fake-wiki-db";
import { MediaAssetService } from "~/lib/wiki-os/core";
import { getImageMeta } from "~/lib/wiki-os/adapters/mediawiki/bridge";
import { downloadMedia } from "~/lib/wiki-os/services/media-download";

const { tables } = fakeWikiDb;

const ctxOf = (role: string | null) =>
  createMockRouterContext(
    role
      ? {
          auth: { userId: "user_1" },
          user: { id: "db1", clerkUserId: "user_1", role: { name: role, level: 100 } },
        }
      : { auth: null, user: null }
  ) as never;
const utilities = (role: string | null) => createCallerFactory(wikiosUtilitiesRouter)(ctxOf(role));
const content = (role: string | null) => createCallerFactory(wikiosPageContentRouter)(ctxOf(role));

beforeEach(() => {
  jest.clearAllMocks();
  fakeWikiDb.reset();
});

describe("getArchivedArticles", () => {
  beforeEach(() => {
    tables.wikiArticle.seed({
      source: "ixwiki",
      title: "Gone page",
      slug: "gone_page",
      status: "ARCHIVED",
      summary: "Was here",
      updatedAt: new Date("2026-09-01T00:00:00Z"),
      authorId: "db_internal_author",
      lastEditorId: "db_internal_editor",
    });
  });

  it.each([[null], ["user"]])("lists nothing for a caller who may not browse deleted pages (%p)", async (role) => {
    await expect(utilities(role).getArchivedArticles({})).resolves.toEqual([]);
  });

  it("lists the deleted pages for a sysop, selecting no user columns", async () => {
    const findMany = jest.spyOn(tables.wikiArticle, "findMany");

    const rows = await utilities("admin").getArchivedArticles({});

    expect(rows).toHaveLength(1);
    expect(findMany).toHaveBeenCalledTimes(1);
    const select = (findMany.mock.calls[0]![0] as { select: Record<string, boolean> }).select;
    expect(Object.keys(select).sort()).toEqual(["id", "slug", "summary", "title", "updatedAt"]);
  });
});

describe("getAuditLogs", () => {
  it("names the actor by name and selects no internal user id", async () => {
    tables.wikiLog.seed({
      logType: "delete",
      action: "delete",
      title: "Gone page",
      actorName: "Admin",
      comment: "spam",
      params: { reason: "spam" },
      userId: "db_internal_admin",
    });
    const findMany = jest.spyOn(tables.wikiLog, "findMany");

    const { logs } = await utilities(null).getAuditLogs({});

    expect(logs).toHaveLength(1);
    const select = (findMany.mock.calls[0]![0] as { select: Record<string, boolean> }).select;
    expect(select).toMatchObject({ actorName: true });
    expect(select).not.toHaveProperty("userId");
    expect(Object.keys(select).sort()).toEqual([
      "action",
      "actorName",
      "comment",
      "createdAt",
      "id",
      "logType",
      "params",
      "title",
    ]);
  });
});

describe("downloadFile", () => {
  const asset = { url: "https://ixwiki.com/images/a/ab/Flag.png", mimeType: "image/png" };

  it("returns the file as base64 with the asset's type", async () => {
    jest.mocked(MediaAssetService.findAsset).mockResolvedValue(asset as never);
    jest.mocked(downloadMedia).mockResolvedValue(Buffer.from([1, 2, 3]));

    await expect(content(null).downloadFile({ filename: "File:Flag.png" })).resolves.toEqual({
      content: Buffer.from([1, 2, 3]).toString("base64"),
      mime: "image/png",
    });
    expect(MediaAssetService.findAsset).toHaveBeenCalledWith("Flag.png");
    expect(downloadMedia).toHaveBeenCalledWith(asset.url);
  });

  it("falls back to the wiki's own image info when there is no asset", async () => {
    jest.mocked(MediaAssetService.findAsset).mockResolvedValue(null);
    jest.mocked(getImageMeta).mockResolvedValue({ url: "https://upload.wikimedia.org/x.jpg" } as never);
    jest.mocked(downloadMedia).mockResolvedValue(Buffer.from([9]));

    const result = await content(null).downloadFile({ filename: "x.jpg" });

    expect(downloadMedia).toHaveBeenCalledWith("https://upload.wikimedia.org/x.jpg");
    expect(result).toEqual({ content: "CQ==", mime: "image/png" });
  });

  it("gives null for a file the download refuses (a host off the allowlist, or over 10 MB)", async () => {
    jest.mocked(MediaAssetService.findAsset).mockResolvedValue({
      url: "http://169.254.169.254/latest/meta-data/",
      mimeType: "image/png",
    } as never);
    jest.mocked(downloadMedia).mockResolvedValue(null);

    await expect(content(null).downloadFile({ filename: "Flag.png" })).resolves.toBeNull();
  });

  it("gives null for a file nothing knows", async () => {
    jest.mocked(MediaAssetService.findAsset).mockResolvedValue(null);
    jest.mocked(getImageMeta).mockResolvedValue(null as never);

    await expect(content(null).downloadFile({ filename: "Nope.png" })).resolves.toBeNull();
    expect(downloadMedia).not.toHaveBeenCalled();
  });

  it("gives null, not an error, when the download throws", async () => {
    jest.mocked(MediaAssetService.findAsset).mockResolvedValue(asset as never);
    jest.mocked(downloadMedia).mockRejectedValue(new Error("boom"));
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(content(null).downloadFile({ filename: "Flag.png" })).resolves.toBeNull();

    error.mockRestore();
  });
});
