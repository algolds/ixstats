import { z } from "zod";
import {
  createTRPCRouter,
  cachedPublicProcedure,
  standardMutationCountryOwnerProcedure,
} from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { invalidateCache } from "~/lib/cache";
import { broadcastMapUpdate } from "~/lib/maps/map-update-bus";
import {
  getTerrainAtPoint,
  getCountryGeoBundle,
  upsertCity,
  upsertSubdivision,
  updateGeoRollupMode,
  rebaseNationalFromGeography,
} from "~/lib/country-geo";
import { assertOwnerMayEdit } from "~/server/shared/map-feature-lock";
import { realmScopeInput, viewerRealmId } from "~/server/api/trpc/realm-scope";

const GEO_CACHE_KEYS = [
  "geoCore.getCountryFeatures",
  "geoCore.getMapBundleMarkers",
  "geoCore.getMapBundleDetail",
  "geoCore.getWorldMapAsOf",
  "geoCore.getAllMapFeatures",
  "countryGeo.getCountryGeoBundle",
];
const GEO_ECONOMY_CACHE_KEYS = [...GEO_CACHE_KEYS, "countries.getByIdWithEconomicData"];

function assertOwnCountry(ctx: { country?: unknown }, countryId: string) {
  const owned = ctx.country as { id: string } | null | undefined;
  if (owned && owned.id !== countryId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
  }
}

const submitterId = (ctx: {
  auth?: { userId?: string | null } | null;
  user?: { clerkUserId?: string | null } | null;
}) => ctx.auth?.userId ?? ctx.user?.clerkUserId ?? "system";

export const countryGeoRouter = createTRPCRouter({
  /**
   * Get the unified geographic data bundle for a country.
   * Cached public query to reduce database load.
   */
  getCountryGeoBundle: cachedPublicProcedure
    .input(
      z.object({
        countryId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      return getCountryGeoBundle(ctx.db, input.countryId);
    }),

  /**
   * `sampleTerrainAt` — sample the terrain-zone elevation band at a (lng, lat) point.
   * Returns the matching altitudes-layer zone { zoneId, zoneName,
   * elevationMin, elevationMax, color, midpoint } or null if the point is
   * outside any zone (e.g., over the ocean for a country whose altitudes
   * layer is land-only). The `midpoint` is the deterministic value to use
   * as the city's "elevation" — it's `(elevationMin + elevationMax) / 2`,
   * rounded to the nearest integer, matching the convention already used
   * by `src/lib/map-pipeline.ts:186`.
   */
  sampleTerrainAt: cachedPublicProcedure
    .input(z.object({ lng: z.number(), lat: z.number(), ...realmScopeInput.shape }))
    .query(async ({ ctx, input }) => {
      // The viewed realm's altitude layer only: realms share coordinates
      const realmId = await viewerRealmId(ctx, input.realm);
      const result = await getTerrainAtPoint(ctx.db, input.lng, input.lat, realmId);
      if (!result.elevationZone) return null;
      const { elevationMin, elevationMax, zoneId, zoneName, color } = result.elevationZone;
      const midpoint = Math.round((elevationMin + elevationMax) / 2);
      return { zoneId, zoneName, elevationMin, elevationMax, color, midpoint };
    }),

  /**
   * Create or update a City.
   */
  upsertCity: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        id: z.string().optional(),
        name: z.string().min(1).max(100),
        type: z.string().default("city"),
        coordinates: z.tuple([z.number(), z.number()]).optional(),
        population: z.number().int().min(0).nullish(),
        isNationalCapital: z.boolean().nullish(),
        isSubdivisionCapital: z.boolean().nullish(),
        subdivisionId: z.string().nullish(),
        wikiPageTitle: z.string().max(200).nullish(),
        elevation: z.number().int().min(-500).max(9000).nullish(),
        foundedYear: z.number().int().nullish(),
        gdpContribution: z.number().min(0).nullish(),
        economyOutput: z.number().min(0).nullish(),
        specialization: z.string().max(100).nullish(),
        infrastructureLevel: z.number().int().min(0).max(10).nullish(),
        mayorName: z.string().max(100).nullish(),
        isPort: z.boolean().nullish(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertOwnCountry(ctx, input.countryId);
      if (input.id && ctx.country) {
        const where = { id: input.id, countryId: input.countryId };
        const existing = await ctx.db.city.findFirst({
          where,
          select: { editableByOwner: true },
        });
        assertOwnerMayEdit(ctx, existing, "city");
      }
      const city = await upsertCity(ctx.db, input.countryId, {
        ...input,
        submittedBy: submitterId(ctx),
      });

      await invalidateCache(GEO_CACHE_KEYS);
      if (input.isNationalCapital || city.isNationalCapital) {
        await invalidateCache(["geoCore.getCapitalCities"]);
      }
      broadcastMapUpdate("city", input.countryId);

      return city;
    }),

  /**
   * Create or update a Subdivision (attributes only).
   */
  upsertSubdivision: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        id: z.string().optional(),
        // Optional so partial updates (e.g. geometry-only vertex edits) are valid.
        // Required on create — enforced in the mutation handler below.
        name: z.string().min(1).max(100).optional(),
        capital: z.string().optional(),
        type: z.string().default("province"),
        level: z.number().int().min(1).max(5).default(1),
        geometry: z.record(z.string(), z.unknown()).optional(),
        governorName: z.string().max(100).nullish(),
        budgetShare: z.number().min(0).max(100).nullish(),
        governmentType: z.string().nullish(),
        color: z
          .string()
          .regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/)
          .nullish(),
        population: z.number().min(0).nullish(),
        areaSqKm: z.number().min(0).nullish(),
        gdpContribution: z.number().min(0).nullish(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertOwnCountry(ctx, input.countryId);
      // Name is optional on the schema to allow partial (geometry-only) updates,
      // but it is mandatory when creating a new subdivision.
      if (!input.id && !input.name?.trim()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Name is required when creating a subdivision",
        });
      }
      if (input.id && ctx.country) {
        const where = { id: input.id, countryId: input.countryId };
        const existing = await ctx.db.subdivision.findFirst({
          where,
          select: { editableByOwner: true },
        });
        assertOwnerMayEdit(ctx, existing, "subdivision");
      }

      const subdivision = await upsertSubdivision(ctx.db, input.countryId, {
        ...input,
        submittedBy: submitterId(ctx),
      });

      await invalidateCache(GEO_CACHE_KEYS);
      broadcastMapUpdate("subdivision", input.countryId);

      return subdivision;
    }),

  /**
   * Update the geographic rollup mode for a country.
   */
  updateGeoRollupMode: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        mode: z.enum(["hybrid", "top-down", "bottom-up"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertOwnCountry(ctx, input.countryId);
      const updated = await updateGeoRollupMode(ctx.db, input.countryId, input.mode);

      await invalidateCache(GEO_ECONOMY_CACHE_KEYS);
      broadcastMapUpdate("rollup-mode", input.countryId);

      return updated;
    }),

  /**
   * Rebase national totals from geographic sums.
   */
  rebaseNationalFromGeography: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertOwnCountry(ctx, input.countryId);
      const updated = await rebaseNationalFromGeography(ctx.db, input.countryId);

      await invalidateCache(GEO_ECONOMY_CACHE_KEYS);
      broadcastMapUpdate("national-rebase", input.countryId);

      return updated;
    }),
});
