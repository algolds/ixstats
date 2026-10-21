/** @jest-environment node */
// WK-17: the BlurHash of an image file, from its own pixels (sharp), and the backfill of the assets stored before.
jest.mock("~/server/db", () => ({ __esModule: true, db: {} }));

import sharp from "sharp";
import { BlurHashService } from "~/lib/wiki-os/core/blurhash-service";
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
