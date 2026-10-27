// src/server/api/routers/onoma/marketplace.ts
// Onoma — Conlang Marketplace sub-router

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
  rateLimitedMutationProcedure,
} from "~/server/api/trpc";
import { PACK_PUBLISH_RULES as RULES, packPublishProblems } from "~/lib/onoma/pack-publish";

/** Visibilities anyone may read or fork; drafts are the owner's alone. */
const SHARED_VISIBILITIES = new Set(["public", "unlisted"]);

const packSlug = (name: string) =>
  `${name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)}-${Date.now().toString(36)}`;

const dictionaryInput = z.object({
  name: z.string().trim().min(1).max(RULES.nameMax),
  category: z.string().max(40).nullish(),
  values: z
    .array(z.string().trim().min(1).max(RULES.entryMax))
    .min(1)
    .max(RULES.maxDictionaryEntries),
});

/** The caller's own pack, else NOT_FOUND (another user's pack reads as missing). */
async function loadOwnPack(
  db: Pick<Prisma.TransactionClient, "languagePack">,
  packId: string,
  userId: string
) {
  const pack = await db.languagePack.findUnique({
    where: { id: packId },
    include: { versions: { orderBy: { version: "desc" }, take: 1 } },
  });
  if (!pack || pack.userId !== userId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Language pack not found." });
  }
  return pack;
}

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

      const where: Prisma.LanguagePackWhereInput = {
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
   * Fork a language pack version to make it local.
   */
  fork: rateLimitedMutationProcedure
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

      // Drafts can only be forked by their owner.
      if (
        sourcePack &&
        !SHARED_VISIBILITIES.has(sourcePack.visibility) &&
        sourcePack.userId !== userId
      ) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Source pack not found." });
      }

      if (!sourcePack || sourcePack.versions.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Source pack not found or has no versions.",
        });
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
  rate: rateLimitedMutationProcedure
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

  /** The caller's own language packs, any visibility, newest first (SL-18). */
  myPacks: protectedProcedure.query(async ({ ctx }) => {
    const packs = await ctx.db.languagePack.findMany({
      where: { userId: ctx.user.id },
      orderBy: { updatedAt: "desc" },
      include: {
        versions: { orderBy: { version: "desc" }, take: 1 },
        _count: { select: { forks: true, reviews: true } },
      },
    });
    return packs.map((pack) => ({
      ...pack,
      publishProblems: packPublishProblems(pack, pack.versions[0] ?? null),
    }));
  }),

  /**
   * Start a draft pack from dictionaries the caller picked from their name bank (SL-18). The
   * pack stays a draft until `publishPack`.
   */
  createPack: rateLimitedMutationProcedure
    .input(
      z.object({
        name: z.string().trim().min(RULES.nameMin).max(RULES.nameMax),
        description: z.string().trim().max(RULES.descriptionMax).optional(),
        culturalFamily: z.string().max(40).optional(),
        tags: z.array(z.string().trim().min(1).max(RULES.tagMax)).max(RULES.maxTags).default([]),
        dictionaries: z.array(dictionaryInput).min(1).max(RULES.maxDictionaries),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const pack = await ctx.db.languagePack.create({
        data: {
          userId: ctx.user.id,
          name: input.name,
          slug: packSlug(input.name),
          description: input.description || null,
          culturalFamily: input.culturalFamily || null,
          visibility: "draft",
          tags: [...new Set(input.tags)],
        },
      });
      await ctx.db.languagePackVersion.create({
        data: {
          packId: pack.id,
          version: 1,
          dictionaries: input.dictionaries.map((d) => ({
            name: d.name,
            category: d.category ?? null,
            values: [...new Set(d.values)],
          })),
          changelog: "Created from name bank dictionaries",
        },
      });
      return pack;
    }),

  /**
   * Publish one of the caller's packs (SL-18): "public" lists it in the marketplace, "unlisted"
   * shares it by id only. Refused with the reasons when `packPublishProblems` finds any.
   */
  publishPack: rateLimitedMutationProcedure
    .input(
      z.object({
        packId: z.string().min(1),
        visibility: z.enum(["public", "unlisted"]).default("public"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const pack = await loadOwnPack(ctx.db, input.packId, ctx.user.id);
      const problems = packPublishProblems(pack, pack.versions[0] ?? null);
      if (problems.length > 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: problems.join(" ") });
      }
      return ctx.db.languagePack.update({
        where: { id: pack.id },
        data: { visibility: input.visibility },
      });
    }),

  /** Take one of the caller's packs back to draft; forks already made keep their copy. */
  unpublishPack: rateLimitedMutationProcedure
    .input(z.object({ packId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const pack = await loadOwnPack(ctx.db, input.packId, ctx.user.id);
      return ctx.db.languagePack.update({
        where: { id: pack.id },
        data: { visibility: "draft" },
      });
    }),
});
