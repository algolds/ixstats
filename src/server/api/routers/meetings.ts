// src/server/api/routers/meetings.ts
// Cabinet meetings, government officials, and meeting management

import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";
import { notificationHooks } from "~/lib/notification-hooks";

export const meetingsRouter = createTRPCRouter({
  // ==================== CABINET MEETINGS ====================

  createMeeting: protectedProcedure
    .input(
      z.object({
        countryId: z.string(),
        userId: z.string(),
        title: z.string().min(1).max(200),
        scheduledDate: z.date(),
        description: z.string().optional(),
        duration: z.number().optional(),
        scheduledIxTime: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const meeting = await ctx.db.cabinetMeeting.create({
        data: input,
      });

      // 🔔 Notify meeting scheduled (to country)
      await notificationHooks
        .onMeetingEvent({
          meetingId: meeting.id,
          title: meeting.title,
          scheduledTime: meeting.scheduledDate,
          participants: [input.userId], // Will expand with attendees later
          action: "scheduled",
        })
        .catch((err) => console.error("[Meetings] Failed to send scheduled notification:", err));

      return meeting;
    }),

  getMeetings: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      return await ctx.db.cabinetMeeting.findMany({
        where: { countryId: input.countryId },
        orderBy: { scheduledDate: "desc" },
        include: {
          attendances: true,
          agendaItems: true,
          decisions: true,
          actionItems: true,
        },
      });
    }),

  getMeeting: publicProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      return await ctx.db.cabinetMeeting.findUnique({
        where: { id: input.id },
        include: {
          attendances: {
            include: {
              official: true,
            },
          },
          agendaItems: true,
          decisions: true,
          actionItems: true,
        },
      });
    }),

  updateMeeting: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().optional(),
        date: z.date().optional(),
        duration: z.number().optional(),
        location: z.string().optional(),
        purpose: z.string().optional(),
        status: z.enum(["scheduled", "in_progress", "completed", "cancelled"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const oldMeeting = await ctx.db.cabinetMeeting.findUnique({
        where: { id },
        include: { attendances: true },
      });

      const meeting = await ctx.db.cabinetMeeting.update({
        where: { id },
        data,
      });

      // 🔔 Notify status changes
      if (input.status && oldMeeting) {
        const participants = oldMeeting.attendances
          .map((a) => a.officialId)
          .filter((id): id is string => id !== null);

        if (input.status === "cancelled") {
          await notificationHooks
            .onMeetingEvent({
              meetingId: meeting.id,
              title: meeting.title,
              scheduledTime: meeting.scheduledDate,
              participants,
              action: "cancelled",
            })
            .catch((err) =>
              console.error("[Meetings] Failed to send cancelled notification:", err)
            );
        } else if (input.status === "completed") {
          await notificationHooks
            .onMeetingEvent({
              meetingId: meeting.id,
              title: meeting.title,
              scheduledTime: meeting.scheduledDate,
              participants,
              action: "ended",
            })
            .catch((err) => console.error("[Meetings] Failed to send ended notification:", err));
        }
      }

      return meeting;
    }),

  deleteMeeting: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.cabinetMeeting.delete({
        where: { id: input.id },
      });
    }),

  // ==================== MEETING ATTENDANCE ====================

  recordAttendance: protectedProcedure
    .input(
      z.object({
        meetingId: z.string(),
        officialId: z.string(),
        attendeeName: z.string(),
        attendanceStatus: z.enum(["invited", "confirmed", "attended", "declined", "absent"]),
        attendeeRole: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if attendance record already exists
      const existing = await ctx.db.meetingAttendance.findFirst({
        where: {
          meetingId: input.meetingId,
          officialId: input.officialId,
        },
      });

      if (existing) {
        return await ctx.db.meetingAttendance.update({
          where: { id: existing.id },
          data: {
            attendanceStatus: input.attendanceStatus,
            attendeeRole: input.attendeeRole,
            notes: input.notes,
          },
        });
      }

      return await ctx.db.meetingAttendance.create({
        data: input,
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

  addAgendaItem: protectedProcedure
    .input(
      z.object({
        meetingId: z.string(),
        title: z.string().min(1).max(200),
        description: z.string().optional(),
        order: z.number(),
        estimatedDuration: z.number().optional(),
        priority: z.enum(["high", "medium", "low"]).default("medium"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.meetingAgendaItem.create({
        data: input,
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
      const { id, ...data } = input;
      return await ctx.db.meetingAgendaItem.update({
        where: { id },
        data,
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
      })
    )
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.meetingDecision.create({
        data: input,
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
      const { id, ...data } = input;
      return await ctx.db.meetingDecision.update({
        where: { id },
        data,
      });
    }),

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
        priority: z.enum(["high", "medium", "low"]).default("medium"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.meetingActionItem.create({
        data: input,
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
      if (input.officialId) where.assignedToId = input.officialId;
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
      const { id, ...data } = input;
      return await ctx.db.meetingActionItem.update({
        where: { id },
        data,
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
      const { id, ...data } = input;
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
