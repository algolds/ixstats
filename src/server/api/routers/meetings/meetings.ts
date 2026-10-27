// src/server/api/routers/meetings.ts
// Cabinet meetings, government officials, and meeting management

import { z } from "zod";
import { createTRPCRouter, publicProcedure, rateLimitedMutationProcedure } from "~/server/api/trpc";
import { notificationHooks } from "~/lib/notifications/hooks";
import {
  assertCountryWriteAccess,
  countriesWithWriteAccess,
} from "~/server/shared/country-authorization";
import { assertSameRealm } from "~/server/shared/same-realm-guard";

export const meetingsMeetingsRouter = createTRPCRouter({
  // ==================== CABINET MEETINGS ====================

  createMeeting: rateLimitedMutationProcedure
    .input(
      z.object({
        countryId: z.string(),
        targetCountryId: z.string().optional(),
        userId: z.string().optional(), // ignored: the organiser is always the caller
        title: z.string().min(1).max(200),
        scheduledDate: z.date(),
        description: z.string().optional(),
        duration: z.number().optional(),
        scheduledIxTime: z.number().optional(),
        intentId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertCountryWriteAccess(ctx, input.countryId);
      const { targetCountryId, intentId, ...rest } = input;
      if (targetCountryId) await assertSameRealm(ctx.db, input.countryId, targetCountryId);
      const status = targetCountryId ? "pending" : "scheduled";
      const meeting = await ctx.db.cabinetMeeting.create({
        data: {
          ...rest,
          userId: ctx.auth.userId,
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
          participants: [meeting.userId], // Will expand with attendees later
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
            where: { ownedCountries: { some: { id: targetCountryId } } },
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
        limit: z.number().int().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const meetings = await ctx.db.cabinetMeeting.findMany({
        where: {
          OR: [{ countryId: input.countryId }, { targetCountryId: input.countryId }],
        },
        orderBy: { scheduledDate: "desc" },
        take: input.limit,
        include: {
          attendances: true,
          agendaItems: true,
          decisions: true,
          actionItems: true,
        },
      });
      // Notes, decisions, action items, attendance notes and agenda outcomes belong to the
      // governments at the table: redacted for everyone else.
      const writable = await countriesWithWriteAccess(
        ctx,
        meetings.flatMap((m) => [m.countryId, m.targetCountryId])
      );
      return meetings.map((m) =>
        writable.has(m.countryId) || (m.targetCountryId !== null && writable.has(m.targetCountryId))
          ? m
          : {
              ...m,
              notes: null,
              decisions: [],
              actionItems: [],
              attendances: m.attendances.map((a) => ({ ...a, notes: null })),
              agendaItems: m.agendaItems.map((a) => ({ ...a, outcome: null })),
            }
      );
    }),
});
