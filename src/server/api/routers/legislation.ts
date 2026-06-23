import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { notificationAPI } from "~/lib/notification-api";
import { generateDiplomaticNews } from "~/lib/diplomatic-news-generator";
import { applyPolicyEffect } from "~/lib/policy-effects-sync";
import {
  tallyVote,
  IDEOLOGY_AXIS,
  type Ideology,
  type VotingBloc,
  type VoteResult,
} from "~/lib/legislative-vote";

/**
 * Legislation — bills go to the floor and parties vote them up or down.
 *
 * A "bill" is a Policy tagged `policyType:"legislative_bill"`. It sits in committee
 * until the player calls a vote; the floor result (computed from the legislature's
 * seat distribution by ideology) decides whether it becomes active law or dies.
 * The vote tally lives as JSON in `reviewNotes` — point-in-time, no per-vote table.
 *
 * ponytail: vote breakdown stored as JSON on the Policy. Add a BillVote table only if
 * you need to query individual votes across bills.
 */

const IDEOLOGY_VALUES = Object.keys(IDEOLOGY_AXIS) as [Ideology, ...Ideology[]];

function ownsOrThrow(userCountryId: string | null | undefined, countryId: string) {
  if (userCountryId !== countryId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You can only manage legislation for your own country",
    });
  }
}

interface BillMeta {
  ideologyTarget: number;
  voteResult?: VoteResult;
  votedIxTime?: number;
}

function parseMeta(reviewNotes: string | null): BillMeta | null {
  if (!reviewNotes) return null;
  try {
    return JSON.parse(reviewNotes) as BillMeta;
  } catch {
    return null;
  }
}

export const legislationRouter = createTRPCRouter({
  getBills: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const bills = await ctx.db.policy.findMany({
        where: { countryId: input.countryId, policyType: "legislative_bill" },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      return bills.map((b) => ({
        id: b.id,
        name: b.name,
        description: b.description,
        status: b.status, // in_committee | active | rejected
        gdpEffect: b.gdpEffect,
        createdAt: b.createdAt,
        meta: parseMeta(b.reviewNotes),
      }));
    }),

  proposeBill: protectedProcedure
    .input(
      z.object({
        countryId: z.string(),
        name: z.string().min(1).max(120),
        description: z.string().min(1).max(1000),
        ideology: z.enum(IDEOLOGY_VALUES),
        // Optional projected economic effect (% growth), clamped sane.
        gdpEffect: z.number().min(-5).max(5).default(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      ownsOrThrow(ctx.user?.countryId, input.countryId);

      const meta: BillMeta = { ideologyTarget: IDEOLOGY_AXIS[input.ideology] };
      const bill = await ctx.db.policy.create({
        data: {
          countryId: input.countryId,
          userId: ctx.auth.userId,
          name: input.name,
          description: input.description,
          policyType: "legislative_bill",
          category: "legislative",
          status: "in_committee",
          gdpEffect: input.gdpEffect,
          reviewNotes: JSON.stringify(meta),
        },
      });
      return { id: bill.id };
    }),

  holdVote: protectedProcedure
    .input(z.object({ billId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const bill = await ctx.db.policy.findUnique({ where: { id: input.billId } });
      if (!bill || bill.policyType !== "legislative_bill") {
        throw new TRPCError({ code: "NOT_FOUND", message: "Bill not found" });
      }
      ownsOrThrow(ctx.user?.countryId, bill.countryId);
      if (bill.status !== "in_committee") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This bill has already been voted on",
        });
      }

      const meta = parseMeta(bill.reviewNotes);
      if (!meta) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Bill is missing vote metadata" });
      }

      // Build voting blocs from the legislature's seat distribution.
      const legislature = await ctx.db.legislature.findUnique({
        where: { countryId: bill.countryId },
        include: { seats: { include: { party: true } } },
      });
      if (!legislature || legislature.seats.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No seated legislature — hold an election before voting on bills",
        });
      }

      const blocMap = new Map<string, VotingBloc>();
      for (const seat of legislature.seats) {
        if (!seat.party) continue;
        const existing = blocMap.get(seat.party.id);
        if (existing) existing.seats += seat.seats;
        else
          blocMap.set(seat.party.id, {
            partyId: seat.party.id,
            partyName: seat.party.name,
            ideology: seat.party.ideology as Ideology,
            seats: seat.seats,
          });
      }
      const blocs = [...blocMap.values()];
      if (blocs.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Legislature seats are not assigned to parties",
        });
      }

      const result = tallyVote(meta.ideologyTarget, blocs);
      const pct = `${result.yesSeats}–${result.noSeats}${result.abstainSeats ? `, ${result.abstainSeats} abstain` : ""}`;

      await ctx.db.policy.update({
        where: { id: bill.id },
        data: {
          status: result.passed ? "active" : "rejected",
          effectiveDate: result.passed ? new Date() : undefined,
          reviewNotes: JSON.stringify({
            ...meta,
            voteResult: result,
            votedIxTime: Date.now(),
          } satisfies BillMeta),
        },
      });

      // Passed bills become real: ride the proven policy → sim effect channel.
      if (result.passed) {
        await applyPolicyEffect(ctx.db, {
          id: bill.id,
          countryId: bill.countryId,
          name: bill.name,
          gdpEffect: bill.gdpEffect,
        });
      }

      void generateDiplomaticNews(
        ctx.db,
        bill.countryId,
        result.passed ? "bill_passed" : "bill_rejected",
        { billName: bill.name, percentage: pct }
      );

      try {
        await notificationAPI.create({
          title: result.passed ? "Bill Passed" : "Bill Rejected",
          message: `"${bill.name}" ${result.passed ? "passed" : "failed"} on the floor (${pct})`,
          countryId: bill.countryId,
          category: "governance",
          priority: "medium",
          type: result.passed ? "success" : "info",
          source: "legislation",
          href: "/mycountry/politics",
        });
      } catch (e) {
        console.warn("[Notifications] legislation.holdVote:", e);
      }

      return result;
    }),
});
