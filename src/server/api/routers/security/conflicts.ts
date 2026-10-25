/**
 * Security Conflicts Router (Plan 163 / Plan 191)
 *
 * Handles PvP and PvNPC conflict proposals, mutual responses,
 * active engagements, and battle resolution mechanics.
 */

import { z } from "zod";
import {
  createTRPCRouter,
  lightMutationProcedure,
  publicProcedure,
  premiumProcedure,
  premiumMutationProcedure,
  rateLimitedMutationProcedure,
} from "~/server/api/trpc";
import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { notificationAPI } from "~/lib/notifications/api";
import { generateDiplomaticNews } from "~/lib/diplomacy/news-generator";
import { assertCountryWriteAccess } from "~/server/shared/country-authorization";
import { createStorytellerEffects } from "~/lib/economy/storyteller-effects";
import {
  computeConflictOutcome,
  conflictEconomicEffects,
  militaryStrength,
  pvpConflictEndsAt,
} from "~/lib/military/conflict-outcome";
import {
  EXPIRED_PVP_DATA,
  PVP_UNFOUGHT,
  stalePvPProposalsBetween,
  withPvPExpiry,
} from "~/lib/military/pvp-proposals";
import { isProposalExpired, proposalExpiresAt } from "~/lib/diplomacy/proposal-lifecycle";
import {
  PVNPC_STRIKE_COOLDOWN_IXDAYS,
  ixDaysAgo,
  ixDaysLater,
} from "~/lib/military/operation-rules";

/**
 * A PvNPC strike's target must be a nation the striker has relations with, in the same realm,
 * and not struck by it within the cooldown (the UI's target list, enforced on the server).
 */
async function assertStrikeAllowed(
  db: PrismaClient,
  initiator: { id: string; realmId: string },
  target: { id: string; name: string; realmId: string }
) {
  const [relation, lastStrike] = await Promise.all([
    db.diplomaticRelation.findFirst({
      where: {
        OR: [
          { country1: initiator.id, country2: target.id },
          { country1: target.id, country2: initiator.id },
        ],
      },
      select: { id: true },
    }),
    db.militaryConflict.findFirst({
      where: {
        type: "pvnpc",
        initiatorId: initiator.id,
        defenderId: target.id,
        createdAt: { gte: ixDaysAgo(PVNPC_STRIKE_COOLDOWN_IXDAYS) },
      },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);
  if (!relation || initiator.realmId !== target.realmId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Strikes target NPC nations you have diplomatic relations with in your realm.",
    });
  }
  if (lastStrike) {
    const next = ixDaysLater(lastStrike.createdAt, PVNPC_STRIKE_COOLDOWN_IXDAYS);
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `You struck ${target.name} recently. You can strike again on ${next.toISOString().slice(0, 10)}.`,
    });
  }
}

const STRIKE_COUNTRY_FIELDS = {
  id: true,
  name: true,
  realmId: true,
  currentGdpPerCapita: true,
  currentPopulation: true,
} as const;

/** Where a defender answers a challenge (the Defense page opens on Special operations). */
const PVP_CHALLENGE_HREF = "/mycountry/defense?tab=operations";

/**
 * Nations the caller has diplomatic relations with: player-owned ones (PvP challenge targets) or
 * unclaimed ones (PvNPC strike targets).
 */
