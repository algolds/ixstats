/**
 * Studio Router — World Studio realm management and generation.
 *
 * Handles realm CRUD, procedural world generation, and IxStats
 * data population for custom worlds.
 */

import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";

export const studioGenerationRouter = createTRPCRouter({
  // ──────────────────────────────────────────────
  // Realm CRUD
  // ──────────────────────────────────────────────

  // ──────────────────────────────────────────────
  // Admin — Realm & World Management
  // ──────────────────────────────────────────────

  // ──────────────────────────────────────────────
  // World Generation
  // ──────────────────────────────────────────────

  /** Generate a procedural world using Azgaar-style Voronoi engine */
  generateWorld: protectedProcedure
    .input(
      z.object({
        seed: z.number().int(),
        cellCount: z.number().int().min(5000).max(50000).default(20000),
        continentCount: z.number().int().min(1).max(8).default(6),
        countryCountMin: z.number().int().min(5).max(300).default(60),
        countryCountMax: z.number().int().min(5).max(300).default(200),
        oceanPercentage: z.number().min(0.3).max(0.95).default(0.65),
        terrainRoughness: z.number().min(0).max(1).default(0.5),
        hasIcecaps: z.boolean().default(true),
        hasRivers: z.boolean().default(true),
        hasLakes: z.boolean().default(true),
        useIxWorldTemplate: z.boolean().default(true),
        templateStrength: z.number().min(0).max(1).default(0.6),
        useMarkovNaming: z.boolean().default(true),
        languageFamilies: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { generateWorld } = await import("~/lib/worldgen/engine");

      const result = generateWorld({
        seed: input.seed,
        cellCount: input.cellCount,
        continentCount: input.continentCount,
        countryCountRange: [input.countryCountMin, input.countryCountMax],
        oceanPercentage: input.oceanPercentage,
        terrainRoughness: input.terrainRoughness,
        hasIcecaps: input.hasIcecaps,
        hasRivers: input.hasRivers,
        hasLakes: input.hasLakes,
        useIxWorldTemplate: input.useIxWorldTemplate,
        templateStrength: input.templateStrength,
        useMarkovNaming: input.useMarkovNaming,
        languageFamilies: input.languageFamilies ?? [],
      });

      return {
        layers: result.layers,
        stats: result.stats,
        seed: result.seed,
      };
    }),

  /** Commit a generated world to database (creates Country records for a realm) */
  commitWorld: protectedProcedure
    .input(
      z.object({
        realmId: z.string(),
        layers: z.record(z.string(), z.unknown()),
        stats: z.record(z.string(), z.number()),
        seed: z.number().int(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const realm = await ctx.db.realm.findUnique({
        where: { id: input.realmId },
      });
      if (!realm || realm.ownerId !== ctx.auth!.userId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // Extract political features and create countries
      const political = input.layers.political as
        | {
            features?: Array<{
              id?: string;
              properties?: {
                displayName?: string;
                featureId?: string;
                areaKm2?: number;
                fill?: string;
                coastalPerimeter?: number;
              };
              geometry?: unknown;
            }>;
          }
        | undefined;

      if (!political?.features?.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No political features in layers",
        });
      }

      // Delete existing countries for this realm
      await ctx.db.country.deleteMany({
        where: { realmId: realm.id },
      });

      // Create countries from political features
      const countries: any[] = [];
      for (const feature of political.features) {
        const props = feature.properties ?? {};
        const name = props.displayName ?? props.featureId ?? `Country-${countries.length}`;

        const country = await ctx.db.country.create({
          data: {
            name: `${realm.slug}:${name}`,
            slug: `${realm.slug}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
            realmId: realm.id,
            baselinePopulation: 1_000_000,
            baselineGdpPerCapita: 10_000,
            maxGdpGrowthRate: 0.03,
            adjustedGdpGrowth: 0.02,
            populationGrowthRate: 0.01,
            currentPopulation: 1_000_000,
            currentGdpPerCapita: 10_000,
            currentTotalGdp: 10_000_000_000,
            economicTier: "Tier 3",
            populationTier: "Small",
            landArea: props.areaKm2 ?? 0,
            geometry: (feature.geometry as object) ?? undefined,
            coastlineKm: (props.coastalPerimeter ?? 0) * 1000,
          },
        });
        countries.push(country);
      }

      // Update realm status
      await ctx.db.realm.update({
        where: { id: realm.id },
        data: {
          status: "active",
          seed: input.seed,
        },
      });

      // Store as world template
      await ctx.db.worldTemplate.create({
        data: {
          name: `${realm.name} - Generated`,
          createdBy: ctx.auth!.userId,
          layers: input.layers as any,
          metadata: {
            seed: input.seed,
            stats: input.stats,
            generatedAt: new Date().toISOString(),
          } as any,
          countries: countries.map((c) => ({
            id: c.id,
            name: c.name,
            slug: c.slug,
          })),
          isPublic: realm.visibility === "public",
        },
      });

      return { countryCount: countries.length, realmId: realm.id };
    }),
});
