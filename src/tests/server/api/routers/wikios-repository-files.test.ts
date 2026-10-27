/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories
// rely on the ambient global.
const mockSearch = jest.fn();
const mockListUploaded = jest.fn();

jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {},
  isDatabaseReadOnly: true,
}));
jest.mock("~/lib/wiki-os/core/media-asset-service", () => ({
  MediaAssetService: { search: (...args: unknown[]) => mockSearch(...args) },
}));
jest.mock("~/server/shared/uploaded-assets", () => ({
  listUploadedAssets: (...args: unknown[]) => mockListUploaded(...args),
}));

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { wikiosRepositoryFilesRouter } from "~/server/api/routers/wikios/repository-files";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { installFetchGuard, type FetchGuard } from "~/tests/helpers/fetch-guard";

const signedOut = () =>
  createCallerFactory(wikiosRepositoryFilesRouter)(
    createMockRouterContext({ auth: null, user: null }) as never
  );
const signedIn = () =>
  createCallerFactory(wikiosRepositoryFilesRouter)(createMockRouterContext() as never);

let guard: FetchGuard | null = null;
beforeEach(() => {
  mockSearch.mockReset();
  mockListUploaded.mockReset();
});
afterEach(() => {
  guard?.restore();
  guard = null;
});

const asset = (n: number) => ({
  filename: `F_${n}.png`,
  title: `F ${n}.png`,
  url: `/api/wiki/file/F_${n}.png`,
  thumbnailUrl: null,
  sizeBytes: 10,
  width: 4,
  height: 3,
  mimeType: "image/png",
  blurhash: null,
});

describe("repositoryFiles: ixwiki", () => {
  it("pages by offset cursor and stops when a page comes back short", async () => {
    mockSearch.mockResolvedValueOnce(Array.from({ length: 2 }, (_, i) => asset(i)));
    const first = await signedOut().repositoryFiles({ source: "ixwiki", limit: 2 });
    expect(mockSearch.mock.calls[0]![0]).toMatchObject({ limit: 2, offset: 0 });
    expect(first.files).toHaveLength(2);
    expect(first.files[0]).toMatchObject({ name: "F_0.png", title: "File:F 0.png", blurhash: null });
    expect(first.nextCursor).toBe("2");

    mockSearch.mockResolvedValueOnce([asset(2)]);
    const second = await signedOut().repositoryFiles({
      source: "ixwiki",
      limit: 2,
      cursor: first.nextCursor,
    });
    expect(mockSearch.mock.calls[1]![0]).toMatchObject({ limit: 2, offset: 2 });
    expect(second.nextCursor).toBeNull();
  });

  it("rejects a cursor deeper than the 2000-row ceiling and ends the page that reaches it", async () => {
    await expect(
      signedOut().repositoryFiles({ source: "ixwiki", cursor: "2001" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mockSearch).not.toHaveBeenCalled();

    mockSearch.mockResolvedValueOnce(Array.from({ length: 40 }, (_, i) => asset(i)));
    const last = await signedOut().repositoryFiles({ source: "ixwiki", limit: 40, cursor: "1960" });
    expect(mockSearch.mock.calls[0]![0]).toMatchObject({ offset: 1960 });
    expect(last.files).toHaveLength(40);
    expect(last.nextCursor).toBeNull();

    mockSearch.mockResolvedValueOnce(Array.from({ length: 40 }, (_, i) => asset(i)));
    const before = await signedOut().repositoryFiles({ source: "ixwiki", limit: 40, cursor: "1920" });
    expect(before.nextCursor).toBe("1960");
  });
  it("rejects a cursor that is not an offset", async () => {
    await expect(
      signedOut().repositoryFiles({ source: "ixwiki", cursor: "abc" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("repositoryFiles: iiwiki", () => {
  it.each([
    ["action", "delete"],
    ["generator", "allpages"],
    ["gsrsearch", "x"],
  ])("rejects a cursor that carries %s (not a continuation key)", async (key, value) => {
    const cursor = Buffer.from(JSON.stringify({ [key]: value }), "utf-8").toString("base64url");
    await expect(
      signedOut().repositoryFiles({ source: "iiwiki", cursor })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("sisterFileInfo", () => {
  it.each([
    ["no titles", []],
    ["51 titles", Array.from({ length: 51 }, (_, i) => `File:${i}.png`)],
    ["a title with a pipe", ["File:A|B.png"]],
    ["a title over 255 characters", [`File:${"a".repeat(255)}`]],
    ["an empty title", [""]],
  ])("rejects %s", async (_label, titles) => {
    guard = installFetchGuard();
    await expect(
      signedOut().sisterFileInfo({ wiki: "iiwiki", titles })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(guard.calls()).toHaveLength(0);
  });

  it("rejects a wiki other than iiwiki", async () => {
    await expect(
      signedOut().sisterFileInfo({ wiki: "ixwiki" as never, titles: ["File:A.png"] })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("is rate-limited in the sisterwiki bucket like the other reads", async () => {
    const { rateLimiter } = await import("~/lib/cache");
    const enabled = jest.spyOn(rateLimiter, "isEnabled").mockReturnValue(true);
    const check = jest
      .spyOn(rateLimiter, "check")
      .mockResolvedValue({ success: true, remaining: 100, resetAt: new Date() } as never);
    guard = installFetchGuard(() => ({ query: { pages: {} } }));
    try {
      await signedOut().sisterFileInfo({ wiki: "iiwiki", titles: ["File:A.png"] });
      expect(check).toHaveBeenCalledWith(expect.anything(), "sisterwiki", { maxRequests: 120, windowMs: 60_000 });
    } finally {
      enabled.mockRestore();
      check.mockRestore();
    }
  });
});

describe("repositoryFiles: forum and mine", () => {
  it("mine requires sign-in", async () => {
    await expect(signedOut().repositoryFiles({ source: "mine" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(mockListUploaded).not.toHaveBeenCalled();
  });

  it("mine lists the caller's uploads by Clerk id", async () => {
    mockListUploaded.mockResolvedValue({ items: [], nextCursor: null });
    await signedIn().repositoryFiles({ source: "mine" });
    expect(mockListUploaded.mock.calls[0]![0]).toMatchObject({
      source: "upload",
      uploaderClerkId: "test_user_clerk_id",
      limit: 40,
    });
  });
});
