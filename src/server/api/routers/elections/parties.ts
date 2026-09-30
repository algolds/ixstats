import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { notificationAPI } from "~/lib/notifications/api";
import { ensureUpcomingElection } from "~/lib/government/election-lifecycle";
import { assertCountryWriteAccess } from "~/server/shared/country-authorization";

/** MC-2: a new (or re-activated) party may complete the setup the first election needs. */
async function scheduleElectionIfReady(
  db: Parameters<typeof ensureUpcomingElection>[0],
  countryId: string
) {
  try {
    await ensureUpcomingElection(db, countryId);
  } catch (e) {
    console.warn("[Elections] could not schedule an election:", e);
  }
}

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
      // Verify user owns this country (any nation they own, not only the active one)
      await assertCountryWriteAccess(ctx, input.countryId);

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

      await scheduleElectionIfReady(ctx.db, input.countryId);

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
      await assertCountryWriteAccess(ctx, party.countryId);

      const { id, ...data } = input;
      const updated = await ctx.db.politicalParty.update({ where: { id }, data });
      if (input.isActive === true) await scheduleElectionIfReady(ctx.db, party.countryId);
      return updated;
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
      await assertCountryWriteAccess(ctx, party.countryId);

      return ctx.db.politicalParty.delete({ where: { id: input.id } });
    }),
});
