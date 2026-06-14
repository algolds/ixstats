import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { notificationAPI } from "~/lib/notification-api";

// ============================================================
// Election System Router - Extension of Government Sub-System
// ============================================================

// D'Hondt method for proportional seat allocation
// eslint-disable-next-line unused-imports/no-unused-vars
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
// eslint-disable-next-line unused-imports/no-unused-vars
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

export const electionsLegislatureRouter = createTRPCRouter({
  // ─── Political Parties ─────────────────────────────────

  // ─── Legislature ───────────────────────────────────────

  getLegislature: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.legislature.findUnique({
        where: { countryId: input.countryId },
        include: {
          seats: {
            include: { party: true },
            orderBy: { seatNumber: "asc" },
          },
        },
      });
    }),

  configureLegislature: protectedProcedure
    .input(
      z.object({
        countryId: z.string(),
        name: z.string().min(1).max(200),
        chamberType: z.string(),
        totalSeats: z.number().min(10).max(10000),
        electoralSystem: z.enum(["proportional", "fptp", "mixed"]),
        termLength: z.number().min(1).max(10),
        electionCycle: z.enum(["fixed", "variable"]).default("fixed"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.countryId !== input.countryId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only manage legislature for your own country",
        });
      }

      const chambers = parseChambers(
        input.chamberType,
        input.name,
        input.totalSeats,
        input.electoralSystem
      );
      const computedTotalSeats = chambers.reduce((acc, c) => acc + c.seats, 0);

      let legislature = await ctx.db.legislature.findUnique({
        where: { countryId: input.countryId },
      });

      if (legislature) {
        legislature = await ctx.db.legislature.update({
          where: { countryId: input.countryId },
          data: {
            name: input.name,
            chamberType: input.chamberType,
            totalSeats: computedTotalSeats,
            electoralSystem: input.electoralSystem,
            termLength: input.termLength,
            electionCycle: input.electionCycle,
          },
        });
      } else {
        legislature = await ctx.db.legislature.create({
          data: {
            countryId: input.countryId,
            name: input.name,
            chamberType: input.chamberType,
            totalSeats: computedTotalSeats,
            electoralSystem: input.electoralSystem,
            termLength: input.termLength,
            electionCycle: input.electionCycle,
          },
        });
      }

      await ctx.db.legislativeSeat.deleteMany({
        where: { legislatureId: legislature.id },
      });

      const seatsToCreate = [];
      let seatNumber = 1;
      for (const chamber of chambers) {
        for (let i = 0; i < chamber.seats; i++) {
          seatsToCreate.push({
            legislatureId: legislature.id,
            seatNumber: seatNumber++,
            region: chamber.name,
            isActive: true,
          });
        }
      }

      await ctx.db.legislativeSeat.createMany({
        data: seatsToCreate,
      });

      try {
        await notificationAPI.create({
          title: "Legislature Configured",
          message: `Legislature "${input.name}" has been configured with ${computedTotalSeats} seats across ${chambers.length} chamber(s).`,
          countryId: input.countryId,
          category: "governance",
          priority: "medium",
          type: "info",
          source: "elections",
          href: "/mycountry/politics",
        });
      } catch (e) {
        console.warn("[Notifications] elections.configureLegislature:", e);
      }

      return legislature;
    }),

  // ─── Elections ─────────────────────────────────────────

  // ─── Candidates ────────────────────────────────────────

  // ─── Election Simulation (Core Algorithm) ──────────────

  // ─── Current Parliament (for hemicycle visualization) ───
});
