import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { IxTime } from "~/lib/ixtime";
import { generateDiplomaticNews } from "~/lib/diplomatic-news-generator";
import { notificationAPI } from "~/lib/notification-api";

// ============================================================
// Election System Router - Extension of Government Sub-System
// ============================================================

// D'Hondt method for proportional seat allocation
function dHondtAllocation(
  partyVotes: { partyId: string; votes: number }[],
  totalSeats: number
): Map<string, number> {
  const seats = new Map<string, number>();
  partyVotes.forEach((p) => seats.set(p.partyId, 0));

  for (let i = 0; i < totalSeats; i++) {
    let maxQuotient = -1;
    let maxParty = "";

    for (const { partyId, votes } of partyVotes) {
      const currentSeats = seats.get(partyId) ?? 0;
      const quotient = votes / (currentSeats + 1);
      if (quotient > maxQuotient) {
        maxQuotient = quotient;
        maxParty = partyId;
      }
    }

    if (maxParty) {
      seats.set(maxParty, (seats.get(maxParty) ?? 0) + 1);
    }
  }

  return seats;
}

// FPTP allocation: winner takes all per region, or if no regions, proportional top-party
function fptpAllocation(
  partyVotes: { partyId: string; votes: number }[],
  totalSeats: number
): Map<string, number> {
  const seats = new Map<string, number>();
  if (partyVotes.length === 0) return seats;

  // Simple: party with most votes gets all seats (single-district FPTP)
  // In a real multi-district system this would be per-region
  const sorted = [...partyVotes].sort((a, b) => b.votes - a.votes);
  const winner = sorted[0]!;
  seats.set(winner.partyId, totalSeats);
  for (const p of partyVotes) {
    if (p.partyId !== winner.partyId) seats.set(p.partyId, 0);
  }
  return seats;
}

export interface ChamberConfig {
  name: string;
  seats: number;
  electoralSystem: "proportional" | "fptp" | "mixed";
}

