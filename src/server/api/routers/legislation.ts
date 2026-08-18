import { z } from "zod";
import type { PrismaClient } from "@prisma/client";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { notificationAPI } from "~/lib/notifications/api";
import { generateDiplomaticNews } from "~/lib/diplomacy/news-generator";
import { applyPolicyEffect } from "~/lib/policy-effects-sync";
import {
  tallyVote,
  IDEOLOGY_AXIS,
  type Ideology,
  type VotingBloc,
  type VoteResult,
} from "~/lib/statecraft/legislative-vote";
import { computeApproval } from "~/lib/government/approval";
import { fogVoteProjection } from "~/lib/statecraft/whip";

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

/**
 * Voting blocs from a legislature's seats, grouped by party. Each LegislativeSeat is one
 * seat (counts += 1) — fixes a latent bug where the old inline code read a non-existent
 * `seat.seats` field (→ NaN tallies).
 */
async function loadBlocs(db: PrismaClient, countryId: string): Promise<VotingBloc[]> {
  const legislature = await db.legislature.findUnique({
    where: { countryId },
    include: { seats: { include: { party: true } } },
  });
  if (!legislature) return [];

  const blocMap = new Map<string, VotingBloc>();
  for (const seat of legislature.seats) {
    if (!seat.party) continue;
    const existing = blocMap.get(seat.party.id);
    if (existing) existing.seats += 1;
    else
      blocMap.set(seat.party.id, {
        partyId: seat.party.id,
        partyName: seat.party.name,
        ideology: seat.party.ideology as Ideology,
        seats: 1,
      });
  }
  return [...blocMap.values()];
}

/** Government standing (0-100) = approval from party support + political stability. */
async function getGovernmentBacking(db: PrismaClient, countryId: string): Promise<number> {
  const parties = await db.politicalParty.findMany({
    where: { countryId, isActive: true },
    select: { id: true, currentSupport: true },
  });
  if (parties.length === 0) return 50;
  const structure = await db.governmentStructure.findUnique({
    where: { countryId },
    select: { politicalStability: true },
  });
  return computeApproval(parties, structure?.politicalStability ?? null);
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
      const blocs = await loadBlocs(ctx.db as PrismaClient, bill.countryId);
      if (blocs.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "No seated legislature — hold an election (and seat parties) before voting on bills",
        });
      }

      // Mandate whip: a popular government sways fence-sitters (S3.B).
      const standing = await getGovernmentBacking(ctx.db as PrismaClient, bill.countryId);
      const result = tallyVote(meta.ideologyTarget, blocs, standing / 100);
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

  // S3.A: whip count — a fogged projection of the floor before you call the vote.
  // The projection is the real tally; its precision is gated by your standing.
  previewBillVote: protectedProcedure
    .input(z.object({ billId: z.string() }))
    .query(async ({ ctx, input }) => {
      const bill = await ctx.db.policy.findUnique({ where: { id: input.billId } });
      if (!bill || bill.policyType !== "legislative_bill") {
        throw new TRPCError({ code: "NOT_FOUND", message: "Bill not found" });
      }
      const meta = parseMeta(bill.reviewNotes);
      if (!meta) return { available: false as const, reason: "Bill is missing vote metadata." };

      const blocs = await loadBlocs(ctx.db as PrismaClient, bill.countryId);
      if (blocs.length === 0) {
        return { available: false as const, reason: "No seated legislature to whip." };
      }

      const standing = await getGovernmentBacking(ctx.db as PrismaClient, bill.countryId);
      const result = tallyVote(meta.ideologyTarget, blocs, standing / 100);
      return { available: true as const, standing, whip: fogVoteProjection(result, standing) };
    }),
});
