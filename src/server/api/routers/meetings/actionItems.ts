// src/server/api/routers/meetings.ts
// Cabinet meetings, government officials, and meeting management

import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";

export const meetingsActionItemsRouter = createTRPCRouter({
  // ==================== CABINET MEETINGS ====================

  // ==================== MEETING ATTENDANCE ====================

  // ==================== AGENDA ITEMS ====================

  // ==================== DECISIONS ====================

  // ==================== ACTION ITEMS ====================

  createActionItem: protectedProcedure
    .input(
      z.object({
        meetingId: z.string(),
        decisionId: z.string().optional(),
        agendaItemId: z.string().optional(),
        title: z.string().min(1).max(200),
        description: z.string(),
        assignedToId: z.string(),
        dueDate: z.date().optional(),
        priority: z.enum(["urgent", "high", "normal", "medium", "low"]).default("normal"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { assignedToId, ...rest } = input;
      return await ctx.db.meetingActionItem.create({
        data: {
          ...rest,
          assignedTo: assignedToId,
        },
      });
    }),

  getActionItems: publicProcedure
    .input(
      z.object({
        meetingId: z.string().optional(),
        officialId: z.string().optional(),
        status: z.enum(["pending", "in_progress", "completed", "overdue"]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input.meetingId) where.meetingId = input.meetingId;
      if (input.officialId) where.assignedTo = input.officialId;
      if (input.status) where.status = input.status;

      return await ctx.db.meetingActionItem.findMany({
        where,
        include: {
          meeting: true,
        },
        orderBy: { dueDate: "asc" },
      });
    }),

  updateActionItem: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().optional(),
        description: z.string().optional(),
        status: z.enum(["pending", "in_progress", "completed", "overdue"]).optional(),
        dueDate: z.date().optional(),
        completedAt: z.date().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, title, description, status, dueDate, completedAt, notes } = input;
      return await ctx.db.meetingActionItem.update({
        where: { id },
        data: {
          ...(title !== undefined && { title }),
          ...(description !== undefined && { description }),
          ...(status !== undefined && { status }),
          ...(dueDate !== undefined && { dueDate }),
          ...(completedAt !== undefined && { completedAt }),
          ...(notes !== undefined && { completionNotes: notes }),
        },
      });
    }),

  deleteActionItem: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.meetingActionItem.delete({
        where: { id: input.id },
      });
    }),

  // ==================== GOVERNMENT OFFICIALS ====================

  // ==================== GOVERNMENT DEPARTMENTS ====================
});
