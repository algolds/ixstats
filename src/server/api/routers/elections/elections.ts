import { z } from "zod";
import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { parseChambers } from "~/lib/government/election-simulation";
import {
  MIN_ELECTION_PARTIES,
  ensureUpcomingElection,
  resolveElection,
} from "~/lib/government/election-lifecycle";
import { IxTime } from "~/lib/ixtime";
import { assertCountryWriteAccess } from "~/server/shared/country-authorization";

// ============================================================
// Election System Router - Extension of Government Sub-System
// Seat-allocation + simulation logic lives in ~/lib/election-simulation
// (shared with the scheduled-elections cron).
// ============================================================

export const electionsElectionsRouter = createTRPCRouter({
  // ─── Elections ─────────────────────────────────────────

  getElections: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.election.findMany({
        where: { countryId: input.countryId },
        include: {
          candidates: { include: { party: true } },
          results: { include: { candidate: { include: { party: true } } } },
        },
        orderBy: { scheduledIxTime: "desc" },
      });
    }),

  // ─── Election status (MC-2: what the politics surface shows) ───
  // Where the country stands in the lifecycle: setup missing → first election scheduled →
  // polls closed (due) → results + seat composition. Every figure is read, none invented.

  getElectionStatus: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const nowIxTime = IxTime.getCurrentIxTime();
      const [legislature, activeParties, upcoming, voting, completedCount, last] =
        await Promise.all([
          ctx.db.legislature.findUnique({
            where: { countryId: input.countryId },
            select: { id: true, totalSeats: true, termLength: true },
          }),
          ctx.db.politicalParty.count({
            where: { countryId: input.countryId, isActive: true },
          }),
          ctx.db.election.findFirst({
            where: { countryId: input.countryId, status: "upcoming" },
            orderBy: { scheduledIxTime: "asc" },
            select: { id: true, name: true, scheduledIxTime: true },
          }),
          ctx.db.election.count({ where: { countryId: input.countryId, status: "voting" } }),
          ctx.db.election.count({ where: { countryId: input.countryId, status: "completed" } }),
          ctx.db.election.findFirst({
            where: { countryId: input.countryId, status: "completed" },
            orderBy: { scheduledIxTime: "desc" },
            select: {
              id: true,
              name: true,
              scheduledIxTime: true,
              turnout: true,
              marginOfVictory: true,
              results: {
                orderBy: { seatsWon: "desc" },
                select: {
                  votePercentage: true,
                  seatsWon: true,
                  candidate: {
                    select: { party: { select: { id: true, name: true, color: true } } },
                  },
                },
              },
            },
          }),
        ]);

      const seatedSeats = legislature
        ? await ctx.db.legislativeSeat.count({
            where: { legislatureId: legislature.id, partyId: { not: null } },
          })
        : 0;

      return {
        nowIxTime,
        minParties: MIN_ELECTION_PARTIES,
        hasLegislature: !!legislature,
        totalSeats: legislature?.totalSeats ?? 0,
        seatedSeats,
        activeParties,
        counting: voting > 0,
        upcoming: upcoming
          ? {
              id: upcoming.id,
              name: upcoming.name,
              scheduledIxTime: upcoming.scheduledIxTime,
              isFirst: completedCount === 0,
              isDue: upcoming.scheduledIxTime <= nowIxTime,
            }
          : null,
        lastElection: last
          ? {
              id: last.id,
              name: last.name,
              scheduledIxTime: last.scheduledIxTime,
              turnout: last.turnout,
              marginOfVictory: last.marginOfVictory,
              results: last.results.map((r) => ({
                partyId: r.candidate.party.id,
                partyName: r.candidate.party.name,
                color: r.candidate.party.color,
                votePercentage: r.votePercentage,
                seatsWon: r.seatsWon,
              })),
            }
          : null,
      };
    }),

  /**
   * Count the votes of an election that has fallen due on the IxTime clock, without waiting
   * for the elections cron. Only elections already due resolve — the owner cannot call an
   * early vote or re-roll a result. Also schedules the first election if setup is complete.
   */
  resolveDueElection: protectedProcedure
    .input(z.object({ countryId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertCountryWriteAccess(ctx, input.countryId);
      const db = ctx.db as PrismaClient;

      const due = await db.election.findFirst({
        where: {
          countryId: input.countryId,
          status: "upcoming",
          scheduledIxTime: { lte: IxTime.getCurrentIxTime() },
        },
        orderBy: { scheduledIxTime: "asc" },
        select: { id: true },
      });
      if (!due) {
        const ensured = await ensureUpcomingElection(db, input.countryId);
        return { resolved: false as const, reason: "not_due" as const, ensured };
      }

      const { outcome } = await resolveElection(db, due.id);
      if (outcome === "insufficient_candidates") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `An election needs at least ${MIN_ELECTION_PARTIES} active parties on the ballot.`,
        });
      }
      if (outcome === "not_claimed") {
        return { resolved: false as const, reason: "already_counting" as const };
      }
      return { resolved: true as const, electionId: due.id };
    }),

  // ─── Current Parliament (for hemicycle visualization) ───

  getCurrentParliament: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const legislature = await ctx.db.legislature.findUnique({
        where: { countryId: input.countryId },
        include: {
          seats: {
            include: { party: true },
            orderBy: { seatNumber: "asc" },
          },
        },
      });

      if (!legislature) return null;

      // Aggregate seat counts per party for summary
      const partySeatCounts = new Map<
        string,
        {
          party: {
            id: string;
            name: string;
            shortName: string | null;
            color: string;
            ideology: string;
          };
          seats: number;
        }
      >();
      for (const seat of legislature.seats) {
        if (seat.party) {
          const existing = partySeatCounts.get(seat.party.id);
          if (existing) {
            existing.seats++;
          } else {
            partySeatCounts.set(seat.party.id, {
              party: {
                id: seat.party.id,
                name: seat.party.name,
                shortName: seat.party.shortName,
                color: seat.party.color,
                ideology: seat.party.ideology,
              },
              seats: 1,
            });
          }
        }
      }

      return {
        legislature: {
          id: legislature.id,
          name: legislature.name,
          chamberType: legislature.chamberType,
          totalSeats: legislature.totalSeats,
          electoralSystem: legislature.electoralSystem,
          termLength: legislature.termLength,
          chambers: parseChambers(
            legislature.chamberType,
            legislature.name,
            legislature.totalSeats,
            legislature.electoralSystem
          ),
        },
        seats: legislature.seats.map((s) => ({
          seatNumber: s.seatNumber,
          partyId: s.partyId,
          partyColor: s.party?.color ?? "#94a3b8",
          partyName: s.party?.name ?? "Vacant",
          chamber: s.region ?? "Assembly",
        })),
        partySummary: Array.from(partySeatCounts.values()).sort((a, b) => b.seats - a.seats),
      };
    }),
});
