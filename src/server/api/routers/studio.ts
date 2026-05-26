/**
 * Studio Router — World Studio realm management and generation.
 *
 * Handles realm CRUD, procedural world generation, and IxStats
 * data population for custom worlds.
 */

import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
  adminProcedure,
} from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";

export const studioRouter = createTRPCRouter({
  // ──────────────────────────────────────────────
  // Realm CRUD
  // ──────────────────────────────────────────────

  /** Create a new realm */
  createRealm: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        slug: z
          .string()
          .min(1)
          .max(100)
          .regex(/^[a-z0-9-]+$/),
        description: z.string().max(1000).optional(),
        seed: z.number().int().optional(),
        generationParams: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.realm.findUnique({
        where: { slug: input.slug },
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Realm slug "${input.slug}" is already taken`,
        });
      }

      const realm = await ctx.db.realm.create({
        data: {
          name: input.name,
          slug: input.slug,
          description: input.description,
          ownerId: ctx.auth!.userId,
          seed: input.seed,
          generationParams: (input.generationParams ?? undefined) as any,
          status: "draft",
        },
      });

      // Create associated WorldConfig
      await ctx.db.worldConfig.create({
        data: {
          worldId: input.slug,
          name: input.name,
          description: input.description,
          realmId: realm.id,
          mapProjection: "globe",
          climateSystem: "trewartha",
        },
      });

      return realm;
    }),

  /** List realms for the current user */
  listMyRealms: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.realm.findMany({
      where: { ownerId: ctx.auth!.userId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        status: true,
        visibility: true,
        seed: true,
        thumbnail: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { countries: true } },
      },
    });
  }),

  /** List public realms */
  listPublicRealms: publicProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(50).default(20),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const realms = await ctx.db.realm.findMany({
        where: { visibility: "public", status: "active" },
        orderBy: { updatedAt: "desc" },
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        select: {
          id: true,
          slug: true,
          name: true,
          description: true,
          ownerId: true,
          thumbnail: true,
          seed: true,
          createdAt: true,
          _count: { select: { countries: true } },
        },
      });

      let nextCursor: string | undefined;
      if (realms.length > input.limit) {
        nextCursor = realms.pop()!.id;
      }

      return { realms, nextCursor };
    }),

  /** Get a specific realm */
  getRealm: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const realm = await ctx.db.realm.findUnique({
      where: { id: input.id },
      include: {
        worldConfig: true,
        _count: { select: { countries: true } },
      },
    });

    if (!realm) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Realm not found" });
    }

    // Only owner can view private realms
    if (realm.visibility === "private" && realm.ownerId !== ctx.auth!.userId) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
    }

    return realm;
  }),

  /** Update realm metadata */
  updateRealm: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().max(1000).optional(),
        visibility: z.enum(["private", "unlisted", "public"]).optional(),
        status: z.enum(["draft", "generating", "active", "archived"]).optional(),
        generationParams: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const realm = await ctx.db.realm.findUnique({
        where: { id: input.id },
      });
      if (!realm || realm.ownerId !== ctx.auth!.userId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const { id, ...data } = input;
      return ctx.db.realm.update({
        where: { id },
        data: {
          ...data,
          generationParams: (data.generationParams ?? undefined) as any,
        },
      });
    }),

  /** Delete a realm and all associated data */
  deleteRealm: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const realm = await ctx.db.realm.findUnique({
        where: { id: input.id },
      });
      if (!realm || realm.ownerId !== ctx.auth!.userId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // Delete countries belonging to this realm (cascades to all related models)
      await ctx.db.country.deleteMany({
        where: { realmId: realm.id },
      });

      // Delete world config
      await ctx.db.worldConfig.deleteMany({
        where: { realmId: realm.id },
      });

      // Delete realm
      await ctx.db.realm.delete({ where: { id: input.id } });

      return { success: true };
    }),

  // ──────────────────────────────────────────────
  // Admin — Realm & World Management
  // ──────────────────────────────────────────────

  /** Admin: get overview stats for realms, world configs, users */
  adminGetStats: adminProcedure.query(async ({ ctx }) => {
    const [realmCount, activeRealmCount, worldConfigCount, userCount, countryCount, templateCount] =
      await Promise.all([
        ctx.db.realm.count(),
        ctx.db.realm.count({ where: { status: "active" } }),
        ctx.db.worldConfig.count(),
        ctx.db.user.count(),
        ctx.db.country.count(),
        ctx.db.worldTemplate.count(),
      ]);

    // Countries per realm breakdown
    const realmBreakdown = await ctx.db.realm.findMany({
      select: {
        id: true,
        slug: true,
        name: true,
        status: true,
        visibility: true,
        _count: { select: { countries: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    return {
      realmCount,
      activeRealmCount,
      worldConfigCount,
      userCount,
      countryCount,
      templateCount,
      realmBreakdown,
    };
  }),

  /** Admin: list all realms with full details */
  adminListRealms: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.realm.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        worldConfig: {
          select: {
            id: true,
            worldId: true,
            name: true,
            mapProjection: true,
            climateSystem: true,
            isActive: true,
          },
        },
        _count: { select: { countries: true } },
      },
    });
  }),

  /** Admin: list all world configs */
  adminListWorldConfigs: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.worldConfig.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        realm: {
          select: { id: true, slug: true, name: true, status: true },
        },
      },
    });
  }),

  /** Admin: list users with their realm associations (via country) */
  adminListUsers: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.user.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        clerkUserId: true,
        countryId: true,
        membershipTier: true,
        isActive: true,
        createdAt: true,
        country: {
          select: {
            id: true,
            name: true,
            realmId: true,
          },
        },
      },
    });
  }),

  /** Admin: update any realm (not restricted to owner) */
  adminUpdateRealm: adminProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().max(1000).optional(),
        visibility: z.enum(["private", "unlisted", "public"]).optional(),
        status: z.enum(["draft", "generating", "active", "archived"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.realm.update({ where: { id }, data });
    }),

  /** Admin: update a world config */
  adminUpdateWorldConfig: adminProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(100).optional(),
        wikiBaseUrl: z.string().max(500).nullable().optional(),
        mapProjection: z.enum(["globe", "mercator", "dynamic"]).optional(),
        climateSystem: z.string().max(50).optional(),
        defaultCenter: z.tuple([z.number(), z.number()]).optional(),
        defaultZoom: z.number().min(0).max(20).optional(),
        isActive: z.boolean().optional(),
        syncEnabled: z.boolean().optional(),
        syncIntervalMin: z.number().int().min(1).max(1440).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.worldConfig.update({ where: { id }, data });
    }),

  /** Admin: list world templates */
  adminListTemplates: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.worldTemplate.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        createdBy: true,
        isPublic: true,
        createdAt: true,
        metadata: true,
      },
    });
  }),

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
