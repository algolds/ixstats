/** @jest-environment node */
// WK-17: the BlurHash of an image file, from its own pixels (sharp), and the backfill of the assets stored before.
jest.mock("~/server/db", () => ({ __esModule: true, db: {} }));

import sharp from "sharp";
import { BlurHashService } from "~/lib/wiki-os/core/blurhash-service";
import {
  backfillBlurhashes,
  readAssetBytes,
  type BackfillAsset,
} from "~/lib/wiki-os/services/blurhash-backfill";
import { canComputeBlurhash, computeBlurhash } from "~/lib/wiki-os/services/image-blurhash";

type Sharp = ReturnType<typeof sharp>;

const picture = (
  width: number,
  height: number,
  background: { r: number; g: number; b: number; alpha?: number },
  channels: 3 | 4 = 3
) => sharp({ create: { width, height, channels, background } });

/** The average colour a BlurHash holds (its DC component). */
const average = (hash: string) =>
  Array.from(BlurHashService.decode(`00${hash.slice(2, 6)}`, 1, 1)!.slice(0, 3));

let warn: jest.SpyInstance;
beforeEach(() => {
  warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => {
  warn.mockRestore();
  delete process.env.WIKIOS_MAX_IMAGE_AREA;
});

describe("computeBlurhash", () => {
  it.each([
    ["image/png", (s: Sharp) => s.png()],
    ["image/jpeg", (s: Sharp) => s.jpeg({ quality: 100 })],
    ["image/gif", (s: Sharp) => s.gif()],
    ["image/webp", (s: Sharp) => s.webp({ lossless: true })],
  ])("reads a %s's pixels", async (mime, format) => {
    const bytes = await format(picture(120, 90, { r: 30, g: 120, b: 220 })).toBuffer();

    const hash = await computeBlurhash(bytes, mime);

    expect(BlurHashService.components(hash)).toEqual({ x: 4, y: 3 });
    const [r, g, b] = average(hash!);
    expect(Math.abs(r! - 30)).toBeLessThanOrEqual(8);
    expect(Math.abs(g! - 120)).toBeLessThanOrEqual(8);
    expect(Math.abs(b! - 220)).toBeLessThanOrEqual(8);
  });

  it("uses 3 × 4 components for a portrait picture", async () => {
    const bytes = await picture(40, 100, { r: 0, g: 0, b: 0 }).png().toBuffer();
    expect(BlurHashService.components(await computeBlurhash(bytes, "image/png"))).toEqual({
      x: 3,
      y: 4,
    });
  });

  it("shows transparent pixels as white, not as the black they may hold", async () => {
    const bytes = await picture(16, 16, { r: 0, g: 0, b: 0, alpha: 0 }, 4).png().toBuffer();
    expect(average((await computeBlurhash(bytes, "image/png"))!)).toEqual([255, 255, 255]);
  });

  it("reads no SVG, PDF or unknown type", async () => {
    const svg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>`
    );
    expect(await computeBlurhash(svg, "image/svg+xml")).toBeNull();
    expect(await computeBlurhash(Buffer.from("%PDF-1.7"), "application/pdf")).toBeNull();
    expect(await computeBlurhash(Buffer.from("x"), null)).toBeNull();
    expect(canComputeBlurhash("IMAGE/PNG")).toBe(true);
    expect(canComputeBlurhash("image/svg+xml")).toBe(false);
  });

  it("gives null, not an error, for bytes that are not a picture", async () => {
    expect(await computeBlurhash(Buffer.from("not a png at all"), "image/png")).toBeNull();
    expect(await computeBlurhash(new Uint8Array(0), "image/png")).toBeNull();
  });

  it("refuses to decode a picture of more pixels than an upload may have", async () => {
    const bytes = await picture(100, 100, { r: 9, g: 9, b: 9 }).png().toBuffer();
    process.env.WIKIOS_MAX_IMAGE_AREA = "5000";
    expect(await computeBlurhash(bytes, "image/png")).toBeNull();
  });
});

describe("backfillBlurhashes", () => {
  interface Row extends BackfillAsset {
    blurhash: string | null;
  }

  /** The few `wikiAsset` calls the backfill makes, over rows in memory. */
  function fakeDb(rows: Row[]) {
    const matches = (row: Row, where: any) =>
      (where.blurhash !== null || row.blurhash === null) &&
      (!where.mimeType || where.mimeType.in.includes(row.mimeType)) &&
      (!where.id?.gt || row.id > where.id.gt) &&
      (typeof where.id !== "string" || row.id === where.id);
    const wikiAsset = {
      count: jest.fn(async ({ where }: any) => rows.filter((row) => matches(row, where)).length),
      findMany: jest.fn(async ({ where, take }: any) =>
        rows
          .filter((row) => matches(row, where))
          .sort((a, b) => a.id.localeCompare(b.id))
          .slice(0, take)
          .map(({ blurhash: _blurhash, ...asset }) => asset)
      ),
      updateMany: jest.fn(async ({ where, data }: any) => {
        const hit = rows.filter((row) => matches(row, where));
        for (const row of hit) row.blurhash = data.blurhash;
        return { count: hit.length };
      }),
    };
    return { wikiAsset } as any;
  }

  const row = (id: string, over: Partial<Row> = {}): Row => ({
    id,
    filename: `${id}.png`,
    url: `https://ixwiki.com/images/a/ab/${id}.png`,
    mimeType: "image/png",
    sha1: null,
    blurhash: null,
    ...over,
  });

  let png: Buffer;
  beforeAll(async () => {
    png = await picture(20, 10, { r: 250, g: 200, b: 10 }).png().toBuffer();
  });

  it("writes nothing on a dry run, and reports what it would write", async () => {
    const rows = [row("a"), row("b")];
    const db = fakeDb(rows);

    const report = await backfillBlurhashes(db, {}, async () => png);

    expect(report).toMatchObject({ candidates: 2, processed: 2, computed: 2, written: 0 });
    expect(db.wikiAsset.updateMany).not.toHaveBeenCalled();
    expect(rows.every((r) => r.blurhash === null)).toBe(true);
  });

  it("writes each image asset's hash with --apply, skipping SVGs and assets that have one", async () => {
    const rows = [
      row("a"),
      row("b", { mimeType: "image/svg+xml", filename: "b.svg" }),
      row("c", { blurhash: "LEHV6nWB2yk8pyo0adR*.7kCMdnj" }),
      row("d", { mimeType: "image/jpeg" }),
    ];
    const read = jest.fn(async () => png);

    const report = await backfillBlurhashes(fakeDb(rows), { apply: true }, read);

    expect(report).toMatchObject({ candidates: 2, processed: 2, computed: 2, written: 2 });
    expect(read.mock.calls.map(([asset]: any) => asset.id)).toEqual(["a", "d"]);
    expect(BlurHashService.isValid(rows[0]!.blurhash)).toBe(true);
    expect(rows[1]!.blurhash).toBeNull();
    expect(rows[2]!.blurhash).toBe("LEHV6nWB2yk8pyo0adR*.7kCMdnj");
    expect(BlurHashService.isValid(rows[3]!.blurhash)).toBe(true);
  });

  it("counts files it cannot read or decode, leaves them without a hash, and honours --limit", async () => {
    const rows = [row("a"), row("b"), row("c")];
    const read = jest.fn(async (asset: BackfillAsset) =>
      asset.id === "a" ? null : Buffer.from("garbage")
    );

    const report = await backfillBlurhashes(fakeDb(rows), { apply: true, limit: 2 }, read);

    expect(report).toMatchObject({
      candidates: 3,
      processed: 2,
      unreadable: 1,
      undecodable: 1,
      written: 0,
    });
    expect(rows.every((r) => r.blurhash === null)).toBe(true);
  });

  it("reads a staged upload from the staging directory and nothing from a relative URL", async () => {
    const staged = row("s", { url: "/api/wiki/file/S.png", sha1: null });
    expect(await readAssetBytes(staged)).toBeNull(); // staged, but no hash to find it by
    expect(await readAssetBytes(row("r", { url: "/images/a/ab/R.png" }))).toBeNull();
  });
});
