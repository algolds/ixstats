import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { notificationAPI } from "~/lib/notifications/api";

// ============================================================
// Election System Router - Extension of Government Sub-System
// ============================================================

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
