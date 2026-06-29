// src/server/api/routers/meetings.ts
// Cabinet meetings, government officials, and meeting management

import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";

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
      })
    )
    .mutation(async ({ ctx, input }) => {
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

  updateAgendaItem: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().optional(),
        description: z.string().optional(),
        order: z.number().optional(),
        estimatedDuration: z.number().optional(),
        priority: z.enum(["high", "medium", "low"]).optional(),
        status: z.enum(["pending", "in_progress", "completed", "deferred"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // `estimatedDuration` maps to `duration`; `priority` has no column and is ignored.
      // Undefined fields are no-ops in Prisma, preserving partial-update behavior.
      return await ctx.db.meetingAgendaItem.update({
        where: { id: input.id },
        data: {
          title: input.title,
          description: input.description,
          order: input.order,
          duration: input.estimatedDuration,
          status: input.status,
        },
      });
    }),

  deleteAgendaItem: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.meetingAgendaItem.delete({
        where: { id: input.id },
      });
    }),

  // ==================== DECISIONS ====================

  recordDecision: protectedProcedure
    .input(
      z.object({
        meetingId: z.string(),
        agendaItemId: z.string().optional(),
        title: z.string().min(1).max(200),
        description: z.string(),
        decisionType: z.enum(["policy", "budget", "personnel", "strategic", "other"]),
        votesFor: z.number().optional(),
        votesAgainst: z.number().optional(),
        votesAbstain: z.number().optional(),
        outcome: z.enum(["approved", "rejected", "deferred", "requires_review"]),
        estimatedEffect: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { votesFor, votesAgainst, votesAbstain, ...rest } = input;
      return await ctx.db.meetingDecision.create({
        data: {
          ...rest,
          implementationStatus: "pending",
          votingResult: JSON.stringify({
            for: votesFor ?? 0,
            against: votesAgainst ?? 0,
            abstain: votesAbstain ?? 0,
          }),
        },
      });
    }),

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

  updateDecision: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().optional(),
        description: z.string().optional(),
        outcome: z.enum(["approved", "rejected", "deferred", "requires_review"]).optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, title, description } = input;
      return await ctx.db.meetingDecision.update({
        where: { id },
        data: {
          ...(title !== undefined && { title }),
          ...(description !== undefined && { description }),
        },
      });
    }),

  // ==================== ACTION ITEMS ====================

  // ==================== GOVERNMENT OFFICIALS ====================

  // ==================== GOVERNMENT DEPARTMENTS ====================
});
