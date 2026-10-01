/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories rely on the ambient global.
//
// Plan 418 (A9): the images of an IxWiki page come from Postgres (the files its render reported, joined to
// the assets WikiOS holds); MediaWiki is never asked, and an IxWiki title is never tried on a sister wiki.
// A sister wiki's own page still asks its own wiki.
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    wikiArticle: { findFirst: jest.fn(), findUnique: jest.fn(), findMany: jest.fn() },
    wikiAsset: { findMany: jest.fn(), findFirst: jest.fn() },
    $queryRaw: jest.fn(),
  },
}));

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { db } from "~/server/db";
import { getPageImages } from "~/lib/wiki-os/adapters/mediawiki/bridge";
import { installFetchGuard, type FetchGuard } from "~/tests/helpers/fetch-guard";

const mocked = db as unknown as {
  wikiArticle: Record<"findFirst" | "findUnique" | "findMany", jest.Mock>;
  wikiAsset: { findMany: jest.Mock };
  $queryRaw: jest.Mock;
};

const links = (...names: string[]) => ({ imageLinks: names.map((fileName) => ({ fileName })) });

const asset = (filename: string, over: Record<string, unknown> = {}) => ({
  filename,
  slug: filename.toLowerCase(),
  md5Hash: `md5-${filename}`,
  title: filename.replace(/_/g, " "),
  url: `https://ixwiki.com/images/x/xx/${filename}`,
  thumbnailUrl: `https://ixwiki.com/images/thumb/x/xx/${filename}/300px-${filename}`,
  mimeType: "image/png",
  width: 800,
  height: 600,
  ...over,
});

let guard: FetchGuard;
beforeEach(() => {
  jest.clearAllMocks();
  guard = installFetchGuard();
  mocked.$queryRaw.mockResolvedValue([]); // no redirect
  mocked.wikiArticle.findUnique.mockResolvedValue(null);
  mocked.wikiArticle.findMany.mockResolvedValue([]);
  mocked.wikiArticle.findFirst.mockResolvedValue(null);
  mocked.wikiAsset.findMany.mockResolvedValue([]);
});
afterEach(() => guard.restore());

