/** @jest-environment node */
/**
 * The heraldry routers' guards: only an image Vexel rendered itself becomes a coat of arms (an imageless design or a
 * stored URL outside the render path is refused, and nothing changes, the map version included); charges are fetched
 * only from Wikimedia Commons over https (SSRF) and stored sanitised (XSS); another user's drafts and revision history
 * stay hidden; the notification tray acts on the caller only (IDOR); a render is owner-checked and lands at
 * server-chosen URLs as real PNGs (sharp).
 *
 * Folds: src/tests/server/api/routers/heraldry-attach-guard.test.ts,
 * src/tests/server/api/routers/heraldry-notifications-access.test.ts,
 * src/tests/server/api/routers/heraldry-render.test.ts
 */
jest.mock("~/lib/cache", () => ({
  ...jest.requireActual<typeof import("~/lib/cache")>("~/lib/cache"),
  invalidateCache: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("~/server/shared/map-invalidation", () => ({
  invalidateRealmMap: jest.fn().mockResolvedValue(1),
  invalidateAllRealmMaps: jest.fn().mockResolvedValue(undefined),
}));

import fs from "fs";
import os from "os";
import path from "path";
import sharp from "sharp";
import { heraldryMutationsRouter } from "~/server/api/routers/heraldry/mutations";
import { heraldryQueriesRouter } from "~/server/api/routers/heraldry/queries";
import { notificationsUserRouter } from "~/server/api/routers/notifications/user";
import { RENDERED_IMAGE_URL } from "~/lib/heraldry/constants";
import { invalidateAllRealmMaps, invalidateRealmMap } from "~/server/shared/map-invalidation";
import {
  CALLER_CLERK_ID,
  CALLER_COUNTRY,
  createIdorContext,
} from "~/tests/helpers/country-idor-context";

const DESIGN_ID = "6f1c2a52-6a8e-4b8e-9d55-0c1f7c1d2a11";
const CHARGE_ID = "0b6c3a9e-2f41-4c1e-8a57-3d2e9f1b7c40";

const composition = {
  shield: {
    shape: "heater",
    field: { division: "per-fess", tinctures: ["gules", "or"], lineStyle: "straight" },
    ordinaries: [],
    charges: [{ chargeId: CHARGE_ID, position: "fess-point", count: 1, tincture: "or", size: 1 }],
  },
};

let uploadDir: string;
const originalUploadDir = process.env.UPLOAD_DIR;

beforeEach(() => {
  jest.clearAllMocks();
  uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), "vexel-render-"));
  process.env.UPLOAD_DIR = uploadDir;
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(uploadDir, { recursive: true, force: true });
  if (originalUploadDir === undefined) delete process.env.UPLOAD_DIR;
  else process.env.UPLOAD_DIR = originalUploadDir;
});

/** The caller's design (or `ownerId`'s), whose one charge carries a script. */
function designCaller(
  design: Partial<{ ownerId: string; thumbnailUrl: string | null; largeUrl: string | null }>
) {
  const row = {
    id: DESIGN_ID,
    ownerId: CALLER_CLERK_ID,
    compositionData: composition,
    thumbnailUrl: null,
    largeUrl: null,
    ...design,
  };
  // the stored row: what a render writes is what the next read sees
  const update = jest.fn(async ({ data }: { data: object }) => Object.assign(row, data));
  const ctx = createIdorContext({
    heraldryAchievement: {
      findUnique: jest.fn(async () => ({ ...row })),
      update,
    },
    heraldryRevision: { create: jest.fn().mockResolvedValue({}) },
    heraldryCharge: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: CHARGE_ID,
          svgData:
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><script>alert(1)</script>' +
            '<circle cx="50" cy="50" r="40" fill="#123456"/></svg>',
        },
      ]),
    },
  });
  const countryUpdate = jest.fn().mockResolvedValue({});
  ctx.db.country.update = countryUpdate;
  return { caller: heraldryMutationsRouter.createCaller(ctx), update, countryUpdate };
}

const fileFor = (url: string) => path.join(uploadDir, path.basename(url));

describe("attachToCountry takes only an image Vexel rendered", () => {
  it.each([
    { name: "a design with no image", url: null },
    {
      name: "a stored URL that climbs out of the render path",
      url: `/images/uploads/heraldry_${DESIGN_ID}_0123456789abcdef_256.png/../../x`,
    },
  ])("refuses $name and changes nothing", async ({ url }) => {
    const { caller, countryUpdate } = designCaller({ thumbnailUrl: url, largeUrl: url });

    await expect(
      caller.attachToCountry({ achievementId: DESIGN_ID, countryId: CALLER_COUNTRY })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringMatching(/no rendered image/),
    });
    expect(countryUpdate).not.toHaveBeenCalled();
    expect(invalidateRealmMap).not.toHaveBeenCalled();
    expect(invalidateAllRealmMaps).not.toHaveBeenCalled();
  });
});

