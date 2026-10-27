/**
 * Security conflicts: PvP challenges (Plan 163 / Plan 191). A proposal, the defender's response,
 * withdrawal, and the sealed battle's conclusion.
 */

import { z } from "zod";
import {
  createTRPCRouter,
  lightMutationProcedure,
  premiumMutationProcedure,
  rateLimitedMutationProcedure,
} from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { notificationAPI } from "~/lib/notifications/api";
import { generateDiplomaticNews } from "~/lib/diplomacy/news-generator";
import { assertCountryWriteAccess } from "~/server/shared/country-authorization";
import { pvpConflictEndsAt, pvpDurationDays } from "~/lib/military/conflict-outcome";
import { MIN_COMMITMENT } from "~/lib/military/combat";
import { concludePvP, normaliseOrders, sealPvP } from "~/server/modules/combat";
import { assertRealmsMatch } from "~/server/shared/same-realm-guard";
import { clockForCountry } from "~/server/shared/realm-time";
import {
  EXPIRED_PVP_DATA,
  PVP_UNFOUGHT,
  stalePvPProposalsBetween,
} from "~/lib/military/pvp-proposals";
import { isProposalExpired, proposalExpiresAt } from "~/lib/diplomacy/proposal-lifecycle";

/** Where a defender answers a challenge (the Defense page opens on Special operations). */
const PVP_CHALLENGE_HREF = "/mycountry/defense?tab=operations";

export const securityPvPConflictsRouter = createTRPCRouter({
  // Propose a PvP conflict (requires mutual acceptance)
  proposePvPConflict: premiumMutationProcedure
    .input(
      z.object({
        defenderId: z.string(),
        reason: z.string().optional(),
        pvpRules: z
          .object({
            victoryConditions: z.string(),
            maxDuration: z.number(), // in-game days on the realm clock
            stakes: z.string(),
          })
          .optional(),
        /** Share of the challenger's theatre forces committed (hashed into the seed at acceptance). */
        commitment: z.number().min(MIN_COMMITMENT).max(1).optional(),
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
        select: { ownerUserId: true, realmId: true, owner: { select: { clerkUserId: true } } },
      });
      if (!defenderCountry) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Country not found" });
      }
      const initiatorCountry = await ctx.db.country.findUnique({
        where: { id: userProfile.countryId },
        select: { realmId: true },
      });
      if (initiatorCountry) assertRealmsMatch(initiatorCountry.realmId, defenderCountry.realmId);
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
          orders: JSON.stringify(
            normaliseOrders({
              mode: "pvp",
              attackerId: userProfile.countryId,
              defenderId: input.defenderId,
              commitment: input.commitment,
              days: input.pvpRules?.maxDuration ?? pvpDurationDays(null),
            })
          ),
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

      // The seed is fixed now, from the battle, the moment and the challenger's orders: nothing rerolls it.
      const clock = await clockForCountry(ctx.db, conflict.defenderId);
      const startClockMs = clock.now();
      const accepted = await ctx.db.militaryConflict.update({
        where: { id: input.conflictId },
        data: {
          defenderApproved: true,
          status: "active",
          startDate: new Date(),
          startClockMs,
          ...sealPvP(conflict, startClockMs),
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
      const window = pvpConflictEndsAt(conflict, await clockForCountry(ctx.db, input.countryId));
      if (window && !window.over) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: window.endsAt
            ? `Hostilities continue until ${window.endsAt.toISOString().slice(0, 10)}.`
            : "Hostilities continue: your realm's clock is paused.",
        });
      }

      // The combat model resolves on the seed fixed at acceptance, claims the row once, then applies the losses,
      // war damage and casualties.
      const concluded = await concludePvP(ctx.db, conflict);
      if (!concluded) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Conflict is no longer active." });
      }
      const winnerId = concluded.winner;
      const initiatorWon = winnerId === conflict.initiatorId;

      const winnerName = initiatorWon ? conflict.initiator.name : conflict.defender.name;
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

      return {
        conflictId: conflict.id,
        status: "resolved" as const,
        winner: winnerId,
        outcomeBand: concluded.result.band,
      };
    }),
});
