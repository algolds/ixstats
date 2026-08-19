// src/server/api/routers/onoma/marketplace.ts
// Onoma — Conlang Marketplace sub-router

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";
import { PhonologyRulesSchema, MorphologyRulesSchema } from "~/lib/onoma/types";

export const onomaMarketplaceRouter = createTRPCRouter({
  /**
   * List public language packs with pagination and filter by tags/family.
   */
  list: publicProcedure
    .input(
      z
        .object({
          search: z.string().optional(),
          culturalFamily: z.string().optional(),
          tag: z.string().optional(),
          limit: z.number().min(1).max(50).default(20),
          cursor: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 20;
      const cursor = input?.cursor;

      const where: any = {
        visibility: "public",
      };

      if (input?.search) {
        where.OR = [
          { name: { contains: input.search, mode: "insensitive" } },
          { description: { contains: input.search, mode: "insensitive" } },
        ];
      }

      if (input?.culturalFamily && input.culturalFamily !== "all") {
        where.culturalFamily = input.culturalFamily;
      }

      if (input?.tag) {
        where.tags = { has: input.tag };
      }

      const packs = await ctx.db.languagePack.findMany({
        where,
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: { createdAt: "desc" },
        include: {
          versions: {
            orderBy: { version: "desc" },
            take: 1,
          },
          reviews: {
            select: { rating: true },
          },
          _count: {
            select: { forks: true, reviews: true },
          },
        },
      });

      let nextCursor: typeof cursor | undefined = undefined;
      if (packs.length > limit) {
        const nextItem = packs.pop();
        nextCursor = nextItem!.id;
      }

      return { packs, nextCursor };
    }),

  /**
   * Publish a language pack (create pack + version).
   */
  publish: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        culturalFamily: z.string().optional(),
        tags: z.array(z.string()).default([]),
        phonologyRules: PhonologyRulesSchema.optional(),
        morphologyRules: MorphologyRulesSchema.optional(),
        orthographyRules: z.record(z.string(), z.string()).optional(),
        namingConventions: z.record(z.string(), z.unknown()).optional(),
        dictionaries: z
          .array(
            z.object({
              name: z.string(),
              category: z.string(),
              values: z.array(z.string()),
            })
          )
          .optional(),
        sampleOutputs: z.array(z.string()).optional(),
        changelog: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const slug = `${input.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${Date.now().toString().slice(-4)}`;

      // Try fetching country ID from user
      const userObj = await ctx.db.user.findUnique({
        where: { id: userId },
        select: { countryId: true },
      });

      const pack = await ctx.db.languagePack.create({
        data: {
          userId,
          countryId: userObj?.countryId,
          name: input.name,
          slug,
          description: input.description,
          culturalFamily: input.culturalFamily,
          visibility: "public",
          tags: input.tags,
        },
      });

      await ctx.db.languagePackVersion.create({
        data: {
          packId: pack.id,
          version: 1,
          phonologyRules: (input.phonologyRules ?? {}) as Prisma.InputJsonValue,
          morphologyRules: (input.morphologyRules ?? {}) as Prisma.InputJsonValue,
          orthographyRules: (input.orthographyRules ?? {}) as Prisma.InputJsonValue,
          namingConventions: (input.namingConventions ?? {}) as Prisma.InputJsonValue,
          dictionaries: (input.dictionaries ?? []) as unknown as Prisma.InputJsonValue,
          sampleOutputs: (input.sampleOutputs ?? []) as unknown as Prisma.InputJsonValue,
          changelog: input.changelog || "Initial Release",
        },
      });

      return pack;
    }),

  /**
   * Fork a language pack version to make it local.
   */
  fork: protectedProcedure
    .input(
      z.object({
        packId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      const sourcePack = await ctx.db.languagePack.findUnique({
        where: { id: input.packId },
        include: {
          versions: {
            orderBy: { version: "desc" },
            take: 1,
          },
        },
      });

      if (!sourcePack || sourcePack.versions.length === 0) {
        throw new Error("Source pack not found or has no versions.");
      }

      const latestVer = sourcePack.versions[0];

      // Clone pack info
      const forkedName = `${sourcePack.name} (Fork)`;
      const slug = `${forkedName.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${Date.now().toString().slice(-4)}`;

      const forkedPack = await ctx.db.languagePack.create({
        data: {
          userId,
          name: forkedName,
          slug,
          description: `Forked from ${sourcePack.name}.\n\n${sourcePack.description || ""}`,
          culturalFamily: sourcePack.culturalFamily,
          visibility: "draft", // Starts private as local draft
          tags: sourcePack.tags,
        },
      });

      // Clone version details
      await ctx.db.languagePackVersion.create({
        data: {
          packId: forkedPack.id,
          version: 1,
          phonologyRules: latestVer.phonologyRules || {},
          morphologyRules: latestVer.morphologyRules || {},
          orthographyRules: latestVer.orthographyRules || {},
          namingConventions: latestVer.namingConventions || {},
          dictionaries: latestVer.dictionaries || [],
          sampleOutputs: latestVer.sampleOutputs || [],
          changelog: `Forked from version ${latestVer.version}`,
        },
      });

      // Record fork link
      await ctx.db.languagePackFork.create({
        data: {
          sourcePackId: sourcePack.id,
          forkedPackId: forkedPack.id,
        },
      });

      // Increment clone/fork count
      await ctx.db.languagePack.update({
        where: { id: sourcePack.id },
        data: {
          forkCount: { increment: 1 },
          cloneCount: { increment: 1 },
        },
      });

      return forkedPack;
    }),

  /**
   * Rate and review a language pack.
   */
  rate: protectedProcedure
    .input(
      z.object({
        packId: z.string(),
        rating: z.number().min(1).max(5),
        comment: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      // Upsert review
      await ctx.db.languagePackReview.upsert({
        where: {
          packId_userId: {
            packId: input.packId,
            userId,
          },
        },
        create: {
          packId: input.packId,
          userId,
          rating: input.rating,
          comment: input.comment,
        },
        update: {
          rating: input.rating,
          comment: input.comment,
        },
      });

      // Recalculate average rating
      const reviews = await ctx.db.languagePackReview.findMany({
        where: { packId: input.packId },
        select: { rating: true },
      });

      const avg =
        reviews.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) / reviews.length;

      await ctx.db.languagePack.update({
        where: { id: input.packId },
        data: {
          ratingAvg: avg,
          ratingCount: reviews.length,
        },
      });

      return { ratingAvg: avg, ratingCount: reviews.length };
    }),
});