export function parseChambers(
  chamberType: string,
  legislatureName: string,
  totalSeats: number,
  globalElectoralSystem: string
): ChamberConfig[] {
  if (chamberType.includes("|")) {
    const [, serialized] = chamberType.split("|");
    if (serialized) {
      const parts = serialized.split(";").filter(Boolean);
      return parts.map((part) => {
        const [name, seatsStr, system] = part.split(":");
        return {
          name: name || "Chamber",
          seats: Number(seatsStr) || 100,
          electoralSystem: (system || globalElectoralSystem || "proportional") as any,
        };
      });
    }
  }

  // Fallbacks
  const system = (globalElectoralSystem || "proportional") as any;
  if (chamberType === "bicameral") {
    const senateSeats = Math.max(10, Math.floor(totalSeats * 0.4));
    const houseSeats = Math.max(10, totalSeats - senateSeats);
    return [
      { name: "House of Representatives", seats: houseSeats, electoralSystem: system },
      { name: "Senate", seats: senateSeats, electoralSystem: system },
    ];
  }

  return [
    { name: legislatureName || "National Assembly", seats: totalSeats, electoralSystem: system },
  ];
}

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
      const election = await ctx.db.election.findUnique({
        where: { id: input.electionId },
        include: {
          candidates: { include: { party: true } },
          legislature: true,
          country: true,
        },
      });

      if (!election) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      if (ctx.user?.countryId !== election.countryId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      if (election.candidates.length < 2) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "At least 2 candidates from different parties are required",
        });
      }

      const country = election.country;
      const legislature = election.legislature;
      // eslint-disable-next-line unused-imports/no-unused-vars
      const totalSeats = legislature.totalSeats;

      // Step 1: Calculate economic performance modifier
      // Positive growth → incumbent/status-quo parties benefit; negative → opposition benefits
      const gdpGrowth = country.adjustedGdpGrowth;
      const economicModifier =
        gdpGrowth > 0
          ? Math.min(gdpGrowth * 100, 10) // +10% max boost from good economy
          : Math.max(gdpGrowth * 150, -15); // -15% max penalty from bad economy

      // Step 2: Calculate per-party vote shares
      const partyVotes: { partyId: string; votes: number; candidateId: string }[] = [];
      let totalSupport = 0;

      for (const candidate of election.candidates) {
        const party = candidate.party;

        // Base: party's current support
        let support = party.currentSupport;

        // Economic modifier: first party in list (assumed incumbent) gets boost/penalty
        const isFirstParty = election.candidates.indexOf(candidate) === 0;
        if (isFirstParty) {
          support += economicModifier;
        } else {
          // Opposition gets inverse of economic modifier (capped)
          support -= economicModifier * 0.5;
        }

        // Candidate charisma adds ±5% swing
        const charismaSwing = (candidate.charisma - 50) / 10;
        support += charismaSwing;

        // Random swing: 5-15% randomness
        const randomSwing = (Math.random() - 0.5) * 15;
        support += randomSwing;

        // Clamp to 1-99
        support = Math.max(1, Math.min(99, support));

        partyVotes.push({
          partyId: party.id,
          candidateId: candidate.id,
          votes: Math.round(support * 1000), // Scale up for D'Hondt precision
        });
        // eslint-disable-next-line unused-imports/no-unused-vars
        totalSupport += support;
      }

      // Normalize to percentages
      const totalVotesCast = Math.floor((country?.currentPopulation || 1000000) * 0.65);
      const turnout = Math.min(95, 55 + (country?.overallNationalHealth ?? 50) * 0.3);

      // Step 3: Allocate seats based on electoral system per chamber
      const chambers = parseChambers(
        legislature.chamberType,
        legislature.name,
        legislature.totalSeats,
        legislature.electoralSystem
      );

      const chamberAllocations: { chamberName: string; allocation: Map<string, number> }[] = [];
      const totalSeatsWonPerParty = new Map<string, number>();

      for (const chamber of chambers) {
        let alloc: Map<string, number>;
        if (chamber.electoralSystem === "proportional") {
          alloc = dHondtAllocation(partyVotes, chamber.seats);
        } else if (chamber.electoralSystem === "fptp") {
          alloc = fptpAllocation(partyVotes, chamber.seats);
        } else {
          // Mixed: half proportional, half FPTP
          const propSeats = Math.floor(chamber.seats / 2);
          const fptpSeats = chamber.seats - propSeats;
          const propAlloc = dHondtAllocation(partyVotes, propSeats);
          const fptpAlloc = fptpAllocation(partyVotes, fptpSeats);
          alloc = new Map<string, number>();
          for (const [pid, s] of propAlloc) {
            alloc.set(pid, s + (fptpAlloc.get(pid) ?? 0));
          }
        }
        chamberAllocations.push({ chamberName: chamber.name, allocation: alloc });

        for (const [partyId, seatsWon] of alloc) {
          totalSeatsWonPerParty.set(partyId, (totalSeatsWonPerParty.get(partyId) ?? 0) + seatsWon);
        }
      }

      // Step 4: Create ElectionResult records
      const results = [];
      for (const pv of partyVotes) {
        const pctOfTotal = (pv.votes / partyVotes.reduce((s, x) => s + x.votes, 0)) * 100;
        const seatsWon = totalSeatsWonPerParty.get(pv.partyId) ?? 0;

        const result = await ctx.db.electionResult.create({
          data: {
            electionId: election.id,
            candidateId: pv.candidateId,
            votesReceived: Math.round((pctOfTotal / 100) * totalVotesCast),
            votePercentage: Math.round(pctOfTotal * 100) / 100,
            seatsWon,
          },
        });
        results.push({ ...result, partyId: pv.partyId });
      }

      // Step 5: Update LegislativeSeat assignments per chamber
      const allSeats = await ctx.db.legislativeSeat.findMany({
        where: { legislatureId: legislature.id },
        orderBy: { seatNumber: "asc" },
      });

      const updatedSeatIds = new Set<string>();
      let seatOffset = 0;

      for (const { chamberName, allocation } of chamberAllocations) {
        let chamberSeats = allSeats.filter((s) => s.region === chamberName);
        if (chamberSeats.length === 0) {
          const chamberConfig = chambers.find((c) => c.name === chamberName);
          const numSeats = chamberConfig ? chamberConfig.seats : 0;
          chamberSeats = allSeats.slice(seatOffset, seatOffset + numSeats);
          seatOffset += numSeats;
        }

        const sortedChamberParties = [...allocation.entries()].sort((a, b) => b[1] - a[1]);

        let chamberSeatIdx = 0;
        for (const [partyId, seatsWon] of sortedChamberParties) {
          for (let i = 0; i < seatsWon; i++) {
            if (chamberSeatIdx < chamberSeats.length) {
              const seat = chamberSeats[chamberSeatIdx]!;
              await ctx.db.legislativeSeat.update({
                where: { id: seat.id },
                data: { partyId },
              });
              updatedSeatIds.add(seat.id);
              chamberSeatIdx++;
            }
          }
        }

        while (chamberSeatIdx < chamberSeats.length) {
          const seat = chamberSeats[chamberSeatIdx]!;
          await ctx.db.legislativeSeat.update({
            where: { id: seat.id },
            data: { partyId: null },
          });
          updatedSeatIds.add(seat.id);
          chamberSeatIdx++;
        }
      }

      const unassignedSeats = allSeats.filter((s) => !updatedSeatIds.has(s.id));
      for (const seat of unassignedSeats) {
        await ctx.db.legislativeSeat.update({
          where: { id: seat.id },
          data: { partyId: null },
        });
      }

      // Step 6: Calculate margin of victory
      const sortedResults = [...results].sort(
        (a, b) =>
          (totalSeatsWonPerParty.get(b.partyId) ?? 0) - (totalSeatsWonPerParty.get(a.partyId) ?? 0)
      );
      const marginOfVictory =
        sortedResults.length >= 2
          ? sortedResults[0]!.votePercentage - sortedResults[1]!.votePercentage
          : 100;

      // Step 7: Update election status
      await ctx.db.election.update({
        where: { id: election.id },
        data: {
          status: "completed",
          turnout: Math.round(turnout * 10) / 10,
          totalVotes: totalVotesCast,
          marginOfVictory: Math.round(marginOfVictory * 100) / 100,
        },
      });

      // Step 8: Update GovernmentStructure political metrics
      const govStructure = await ctx.db.governmentStructure.findUnique({
        where: { countryId: election.countryId },
      });
      if (govStructure) {
        // Decisive win (+0.05 stability), close race (-0.05), very close (-0.10)
        let stabilityDelta = 0;
        if (marginOfVictory > 15) stabilityDelta = 0.05;
        else if (marginOfVictory > 5) stabilityDelta = 0.02;
        else if (marginOfVictory > 2) stabilityDelta = -0.05;
        else stabilityDelta = -0.1;

        const newStability = Math.max(
          0,
          Math.min(1, (govStructure.politicalStability ?? 0.5) + stabilityDelta)
        );
        const newDemocracy = Math.min(100, (govStructure.democracyIndex ?? 50) + 2); // +2 per peaceful election

        await ctx.db.governmentStructure.update({
          where: { countryId: election.countryId },
          data: {
            politicalStability: newStability,
            democracyIndex: newDemocracy,
            politicalMetricsUpdated: new Date(),
          },
        });
      }

      // Step 9: Create storyteller effects for economic impact
      // Close elections create uncertainty; decisive ones boost confidence
      const growthModifier = marginOfVictory > 10 ? 0.003 : marginOfVictory > 5 ? 0.001 : -0.003;

      await ctx.db.storytellerEffect.create({
        data: {
          countryId: election.countryId,
          ixTimeTimestamp: new Date(),
          inputType: "economic_policy",
          value: growthModifier,
          duration: legislature.termLength,
          description: `Election result: ${marginOfVictory > 10 ? "Decisive victory" : marginOfVictory > 5 ? "Clear win" : "Close election"} - ${sortedResults[0]?.votePercentage.toFixed(1)}% to ${sortedResults[1]?.votePercentage.toFixed(1)}%`,
          isActive: true,
          createdBy: "ELECTION_SYSTEM",
        },
      });

      // Step 10: Update party support levels based on results
      for (const r of results) {
        await ctx.db.politicalParty.update({
          where: { id: r.partyId },
          data: { currentSupport: r.votePercentage },
        });
      }

      // Step 11: Auto-news — post election results to ThinkPages
      const topResult = results.sort((a, b) => b.seatsWon - a.seatsWon)[0];
      if (topResult) {
        const winnerParty = election.candidates.find((c) => c.id === topResult.candidateId);
        const country = await ctx.db.country.findUnique({
          where: { id: election.countryId },
          select: { name: true },
        });
        void generateDiplomaticNews(ctx.db, election.countryId, "election_result", {
          countryName: country?.name ?? "Unknown",
          partyName: winnerParty?.party?.name ?? "Leading party",
          seats: topResult.seatsWon,
          percentage: topResult.votePercentage.toFixed(1),
        });

        // Notification: Election results
        try {
          await notificationAPI.create({
            title: "Election Results",
            message: `${winnerParty?.party?.name ?? "Leading party"} wins with ${topResult.seatsWon} seats (${topResult.votePercentage.toFixed(1)}%). Turnout: ${turnout.toFixed(1)}%`,
            countryId: election.countryId,
            category: "governance",
            priority: "high",
            type: "success",
            source: "elections",
            href: "/mycountry/politics",
            actionable: true,
            metadata: {
              electionId: election.id,
              winnerParty: winnerParty?.party?.name,
              seatsWon: topResult.seatsWon,
              marginOfVictory,
              turnout,
            },
          });
        } catch (e) {
          console.warn("[Notifications] elections.simulateElection:", e);
        }
      }

      return ctx.db.election.findUnique({
        where: { id: election.id },
        include: {
          candidates: { include: { party: true } },
          results: {
            include: { candidate: { include: { party: true } } },
            orderBy: { seatsWon: "desc" },
          },
          legislature: {
            include: {
              seats: {
                include: { party: true },
                orderBy: { seatNumber: "asc" },
              },
            },
          },
        },
      });
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
