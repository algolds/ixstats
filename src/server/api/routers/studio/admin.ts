/**
 * Studio Router — World Studio realm management and generation.
 *
 * Handles realm CRUD, procedural world generation, and IxStats
 * data population for custom worlds.
 */

import { z } from "zod";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";

export const studioAdminRouter = createTRPCRouter({
  // ──────────────────────────────────────────────
  // Realm CRUD
  // ──────────────────────────────────────────────

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
});
