/** @jest-environment node */
// WK-17: the BlurHash of an image file, from its own pixels (sharp), and the backfill of the assets stored before.
jest.mock("~/server/db", () => ({ __esModule: true, db: {} }));

import sharp from "sharp";
import { computeBlurhash } from "~/lib/wiki-os/services/image-blurhash";

const picture = (
  width: number,
  height: number,
  background: { r: number; g: number; b: number; alpha?: number },
  channels: 3 | 4 = 3
) => sharp({ create: { width, height, channels, background } });
let warn: jest.SpyInstance;
beforeEach(() => {
  warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => {
  warn.mockRestore();
  delete process.env.WIKIOS_MAX_IMAGE_AREA;
});

describe("computeBlurhash", () => {
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
