// src/server/api/routers/meetings.ts
// Cabinet meetings, government officials, and meeting management

import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";

export const meetingsGovernmentRouter = createTRPCRouter({
  // ==================== CABINET MEETINGS ====================

  // ==================== MEETING ATTENDANCE ====================

  // ==================== AGENDA ITEMS ====================

  // ==================== DECISIONS ====================

  // ==================== ACTION ITEMS ====================

  // ==================== GOVERNMENT OFFICIALS ====================

  appointOfficial: protectedProcedure
    .input(
      z.object({
        governmentStructureId: z.string().optional(),
        departmentId: z.string().optional(),
        name: z.string().min(1).max(100),
        title: z.string().min(1).max(100),
        role: z.string(),
        appointedDate: z.date(),
        termEndDate: z.date().optional(),
        bio: z.string().optional(),
        email: z.string().optional(),
        phone: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.governmentOfficial.create({
        data: input,
      });
    }),

  getOfficials: publicProcedure
    .input(
      z.object({
        governmentStructureId: z.string().optional(),
        departmentId: z.string().optional(),
        active: z.boolean().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input.governmentStructureId) where.governmentStructureId = input.governmentStructureId;
      if (input.departmentId) where.departmentId = input.departmentId;
      if (input.active !== undefined) where.isActive = input.active;

      return await ctx.db.governmentOfficial.findMany({
        where,
        include: {
          department: true,
        },
        orderBy: [{ title: "asc" }],
      });
    }),

  getOfficial: publicProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      return await ctx.db.governmentOfficial.findUnique({
        where: { id: input.id },
        include: {
          meetingAttendances: {
            include: { meeting: true },
            orderBy: { meetingId: "desc" },
            take: 10,
          },
        },
      });
    }),

  updateOfficial: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        title: z.string().optional(),
        role: z.string().optional(),
        departmentId: z.string().optional(),
        termEndDate: z.date().optional(),
        bio: z.string().optional(),
        isActive: z.boolean().optional(),
        email: z.string().optional(),
        phone: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return await ctx.db.governmentOfficial.update({
        where: { id },
        data,
      });
    }),

  removeOfficial: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.governmentOfficial.update({
        where: { id: input.id },
        data: {
          isActive: false,
          termEndDate: new Date(),
        },
      });
    }),

  // ==================== GOVERNMENT DEPARTMENTS ====================

  createDepartment: protectedProcedure
    .input(
      z.object({
        governmentStructureId: z.string(),
        name: z.string().min(1).max(100),
        category: z.string(),
        description: z.string().optional(),
        shortName: z.string().optional(),
        minister: z.string().optional(),
        ministerTitle: z.string().optional(),
        parentDepartmentId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.governmentDepartment.create({
        data: input,
      });
    }),

  getDepartments: publicProcedure
    .input(
      z.object({
        governmentStructureId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      return await ctx.db.governmentDepartment.findMany({
        where: { governmentStructureId: input.governmentStructureId },
        include: {
          officials: {
            where: { isActive: true },
          },
        },
        orderBy: { name: "asc" },
      });
    }),

  updateDepartment: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        description: z.string().optional(),
        budget: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, budget: _budget, ...data } = input;
      return await ctx.db.governmentDepartment.update({
        where: { id },
        data,
      });
    }),

  deleteDepartment: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // First check if department has officials
      const officials = await ctx.db.governmentOfficial.count({
        where: { departmentId: input.id },
      });

      if (officials > 0) {
        throw new Error("Cannot delete department with active officials");
      }

      return await ctx.db.governmentDepartment.delete({
        where: { id: input.id },
      });
    }),
});
