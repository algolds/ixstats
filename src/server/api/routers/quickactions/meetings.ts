/**
 * Quick Actions Cabinet Meetings Router (Plan 163 / Plan 191)
 *
 * Lists cabinet meetings and schedules new ones (with attendees, agenda
 * items and an activity-schedule entry).
 */

import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { IxTime } from "~/lib/ixtime";
import { notificationHooks } from "~/lib/notifications/hooks";
import { assertCountryWriteAccess } from "~/server/shared/country-authorization";

const meetingInputSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional().nullable(),
  scheduledDate: z.date(),
  scheduledIxTime: z.number().optional(),
  duration: z.number().int().min(15).max(480).default(60),
  attendeeIds: z.array(z.string()).default([]),
  customAttendees: z
    .array(
      z.object({
        name: z.string(),
        role: z.string().optional(),
      })
    )
    .optional()
    .default([]),
  agendaItems: z
    .array(
      z.object({
        title: z.string(),
        description: z.string().optional(),
        duration: z.number().optional(),
        category: z.string().optional(),
        tags: z.array(z.string()).optional(),
        presenter: z.string().optional(),
      })
    )
    .optional()
    .default([]),
});

export const quickActionsMeetingsRouter = createTRPCRouter({
  /**
   * Get all meetings for a country
   */
  getMeetings: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
        userId: z.string().optional(),
        status: z.enum(["scheduled", "in_progress", "completed", "cancelled"]).optional(),
        fromDate: z.date().optional(),
        toDate: z.date().optional(),
        limit: z.number().int().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const meetings = await ctx.db.cabinetMeeting.findMany({
        where: {
          countryId: input.countryId,
          ...(input.userId && { userId: input.userId }),
          ...(input.status && { status: input.status }),
          ...(input.fromDate && { scheduledDate: { gte: input.fromDate } }),
          ...(input.toDate && { scheduledDate: { lte: input.toDate } }),
        },
        include: {
          attendances: {
            include: {
              official: {
                select: {
                  id: true,
                  name: true,
                  title: true,
                  role: true,
                },
              },
            },
          },
          agendaItems: {
            orderBy: { order: "asc" },
          },
        },
        orderBy: { scheduledDate: "desc" },
        take: input.limit,
      });

      return meetings.map((meeting) => ({
        ...meeting,
        attendances: meeting.attendances.map((attendance) => ({
          ...attendance,
        })),
        agendaItems: meeting.agendaItems.map((item) => ({
          ...item,
          tags: item.tags ? JSON.parse(item.tags) : [],
          relatedMetrics: item.relatedMetrics ? JSON.parse(item.relatedMetrics) : null,
        })),
      }));
    }),

  /**
   * Create a new cabinet meeting with IxTime sync
   */
  createMeeting: protectedProcedure
    .input(
      z.object({
        countryId: z.string(),
        userId: z.string().optional(), // ignored: the organiser is always the caller
        meeting: meetingInputSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertCountryWriteAccess(ctx, input.countryId);
      const userId = ctx.auth.userId;

      const scheduledIxTime =
        input.meeting.scheduledIxTime ??
        IxTime.convertToIxTime(input.meeting.scheduledDate.getTime());

      // Create the meeting
      const meeting = await ctx.db.cabinetMeeting.create({
        data: {
          countryId: input.countryId,
          userId,
          title: input.meeting.title,
          description: input.meeting.description ?? null,
          scheduledDate: input.meeting.scheduledDate,
          scheduledIxTime,
          duration: input.meeting.duration,
          status: "scheduled",
        },
      });

      // Add attendances for government officials
      if (input.meeting.attendeeIds.length > 0) {
        await ctx.db.meetingAttendance.createMany({
          data: input.meeting.attendeeIds.map((officialId) => ({
            meetingId: meeting.id,
            officialId,
            attendeeName: "",
            attendanceStatus: "invited",
          })),
        });
      }

      // Add custom attendees
      if (input.meeting.customAttendees && input.meeting.customAttendees.length > 0) {
        await ctx.db.meetingAttendance.createMany({
          data: input.meeting.customAttendees.map((attendee) => ({
            meetingId: meeting.id,
            attendeeName: attendee.name,
            attendeeRole: attendee.role ?? null,
            attendanceStatus: "invited",
          })),
        });
      }

      // Add agenda items
      if (input.meeting.agendaItems && input.meeting.agendaItems.length > 0) {
        await ctx.db.meetingAgendaItem.createMany({
          data: input.meeting.agendaItems.map((item, index) => ({
            meetingId: meeting.id,
            title: item.title,
            description: item.description ?? null,
            order: index,
            duration: item.duration ?? null,
            category: item.category ?? null,
            tags: item.tags ? JSON.stringify(item.tags) : null,
            presenter: item.presenter ?? null,
            status: "pending",
          })),
        });
      }

      // Create activity schedule entry
      await ctx.db.activitySchedule.create({
        data: {
          countryId: input.countryId,
          userId,
          activityType: "meeting",
          title: input.meeting.title,
          description: input.meeting.description ?? null,
          scheduledDate: input.meeting.scheduledDate,
          scheduledIxTime,
          duration: input.meeting.duration,
          status: "scheduled",
          priority: "normal",
          category: "government",
          relatedIds: JSON.stringify({ meetingId: meeting.id }),
        },
      });

      // Notify about meeting scheduled
      try {
        await notificationHooks.onQuickActionComplete({
          userId,
          countryId: input.countryId,
          actionType: "meeting",
          actionName: input.meeting.title,
          status: "scheduled",
          impactSummary: `Scheduled for ${input.meeting.scheduledDate.toLocaleDateString()} with ${input.meeting.attendeeIds.length} attendees`,
          href: "/mycountry/quickactions",
        });
      } catch (error) {
        console.error("[QuickActions] Failed to send meeting scheduled notification:", error);
      }

      return { meeting, success: true, message: "Cabinet meeting scheduled successfully" };
    }),
});
