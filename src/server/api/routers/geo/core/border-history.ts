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
import { realmScopeInput, viewerRealmId } from "~/server/api/trpc/realm-scope";
import { mergeBordersAsOf } from "~/lib/maps/border-history-asof";
import { loadLayerWithFallback } from "./layer-loader";
import { getZoomBucket } from "./cache";
import { IxTime } from "~/lib/ixtime";
import { roundToIxDay } from "~/lib/ixtime/day";

/** Most countries one realm's map can hold: a backstop on the history read, which returns one row per country. */
const MAX_HISTORY_ROWS = 5000;

export const borderHistoryProcedures = {
  /**
   * Political FeatureCollection as it appeared at the given IxTime.
   * Accepts an epoch-ms IxTime number (matches `IxTime.getCurrentIxTime()`), taken as the start of its IxTime day:
   * the cache key is that day too, so one answer serves every scrub position within it.
   */
  getWorldMapAsOf: cachedPublicProcedure
    .input(
      z.object({
        ixTime: z.number(),
        zoom: z.number().min(0).max(20).optional(),
        ...realmScopeInput.shape,
      })
    )
    .query(async ({ ctx, input }) => {
      const asOf = new Date(roundToIxDay(input.ixTime));
      const realmId = await viewerRealmId(ctx, input.realm);

      const politicalFC = await loadLayerWithFallback(
        ctx.db,
        "political",
        getZoomBucket(input.zoom),
        realmId
      );

      if (!politicalFC) {
        return { type: "FeatureCollection" as const, features: [] };
      }

      // The latest snapshot per country of this realm, which is all the merge uses
      const history = await ctx.db.borderHistory.findMany({
        where: { changedAt: { lte: asOf }, country: { realmId } },
        distinct: ["countryId"],
        orderBy: [{ countryId: "asc" }, { changedAt: "desc" }],
        take: MAX_HISTORY_ROWS,
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
