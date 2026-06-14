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

export const electionsPartiesRouter = createTRPCRouter({
  // ─── Political Parties ─────────────────────────────────

  getParties: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.politicalParty.findMany({
        where: { countryId: input.countryId },
        orderBy: { currentSupport: "desc" },
      });
    }),

  createParty: protectedProcedure
    .input(
      z.object({
        countryId: z.string(),
        name: z.string().min(1).max(100),
        shortName: z.string().max(10).optional(),
        ideology: z.enum([
          "far_left",
          "left",
          "center_left",
          "center",
          "center_right",
          "right",
          "far_right",
        ]),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
        leaderName: z.string().max(100).optional(),
        platform: z.string().optional(),
        baseSupport: z.number().min(0).max(100).default(25),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify user owns this country
      if (ctx.user?.countryId !== input.countryId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only manage parties for your own country",
        });
      }

      const party = await ctx.db.politicalParty.create({
        data: {
          countryId: input.countryId,
          name: input.name,
          shortName: input.shortName,
          ideology: input.ideology,
          color: input.color,
          leaderName: input.leaderName,
          platform: input.platform,
          baseSupport: input.baseSupport,
          currentSupport: input.baseSupport,
        },
      });

      try {
        await notificationAPI.create({
          title: "Political Party Formed",
          message: `New political party "${input.name}" has been established`,
          countryId: input.countryId,
          category: "governance",
          priority: "medium",
          type: "info",
          source: "elections",
          href: "/mycountry/politics",
        });
      } catch (e) {
        console.warn("[Notifications] elections.createParty:", e);
      }

      return party;
    }),

  updateParty: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(100).optional(),
        shortName: z.string().max(10).optional(),
        ideology: z
          .enum(["far_left", "left", "center_left", "center", "center_right", "right", "far_right"])
          .optional(),
        color: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .optional(),
        leaderName: z.string().max(100).optional(),
        platform: z.string().optional(),
        baseSupport: z.number().min(0).max(100).optional(),
        currentSupport: z.number().min(0).max(100).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const party = await ctx.db.politicalParty.findUnique({
        where: { id: input.id },
      });
      if (!party) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Party not found" });
      }
      if (ctx.user?.countryId !== party.countryId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const { id, ...data } = input;
      return ctx.db.politicalParty.update({ where: { id }, data });
    }),

  deleteParty: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const party = await ctx.db.politicalParty.findUnique({
        where: { id: input.id },
      });
      if (!party) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      if (ctx.user?.countryId !== party.countryId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      return ctx.db.politicalParty.delete({ where: { id: input.id } });
    }),

  // ─── Legislature ───────────────────────────────────────

  // ─── Elections ─────────────────────────────────────────

  // ─── Candidates ────────────────────────────────────────

  // ─── Election Simulation (Core Algorithm) ──────────────

  // ─── Current Parliament (for hemicycle visualization) ───
});
