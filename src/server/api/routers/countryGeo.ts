import { z } from "zod";
import {
  createTRPCRouter,
  cachedPublicProcedure,
  standardMutationCountryOwnerProcedure,
} from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { invalidateCache } from "~/lib/trpc-cache";
import { broadcastMapUpdate } from "~/lib/map-update-bus";
import { ixnayWiki } from "~/lib/mediawiki-service";
import { parseEntityAttributesFromWiki, type EntityKind } from "~/lib/wiki-entity-parser";
import { checkGeoCompliance } from "~/lib/country-geo-compliance";
import { getTerrainAtPoint } from "~/lib/base-layer-query";
import {
  getCountryGeoBundle,
  upsertCity,
  upsertSubdivision,
  setCapital,
  upsertPoi,
  upsertStoryPin,
  upsertMapLabel,
  updateGeoRollupMode,
  rebaseNationalFromGeography,
} from "~/lib/country-geo-service";

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
        population: z.number().int().min(0).optional(),
        isNationalCapital: z.boolean().optional(),
        isSubdivisionCapital: z.boolean().optional(),
        subdivisionId: z.string().optional(),
        wikiPageTitle: z.string().max(200).optional(),
        elevation: z.number().int().min(-500).max(9000).optional(),
        gdpContribution: z.number().min(0).optional(),
        economyOutput: z.number().min(0).optional(),
        specialization: z.string().max(100).optional(),
        infrastructureLevel: z.number().int().min(0).max(10).optional(),
        mayorName: z.string().max(100).optional(),
        isPort: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const country = ctx.country as any;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }

      const city = await upsertCity(ctx.db, input.countryId, {
        ...input,
        submittedBy: ctx.auth?.userId ?? ctx.user?.clerkUserId ?? "system",
      });

      // Invalidate caches
      await invalidateCache([
        "geoCore.getCountryFeatures",
        "geoCore.getMapBundle",
        "geoCore.getWorldMap",
        "geoCore.getAllMapFeatures",
        "countryGeo.getCountryGeoBundle",
      ]);
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
        type: z.string().default("province"),
        level: z.number().int().min(1).max(5).default(1),
        geometry: z.record(z.string(), z.unknown()).optional(),
        governorName: z.string().max(100).optional(),
        budgetShare: z.number().min(0).max(100).optional(),
        governmentType: z.string().optional(),
        color: z
          .string()
          .regex(/^#[0-9A-Fa-f]{6}$/)
          .optional(),
        population: z.number().min(0).optional(),
        areaSqKm: z.number().min(0).optional(),
        gdpContribution: z.number().min(0).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const country = ctx.country as any;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }
      // Name is optional on the schema to allow partial (geometry-only) updates,
      // but it is mandatory when creating a new subdivision.
      if (!input.id && !input.name?.trim()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Name is required when creating a subdivision" });
      }

      const subdivision = await upsertSubdivision(ctx.db, input.countryId, {
        ...input,
        submittedBy: ctx.auth?.userId ?? ctx.user?.clerkUserId ?? "system",
      });

      await invalidateCache([
        "geoCore.getCountryFeatures",
        "geoCore.getMapBundle",
        "geoCore.getWorldMap",
        "geoCore.getAllMapFeatures",
        "countryGeo.getCountryGeoBundle",
      ]);
      broadcastMapUpdate("subdivision", input.countryId);

      return subdivision;
    }),

  /**
   * Set the national capital of the country.
   */
  setCapital: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        cityId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const country = ctx.country as any;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }

      await setCapital(ctx.db, input.countryId, input.cityId);

      await invalidateCache([
        "geoCore.getCountryFeatures",
        "geoCore.getMapBundle",
        "geoCore.getWorldMap",
        "geoCore.getAllMapFeatures",
        "countryGeo.getCountryGeoBundle",
        "geoCore.getCapitalCities",
      ]);
      broadcastMapUpdate("city", input.countryId);

      return { success: true };
    }),

  /**
   * Create or update a Point of Interest (POI).
   */
  upsertPoi: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        id: z.string().optional(),
        name: z.string().min(1).max(100),
        category: z.string(),
        coordinates: z.tuple([z.number(), z.number()]).optional(),
        description: z.string().max(1000).optional(),
        icon: z.string().optional(),
        wikiPageTitle: z.string().max(200).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const country = ctx.country as any;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }

      const poi = await upsertPoi(ctx.db, input.countryId, {
        ...input,
        submittedBy: ctx.auth?.userId ?? ctx.user?.clerkUserId ?? "system",
      });

      await invalidateCache([
        "geoCore.getCountryFeatures",
        "geoCore.getMapBundle",
        "geoCore.getWorldMap",
        "geoCore.getAllMapFeatures",
        "countryGeo.getCountryGeoBundle",
      ]);
      broadcastMapUpdate("poi", input.countryId);

      return poi;
    }),

  /**
   * Create or update a Story Pin.
   */
  upsertStoryPin: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        id: z.string().optional(),
        title: z.string().min(1).max(200),
        content: z.string().min(1).max(15000),
        category: z.string(),
        coordinates: z.tuple([z.number(), z.number()]).optional(),
        ixTimeYear: z.number().int().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const country = ctx.country as any;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }

      const storyPin = await upsertStoryPin(ctx.db, input.countryId, {
        ...input,
        submittedBy: ctx.auth?.userId ?? ctx.user?.clerkUserId ?? "system",
      });

      await invalidateCache([
        "geoFeatures.getAllStoryPins",
        "geoCore.getCountryFeatures",
        "geoCore.getMapBundle",
        "countryGeo.getCountryGeoBundle",
      ]);
      broadcastMapUpdate("storyPin", input.countryId);

      return storyPin;
    }),

  /**
   * Create or update a Map Label.
   */
  upsertMapLabel: standardMutationCountryOwnerProcedure
    .input(
      z.object({
        countryId: z.string(),
        id: z.string().optional(),
        text: z.string().min(1).max(100),
        labelType: z.string(),
        coordinates: z.tuple([z.number(), z.number()]).optional(),
        fontSize: z.number().min(8).max(48).optional(),
        color: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .optional(),
        rotation: z.number().min(-180).max(180).optional(),
        opacity: z.number().min(0.1).max(1).optional(),
        letterSpacing: z.number().min(0).max(0.5).optional(),
        fontWeight: z.string().optional(),
        minZoom: z.number().min(0).max(24).optional(),
        maxZoom: z.number().min(0).max(24).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const country = ctx.country as any;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }

      const mapLabel = await upsertMapLabel(ctx.db, input.countryId, {
        ...input,
        submittedBy: ctx.auth?.userId ?? ctx.user?.clerkUserId ?? "system",
      });

      await invalidateCache([
        "geoFeatures.getAllMapLabels",
        "geoCore.getCountryFeatures",
        "geoCore.getMapBundle",
        "countryGeo.getCountryGeoBundle",
      ]);
      broadcastMapUpdate("mapLabel", input.countryId);

      return mapLabel;
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
      const country = ctx.country as any;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }

      const updated = await updateGeoRollupMode(ctx.db, input.countryId, input.mode);

      // Invalidate caches
      await invalidateCache([
        "geoCore.getCountryFeatures",
        "geoCore.getMapBundle",
        "geoCore.getWorldMap",
        "geoCore.getAllMapFeatures",
        "countryGeo.getCountryGeoBundle",
        "countries.getByIdWithEconomicData",
      ]);
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
      const country = ctx.country as any;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }

      const updated = await rebaseNationalFromGeography(ctx.db, input.countryId);

      // Invalidate caches
      await invalidateCache([
        "geoCore.getCountryFeatures",
        "geoCore.getMapBundle",
        "geoCore.getWorldMap",
        "geoCore.getAllMapFeatures",
        "countryGeo.getCountryGeoBundle",
        "countries.getByIdWithEconomicData",
      ]);
      broadcastMapUpdate("national-rebase", input.countryId);

      return updated;
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
      const country = ctx.country as any;
      if (country && country.id !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own country" });
      }

      const { countryId, kind, id } = input;
      const kindTyped = kind as EntityKind;

      // 1. Fetch the entity (so we can resolve its wiki title + existing values).
      let existing: any;
      let wikiTitle: string | null = null;
      if (kind === "city") {
        existing = await ctx.db.city.findFirst({ where: { id, countryId } });
        if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "City not found" });
        wikiTitle = existing.wikiPageTitle?.trim() || existing.name;
      } else if (kind === "subdivision") {
        existing = await ctx.db.subdivision.findFirst({ where: { id, countryId } });
        if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Subdivision not found" });
        wikiTitle = existing.wikiPageTitle?.trim() || existing.name;
      } else {
        existing = await ctx.db.pointOfInterest.findFirst({ where: { id, countryId } });
        if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "POI not found" });
        wikiTitle = existing.wikiPageTitle?.trim() || existing.name;
      }

      if (!wikiTitle) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No wiki title to look up." });
      }

      // 2. Fetch the wiki page wikitext.
      const wikitext = await ixnayWiki.getPageWikitext(wikiTitle);
      if (!wikitext || typeof wikitext === "object") {
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
      const result = parseEntityAttributesFromWiki(wikitext, kindTyped, wikiTitle, existing);

      if (!result.hasChanges) {
        return result;
      }

      // 4. Apply via the existing upsert path (preserves validation + caching).
      const applied: Record<string, unknown> = {};
      for (const f of result.applied) {
        applied[f.field] = f.newValue;
      }

      if (kind === "city") {
        await upsertCity(ctx.db, countryId, {
          id: existing.id,
          name: existing.name,
          type: existing.type,
          coordinates: existing.coordinates,
          population: (applied.population as number) ?? existing.population,
          gdpContribution: (applied.gdpContribution as number) ?? existing.gdpContribution,
          mayorName: (applied.mayorName as string) ?? existing.mayorName,
          specialization: (applied.specialization as string) ?? existing.specialization,
          elevation: (applied.elevation as number) ?? existing.elevation,
          foundedYear: (applied.foundedYear as number) ?? existing.foundedYear,
          wikiPageTitle: existing.wikiPageTitle,
          submittedBy: ctx.auth?.userId ?? ctx.user?.clerkUserId ?? "system",
        });
        broadcastMapUpdate("city", countryId);
      } else if (kind === "subdivision") {
        await upsertSubdivision(ctx.db, countryId, {
          id: existing.id,
          name: existing.name,
          type: existing.type,
          level: existing.level,
          population: (applied.population as number) ?? existing.population,
          gdpContribution: (applied.gdpContribution as number) ?? existing.gdpContribution,
          governorName: (applied.governorName as string) ?? existing.governorName,
          areaSqKm: (applied.areaSqKm as number) ?? existing.areaSqKm,
          capital: (applied.capital as string) ?? existing.capital,
          submittedBy: ctx.auth?.userId ?? ctx.user?.clerkUserId ?? "system",
        });
        broadcastMapUpdate("subdivision", countryId);
      } else {
        await upsertPoi(ctx.db, countryId, {
          id: existing.id,
          name: existing.name,
          category: existing.category,
          coordinates: existing.coordinates,
          description: (applied.description as string) ?? existing.description,
          icon: existing.icon,
          wikiPageTitle: existing.wikiPageTitle,
          submittedBy: ctx.auth?.userId ?? ctx.user?.clerkUserId ?? "system",
        });
        broadcastMapUpdate("poi", countryId);
      }

      await invalidateCache([
        "geoCore.getCountryFeatures",
        "geoCore.getMapBundle",
        "geoCore.getWorldMap",
        "geoCore.getAllMapFeatures",
        "countryGeo.getCountryGeoBundle",
      ]);

      return result;
    }),
});
