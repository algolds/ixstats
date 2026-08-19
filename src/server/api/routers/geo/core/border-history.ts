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
import { TRPCError } from "@trpc/server";
import { cachedPublicProcedure } from "~/server/api/trpc";
import { mergeBordersAsOf } from "~/lib/maps/border-history-asof";
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

  /**
   * Dev-only seed: insert a synthetic `BorderHistory` row for a given country
   * using the country's CURRENT geometry as the snapshot, with a `changedAt`
   * 24h in the past. The goal is to make the timeline scrubber visible on a
   * fresh DB without requiring the operator to first perform a real admin
   * border edit. Refuses to run outside development.
   *
   * `countryId` is the `Country.id` (cuid), not the `featureId`. Call once
   * per country you want to appear in the scrubber domain.
   */
  seedBorderHistoryDev: cachedPublicProcedure
    .input(
      z.object({
        countryId: z.string(),
        daysAgo: z.number().int().min(1).max(365).default(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (process.env.NODE_ENV === "production") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "seedBorderHistoryDev is dev-only; refuses to run in production.",
        });
      }

      const country = await ctx.db.country.findUnique({
        where: { id: input.countryId },
        select: { id: true, geometry: true, name: true },
      });
      if (!country) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Country not found: ${input.countryId}`,
        });
      }
      if (!country.geometry) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Country has no geometry yet: ${country.name}`,
        });
      }

      const changedAt = new Date(Date.now() - input.daysAgo * 24 * 60 * 60 * 1000);
      const created = await ctx.db.borderHistory.create({
        data: {
          countryId: country.id,
          geometry: country.geometry as any,
          changedBy: "dev-seed",
          changedAt,
          reason: `Dev seed (${input.daysAgo}d ago) for timeline scrubber`,
        },
        select: { id: true, countryId: true, changedAt: true },
      });

      return { created };
    }),
};
