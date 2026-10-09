/** @jest-environment node */
import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import sharp from "sharp";

const mockUpsert = jest.fn<(args: unknown) => Promise<unknown>>();
const mockFindMany = jest.fn<(args: unknown) => Promise<unknown[]>>();

jest.mock("~/server/db", () => ({
  db: {
    uploadedAsset: {
      upsert: (a: unknown) => mockUpsert(a),
      findMany: (a: unknown) => mockFindMany(a),
    },
  },
}));

import {
  registerUploadedAsset,
  listUploadedAssets,
} from "~/server/shared/uploaded-assets";

let dir: string;
let pngPath: string;

beforeEach(async () => {
  mockUpsert.mockReset();
  mockFindMany.mockReset();
  mockUpsert.mockImplementation(async (args) => {
    const { create } = args as { create: Record<string, unknown> };
    return { id: "a1", createdAt: new Date("2026-10-09T00:00:00Z"), ...create };
  });
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "uploaded-assets-"));
  pngPath = path.join(dir, "tiny.png");
  const png = await sharp({
    create: { width: 40, height: 20, channels: 3, background: { r: 200, g: 40, b: 40 } },
  })
    .png()
    .toBuffer();
  await fs.writeFile(pngPath, png);
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe("registerUploadedAsset", () => {
  it("records dimensions, writes a thumbnail and computes a blurhash", async () => {
    const record = await registerUploadedAsset({
      filePath: pngPath,
      url: "/images/uploads/tiny.png",
      mimeType: "image/png",
      source: "upload",
      uploaderClerkId: "user_1",
    });
    expect(record).not.toBeNull();
    expect(record).toMatchObject({
      width: 40,
      height: 20,
      thumbUrl: "/images/uploads/tiny.png.thumb.webp",
      title: "tiny.png",
      source: "upload",
    });
    expect(record?.blurhash).toEqual(expect.any(String));
    expect(record?.sizeBytes).toBeGreaterThan(0);
    await expect(fs.stat(`${pngPath}.thumb.webp`)).resolves.toBeDefined();
    const args = mockUpsert.mock.calls[0]![0] as { where: unknown };
    expect(args.where).toEqual({ url: "/images/uploads/tiny.png" });
  });

  it("upserts by source and sourceRef when a sourceRef is given", async () => {
    await registerUploadedAsset({
      filePath: pngPath,
      url: "/images/uploads/forum/9-tiny.png",
      mimeType: "image/png",
      source: "forum",
      sourceRef: "9",
      title: "Photo",
    });
    const args = mockUpsert.mock.calls[0]![0] as { where: unknown; create: { title: string } };
    expect(args.where).toEqual({ source_sourceRef: { source: "forum", sourceRef: "9" } });
    expect(args.create.title).toBe("Photo");
  });

  it("reads SVG dimensions from width/height or viewBox without a thumbnail", async () => {
    const svgPath = path.join(dir, "a.svg");
    await fs.writeFile(svgPath, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 60"><rect/></svg>');
    const record = await registerUploadedAsset({
      filePath: svgPath,
      url: "/images/uploads/a.svg",
      mimeType: "image/svg+xml",
      source: "upload",
    });
    expect(record).toMatchObject({ width: 120, height: 60, thumbUrl: null, blurhash: null });
  });

  it("returns null without throwing when the table is missing", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    mockUpsert.mockRejectedValue(Object.assign(new Error("no table"), { code: "P2021" }));
    await expect(
      registerUploadedAsset({
        filePath: pngPath,
        url: "/images/uploads/tiny.png",
        mimeType: "image/png",
        source: "upload",
      })
    ).resolves.toBeNull();
    warn.mockRestore();
  });

  it("returns null when the file cannot be read", async () => {
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(
      registerUploadedAsset({
        filePath: path.join(dir, "missing.png"),
        url: "/x.png",
        mimeType: "image/png",
        source: "upload",
      })
    ).resolves.toBeNull();
    error.mockRestore();
  });
});

describe("listUploadedAssets", () => {
  const row = (id: string, iso: string) => ({
    id,
    url: `/u/${id}.png`,
    thumbUrl: null,
    title: id,
    mimeType: "image/png",
    width: 1,
    height: 1,
    sizeBytes: 1,
    blurhash: null,
    source: "upload",
    createdAt: new Date(iso),
  });

  it("round-trips the keyset cursor", async () => {
    mockFindMany.mockResolvedValueOnce([
      row("c", "2026-10-03T00:00:00.000Z"),
      row("b", "2026-10-02T00:00:00.000Z"),
      row("a", "2026-10-01T00:00:00.000Z"),
    ]);
    const first = await listUploadedAssets({ source: "upload", limit: 2 });
    expect(first.items.map((i) => i.id)).toEqual(["c", "b"]);
    expect(first.nextCursor).toEqual(expect.any(String));
    expect(mockFindMany.mock.calls[0]![0]).toMatchObject({ take: 3 });

    mockFindMany.mockResolvedValueOnce([row("a", "2026-10-01T00:00:00.000Z")]);
    const second = await listUploadedAssets({
      source: "upload",
      limit: 2,
      cursor: first.nextCursor,
      query: "a",
      uploaderClerkId: "user_1",
    });
    expect(second.nextCursor).toBeNull();
    const args = mockFindMany.mock.calls[1]![0] as { where: Record<string, unknown> };
    expect(args.where).toMatchObject({
      source: "upload",
      uploaderClerkId: "user_1",
      title: { contains: "a", mode: "insensitive" },
      AND: [
        {
          OR: [
            { createdAt: { lt: new Date("2026-10-02T00:00:00.000Z") } },
            { createdAt: new Date("2026-10-02T00:00:00.000Z"), id: { lt: "b" } },
          ],
        },
      ],
    });
  });

  it("gives an empty page when the table is missing", async () => {
    mockFindMany.mockRejectedValue(Object.assign(new Error("no table"), { code: "P2021" }));
    await expect(listUploadedAssets({ source: "forum", limit: 5 })).resolves.toEqual({
      items: [],
      nextCursor: null,
    });
  });
});
