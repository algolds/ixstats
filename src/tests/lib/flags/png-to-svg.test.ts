/** @jest-environment node */
import { extractProvincesFromPng } from "~/lib/flags/png-to-svg";
import { PngDecodeError } from "~/lib/maps/png-realm-map";
import { pngClaimingSize, twoNationPng } from "~/tests/fixtures/png-maps";

describe("decoding the map image", () => {
  it("turns an unreadable image into a PngDecodeError", async () => {
    await expect(extractProvincesFromPng(Buffer.from("not an image at all"))).rejects.toThrow(
      PngDecodeError
    );
  });

  it("refuses an image over 64 megapixels", async () => {
    const huge = await pngClaimingSize(8193, 8192);
    await expect(extractProvincesFromPng(huge)).rejects.toMatchObject({
      name: "PngDecodeError",
      message: expect.stringMatching(/64 megapixels/),
    });
  });
});

describe("extractProvincesFromPng — decompression bombs", () => {
  it("refuses an oversize image from its header, before decoding a pixel", async () => {
    const huge = await pngClaimingSize(9000, 9000);
    await expect(extractProvincesFromPng(huge)).rejects.toMatchObject({
      name: "PngDecodeError",
      message: expect.stringMatching(/it is 9000×9000 pixels$/),
    });
  });

  it("still decodes an ordinary map", async () => {
    const result = await extractProvincesFromPng(await twoNationPng(), { minRegionPixels: 10 });
    expect(result).toMatchObject({ width: 40, height: 20 });
  });
});
