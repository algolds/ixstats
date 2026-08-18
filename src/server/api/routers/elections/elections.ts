import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { IxTime } from "~/lib/ixtime";
import { notificationAPI } from "~/lib/notifications/api";
import { parseChambers, simulateElectionCore } from "~/lib/election-simulation";

// ============================================================
// Election System Router - Extension of Government Sub-System
// Seat-allocation + simulation logic lives in ~/lib/election-simulation
// (shared with the scheduled-elections cron).
// ============================================================

export const electionsElectionsRouter = createTRPCRouter({
  // ─── Political Parties ─────────────────────────────────

  // ─── Legislature ───────────────────────────────────────

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

  getElectionById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.election.findUnique({
        where: { id: input.id },
        include: {
          candidates: { include: { party: true } },
          results: {
            include: { candidate: { include: { party: true } } },
            orderBy: { seatsWon: "desc" },
          },
          legislature: true,
        },
      });
    }),

  scheduleElection: protectedProcedure
    .input(
      z.object({
        countryId: z.string(),
        name: z.string().min(1).max(200),
        electionType: z.enum(["general", "special", "referendum"]).default("general"),
        scheduledIxTime: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.countryId !== input.countryId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const legislature = await ctx.db.legislature.findUnique({
        where: { countryId: input.countryId },
      });
      if (!legislature) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Configure a legislature before scheduling elections",
        });
      }

      const scheduledTime = input.scheduledIxTime ?? IxTime.getCurrentIxTime();

      const election = await ctx.db.election.create({
        data: {
          countryId: input.countryId,
          legislatureId: legislature.id,
          name: input.name,
          electionType: input.electionType,
          scheduledIxTime: scheduledTime,
          status: "upcoming",
        },
      });

      try {
        await notificationAPI.create({
          title: "Election Scheduled",
          message: `${input.electionType === "general" ? "General" : input.electionType === "special" ? "Special" : "Referendum"} election "${input.name}" has been scheduled`,
          countryId: input.countryId,
          category: "governance",
          priority: "high",
          type: "info",
          source: "elections",
          href: "/mycountry/politics",
        });
      } catch (e) {
        console.warn("[Notifications] elections.scheduleElection:", e);
      }

      return election;
    }),

  // ─── Candidates ────────────────────────────────────────

  registerCandidate: protectedProcedure
    .input(
      z.object({
        electionId: z.string(),
        partyId: z.string(),
        candidateName: z.string().min(1).max(200),
        region: z.string().optional(),
        platform: z.string().optional(),
        charisma: z.number().min(0).max(100).default(50),
        politicalCapital: z.number().min(0).max(100).default(50),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const election = await ctx.db.election.findUnique({
        where: { id: input.electionId },
      });
      if (!election) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      if (ctx.user?.countryId !== election.countryId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      if (election.status === "completed" || election.status === "cancelled") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Cannot register candidates for a completed/cancelled election",
        });
      }

      return ctx.db.electionCandidate.create({
        data: {
          electionId: input.electionId,
          partyId: input.partyId,
          candidateName: input.candidateName,
          region: input.region,
          platform: input.platform,
          charisma: input.charisma,
          politicalCapital: input.politicalCapital,
        },
        include: { party: true },
      });
    }),

  removeCandidate: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const candidate = await ctx.db.electionCandidate.findUnique({
        where: { id: input.id },
        include: { election: { select: { countryId: true } } },
      });
      if (!candidate) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      if (ctx.user?.countryId !== candidate.election.countryId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      return ctx.db.electionCandidate.delete({ where: { id: input.id } });
    }),

  // ─── Election Simulation (Core Algorithm) ──────────────

  simulateElection: protectedProcedure
    .input(z.object({ electionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Ownership check, then delegate to the shared simulation core
      // (the scheduled-elections cron calls the same core).
      const election = await ctx.db.election.findUnique({
        where: { id: input.electionId },
        select: { countryId: true },
      });
      if (!election) throw new TRPCError({ code: "NOT_FOUND" });
      if (ctx.user?.countryId !== election.countryId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const result = await simulateElectionCore(ctx.db, input.electionId);
      if (!result.ok) {
        if (result.reason === "insufficient_candidates") {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "At least 2 candidates from different parties are required",
          });
        }
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return result.election;
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
