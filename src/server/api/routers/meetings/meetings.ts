// src/server/api/routers/meetings.ts
// Cabinet meetings, government officials, and meeting management

import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";
import { notificationHooks } from "~/lib/notification-hooks";

export const meetingsMeetingsRouter = createTRPCRouter({
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
      const { id, title, date, duration, status } = input;

      const oldMeeting = await ctx.db.cabinetMeeting.findUnique({
        where: { id },
        include: { attendances: { select: { officialId: true } } },
      });

      const meeting = await ctx.db.cabinetMeeting.update({
        where: { id },
        data: {
          ...(title !== undefined && { title }),
          ...(duration !== undefined && { duration }),
          ...(status !== undefined && { status }),
          ...(date !== undefined && { scheduledDate: date }),
        },
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

  // ==================== AGENDA ITEMS ====================

  // ==================== DECISIONS ====================

  // ==================== ACTION ITEMS ====================

  // ==================== GOVERNMENT OFFICIALS ====================

  // ==================== GOVERNMENT DEPARTMENTS ====================
});
