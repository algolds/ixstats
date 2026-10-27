import { z } from "zod/v4";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { generateRandomComposition } from "~/lib/heraldry/generator";
import { isSystemOwner } from "~/lib/auth";

/** The design's owner or a system owner (Clerk ids). */
function canSeeDraft(ctx: { auth?: { userId?: string | null } | null }, ownerId: string): boolean {
  const viewer = ctx.auth?.userId;
  return !!viewer && (viewer === ownerId || isSystemOwner(viewer));
}

export const heraldryQueriesRouter = createTRPCRouter({
  getAchievement: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const achievement = await ctx.db.heraldryAchievement.findUnique({
        where: { id: input.id },
      });
      // An unpublished design is its owner's draft: anyone else gets NOT_FOUND.
      if (!achievement || (!achievement.isPublished && !canSeeDraft(ctx, achievement.ownerId))) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Heraldry achievement with ID ${input.id} not found`,
        });
      }
      return achievement;
    }),

  getChargeLibrary: publicProcedure
    .input(
      z.object({
        search: z.string().optional(),
        category: z
          .enum([
            "ANIMALS",
            "BIRDS",
            "MYTHICAL_CREATURES",
            "FISH",
            "INSECTS",
            "PLANTS",
            "TREES",
            "FLOWERS",
            "CELESTIAL",
            "WEAPONS",
            "BUILDINGS",
            "CROWNS",
            "RELIGIOUS",
            "MARITIME",
            "AGRICULTURAL",
            "GEOMETRIC",
            "HUMAN_FIGURES",
            "OBJECTS",
            "LETTERS",
            "NUMBERS",
            "IXNAY_SPECIFIC",
            "MISCELLANEOUS",
          ])
          .optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input.search) {
        where.OR = [
          { name: { contains: input.search, mode: "insensitive" } },
          { keywords: { has: input.search } },
        ];
      }
      if (input.category) {
        where.category = input.category;
      }

      const [items, total] = await Promise.all([
        ctx.db.heraldryCharge.findMany({
          where,
          take: input.limit,
          skip: input.offset,
          orderBy: { name: "asc" },
        }),
        ctx.db.heraldryCharge.count({ where }),
      ]);

      return { items, total };
    }),

  getChargeById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const charge = await ctx.db.heraldryCharge.findUnique({
        where: { id: input.id },
      });
      if (!charge) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Heraldry charge with ID ${input.id} not found`,
        });
      }
      return charge;
    }),

  getRegistry: publicProcedure
    .input(
      z.object({
        subjectType: z.enum(["COUNTRY", "CHARACTER", "INSTITUTION", "DYNASTY"]).optional(),
        limit: z.number().min(1).max(100).default(40),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: any = { isPublished: true };
      if (input.subjectType) {
        where.subjectType = input.subjectType;
      }
      const [items, total] = await Promise.all([
        ctx.db.heraldryAchievement.findMany({
          where,
          take: input.limit,
          skip: input.offset,
          orderBy: { publishedAt: "desc" },
        }),
        ctx.db.heraldryAchievement.count({ where }),
      ]);
      return { items, total };
    }),

  getRevisionHistory: protectedProcedure
    .input(z.object({ achievementId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const achievement = await ctx.db.heraldryAchievement.findUnique({
        where: { id: input.achievementId },
        select: { ownerId: true },
      });
      // Revision history is the owner's working record, published or not.
      if (!achievement || !canSeeDraft(ctx, achievement.ownerId)) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Design not found" });
      }
      return ctx.db.heraldryRevision.findMany({
        where: { achievementId: input.achievementId },
        orderBy: { createdAt: "desc" },
      });
    }),

  generateRandom: publicProcedure
    .input(
      z.object({
        count: z.number().min(1).max(12).default(6),
        options: z
          .object({
            cultureGroup: z.string().optional(),
            religion: z.string().optional(),
            governmentType: z.string().optional(),
            nationalColors: z.array(z.string()).optional(),
          })
          .optional(),
      })
    )
    .query(({ input }) => {
      const results = [];
      for (let i = 0; i < input.count; i++) {
        results.push(generateRandomComposition(input.options));
      }
      return results;
    }),
});
