// src/server/api/routers/meetings.ts
// Cabinet meetings, government officials, and meeting management

import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";
import { assertCountryResourceWriteAccess } from "~/server/shared/country-authorization";
import { resolveMeetingCountryId } from "~/server/shared/country-resource-owner";

export const meetingsProceedingsRouter = createTRPCRouter({
  // ==================== CABINET MEETINGS ====================

  // ==================== MEETING ATTENDANCE ====================

  // ==================== AGENDA ITEMS ====================

  addAgendaItem: protectedProcedure
    .input(
      z.object({
        meetingId: z.string(),
        title: z.string().min(1).max(200),
        description: z.string().optional(),
        order: z.number(),
        estimatedDuration: z.number().optional(),
        priority: z.enum(["high", "medium", "low"]).default("medium"),
        linkedIssueId: z.string().optional(),
        linkedPolicyId: z.string().optional(),
        linkedIntentId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertCountryResourceWriteAccess(
        ctx,
        await resolveMeetingCountryId(ctx.db, input.meetingId),
        "Meeting"
      );
      // `estimatedDuration` maps to the model's `duration` column; `priority` is
      // accepted for client compatibility but has no column on MeetingAgendaItem.
      return await ctx.db.meetingAgendaItem.create({
        data: {
          meetingId: input.meetingId,
          title: input.title,
          description: input.description,
          order: input.order,
          duration: input.estimatedDuration,
          linkedIssueId: input.linkedIssueId,
          linkedPolicyId: input.linkedPolicyId,
          linkedIntentId: input.linkedIntentId,
        },
      });
    }),

  getAgendaItems: publicProcedure
    .input(
      z.object({
        meetingId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      return await ctx.db.meetingAgendaItem.findMany({
        where: { meetingId: input.meetingId },
        orderBy: { order: "asc" },
      });
    }),

  // ==================== DECISIONS ====================

  getDecisions: publicProcedure
    .input(
      z.object({
        meetingId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      return await ctx.db.meetingDecision.findMany({
        where: { meetingId: input.meetingId },
      });
    }),

  // ==================== ACTION ITEMS ====================

  // ==================== GOVERNMENT OFFICIALS ====================

  // ==================== GOVERNMENT DEPARTMENTS ====================
});
