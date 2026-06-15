/**
 * Border History tRPC procedures.
 *
 * Read-only historical view of the political layer: given a target IxTime,
 * return the political FeatureCollection as it would have appeared at that
 * time, with each country's geometry replaced by the latest BorderHistory
 * snapshot whose `changedAt <= asOf` (or the current geometry if no such
 * snapshot exists).
 *
 * Limitations: BorderHistory is edit-driven, not authored-era-driven. Countries
 * with no history rows show their current border at every date. Full bitemporal
 * `validFrom`/`validTo` is a deferred follow-up.
 */
import { z } from "zod";
import { cachedPublicProcedure } from "~/server/api/trpc";
import { mergeBordersAsOf } from "~/lib/border-history-asof";
import { loadLayerFromDB, loadGeoJSONFromFile } from "./layer-loader";
import { getZoomBucket } from "./cache";
import { IxTime } from "~/lib/ixtime";

export const borderHistoryProcedures = {
  /**
   * Political FeatureCollection as it appeared at the given IxTime.
   * Accepts an epoch-ms IxTime number (matches `IxTime.getCurrentIxTime()`).
   */
  getWorldMapAsOf: cachedPublicProcedure
    .input(
      z.object({
        ixTime: z.number(),
        zoom: z.number().min(0).max(20).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const asOf = new Date(input.ixTime);

      const zoomBucket = getZoomBucket(input.zoom);
      const politicalFC =
        (await loadLayerFromDB(ctx.db, "political", zoomBucket)) ??
        (await loadGeoJSONFromFile("political").catch(() => null));

      if (!politicalFC) {
        return { type: "FeatureCollection" as const, features: [] };
      }

      const history = await ctx.db.borderHistory.findMany({
        where: { changedAt: { lte: asOf } },
        select: { countryId: true, geometry: true, changedAt: true },
      });

      const features = mergeBordersAsOf(
        politicalFC.features,
        history.map((h) => ({
          countryId: h.countryId,
          geometry: h.geometry,
          changedAt: h.changedAt,
        })),
        asOf
      );

      return { type: "FeatureCollection" as const, features };
    }),

  /**
   * Slider domain: earliest BorderHistory timestamp + current IxTime ("now").
   * Returns `minTime: null` when there is no history yet (caller should hide
   * the scrubber in that case).
   */
  getHistoryRange: cachedPublicProcedure.query(async ({ ctx }) => {
    const earliest = await ctx.db.borderHistory.findFirst({
      orderBy: { changedAt: "asc" },
      select: { changedAt: true },
    });
    return {
      minTime: earliest?.changedAt.getTime() ?? null,
      maxTime: IxTime.getCurrentIxTime(),
    };
  }),
};
