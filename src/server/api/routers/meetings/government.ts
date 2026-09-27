// src/server/api/routers/meetings.ts
// Cabinet meetings, government officials, and meeting management

import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";
import { assertCountryResourceWriteAccess } from "~/server/shared/country-authorization";
import {
  resolveDepartmentCountryId,
  resolveOfficialCountryId,
  resolveStructureCountryId,
} from "~/server/shared/country-resource-owner";

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
      const { governmentStructureId, departmentId } = input;
      if (departmentId) {
        const departmentCountryId = await resolveDepartmentCountryId(ctx.db, departmentId);
        await assertCountryResourceWriteAccess(ctx, departmentCountryId, "Department");
      }
      // With no parent at all, only privileged callers may create a floating official.
      if (governmentStructureId || !departmentId) {
        const structureCountryId = governmentStructureId
          ? await resolveStructureCountryId(ctx.db, governmentStructureId)
          : null;
        await assertCountryResourceWriteAccess(ctx, structureCountryId, "Government structure");
      }
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

  removeOfficial: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertCountryResourceWriteAccess(
        ctx,
        await resolveOfficialCountryId(ctx.db, input.id),
        "Official"
      );
      return await ctx.db.governmentOfficial.update({
        where: { id: input.id },
        data: {
          isActive: false,
          termEndDate: new Date(),
        },
      });
    }),

  // ==================== GOVERNMENT DEPARTMENTS ====================

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
});
