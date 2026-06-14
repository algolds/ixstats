// src/server/api/routers/meetings.ts
// Cabinet meetings, government officials, and meeting management

import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";

export const meetingsAttendanceRouter = createTRPCRouter({
  // ==================== CABINET MEETINGS ====================

  // ==================== MEETING ATTENDANCE ====================

  recordAttendance: protectedProcedure
    .input(
      z.object({
        meetingId: z.string(),
        officialId: z.string().nullish(),
        attendeeName: z.string(),
        attendanceStatus: z.enum(["invited", "confirmed", "attended", "declined", "absent"]),
        attendeeRole: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if attendance record already exists
      const existing = input.officialId
        ? await ctx.db.meetingAttendance.findFirst({
            where: {
              meetingId: input.meetingId,
              officialId: input.officialId,
            },
          })
        : await ctx.db.meetingAttendance.findFirst({
            where: {
              meetingId: input.meetingId,
              attendeeName: input.attendeeName,
              officialId: null,
            },
          });

      if (existing) {
        return await ctx.db.meetingAttendance.update({
          where: { id: existing.id },
          data: {
            attendanceStatus: input.attendanceStatus,
            attendeeRole: input.attendeeRole ?? null,
            notes: input.notes ?? null,
          },
        });
      }

      return await ctx.db.meetingAttendance.create({
        data: {
          meetingId: input.meetingId,
          officialId: input.officialId ?? null,
          attendeeName: input.attendeeName,
          attendanceStatus: input.attendanceStatus,
          attendeeRole: input.attendeeRole ?? null,
          notes: input.notes ?? null,
        },
      });
    }),

  getAttendance: publicProcedure
    .input(
      z.object({
        meetingId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      return await ctx.db.meetingAttendance.findMany({
        where: { meetingId: input.meetingId },
        include: {
          official: true,
        },
      });
    }),

  // ==================== AGENDA ITEMS ====================

  // ==================== DECISIONS ====================

  // ==================== ACTION ITEMS ====================

  // ==================== GOVERNMENT OFFICIALS ====================

  // ==================== GOVERNMENT DEPARTMENTS ====================
});
