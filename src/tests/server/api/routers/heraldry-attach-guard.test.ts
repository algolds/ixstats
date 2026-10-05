/** Vexel attach: a design with no rendered image must not blank the country's coat of arms. */
jest.mock("~/lib/cache", () => ({
  ...jest.requireActual("~/lib/cache"),
  invalidateCache: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("~/server/shared/layer-cache", () => ({ clearLayerCache: jest.fn() }));

import { heraldryMutationsRouter } from "~/server/api/routers/heraldry/mutations";
import {
  CALLER_CLERK_ID,
  CALLER_COUNTRY,
  createIdorContext,
} from "~/tests/helpers/country-idor-context";

const ACHIEVEMENT_ID = "6f1c2a52-6a8e-4b8e-9d55-0c1f7c1d2a11";

function attachCaller(achievement: { thumbnailUrl: string | null; largeUrl: string | null }) {
  const ctx = createIdorContext({
    heraldryAchievement: {
      findUnique: jest.fn().mockResolvedValue({
        id: ACHIEVEMENT_ID,
        ownerId: CALLER_CLERK_ID,
        ...achievement,
      }),
    },
  });
  ctx.db.country.update = jest.fn().mockResolvedValue({});
  return { caller: heraldryMutationsRouter.createCaller(ctx), update: ctx.db.country.update };
}

describe("heraldry.attachToCountry", () => {
  it("refuses a design with no image and leaves the coat of arms alone", async () => {
    const { caller, update } = attachCaller({ thumbnailUrl: null, largeUrl: null });

    await expect(
      caller.attachToCountry({ achievementId: ACHIEVEMENT_ID, countryId: CALLER_COUNTRY })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringMatching(/no rendered image/),
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("writes the design's image when it has one", async () => {
    const { caller, update } = attachCaller({ thumbnailUrl: null, largeUrl: "/arms/large.png" });

    await expect(
      caller.attachToCountry({ achievementId: ACHIEVEMENT_ID, countryId: CALLER_COUNTRY })
    ).resolves.toEqual({ success: true });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ coatOfArms: "/arms/large.png" }) })
    );
  });
});
