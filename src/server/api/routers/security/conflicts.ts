/**
 * Security Conflicts Router (Plan 163 / Plan 191)
 *
 * Handles PvP and PvNPC conflict proposals, mutual responses,
 * active engagements, and battle resolution mechanics.
 */

import { z } from "zod";
import { createTRPCRouter, publicProcedure, premiumProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { notificationAPI } from "~/lib/notifications/api";
import { generateDiplomaticNews } from "~/lib/diplomacy/news-generator";

export const securityConflictsRouter = createTRPCRouter({
  // Propose a PvP conflict (requires mutual acceptance)
  proposePvPConflict: premiumProcedure
    .input(
      z.object({
        defenderId: z.string(),
        reason: z.string().optional(),
        pvpRules: z
          .object({
            victoryConditions: z.string(),
            maxDuration: z.number(), // IxTime days
            stakes: z.string(),
          })
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
        select: { countryId: true },
      });

      if (!userProfile?.countryId) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Not associated with a country." });
      }

      if (userProfile.countryId === input.defenderId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot declare conflict against yourself.",
        });
      }

      // Check for existing active conflict
      const existing = await ctx.db.militaryConflict.findFirst({
        where: {
          OR: [
            { initiatorId: userProfile.countryId, defenderId: input.defenderId },
            { initiatorId: input.defenderId, defenderId: userProfile.countryId },
          ],
          status: { in: ["proposed", "accepted", "active"] },
        },
      });

      if (existing) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "An active or pending conflict already exists between these nations.",
        });
      }

      const conflict = await ctx.db.militaryConflict.create({
        data: {
          type: "pvp",
          initiatorId: userProfile.countryId,
          defenderId: input.defenderId,
          status: "proposed",
          initiatorApproved: true,
          defenderApproved: false,
          reason: input.reason,
          pvpRules: input.pvpRules ? JSON.stringify(input.pvpRules) : null,
        },
        include: {
          initiator: { select: { id: true, name: true } },
          defender: { select: { id: true, name: true } },
        },
      });

      // Notification: notify defender about PvP conflict proposal (fire-and-forget)
      try {
        const defenderCountry = await ctx.db.country.findUnique({
          where: { id: input.defenderId },
          select: { name: true, users: { select: { clerkUserId: true } } },
        });
        const defenderUserId = defenderCountry?.users[0]?.clerkUserId;
        if (defenderUserId) {
          await notificationAPI.create({
            userId: defenderUserId,
            countryId: input.defenderId,
            title: "Conflict Proposed",
            message: `${conflict.initiator.name} has proposed a military conflict against your nation`,
            type: "warning",
            category: "military",
            priority: "high",
            metadata: { conflictId: conflict.id, initiatorId: userProfile.countryId },
          });
        }
      } catch {}

      // Canon news: initiator's feed
      void generateDiplomaticNews(ctx.db as any, conflict.initiatorId, "pvp_conflict_proposed", {
        countryName: conflict.initiator.name,
        targetName: conflict.defender.name,
        reason: input.reason,
      });

      // Canon news: defender's feed
      void generateDiplomaticNews(ctx.db as any, input.defenderId, "pvp_conflict_proposed", {
        countryName: conflict.initiator.name,
        targetName: conflict.defender.name,
        reason: input.reason,
      });

      return conflict;
    }),

  // Accept or decline a PvP conflict
  respondToConflict: premiumProcedure
    .input(
      z.object({
        conflictId: z.string(),
        accept: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
        select: { countryId: true },
      });

      const conflict = await ctx.db.militaryConflict.findUnique({
        where: { id: input.conflictId },
      });

      if (!conflict) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Conflict not found." });
      }

      if (conflict.defenderId !== userProfile?.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only the defender can respond." });
      }

      if (conflict.status !== "proposed") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Conflict is not in proposed state." });
      }

      if (!input.accept) {
        const declined = await ctx.db.militaryConflict.update({
          where: { id: input.conflictId },
          data: { status: "resolved", winner: "declined" },
        });

        // Notification: notify initiator of decline (fire-and-forget)
        try {
          const initiatorCountry = await ctx.db.country.findUnique({
            where: { id: conflict.initiatorId },
            select: { users: { select: { clerkUserId: true } } },
          });
          const initiatorUserId = initiatorCountry?.users[0]?.clerkUserId;
          if (initiatorUserId) {
            await notificationAPI.create({
              userId: initiatorUserId,
              countryId: conflict.initiatorId,
              title: "Conflict Declined",
              message: "Your conflict proposal was declined",
              type: "warning",
              category: "military",
              priority: "medium",
              metadata: { conflictId: input.conflictId },
            });
          }
        } catch {}

        return declined;
      }

      const accepted = await ctx.db.militaryConflict.update({
        where: { id: input.conflictId },
        data: {
          defenderApproved: true,
          status: "active",
          startDate: new Date(),
        },
        include: {
          initiator: { select: { id: true, name: true } },
          defender: { select: { id: true, name: true } },
        },
      });

      // Notification: notify initiator of acceptance (fire-and-forget)
      try {
        const initiatorCountry = await ctx.db.country.findUnique({
          where: { id: conflict.initiatorId },
          select: { users: { select: { clerkUserId: true } } },
        });
        const initiatorUserId = initiatorCountry?.users[0]?.clerkUserId;
        if (initiatorUserId) {
          await notificationAPI.create({
            userId: initiatorUserId,
            countryId: conflict.initiatorId,
            title: "Conflict Accepted",
            message: `${accepted.defender.name} has accepted your conflict proposal - hostilities begin`,
            type: "warning",
            category: "military",
            priority: "high",
            metadata: { conflictId: input.conflictId },
          });
        }
      } catch {}

      // Canon news: defender's feed
      void generateDiplomaticNews(ctx.db as any, accepted.defenderId, "pvp_conflict_accepted", {
        countryName: accepted.defender.name,
        targetName: accepted.initiator.name,
      });

      // Canon news: initiator's feed
      void generateDiplomaticNews(ctx.db as any, accepted.initiatorId, "pvp_conflict_accepted", {
        countryName: accepted.defender.name,
        targetName: accepted.initiator.name,
      });

      return accepted;
    }),

  // Get conflicts involving a country
  getConflicts: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const conflicts = await ctx.db.militaryConflict.findMany({
        where: {
          OR: [{ initiatorId: input.countryId }, { defenderId: input.countryId }],
        },
        include: {
          initiator: { select: { id: true, name: true, flag: true } },
          defender: { select: { id: true, name: true, flag: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      return conflicts.map((c) => ({
        ...c,
        initiator: c.initiator
          ? {
              id: c.initiator.id,
              name: c.initiator.name,
              flagUrl: c.initiator.flag,
            }
          : null,
        defender: c.defender
          ? {
              id: c.defender.id,
              name: c.defender.name,
              flagUrl: c.defender.flag,
            }
          : null,
      }));
    }),

  // Resolve a PvNPC conflict automatically
  resolvePvNPCConflict: premiumProcedure
    .input(
      z.object({
        targetCountryId: z.string(),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
        select: { countryId: true, id: true },
      });

      if (!userProfile?.countryId) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Not associated with a country." });
      }

      // Get both countries' military data
      const [initiatorBranches, defenderBranches, initiator, defender] = await Promise.all([
        ctx.db.militaryBranch.findMany({
          where: { countryId: userProfile.countryId, isActive: true },
          include: { units: true, assets: true },
        }),
        ctx.db.militaryBranch.findMany({
          where: { countryId: input.targetCountryId, isActive: true },
          include: { units: true, assets: true },
        }),
        ctx.db.country.findUnique({
          where: { id: userProfile.countryId },
          select: { id: true, name: true, currentGdpPerCapita: true, currentPopulation: true },
        }),
        ctx.db.country.findUnique({
          where: { id: input.targetCountryId },
          select: { id: true, name: true, currentGdpPerCapita: true, currentPopulation: true },
        }),
      ]);

      if (!initiator || !defender) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Country not found" });
      }

      // Calculate military strength
      const calcStrength = (branches: typeof initiatorBranches) =>
        branches.reduce((sum, b) => {
          const unitStr = b.units.reduce(
            (s, u) => s + (u.personnel ?? 0) * ((u.readiness ?? 50) / 100),
            0
          );
          const assetStr = b.assets.reduce(
            (s, a) => s + (a.quantity ?? 0) * (a.operational ?? 0) * 10,
            0
          );
          return sum + unitStr + assetStr;
        }, 0);

      const initiatorStrength = calcStrength(initiatorBranches);
      const defenderStrength = calcStrength(defenderBranches);
      const totalStrength = initiatorStrength + defenderStrength || 1;

      // Random swing factor (10-30%)
      const swing = 0.1 + Math.random() * 0.2;
      const effectiveRatio =
        initiatorStrength / totalStrength + (Math.random() > 0.5 ? swing : -swing);

      const initiatorWins = effectiveRatio > 0.5;
      const marginOfVictory = Math.abs(effectiveRatio - 0.5);

      // Calculate casualties proportional to strength ratio
      const baseCasualties = Math.round((initiatorStrength + defenderStrength) * 0.05);
      const initiatorCasualties = Math.round(
        baseCasualties * (initiatorWins ? 0.3 : 0.7) * (1 + Math.random() * 0.3)
      );
      const defenderCasualties = Math.round(
        baseCasualties * (initiatorWins ? 0.7 : 0.3) * (1 + Math.random() * 0.3)
      );

      // Economic damage
      const econDamage = marginOfVictory < 0.1 ? 0.02 : marginOfVictory < 0.2 ? 0.01 : 0.005;

      const conflict = await ctx.db.militaryConflict.create({
        data: {
          type: "pvnpc",
          initiatorId: userProfile.countryId,
          defenderId: input.targetCountryId,
          status: "resolved",
          initiatorApproved: true,
          defenderApproved: true,
          reason: input.reason,
          startDate: new Date(),
          endDate: new Date(),
          winner: initiatorWins ? userProfile.countryId : input.targetCountryId,
          initiatorCasualties,
          defenderCasualties,
          economicDamage: econDamage,
        },
        include: {
          initiator: { select: { id: true, name: true } },
          defender: { select: { id: true, name: true } },
        },
      });

      // Create storyteller effects for economic damage
      await ctx.db.storytellerEffect.createMany({
        data: [
          {
            countryId: userProfile.countryId,
            ixTimeTimestamp: new Date(),
            inputType: "GDP_ADJUSTMENT",
            value: -econDamage * (initiatorWins ? 0.5 : 1.5),
            description: `Military conflict with ${defender.name}: ${initiatorWins ? "victory" : "defeat"}`,
            duration: 2,
            isActive: true,
            createdBy: userProfile.id,
          },
          {
            countryId: input.targetCountryId,
            ixTimeTimestamp: new Date(),
            inputType: "GDP_ADJUSTMENT",
            value: -econDamage * (initiatorWins ? 1.5 : 0.5),
            description: `Military conflict with ${initiator.name}: ${initiatorWins ? "defeat" : "defense"}`,
            duration: 2,
            isActive: true,
            createdBy: userProfile.id,
          },
        ],
      });

      const winnerName = initiatorWins ? initiator.name : defender.name;

      // Canon news: initiator's feed
      void generateDiplomaticNews(ctx.db as any, userProfile.countryId, "pvnpc_conflict_resolved", {
        countryName: initiator.name,
        targetName: defender.name,
        winner: winnerName,
      });

      // Canon news: defender's feed
      void generateDiplomaticNews(ctx.db as any, input.targetCountryId, "pvnpc_conflict_resolved", {
        countryName: initiator.name,
        targetName: defender.name,
        winner: winnerName,
      });

      return conflict;
    }),
});
