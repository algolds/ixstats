// src/server/api/routers/meetings.ts
// Cabinet meetings, government officials, and meeting management

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, lightMutationProcedure, protectedProcedure } from "~/server/api/trpc";
import { assertCountryResourceWriteAccess } from "~/server/shared/country-authorization";
import { resolveMeetingCountryId } from "~/server/shared/country-resource-owner";

/** A meeting in one of these statuses is over and cannot be concluded (again). */
const CLOSED_MEETING_STATUSES = ["completed", "cancelled"];

const AGENDA_DECISIONS = ["approved", "rejected", "deferred"] as const;
type AgendaDecision = (typeof AGENDA_DECISIONS)[number];

/** MeetingAgendaItem.status after each decision. */
const AGENDA_ITEM_STATUS: Record<AgendaDecision, string> = {
  approved: "decided",
  rejected: "decided",
  deferred: "deferred",
};

const DECISION_LABEL: Record<AgendaDecision, string> = {
  approved: "Approved",
  rejected: "Rejected",
  deferred: "Deferred",
};

export const meetingsProceedingsRouter = createTRPCRouter({
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
        linkedIssueId: z.string().optional(),
        linkedPolicyId: z.string().optional(),
        linkedIntentId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertCountryResourceWriteAccess(
        ctx,
        await resolveMeetingCountryId(ctx.db, input.meetingId),
        "Meeting"
      );
      // `estimatedDuration` maps to the model's `duration` column; `priority` is
      // accepted for client compatibility but has no column on MeetingAgendaItem.
      return await ctx.db.meetingAgendaItem.create({
        data: {
          meetingId: input.meetingId,
          title: input.title,
          description: input.description,
          order: input.order,
          duration: input.estimatedDuration,
          linkedIssueId: input.linkedIssueId,
          linkedPolicyId: input.linkedPolicyId,
          linkedIntentId: input.linkedIntentId,
        },
      });
    }),

  // ==================== CONCLUDE ====================

  /**
   * Conclude a meeting: record the overall outcome (`CabinetMeeting.notes`) and one
   * MeetingDecision per decided agenda item, set each item's status and outcome, and mark the
   * meeting completed. Host country owner or privileged roles only.
   */
  concludeMeeting: lightMutationProcedure
    .input(
      z.object({
        meetingId: z.string().min(1),
        outcome: z.string().trim().min(1).max(2000),
        decisions: z
          .array(
            z.object({
              agendaItemId: z.string().min(1),
              decision: z.enum(AGENDA_DECISIONS),
              notes: z.string().trim().max(1000).optional(),
            })
          )
          .max(50)
          .default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertCountryResourceWriteAccess(
        ctx,
        await resolveMeetingCountryId(ctx.db, input.meetingId),
        "Meeting"
      );
      const meeting = await ctx.db.cabinetMeeting.findUnique({
        where: { id: input.meetingId },
        select: { id: true, status: true, agendaItems: { select: { id: true, title: true } } },
      });
      if (!meeting) throw new TRPCError({ code: "NOT_FOUND", message: "Meeting not found" });
      if (CLOSED_MEETING_STATUSES.includes(meeting.status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This meeting is already over" });
      }

      const agendaTitles = new Map(meeting.agendaItems.map((item) => [item.id, item.title]));
      const seen = new Set<string>();
      for (const d of input.decisions) {
        if (!agendaTitles.has(d.agendaItemId) || seen.has(d.agendaItemId)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Each decision must name a different agenda item of this meeting",
          });
        }
        seen.add(d.agendaItemId);
      }

      return ctx.db.$transaction(async (tx) => {
        // Guarded on status so two concurrent submissions cannot both conclude it.
        const { count } = await tx.cabinetMeeting.updateMany({
          where: { id: meeting.id, status: { notIn: CLOSED_MEETING_STATUSES } },
          data: { status: "completed", completedAt: new Date(), notes: input.outcome },
        });
        if (count === 0) {
          throw new TRPCError({ code: "CONFLICT", message: "This meeting is already over" });
        }

        for (const d of input.decisions) {
          const title = agendaTitles.get(d.agendaItemId)!;
          const outcome = d.notes || DECISION_LABEL[d.decision];
          await tx.meetingDecision.create({
            data: {
              meetingId: meeting.id,
              agendaItemId: d.agendaItemId,
              title,
              description: outcome,
              decisionType: d.decision,
            },
          });
          await tx.meetingAgendaItem.update({
            where: { id: d.agendaItemId },
            data: { status: AGENDA_ITEM_STATUS[d.decision], outcome },
          });
        }

        return tx.cabinetMeeting.findUnique({
          where: { id: meeting.id },
          include: { agendaItems: true, decisions: true },
        });
      });
    }),
});
