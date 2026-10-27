import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  protectedProcedure,
  rateLimitedMutationProcedure,
} from "~/server/api/trpc";

/** A language pack anyone may build on; a draft is its owner's alone (as the marketplace's fork rule has it). */
const SHARED_PACK_VISIBILITIES = ["public", "unlisted"];

export const onomaWritingRouter = createTRPCRouter({
  /**
   * List all writing systems for the current user.
   */
  listSystems: protectedProcedure
    .input(
      z
        .object({
          languagePackId: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      return ctx.db.writingSystem.findMany({
        where: {
          userId,
          languagePackId: input?.languagePackId || null,
        },
        orderBy: { name: "asc" },
      });
    }),

  /**
   * Save (create or update) a writing system.
   */
  saveSystem: rateLimitedMutationProcedure
    .input(
      z.object({
        id: z.string().optional(),
        languagePackId: z.string().optional(),
        name: z.string().min(1),
        scriptType: z.string().default("alphabet"),
        direction: z.string().default("ltr"),
        glyphs: z.array(z.record(z.string(), z.unknown())).default([]),
        ligatures: z.array(z.record(z.string(), z.unknown())).default([]),
        baselineOffset: z.number().default(0),
        glyphSize: z.number().default(32),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      // The pack it belongs to: the caller's own, or one shared with everyone; another user's draft is missing
      if (input.languagePackId) {
        const pack = await ctx.db.languagePack.findFirst({
          where: {
            id: input.languagePackId,
            OR: [{ userId }, { visibility: { in: SHARED_PACK_VISIBILITIES } }],
          },
          select: { id: true },
        });
        if (!pack) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Language pack not found" });
        }
      }

      const data = {
        userId,
        languagePackId: input.languagePackId || null,
        name: input.name,
        scriptType: input.scriptType,
        direction: input.direction,
        glyphs: (input.glyphs || []) as Prisma.InputJsonValue,
        ligatures: (input.ligatures || []) as Prisma.InputJsonValue,
        baselineOffset: input.baselineOffset,
        glyphSize: input.glyphSize,
      };

      if (input.id) {
        // Verify ownership
        const existing = await ctx.db.writingSystem.findFirst({
          where: { id: input.id, userId },
        });
        if (!existing) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Writing system not found or unauthorized",
          });
        }

        return ctx.db.writingSystem.update({
          where: { id: input.id },
          data,
        });
      }

      return ctx.db.writingSystem.create({
        data,
      });
    }),

  /**
   * Delete a writing system.
   */
  deleteSystem: rateLimitedMutationProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      const existing = await ctx.db.writingSystem.findFirst({
        where: { id: input.id, userId },
      });
      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Writing system not found or unauthorized",
        });
      }

      return ctx.db.writingSystem.delete({
        where: { id: input.id },
      });
    }),
});