describe("importCommonsCharge", () => {
  const charge = (url: string) => ({
    name: "Lion",
    category: "ANIMALS" as const,
    url,
    license: "CC0",
  });

  it("refuses a URL that is not upload.wikimedia.org over https without fetching it (SSRF)", async () => {
    const fetchSpy = jest.spyOn(global, "fetch");
    const caller = heraldryMutationsRouter.createCaller(createIdorContext({}));

    await expect(
      caller.importCommonsCharge(charge("http://localhost:5432/"))
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("stores a Commons SVG with its scripts and handlers stripped (XSS)", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><path d="M0 0" onload="alert(2)"/></svg>'
        )
      );
    const create = jest.fn(async ({ data }: { data: { svgData: string } }) => data);
    const caller = heraldryMutationsRouter.createCaller(
      createIdorContext({ heraldryCharge: { create } })
    );

    await caller.importCommonsCharge(
      charge("https://upload.wikimedia.org/wikipedia/commons/a/a0/Lion.svg")
    );

    const stored = create.mock.calls[0]![0].data.svgData;
    expect(stored).toMatch(/<path/);
    expect(stored).not.toMatch(/script|onload|alert/i);
  });
});

describe("another user's drafts stay hidden", () => {
  function queriesAs(clerkId: string, design: { ownerId: string; isPublished: boolean }) {
    const ctx = createIdorContext({
      heraldryAchievement: {
        findUnique: jest.fn().mockResolvedValue({ id: DESIGN_ID, ...design }),
      },
      heraldryRevision: { findMany: jest.fn().mockResolvedValue([{ id: "r1" }]) },
    });
    ctx.auth = { userId: clerkId };
    return heraldryQueriesRouter.createCaller(ctx);
  }

  it("an unpublished design is not found for anyone but its owner", async () => {
    await expect(
      queriesAs("user_other", { ownerId: CALLER_CLERK_ID, isPublished: false }).getAchievement({
        id: DESIGN_ID,
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("a published design's revision history is the owner's alone", async () => {
    await expect(
      queriesAs("user_other", { ownerId: CALLER_CLERK_ID, isPublished: true }).getRevisionHistory({
        achievementId: DESIGN_ID,
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

it("markAllAsRead marks the caller's notifications, never those of a userId the client sends (IDOR)", async () => {
  const updateMany = jest.fn().mockResolvedValue({ count: 0 });
  const ctx = createIdorContext({
    notification: { updateMany },
    user: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(null),
    },
  });
  await notificationsUserRouter.createCaller(ctx).markAllAsRead({ userId: "user_victim" });
  const where = JSON.stringify(updateMany.mock.calls[0]![0].where);
  expect(where).not.toContain("user_victim");
  expect(where).toContain(CALLER_CLERK_ID);
});

describe("renderAchievementImage", () => {
  it("refuses a design the caller does not own and writes nothing, on disk or in the database", async () => {
    const { caller, update } = designCaller({ ownerId: "user_someone_else" });

    await expect(caller.renderAchievementImage({ id: DESIGN_ID })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(update).not.toHaveBeenCalled();
    expect(fs.readdirSync(uploadDir)).toEqual([]);
  });

  it("the owner renders 256px and 1024px PNGs at server-chosen URLs and attaches one, leaving the map version alone", async () => {
    const { caller, update, countryUpdate } = designCaller({});

    const result = await caller.renderAchievementImage({ id: DESIGN_ID });

    expect(result.thumbnailUrl).toMatch(RENDERED_IMAGE_URL);
    expect(result.largeUrl).toMatch(RENDERED_IMAGE_URL);
    expect(update).toHaveBeenCalledWith({ where: { id: DESIGN_ID }, data: result });
    const thumb = await sharp(fs.readFileSync(fileFor(result.thumbnailUrl!))).metadata();
    const large = await sharp(fs.readFileSync(fileFor(result.largeUrl!))).metadata();
    expect([thumb.format, thumb.width, thumb.height]).toEqual(["png", 256, 256]);
    expect([large.format, large.width, large.height]).toEqual(["png", 1024, 1024]);
    // the shield is actually drawn: the centre pixel (the library charge) is opaque
    const { data, info } = await sharp(fileFor(result.thumbnailUrl!))
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect(data[(128 * info.width + 128) * info.channels + 3]).toBe(255);

    await caller.attachToCountry({ achievementId: DESIGN_ID, countryId: CALLER_COUNTRY });
    expect(countryUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ coatOfArms: result.thumbnailUrl }),
      })
    );
    // a coat of arms is not on the political layer
    expect(invalidateRealmMap).not.toHaveBeenCalled();
    expect(invalidateAllRealmMaps).not.toHaveBeenCalled();
  });
});