describe("getPageImages for IxWiki", () => {
  it("lists the files the page uses with the URLs and size WikiOS holds, in file-name order, never asking a wiki", async () => {
    mocked.wikiArticle.findFirst.mockResolvedValue(links("Flag of Caphiria.png", "Map.png"));
    mocked.wikiAsset.findMany.mockResolvedValue([
      asset("Flag_of_Caphiria.png", { width: 300, height: 200 }),
      asset("Map.png"),
    ]);

    const images = await getPageImages("Caphiria");

    expect(images).toEqual([
      {
        title: "File:Flag of Caphiria.png",
        url: "https://ixwiki.com/images/x/xx/Flag_of_Caphiria.png",
        thumbUrl: "https://ixwiki.com/images/thumb/x/xx/Flag_of_Caphiria.png/300px-Flag_of_Caphiria.png",
        width: 300,
        height: 200,
      },
      expect.objectContaining({ title: "File:Map.png", width: 800, height: 600 }),
    ]);
    expect(mocked.wikiArticle.findFirst.mock.calls[0]?.[0]).toMatchObject({
      where: { source: "ixwiki", title: "Caphiria", status: { not: "ARCHIVED" } },
      select: { imageLinks: { orderBy: { fileName: "asc" } } },
    });
    expect(guard.calls()).toEqual([]);
  });

  it("is null for a page with no image, and never falls through to iiwiki", async () => {
    mocked.wikiArticle.findFirst.mockResolvedValue(links());

    expect(await getPageImages("Caphiria")).toBeNull();
    expect(guard.calls()).toEqual([]);
  });

  it("is null for a page Postgres lacks (or a deleted one), and never falls through to iiwiki", async () => {
    expect(await getPageImages("Nowhere")).toBeNull();
    // A deleted page is excluded by the query itself.
    expect(mocked.wikiArticle.findFirst.mock.calls[0]?.[0].where.status).toEqual({ not: "ARCHIVED" });
    expect(guard.calls()).toEqual([]);
  });

  it("follows a redirect, as the wiki's own image query did", async () => {
    mocked.$queryRaw.mockResolvedValueOnce([{ head: "#REDIRECT [[Caphiria]]" }]);
    mocked.wikiArticle.findFirst.mockResolvedValue(links("Map.png"));
    mocked.wikiAsset.findMany.mockResolvedValue([asset("Map.png")]);

    await getPageImages("Caphiria (old)");

    expect(mocked.wikiArticle.findFirst.mock.calls[0]?.[0].where.title).toBe("Caphiria");
  });

  it("leaves out excluded files, icons, non-images and files with no asset row", async () => {
    mocked.wikiArticle.findFirst.mockResolvedValue(
      links("Flag icon.png", "Tiny.png", "Doc.pdf", "Lost.png", "Real.png", "Unsized.png")
    );
    mocked.wikiAsset.findMany.mockResolvedValue([
      asset("Flag_icon.png"),
      asset("Tiny.png", { width: 40, height: 40 }),
      asset("Doc.pdf", { mimeType: "application/pdf" }),
      asset("Real.png"),
      asset("Unsized.png", { width: null, height: null }),
    ]);

    const images = await getPageImages("Caphiria", { excludePatterns: [/^File:Flag.icon/i] });

    expect(images?.map((image) => image.title)).toEqual(["File:Real.png", "File:Unsized.png"]);
    expect(images?.[1]).toMatchObject({ width: 0, height: 0 });
  });

  it("applies the limit before looking the assets up", async () => {
    mocked.wikiArticle.findFirst.mockResolvedValue(links("A.png", "B.png", "C.png"));
    mocked.wikiAsset.findMany.mockResolvedValue([asset("A.png"), asset("B.png")]);

    const images = await getPageImages("Caphiria", { limit: 2 });

    expect(images?.map((image) => image.title)).toEqual(["File:A.png", "File:B.png"]);
  });

  it("is null when the read fails, without asking a wiki", async () => {
    mocked.wikiArticle.findFirst.mockRejectedValue(new Error("db down"));

    expect(await getPageImages("Caphiria")).toBeNull();
    expect(guard.calls()).toEqual([]);
  });
});

describe("getPageImages for a sister wiki", () => {
  it("asks that wiki for its own page's images (iiwiki)", async () => {
    guard.restore();
    const requested: string[] = [];
    guard = installFetchGuard((url) => {
      requested.push(url.searchParams.get("prop") ?? "");
      if (url.searchParams.get("prop") === "images") {
        return { query: { pages: { 1: { images: [{ title: "File:Elm.png" }] } } } };
      }
      return {
        query: {
          pages: {
            2: {
              title: "File:Elm.png",
              imageinfo: [{ url: "https://iiwiki.com/Elm.png", width: 640, height: 480, mime: "image/png" }],
            },
          },
        },
      };
    });

    const images = await getPageImages("Elmeria Images Test", { wiki: "iiwiki" });

    expect(images).toEqual([
      {
        title: "File:Elm.png",
        url: "https://iiwiki.com/Elm.png",
        thumbUrl: "https://iiwiki.com/Elm.png",
        width: 640,
        height: 480,
      },
    ]);
    expect(requested).toEqual(["images", "imageinfo"]);
    expect(guard.calls().every((url) => url.startsWith("https://iiwiki.com/api.php"))).toBe(true);
    // A sister wiki's page is not read from IxWiki's tables.
    expect(mocked.wikiArticle.findFirst).not.toHaveBeenCalled();
  });

  it("asks althistory for its own page, not iiwiki", async () => {
    guard.restore();
    guard = installFetchGuard((url) => {
      expect(url.hostname).toBe("althistory.fandom.com");
      return { query: { pages: { 1: { missing: true } } } };
    });

    expect(await getPageImages("Some Alt Page", { wiki: "althistory" })).toBeNull();
    expect(guard.calls()).toHaveLength(1);
  });
});
