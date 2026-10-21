/** @jest-environment node */
/**
 * Province imports take SVG markup or a base64 PNG: the content is capped like the Full Pipeline's PNG input, and an
 * image the decoder refuses (over the pixel limit, corrupt) is the uploader's input, not a server fault.
 */
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/flags/png-to-svg", () => ({ extractProvincesFromPng: jest.fn() }));

import { createCallerFactory } from "~/server/api/trpc";
import { geoAdminProvincesRouter } from "~/server/api/routers/geo/admin/provinces";
import { extractProvincesFromPng } from "~/lib/flags/png-to-svg";
import { MAX_PNG_BASE64_LENGTH, PngDecodeError } from "~/lib/maps/png-realm-map";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const extractMock = extractProvincesFromPng as jest.Mock;

const admin = {
  id: "u_admin",
  clerkUserId: "admin_1",
  countryId: null,
  role: { name: "admin", level: 10 },
  country: null,
};

function caller() {
  const db = {
    mapLayer: { findFirst: jest.fn().mockResolvedValue(null) },
    svgUpload: { findUnique: jest.fn().mockResolvedValue(null) },
    user: { findUnique: jest.fn().mockResolvedValue(admin) },
  };
  return createCallerFactory(geoAdminProvincesRouter)(
    createMockRouterContext({ db, auth: { userId: "admin_1" }, user: admin }) as never
  );
}

/** Non-markup content is read as a base64 PNG. */
const PNG_BASE64 = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]).toString("base64");

beforeEach(() => extractMock.mockReset());

describe("geoAdmin.parseProvinceUpload — upload limits", () => {
  it("refuses content over the size limit before decoding anything", async () => {
    await expect(
      caller().parseProvinceUpload({
        countryId: "c1",
        svgContent: "A".repeat(MAX_PNG_BASE64_LENGTH + 4),
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(extractMock).not.toHaveBeenCalled();
  });

  it("an image the decoder refuses is BAD_REQUEST with its reason", async () => {
    extractMock.mockRejectedValue(new PngDecodeError("it is 9000×9000 pixels"));
    await expect(
      caller().parseProvinceUpload({ countryId: "c1", svgContent: PNG_BASE64 })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringMatching(/64 megapixels.*9000×9000 pixels$/),
    });
  });

  it("any other failure is not disguised as bad input", async () => {
    extractMock.mockRejectedValue(new Error("out of memory"));
    await expect(
      caller().parseProvinceUpload({ countryId: "c1", svgContent: PNG_BASE64 })
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });

  it("passes an ordinary PNG to the province extractor", async () => {
    extractMock.mockResolvedValue({ provinces: [], width: 40, height: 20, log: [] });
    const result = await caller().parseProvinceUpload({ countryId: "c1", svgContent: PNG_BASE64 });
    expect(result.viewBox).toEqual({ width: 40, height: 20 });
    expect(extractMock).toHaveBeenCalledTimes(1);
  });
});
