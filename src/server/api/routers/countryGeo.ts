import { z } from "zod";
import {
  createTRPCRouter,
  cachedPublicProcedure,
  standardMutationCountryOwnerProcedure,
} from "~/server/api/trpc";
import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { invalidateCache } from "~/lib/cache";
import { broadcastMapUpdate } from "~/lib/maps/map-update-bus";
import { getArticleWikitext } from "~/lib/wiki-os/adapters/mediawiki/bridge";
import { parseEntityAttributesFromWiki } from "~/lib/wiki-os/adapters/ixstates/entity-parser";
import {
  checkGeoCompliance,
  getTerrainAtPoint,
  getCountryGeoBundle,
  upsertCity,
  upsertSubdivision,
  upsertPoi,
  updateGeoRollupMode,
  rebaseNationalFromGeography,
  distributeSubdivisionDemographicsToCities,
} from "~/lib/country-geo";

const GEO_CACHE_KEYS = [
  "geoCore.getCountryFeatures",
  "geoCore.getMapBundle",
  "geoCore.getWorldMap",
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

type EntityWhere = { id: string; countryId: string };

/** Per-kind lookup and upsert wiring for populateFromWiki: `keep` fields are copied, `merge` fields take the wiki value when present. */
const POPULATE_KINDS = {
  city: {
    label: "City",
    find: (db: PrismaClient, where: EntityWhere) => db.city.findFirst({ where }),
    upsert: upsertCity,
    keep: ["id", "name", "type", "coordinates", "wikiPageTitle"],
    merge: [
      "population",
      "gdpContribution",
      "mayorName",
      "specialization",
      "elevation",
      "foundedYear",
    ],
  },
  subdivision: {
    label: "Subdivision",
    find: (db: PrismaClient, where: EntityWhere) => db.subdivision.findFirst({ where }),
    upsert: upsertSubdivision,
    keep: ["id", "name", "type", "level"],
    merge: ["population", "gdpContribution", "governorName", "areaSqKm", "capital"],
  },
  poi: {
    label: "POI",
    find: (db: PrismaClient, where: EntityWhere) => db.pointOfInterest.findFirst({ where }),
    upsert: upsertPoi,
    keep: ["id", "name", "category", "coordinates", "icon", "wikiPageTitle"],
    merge: ["description"],
  },
} as const;

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
   * Run the geographic compliance validator against the current bundle.
   * Returns a list of issues (errors, warnings, info) describing
   * population/GDP rollup inconsistencies, capital integrity, founded-year
   * sanity, and coordinates that fall outside the country's bounding box.
   */
  getGeoCompliance: cachedPublicProcedure
    .input(
      z.object({
        countryId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const bundle = await getCountryGeoBundle(ctx.db, input.countryId);
      const bbox = (bundle.boundingBox as [number, number, number, number] | null) ?? null;
      const issues = checkGeoCompliance({
        cities: bundle.cities.map((c: any) => ({
          id: c.id,
          name: c.name,
          type: c.type,
          isNationalCapital: !!c.isNationalCapital,
          isSubdivisionCapital: !!c.isSubdivisionCapital,
          population: c.population ?? null,
          gdpContribution: c.gdpContribution ?? null,
          coordinates: c.coordinates,
          foundedYear: c.foundedYear ?? null,
        })),
        subdivisions: bundle.subdivisions.map((s: any) => ({
          id: s.id,
          name: s.name,
          type: s.type,
          population: s.population ?? null,
          gdpContribution: s.gdpContribution ?? null,
          capital: s.capital ?? null,
        })),
        pois: bundle.pois.map((p: any) => ({
          id: p.id,
          name: p.name,
          coordinates: p.coordinates,
        })),
        country: {
          id: bundle.country.id,
          name: bundle.country.name,
          currentPopulation: bundle.country.currentPopulation ?? null,
          currentTotalGdp: bundle.country.currentTotalGdp ?? null,
          geoRollupMode: bundle.country.geoRollupMode ?? null,
        },
        rollups: bundle.rollups ?? null,
        boundingBox: bbox,
      });
      const summary = {
        errors: issues.filter((i) => i.severity === "error").length,
        warnings: issues.filter((i) => i.severity === "warning").length,
        info: issues.filter((i) => i.severity === "info").length,
      };
      return { issues, summary };
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
    .input(z.object({ lng: z.number(), lat: z.number() }))
    .query(async ({ ctx, input }) => {
      const result = await getTerrainAtPoint(ctx.db, input.lng, input.lat);
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

  /**
   * Distribute subdivision population and GDP down to cities.
   */
  distributeSubdivisionDemographics: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        scaleExisting: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertOwnCountry(ctx, input.countryId);
      const result = await distributeSubdivisionDemographicsToCities(
        ctx.db,
        input.countryId,
        input.scaleExisting
      );

      await invalidateCache(GEO_ECONOMY_CACHE_KEYS);
      broadcastMapUpdate("cities-distribution", input.countryId);

      return result;
    }),

  /**
   * Populate a geographic entity (City / Subdivision / POI) by parsing
   * its linked wiki page infobox. The wiki page title is resolved from
   * the entity's `wikiPageTitle` field, falling back to the entity's
   * `name` if not set.
   *
   * Fetches the wiki wikitext, runs it through the infobox parser, and
   * maps parsed fields to the corresponding entity attributes:
   *   - City:      population, mayorName, gdpContribution, elevation, foundedYear
   *   - Subdivision: population, governorName, gdpContribution, areaSqKm, capital
   *   - POI:       description
   *
   * Returns a per-field diff (`applied` + `skipped`) so the UI can
   * surface what was filled in vs. what was missing on the wiki page.
   */
  populateFromWiki: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        kind: z.enum(["city", "subdivision", "poi"]),
        id: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertOwnCountry(ctx, input.countryId);
      const { countryId, kind, id } = input;
      const config = POPULATE_KINDS[kind];

      // 1. Fetch the entity (so we can resolve its wiki title + existing values).
      const existing = (await config.find(ctx.db, { id, countryId })) as Record<string, any> | null;
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: `${config.label} not found` });
      }
      const wikiTitle: string | null = existing.wikiPageTitle?.trim() || existing.name;
      if (!wikiTitle) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No wiki title to look up." });
      }

      // 2. Fetch the wiki page wikitext.
      const wikiRes = await getArticleWikitext(wikiTitle, "ixwiki");
      const wikitext = wikiRes?.wikitext ?? null;
      if (!wikitext) {
        return {
          wikiTitle,
          templateName: null,
          applied: [],
          skipped: [],
          hasChanges: false,
          error: `Wiki page "${wikiTitle}" not found or empty.`,
        };
      }

      // 3. Parse the infobox and build the diff.
      const result = parseEntityAttributesFromWiki(wikitext, kind, wikiTitle, existing);
      if (!result.hasChanges) {
        return result;
      }

      // 4. Apply via the existing upsert path (preserves validation + caching).
      const applied = Object.fromEntries(result.applied.map((f) => [f.field, f.newValue]));
      await config.upsert(ctx.db, countryId, {
        ...Object.fromEntries(config.keep.map((f) => [f, existing[f]])),
        ...Object.fromEntries(config.merge.map((f) => [f, applied[f] ?? existing[f]])),
        submittedBy: submitterId(ctx),
      });
      broadcastMapUpdate(kind, countryId);
      await invalidateCache(GEO_CACHE_KEYS);

      return result;
    }),
});
