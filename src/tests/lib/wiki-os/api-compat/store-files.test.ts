/** @jest-environment node */
/**
 * Plan 411: the file queries of the Prisma ApiStore against a mocked client: the facts of a file (the asset row, the
 * File: page's id, the newest upload log), a file whose File: page was deleted is left out, and the filters, bounds
 * and batches of a name listing.
 */
jest.mock("~/server/db", () => {
  const model = () => ({ findMany: jest.fn() });
  return { __esModule: true, db: { wikiAsset: model(), wikiArticle: model(), wikiLog: model() } };
});

import { sha1HexToBase36 } from "~/lib/wiki-os/xml/sha1";
import { filesByName, listFiles } from "~/lib/wiki-os/api-compat/store-files";
import { db } from "~/server/db";

type Mocked = Record<"wikiAsset" | "wikiArticle" | "wikiLog", { findMany: jest.Mock }>;
const mdb = db as unknown as Mocked;

const HEX = "0123456789abcdef0123456789abcdef01234567";
const asset = (over: Record<string, unknown> = {}) => ({
  title: "Flag of Eurth.png",
  filename: "Flag_of_Eurth.png",
  url: "/api/wiki/file/Flag_of_Eurth.png",
  sizeBytes: 5000,
  width: 640,
  height: 480,
  mimeType: "image/png",
  sha1: sha1HexToBase36(HEX),
  updatedAt: new Date("2026-09-01T00:00:00Z"),
  ...over,
});

beforeEach(() => {
  for (const model of Object.values(mdb)) model.findMany.mockReset().mockResolvedValue([]);
});

describe("filesByName", () => {
  it("finds assets by their underscored file names and describes them from the asset, the page and the newest upload", async () => {
    mdb.wikiAsset.findMany.mockResolvedValue([asset()]);
    mdb.wikiArticle.findMany.mockImplementation(
      async ({ where }: { where: { status: unknown } }) =>
        JSON.stringify(where.status).includes("ARCHIVED") &&
        !JSON.stringify(where.status).includes("not")
          ? []
          : [{ title: "File:Flag of Eurth.png", pageId: 77 }]
    );
    mdb.wikiLog.findMany.mockResolvedValue([
      {
        title: "File:Flag of Eurth.png",
        actorName: "Mod",
        comment: "newest",
        createdAt: new Date("2026-09-30T12:00:00Z"),
      },
      {
        title: "File:Flag of Eurth.png",
        actorName: "Heku",
        comment: "first",
        createdAt: new Date("2026-09-01T00:00:00Z"),
      },
    ]);

    const [row] = await filesByName(["Flag of Eurth.png"]);

    expect(mdb.wikiAsset.findMany).toHaveBeenCalledWith({
      where: { filename: { in: ["Flag_of_Eurth.png"] } },
    });
    expect(mdb.wikiLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { logType: "upload", title: { in: ["File:Flag of Eurth.png"] } },
        orderBy: { createdAt: "desc" },
      })
    );
    expect(row).toEqual({
      name: "Flag of Eurth.png",
      title: "File:Flag of Eurth.png",
      pageId: 77,
      url: "/api/wiki/file/Flag_of_Eurth.png",
      size: 5000,
      width: 640,
      height: 480,
      mime: "image/png",
      sha1: HEX,
      timestamp: new Date("2026-09-30T12:00:00Z"),
      user: "Mod",
      comment: "newest",
    });
  });

  it("falls back to the asset's time, no uploader and no page for a file WikiOS only registered", async () => {
    mdb.wikiAsset.findMany.mockResolvedValue([asset({ sha1: null, width: null, height: null })]);

    const [row] = await filesByName(["Flag of Eurth.png"]);

    expect(row).toMatchObject({
      pageId: 0,
      sha1: "",
      width: 0,
      height: 0,
      user: null,
      comment: null,
      timestamp: new Date("2026-09-01T00:00:00Z"),
    });
  });

  it("leaves out a file whose File: page was deleted, and asks nothing for no names", async () => {
    mdb.wikiAsset.findMany.mockResolvedValue([
      asset(),
      asset({ title: "Gone.png", filename: "Gone.png" }),
    ]);
    mdb.wikiArticle.findMany.mockImplementation(
      async ({ where }: { where: { status: unknown; title: { in: string[] } } }) =>
        where.status === "ARCHIVED" ? [{ title: "File:Gone.png" }] : []
    );

    const rows = await filesByName(["Flag of Eurth.png", "Gone.png"]);

    expect(rows.map((row) => row.name)).toEqual(["Flag of Eurth.png"]);
    mdb.wikiAsset.findMany.mockClear();
    expect(await filesByName([])).toEqual([]);
    expect(mdb.wikiAsset.findMany).not.toHaveBeenCalled();
  });
});

describe("listFiles", () => {
  const query = { dir: "ascending" as const, limit: 2 };

  it("reads limit + 1 assets in name order", async () => {
    mdb.wikiAsset.findMany.mockResolvedValue([
      asset(),
      asset({ title: "B.png", filename: "B.png" }),
      asset({ title: "C.png", filename: "C.png" }),
    ]);

    const rows = await listFiles(query);

    expect(rows.map((row) => row.name)).toEqual(["Flag of Eurth.png", "B.png", "C.png"]);
    expect(mdb.wikiAsset.findMany).toHaveBeenCalledWith({
      where: { filename: {} },
      orderBy: { filename: "asc" },
      take: 3,
    });
  });

  it("builds the bounds, prefix, content, type and size filters", async () => {
    await listFiles({
      ...query,
      prefix: "Fl",
      start: "Fla",
      end: "Flz",
      sha1: HEX,
      mimes: ["image/png"],
      minSize: 10,
      maxSize: 99,
    });

    expect(mdb.wikiAsset.findMany).toHaveBeenCalledWith({
      where: {
        filename: { startsWith: "Fl", gte: "Fla", lte: "Flz" },
        mimeType: { in: ["image/png"] },
        sha1: sha1HexToBase36(HEX),
        sizeBytes: { gte: 10, lte: 99 },
      },
      orderBy: { filename: "asc" },
      take: 3,
    });
  });

  it("runs the bounds the other way round when descending", async () => {
    await listFiles({ dir: "descending", limit: 2, start: "Fz", end: "Fa" });

    expect(mdb.wikiAsset.findMany).toHaveBeenCalledWith({
      where: { filename: { lte: "Fz", gte: "Fa" } },
      orderBy: { filename: "desc" },
      take: 3,
    });
  });

  it("reads on past a deleted file until the page is full, continuing after the last name it read", async () => {
    const make = (name: string) => asset({ title: name, filename: name });
    mdb.wikiAsset.findMany
      .mockResolvedValueOnce([make("A.png"), make("B.png"), make("C.png")])
      .mockResolvedValueOnce([make("D.png"), make("E.png")]);
    mdb.wikiArticle.findMany.mockImplementation(
      async ({ where }: { where: { status: unknown } }) =>
        where.status === "ARCHIVED" ? [{ title: "File:A.png" }, { title: "File:B.png" }] : []
    );

    const rows = await listFiles(query);

    expect(rows.map((row) => row.name)).toEqual(["C.png", "D.png", "E.png"]);
    expect(mdb.wikiAsset.findMany.mock.calls[1]?.[0].where.filename).toEqual({ gt: "C.png" });
  });
});
