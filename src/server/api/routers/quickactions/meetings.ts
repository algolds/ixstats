/**
 * Quick Actions Cabinet Meetings Router (Plan 163 / Plan 191)
 *
 * Handles cabinet meeting lifecycle, agenda items, attendance tracking,
 * and meeting completion decision recommendations.
 */

import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { IxTime } from "~/lib/ixtime";
import { notificationHooks } from "~/lib/notifications/hooks";

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
        userId: z.string(),
        meeting: meetingInputSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const _currentIxTime = IxTime.getCurrentIxTime();

      const scheduledIxTime =
        input.meeting.scheduledIxTime ??
        IxTime.convertToIxTime(input.meeting.scheduledDate.getTime());

      // Create the meeting
      const meeting = await ctx.db.cabinetMeeting.create({
        data: {
          countryId: input.countryId,
          userId: input.userId,
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
          userId: input.userId,
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
          userId: input.userId,
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

  /**
   * Update meeting status and add notes
   */
  updateMeeting: protectedProcedure
    .input(
      z.object({
        meetingId: z.string(),
        updates: z.object({
          status: z.enum(["scheduled", "in_progress", "completed", "cancelled"]).optional(),
          notes: z.string().optional(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const meeting = await ctx.db.cabinetMeeting.update({
        where: { id: input.meetingId },
        data: {
          ...(input.updates.status && { status: input.updates.status }),
          ...(input.updates.notes && { notes: input.updates.notes }),
        },
      });

      // Update related activity schedule
      if (input.updates.status) {
        await ctx.db.activitySchedule.updateMany({
          where: {
            relatedIds: { contains: input.meetingId },
            activityType: "meeting",
          },
          data: {
            status:
              input.updates.status === "completed"
                ? "completed"
                : input.updates.status === "cancelled"
                  ? "cancelled"
                  : input.updates.status === "in_progress"
                    ? "in_progress"
                    : "scheduled",
          },
        });
      }

      return { meeting, success: true };
    }),

  /**
   * Update agenda item status
   */
  updateAgendaItem: protectedProcedure
    .input(
      z.object({
        agendaItemId: z.string(),
        status: z.enum(["pending", "discussed", "deferred", "completed"]),
        outcome: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const agendaItem = await ctx.db.meetingAgendaItem.update({
        where: { id: input.agendaItemId },
        data: {
          status: input.status,
          ...(input.outcome && { outcome: input.outcome }),
        },
      });

      return { agendaItem, success: true };
    }),

  /**
   * Complete a meeting and trigger decision/action prompts
   */
  completeMeeting: protectedProcedure
    .input(
      z.object({
        meetingId: z.string(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const meeting = await ctx.db.cabinetMeeting.findUnique({
        where: { id: input.meetingId },
        include: {
          agendaItems: true,
        },
      });

      if (!meeting) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Meeting not found",
        });
      }

      // Update meeting status
      await ctx.db.cabinetMeeting.update({
        where: { id: input.meetingId },
        data: {
          status: "completed",
          completedAt: new Date(),
          notes: input.notes ?? null,
        },
      });

      // Update related activity schedule
      await ctx.db.activitySchedule.updateMany({
        where: {
          relatedIds: { contains: input.meetingId },
          activityType: "meeting",
        },
        data: {
          status: "completed",
        },
      });

      // Notify about meeting completion
      try {
        const discussedCount = meeting.agendaItems.filter((i) => i.status === "discussed").length;
        await notificationHooks.onQuickActionComplete({
          countryId: meeting.countryId,
          actionType: "meeting",
          actionName: meeting.title,
          status: "completed",
          impactSummary: `Meeting completed with ${discussedCount} items discussed`,
          href: "/mycountry/quickactions",
        });
      } catch (error) {
        console.error("[QuickActions] Failed to send meeting completion notification:", error);
      }

      // Generate suggested decisions based on agenda items
      const suggestedDecisions: Array<{
        title: string;
        description: string;
        decisionType: string;
        agendaItemId?: string;
        agendaTitle: string;
      }> = [];

      for (const item of meeting.agendaItems) {
        const category = item.category?.toLowerCase() ?? "";
        const tags = item.tags ? (JSON.parse(item.tags) as string[]) : [];

        // Generate context-appropriate decision suggestions
        if (category === "economic" || tags.includes("budget") || tags.includes("finance")) {
          suggestedDecisions.push({
            title: `Budget Allocation for ${item.title}`,
            description: `Approve budget allocation related to: ${item.title}`,
            decisionType: "budget_allocation",
            agendaItemId: item.id,
            agendaTitle: item.title,
          });
        }

        if (category === "social" || tags.includes("policy")) {
          suggestedDecisions.push({
            title: `Policy Decision on ${item.title}`,
            description: `Approve or modify policy discussed in: ${item.title}`,
            decisionType: "policy_approval",
            agendaItemId: item.id,
            agendaTitle: item.title,
          });
        }

        if (tags.includes("appointment") || tags.includes("personnel")) {
          suggestedDecisions.push({
            title: `Personnel Decision for ${item.title}`,
            description: `Approve appointment or personnel change for: ${item.title}`,
            decisionType: "appointment",
            agendaItemId: item.id,
            agendaTitle: item.title,
          });
        }

        // Always suggest a general resolution for discussed items
        if (item.status === "discussed") {
          suggestedDecisions.push({
            title: `Resolution on ${item.title}`,
            description: `Record formal decision regarding: ${item.title}`,
            decisionType: "resolution",
            agendaItemId: item.id,
            agendaTitle: item.title,
          });
        }
      }

      return {
        success: true,
        message: "Meeting completed successfully",
        suggestedDecisions,
      };
    }),
});