async function relatedCountries(db: PrismaClient, clerkUserId: string, playerOwned: boolean) {
  const userProfile = await db.user.findUnique({
    where: { clerkUserId },
    select: { countryId: true },
  });
  const countryId = userProfile?.countryId;
  if (!countryId) return [];

  const relations = await db.diplomaticRelation.findMany({
    where: { OR: [{ country1: countryId }, { country2: countryId }] },
    select: { country1: true, country2: true },
  });
  const partnerIds = [
    ...new Set(relations.map((r) => (r.country1 === countryId ? r.country2 : r.country1))),
  ];
  if (partnerIds.length === 0) return [];

  return db.country.findMany({
    where: { id: { in: partnerIds }, ownerUserId: playerOwned ? { not: null } : null },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export const securityConflictsRouter = createTRPCRouter({
  // Propose a PvP conflict (requires mutual acceptance)
  proposePvPConflict: premiumMutationProcedure
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

      // Only a player nation can answer a challenge; NPC nations are struck via PvNPC.
      const defenderCountry = await ctx.db.country.findUnique({
        where: { id: input.defenderId },
        select: { ownerUserId: true, owner: { select: { clerkUserId: true } } },
      });
      if (!defenderCountry) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Country not found" });
      }
      if (!defenderCountry.ownerUserId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "PvP challenges go to player nations. Use a PvNPC strike against NPC nations.",
        });
      }

      // A challenge left unanswered past its window no longer blocks a new one.
      await ctx.db.militaryConflict.updateMany({
        where: stalePvPProposalsBetween(userProfile.countryId, input.defenderId),
        data: EXPIRED_PVP_DATA,
      });

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
        const defenderUserId = defenderCountry.owner?.clerkUserId;
        if (defenderUserId) {
          await notificationAPI.create({
            userId: defenderUserId,
            countryId: input.defenderId,
            title: "Conflict Proposed",
            message: `${conflict.initiator.name} has proposed a military conflict against your nation`,
            type: "warning",
            category: "military",
            priority: "high",
            href: PVP_CHALLENGE_HREF,
            metadata: { conflictId: conflict.id, initiatorId: userProfile.countryId },
          });
        }
      } catch (err) {
        console.warn("[Conflicts] Proposal notification failed for conflict", conflict.id, err);
      }

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

  // Accept or decline a PvP conflict. Not premium: the challenger picks the defender, who may
  // answer whatever their tier (initiating stays premium).
  respondToConflict: rateLimitedMutationProcedure
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

      if (isProposalExpired(conflict.createdAt)) {
        await ctx.db.militaryConflict.updateMany({
          where: { id: conflict.id, status: "proposed" },
          data: EXPIRED_PVP_DATA,
        });
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `This challenge expired on ${proposalExpiresAt(conflict.createdAt).toISOString().slice(0, 10)} without an answer.`,
        });
      }

      if (!input.accept) {
        const declined = await ctx.db.militaryConflict.update({
          where: { id: input.conflictId },
          data: { status: "resolved", winner: PVP_UNFOUGHT.declined },
        });

        // Notification: notify initiator of decline (fire-and-forget)
        try {
          const initiatorCountry = await ctx.db.country.findUnique({
            where: { id: conflict.initiatorId },
            select: { owner: { select: { clerkUserId: true } } },
          });
          const initiatorUserId = initiatorCountry?.owner?.clerkUserId;
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
        } catch (err) {
          console.warn(
            "[Conflicts] Decline notification failed for conflict",
            input.conflictId,
            err
          );
        }

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
          select: { owner: { select: { clerkUserId: true } } },
        });
        const initiatorUserId = initiatorCountry?.owner?.clerkUserId;
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
      } catch (err) {
        console.warn(
          "[Conflicts] Acceptance notification failed for conflict",
          input.conflictId,
          err
        );
      }

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

  // The challenger withdraws a challenge the defender has not answered.
  withdrawPvPConflict: rateLimitedMutationProcedure
    .input(z.object({ conflictId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const conflict = await ctx.db.militaryConflict.findUnique({
        where: { id: input.conflictId },
        select: { id: true, type: true, initiatorId: true },
      });
      if (!conflict || conflict.type !== "pvp") {
        throw new TRPCError({ code: "NOT_FOUND", message: "Conflict not found." });
      }
      await assertCountryWriteAccess(ctx, conflict.initiatorId);

      const withdrawn = await ctx.db.militaryConflict.updateMany({
        where: { id: conflict.id, status: "proposed" },
        data: { status: "resolved", winner: PVP_UNFOUGHT.withdrawn },
      });
      if (withdrawn.count === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only a challenge still waiting for an answer can be withdrawn.",
        });
      }
      return { conflictId: conflict.id, status: "resolved" as const };
    }),

  // Conclude an active PvP conflict once its duration has run. Either party may call it; the
  // battle resolves with the same strength calculation as a PvNPC strike.
  concludePvPConflict: lightMutationProcedure
    .input(z.object({ conflictId: z.string(), countryId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertCountryWriteAccess(ctx, input.countryId);

      const conflict = await ctx.db.militaryConflict.findUnique({
        where: { id: input.conflictId },
        include: {
          initiator: { select: { id: true, name: true } },
          defender: { select: { id: true, name: true } },
        },
      });
      if (!conflict || conflict.type !== "pvp") {
        throw new TRPCError({ code: "NOT_FOUND", message: "Conflict not found." });
      }
      if (conflict.initiatorId !== input.countryId && conflict.defenderId !== input.countryId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only a party to the conflict can conclude it.",
        });
      }
      if (conflict.status !== "active") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Conflict is not active." });
      }
      const endsAt = pvpConflictEndsAt(conflict);
      if (endsAt && endsAt.getTime() > Date.now()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Hostilities continue until ${endsAt.toISOString().slice(0, 10)}.`,
        });
      }

      const [initiatorBranches, defenderBranches] = await Promise.all(
        [conflict.initiatorId, conflict.defenderId].map((countryId) =>
          ctx.db.militaryBranch.findMany({
            where: { countryId, isActive: true },
            include: { units: true, assets: true },
          })
        )
      );
      const outcome = computeConflictOutcome(
        militaryStrength(initiatorBranches ?? []),
        militaryStrength(defenderBranches ?? [])
      );
      const winnerId = outcome.initiatorWins ? conflict.initiatorId : conflict.defenderId;

      // Claim atomically so a repeated call cannot resolve (and damage economies) twice.
      const claimed = await ctx.db.militaryConflict.updateMany({
        where: { id: conflict.id, status: "active" },
        data: {
          status: "resolved",
          endDate: new Date(),
          winner: winnerId,
          initiatorCasualties: outcome.initiatorCasualties,
          defenderCasualties: outcome.defenderCasualties,
          economicDamage: outcome.economicDamage,
        },
      });
      if (claimed.count === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Conflict is no longer active." });
      }

      await createStorytellerEffects(
        ctx.db,
        conflictEconomicEffects({
          initiator: conflict.initiator,
          defender: conflict.defender,
          outcome,
          createdBy: ctx.user?.id ?? "system",
          defenderWinLabel: "victory",
        })
      );

      const winnerName = outcome.initiatorWins ? conflict.initiator.name : conflict.defender.name;
      for (const side of [conflict.initiator, conflict.defender]) {
        void generateDiplomaticNews(ctx.db as any, side.id, "pvnpc_conflict_resolved", {
          countryName: conflict.initiator.name,
          targetName: conflict.defender.name,
          winner: winnerName,
        });
      }

      // Notification: tell both owners the outcome (fire-and-forget)
      try {
        const owners = await ctx.db.country.findMany({
          where: { id: { in: [conflict.initiatorId, conflict.defenderId] } },
          select: { id: true, owner: { select: { clerkUserId: true } } },
        });
        for (const c of owners) {
          if (!c.owner?.clerkUserId) continue;
          await notificationAPI.create({
            userId: c.owner.clerkUserId,
            countryId: c.id,
            title: c.id === winnerId ? "Conflict Won" : "Conflict Lost",
            message: `The conflict between ${conflict.initiator.name} and ${conflict.defender.name} has ended: ${winnerName} prevails.`,
            type: c.id === winnerId ? "success" : "warning",
            category: "military",
            priority: "high",
            metadata: { conflictId: conflict.id },
          });
        }
      } catch (err) {
        console.warn("[Conflicts] Resolution notification failed for conflict", conflict.id, err);
      }

      return { conflictId: conflict.id, status: "resolved" as const, winner: winnerId };
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

      return conflicts.map(withPvPExpiry).map((c) => ({
        ...c,
        // When an active PvP conflict may be concluded (concludePvPConflict).
        endsAt: c.type === "pvp" && c.status === "active" ? pvpConflictEndsAt(c) : null,
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

  // Related player nations the caller may challenge via proposePvPConflict.
  getPvPTargets: premiumProcedure.query(({ ctx }) =>
    relatedCountries(ctx.db, ctx.auth.userId, true)
  ),

  // Related nations the caller may strike via resolvePvNPCConflict: those no user has claimed.
  getPvNPCTargets: premiumProcedure.query(({ ctx }) =>
    relatedCountries(ctx.db, ctx.auth.userId, false)
  ),

  // Resolve a PvNPC conflict automatically
  resolvePvNPCConflict: premiumMutationProcedure
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

      // The strike damages the target's GDP, so the target must be an NPC (unclaimed) nation;
      // player nations (including the caller's own) go through the mutual-consent PvP flow.
      const targetPlayer = await ctx.db.user.findFirst({
        where: { ownedCountries: { some: { id: input.targetCountryId } } },
        select: { id: true },
      });
      if (targetPlayer || input.targetCountryId === userProfile.countryId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "PvNPC strikes can only target NPC nations. Challenge player nations via PvP.",
        });
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
          select: STRIKE_COUNTRY_FIELDS,
        }),
        ctx.db.country.findUnique({
          where: { id: input.targetCountryId },
          select: STRIKE_COUNTRY_FIELDS,
        }),
      ]);

      if (!initiator || !defender) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Country not found" });
      }
      await assertStrikeAllowed(ctx.db, initiator, defender);

      const outcome = computeConflictOutcome(
        militaryStrength(initiatorBranches),
        militaryStrength(defenderBranches)
      );
      const {
        initiatorWins,
        initiatorCasualties,
        defenderCasualties,
        economicDamage: econDamage,
      } = outcome;

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
      await createStorytellerEffects(
        ctx.db,
        conflictEconomicEffects({
          initiator,
          defender,
          outcome,
          createdBy: userProfile.id,
          defenderWinLabel: "defense",
        })
      );

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
