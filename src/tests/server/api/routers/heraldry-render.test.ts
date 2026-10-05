/**
 * @jest-environment node
 */
/** Vexel coat-of-arms render: owner-checked, server-built URLs, real PNGs via sharp. */
jest.mock("~/lib/cache", () => ({
  ...jest.requireActual("~/lib/cache"),
  invalidateCache: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("~/server/shared/layer-cache", () => ({ clearLayerCache: jest.fn() }));

import fs from "fs";
import os from "os";
import path from "path";
import sharp from "sharp";
import { heraldryMutationsRouter } from "~/server/api/routers/heraldry/mutations";
import { RENDERED_IMAGE_URL } from "~/server/api/routers/heraldry/render";
import {
  CALLER_CLERK_ID,
  CALLER_COUNTRY,
  createIdorContext,
} from "~/tests/helpers/country-idor-context";

const ACHIEVEMENT_ID = "6f1c2a52-6a8e-4b8e-9d55-0c1f7c1d2a11";
const CHARGE_ID = "0b6c3a9e-2f41-4c1e-8a57-3d2e9f1b7c40";

const composition = {
  shield: {
    shape: "heater",
    field: { division: "per-fess", tinctures: ["gules", "or"], lineStyle: "straight" },
    ordinaries: [],
    charges: [{ chargeId: CHARGE_ID, position: "fess-point", count: 1, tincture: "or", size: 1 }],
  },
};

const chargeSvg =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><script>alert(1)</script>' +
  '<circle cx="50" cy="50" r="40" fill="#123456"/></svg>';

let uploadDir: string;
const originalUploadDir = process.env.UPLOAD_DIR;

beforeEach(() => {
  uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), "vexel-render-"));
  process.env.UPLOAD_DIR = uploadDir;
});

afterEach(() => {
  fs.rmSync(uploadDir, { recursive: true, force: true });
  if (originalUploadDir === undefined) delete process.env.UPLOAD_DIR;
  else process.env.UPLOAD_DIR = originalUploadDir;
});

function setup(
  achievement: Partial<{ ownerId: string; thumbnailUrl: string | null; largeUrl: string | null }>
) {
  const row = {
    id: ACHIEVEMENT_ID,
    ownerId: CALLER_CLERK_ID,
    compositionData: composition,
    thumbnailUrl: null,
    largeUrl: null,
    ...achievement,
  };
  const update = jest.fn(async ({ data }: { data: object }) => ({ ...row, ...data }));
  const ctx = createIdorContext({
    heraldryAchievement: {
      findUnique: jest.fn().mockResolvedValue(row),
      create: jest.fn().mockResolvedValue(row),
      update,
    },
    heraldryRevision: { create: jest.fn().mockResolvedValue({}) },
    heraldryCharge: {
      findMany: jest.fn().mockResolvedValue([{ id: CHARGE_ID, svgData: chargeSvg }]),
    },
  });
  ctx.db.country.update = jest.fn().mockResolvedValue({});
  return { caller: heraldryMutationsRouter.createCaller(ctx), update, ctx };
}

const fileFor = (url: string) => path.join(uploadDir, path.basename(url));

describe("heraldry.renderAchievementImage", () => {
  it("renders the owner's design to 256px and 1024px PNGs at server-chosen URLs", async () => {
    const { caller, update } = setup({});

    const result = await caller.renderAchievementImage({ id: ACHIEVEMENT_ID });

    expect(result.thumbnailUrl).toMatch(RENDERED_IMAGE_URL);
    expect(result.largeUrl).toMatch(RENDERED_IMAGE_URL);
    expect(result.thumbnailUrl).toMatch(/_256\.png$/);
    expect(result.largeUrl).toMatch(/_1024\.png$/);
    expect(update).toHaveBeenCalledWith({ where: { id: ACHIEVEMENT_ID }, data: result });

    const thumb = await sharp(fs.readFileSync(fileFor(result.thumbnailUrl!))).metadata();
    const large = await sharp(fs.readFileSync(fileFor(result.largeUrl!))).metadata();
    expect([thumb.format, thumb.width, thumb.height]).toEqual(["png", 256, 256]);
    expect([large.format, large.width, large.height]).toEqual(["png", 1024, 1024]);

    // The shield is actually drawn: the centre pixel (the library charge) is opaque.
    const { data, info } = await sharp(fileFor(result.thumbnailUrl!))
      .raw()
      .toBuffer({ resolveWithObject: true });
    const centre = (128 * info.width + 128) * info.channels;
    expect(data[centre + 3]).toBe(255);
  });

  it("refuses a design the caller does not own and writes nothing", async () => {
    const { caller, update } = setup({ ownerId: "user_someone_else" });

    await expect(caller.renderAchievementImage({ id: ACHIEVEMENT_ID })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(update).not.toHaveBeenCalled();
    expect(fs.readdirSync(uploadDir)).toEqual([]);
  });
});

describe("heraldry.saveAchievement", () => {
  it("stores rendered image URLs with the saved design", async () => {
    const { caller } = setup({});

    const saved = await caller.saveAchievement({
      title: "Arms",
      subjectType: "COUNTRY",
      subjectId: CALLER_COUNTRY,
      compositionData: composition as never,
    });

    expect(saved.thumbnailUrl).toMatch(RENDERED_IMAGE_URL);
    expect(saved.largeUrl).toMatch(RENDERED_IMAGE_URL);
    expect(fs.existsSync(fileFor(saved.thumbnailUrl!))).toBe(true);
  });
});

describe("heraldry.attachToCountry image URL check", () => {
  it.each([
    "https://evil.example/arms.png",
    "/images/uploads/uploaded_1700000000000_abcdef12_arms.png",
    `/images/uploads/heraldry_${ACHIEVEMENT_ID}_0123456789abcdef_256.png/../../x`,
  ])("refuses a stored URL Vexel did not render: %s", async (url) => {
    const { caller, ctx } = setup({ thumbnailUrl: url, largeUrl: url });

    await expect(
      caller.attachToCountry({ achievementId: ACHIEVEMENT_ID, countryId: CALLER_COUNTRY })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(ctx.db.country.update).not.toHaveBeenCalled();
  });

  it("attaches the rendered thumbnail", async () => {
    const url = `/images/uploads/heraldry_${ACHIEVEMENT_ID}_0123456789abcdef_256.png`;
    const { caller, ctx } = setup({ thumbnailUrl: url });

    await caller.attachToCountry({ achievementId: ACHIEVEMENT_ID, countryId: CALLER_COUNTRY });
    expect(ctx.db.country.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ coatOfArms: url }) })
    );
  });
});
