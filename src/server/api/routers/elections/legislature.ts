import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { notificationAPI } from "~/lib/notifications/api";
import {
  ensureUpcomingElection,
  type EnsureElectionResult,
} from "~/lib/government/election-lifecycle";
import { assertCountryWriteAccess } from "~/server/shared/country-authorization";
import { parseChambers } from "~/lib/government/election-simulation";

// ============================================================
// Election System Router - Extension of Government Sub-System
// ============================================================

export const electionsLegislatureRouter = createTRPCRouter({
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
      await assertCountryWriteAccess(ctx, input.countryId);

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

      // MC-2: the seats above are vacant. Schedule the first election — or, when the
      // legislature is being reconfigured (dissolved), pull the next one forward as a snap
      // election — so the chamber gets seated and bills can reach a vote. The elections
      // cron sweep retries this if it fails here.
      let election: EnsureElectionResult | null = null;
      try {
        election = await ensureUpcomingElection(ctx.db, input.countryId, { snap: true });
      } catch (e) {
        console.warn("[Elections] configureLegislature: could not schedule an election:", e);
      }

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

      return { ...legislature, election };
    }),
});
