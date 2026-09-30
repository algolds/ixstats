import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { parseChambers } from "~/lib/government/election-simulation";

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
