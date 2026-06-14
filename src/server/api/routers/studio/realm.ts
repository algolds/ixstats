/**
 * Studio Router — World Studio realm management and generation.
 *
 * Handles realm CRUD, procedural world generation, and IxStats
 * data population for custom worlds.
 */

import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";

export const studioRealmRouter = createTRPCRouter({
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

  // ──────────────────────────────────────────────
  // World Generation
  // ──────────────────────────────────────────────
});
