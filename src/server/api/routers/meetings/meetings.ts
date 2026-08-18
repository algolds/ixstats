// src/server/api/routers/meetings.ts
// Cabinet meetings, government officials, and meeting management

import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { notificationHooks } from "~/lib/notifications/hooks";

export const meetingsMeetingsRouter = createTRPCRouter({
  // ==================== CABINET MEETINGS ====================

  createMeeting: protectedProcedure
    .input(
      z.object({
        countryId: z.string(),
        targetCountryId: z.string().optional(),
        userId: z.string(),
        title: z.string().min(1).max(200),
        scheduledDate: z.date(),
        description: z.string().optional(),
        duration: z.number().optional(),
        scheduledIxTime: z.number().optional(),
        intentId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { targetCountryId, intentId, ...rest } = input;
      const status = targetCountryId ? "pending" : "scheduled";
      const meeting = await ctx.db.cabinetMeeting.create({
        data: {
          ...rest,
          targetCountryId,
          intentId,
          status,
        },
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

      // 🔔 Trigger diplomatic notification if it's a cross-country meeting request
      if (targetCountryId) {
        try {
          const hostCountry = await ctx.db.country.findUnique({
            where: { id: input.countryId },
            select: { name: true },
          });
          const targetUsers = await ctx.db.user.findMany({
            where: { countryId: targetCountryId },
            select: { id: true },
          });

          await notificationHooks.onDiplomaticEvent({
            eventType: "treaty",
            title: "Summit Requested",
            countries: [input.countryId, targetCountryId],
            description: `Bilateral summit request from ${hostCountry?.name || "foreign nation"}.`,
            affectedUserIds: targetUsers.map((u) => u.id),
          });
        } catch (err) {
          console.error("[Meetings] Failed to send diplomatic notification:", err);
        }
      }

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
        where: {
          OR: [{ countryId: input.countryId }, { targetCountryId: input.countryId }],
        },
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

  acceptMeeting: protectedProcedure
    .input(
      z.object({
        meetingId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userCountryId = ctx.user?.countryId;
      if (!userCountryId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You must have a country to accept meeting requests.",
        });
      }

      const meeting = await ctx.db.cabinetMeeting.findUnique({
        where: { id: input.meetingId },
        include: { attendances: true },
      });

      if (!meeting) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Meeting not found.",
        });
      }

      if (meeting.targetCountryId !== userCountryId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have permission to accept this meeting invitation.",
        });
      }

      const updatedMeeting = await ctx.db.cabinetMeeting.update({
        where: { id: input.meetingId },
        data: { status: "scheduled" },
      });

      // 1. Boost Diplomatic Relation strength by +5
      try {
        const relation = await ctx.db.diplomaticRelation.findFirst({
          where: {
            OR: [
              { country1: meeting.countryId, country2: userCountryId },
              { country1: userCountryId, country2: meeting.countryId },
            ],
          },
        });

        if (relation) {
          await ctx.db.diplomaticRelation.update({
            where: { id: relation.id },
            data: {
              strength: Math.min(100, relation.strength + 5),
              lastContact: new Date(),
            },
          });
        } else {
          await ctx.db.diplomaticRelation.create({
            data: {
              country1: meeting.countryId,
              country2: userCountryId,
              relationship: "neutral",
              strength: 55,
              status: "active",
              lastContact: new Date(),
            },
          });
        }
      } catch (err) {
        console.error("[Meetings] Failed to boost diplomatic relation:", err);
      }

      // 2. Create private bilateral diplomatic chat channel if it doesn't exist
      try {
        const hostCountry = await ctx.db.country.findUnique({
          where: { id: meeting.countryId },
          select: { name: true },
        });
        const targetCountry = await ctx.db.country.findUnique({
          where: { id: userCountryId },
          select: { name: true },
        });

        if (hostCountry && targetCountry) {
          const channels = await ctx.db.diplomaticChannel.findMany({
            where: {
              type: "bilateral",
              participants: {
                some: { countryId: meeting.countryId },
              },
            },
            include: {
              participants: true,
            },
          });

          const existingBilateralChannel = channels.find((ch) =>
            ch.participants.some((p) => p.countryId === userCountryId)
          );

          if (!existingBilateralChannel) {
            const newChannel = await ctx.db.diplomaticChannel.create({
              data: {
                name: `Bilateral Hotline: ${hostCountry.name} & ${targetCountry.name}`,
                type: "bilateral",
                classification: "PRIVATE",
                encrypted: true,
              },
            });

            await ctx.db.diplomaticChannelParticipant.createMany({
              data: [
                {
                  channelId: newChannel.id,
                  countryId: meeting.countryId,
                  countryName: hostCountry.name,
                },
                {
                  channelId: newChannel.id,
                  countryId: userCountryId,
                  countryName: targetCountry.name,
                },
              ],
            });
          }
        }
      } catch (err) {
        console.error("[Meetings] Failed to setup message channel:", err);
      }

      // 3. Log a DiplomaticEvent
      try {
        const hostCountry = await ctx.db.country.findUnique({
          where: { id: meeting.countryId },
          select: { name: true },
        });
        const targetCountry = await ctx.db.country.findUnique({
          where: { id: userCountryId },
          select: { name: true },
        });

        await ctx.db.diplomaticEvent.create({
          data: {
            country1Id: meeting.countryId,
            country2Id: userCountryId,
            eventType: "treaty",
            title: "Bilateral Summit Confirmed",
            description: `Bilateral summit confirmed between ${hostCountry?.name || "foreign nation"} and ${targetCountry?.name || "foreign nation"}.`,
            severity: "medium",
          },
        });
      } catch (err) {
        console.error("[Meetings] Failed to log diplomatic event:", err);
      }

      // 4. Trigger notifications
      try {
        const hostUsers = await ctx.db.user.findMany({
          where: { countryId: meeting.countryId },
          select: { id: true },
        });
        const participantIds = meeting.attendances
          .map((a) => a.officialId)
          .filter((id): id is string => id !== null);

        await notificationHooks.onMeetingEvent({
          meetingId: meeting.id,
          title: meeting.title,
          scheduledTime: meeting.scheduledDate,
          participants: [...participantIds, ...hostUsers.map((u) => u.id)],
          action: "scheduled",
        });
      } catch (err) {
        console.error("[Meetings] Failed to send accept notifications:", err);
      }

      return updatedMeeting;
    }),

  declineMeeting: protectedProcedure
    .input(
      z.object({
        meetingId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userCountryId = ctx.user?.countryId;
      if (!userCountryId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You must have a country to decline meeting requests.",
        });
      }

      const meeting = await ctx.db.cabinetMeeting.findUnique({
        where: { id: input.meetingId },
        include: { attendances: true },
      });

      if (!meeting) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Meeting not found.",
        });
      }

      if (meeting.targetCountryId !== userCountryId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have permission to decline this meeting invitation.",
        });
      }

      const updatedMeeting = await ctx.db.cabinetMeeting.update({
        where: { id: input.meetingId },
        data: { status: "declined" },
      });

      // Trigger cancelled notifications
      try {
        const hostUsers = await ctx.db.user.findMany({
          where: { countryId: meeting.countryId },
          select: { id: true },
        });
        const participantIds = meeting.attendances
          .map((a) => a.officialId)
          .filter((id): id is string => id !== null);

        await notificationHooks.onMeetingEvent({
          meetingId: meeting.id,
          title: meeting.title,
          scheduledTime: meeting.scheduledDate,
          participants: [...participantIds, ...hostUsers.map((u) => u.id)],
          action: "cancelled",
        });
      } catch (err) {
        console.error("[Meetings] Failed to send decline notifications:", err);
      }

      return updatedMeeting;
    }),

  // ==================== MEETING ATTENDANCE ====================

  // ==================== AGENDA ITEMS ====================

  // ==================== DECISIONS ====================

  // ==================== ACTION ITEMS ====================

  // ==================== GOVERNMENT OFFICIALS ====================

  // ==================== GOVERNMENT DEPARTMENTS ====================
});
