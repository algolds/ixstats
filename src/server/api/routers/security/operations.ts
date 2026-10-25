/**
 * Security Operations Router (Plan 163 / Plan 191)
 *
 * Handles military operations lifecycle, unit/asset deployments,
 * GDP maintenance drag calculations, and mission recall.
 */

import { z } from "zod";
import { createTRPCRouter, publicProcedure, premiumMutationProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { notificationAPI } from "~/lib/notifications/api";
import { generateDiplomaticNews } from "~/lib/diplomacy/news-generator";
import { applyRelationshipImpact } from "~/lib/diplomacy/relationship-impact";
import {
  assertCountryWriteAccess,
  hasCountryWriteAccess,
} from "~/server/shared/country-authorization";
import { redactOperationCosts } from "~/lib/military/owner-redaction";
import { endStorytellerEffects } from "~/lib/economy/storyteller-effects";
import {
  COMBAT_OPERATIONS,
  OPERATION_TYPES,
  combinedRating,
  operationDailyCost,
} from "~/lib/military/combat";
import {
  GENERALS_READINESS_MULTIPLIER,
  PEACEKEEPING_BONUS_WINDOW_IXDAYS,
  PEACEKEEPING_RELATION_BONUS,
  ixDaysAgo,
  operationSuccessRating,
} from "~/lib/military/operation-rules";
import { DEPLOY_CONDITION_COST } from "~/lib/military/model";
import { IxTime } from "~/lib/ixtime";
import { isBrokerSatisfied } from "~/server/modules/security/brokers";
import { applyOperationReadiness } from "~/server/modules/defense";
import {
  CROSS_REALM_MESSAGE,
  newBattleId,
  resolveIntervention,
  sealIntervention,
} from "~/server/modules/combat";
import { clockForCountry, type RealmClockReader } from "~/server/shared/realm-time";
import type { PrismaClient } from "@prisma/client";

/** `createdBy` of a military operation's GDP-drain StorytellerEffect (operations before D3; now paid from O&M). */
const operationEffectKey = (operationId: string) => `operation:${operationId}`;

/**
 * The relation a new peacekeeping operation raises: the one with its target, unless an earlier
 * peacekeeping operation by this nation already raised it within the window on its realm clock
 * (null then).
 */
async function peacekeepingRelation(
  db: PrismaClient,
  countryId: string,
  targetId: string,
  clock: RealmClockReader
) {
  const recentBonus = await db.militaryOperation.findFirst({
    where: {
      countryId,
      targetCountryId: targetId,
      operationType: "peacekeeping",
      diplomaticImpact: { gt: 0 },
      createdAt: { gte: ixDaysAgo(PEACEKEEPING_BONUS_WINDOW_IXDAYS, clock) },
    },
    select: { id: true },
  });
  if (recentBonus) return null;
  return db.diplomaticRelation.findFirst({
    where: {
      OR: [
        { country1: countryId, country2: targetId },
        { country1: targetId, country2: countryId },
      ],
    },
  });
}

/** An operation row without its server-only battle inputs, and without the seed until it has ended. */
function withoutBattleInputs<T extends { status: string; inputSnapshot?: string | null; orders?: string | null; seed?: string | null }>(
  operation: T
): Omit<T, "inputSnapshot" | "orders"> {
  const { inputSnapshot: _snapshot, orders: _orders, ...rest } = operation;
  return { ...rest, seed: operation.status === "completed" ? (operation.seed ?? null) : null };
}

export const securityOperationsRouter = createTRPCRouter({
  // Get active and past operations. Personnel and costs are the owner's only.
  getOperations: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
        includeCompleted: z.boolean().optional().default(false),
      })
    )
    .query(async ({ ctx, input }) => {
      const statusFilter = input.includeCompleted ? {} : { status: { in: ["planned", "active"] } };

      const operations = await ctx.db.militaryOperation.findMany({
        where: { countryId: input.countryId, ...statusFilter },
        include: {
          targetCountry: { select: { id: true, name: true, flag: true } },
          deployments: true,
        },
        orderBy: { createdAt: "desc" },
      });

      const rows = operations.map(withoutBattleInputs).map((op) => ({
        ...op,
        targetCountry: op.targetCountry
          ? {
              id: op.targetCountry.id,
              name: op.targetCountry.name,
              flagUrl: op.targetCountry.flag,
            }
          : null,
      }));
      if (await hasCountryWriteAccess(ctx, input.countryId)) return rows;
      return rows.map(redactOperationCosts);
    }),

  // Create a military operation and deploy units/assets
  createOperation: premiumMutationProcedure
    .input(
      z.object({
        countryId: z.string(),
        operationType: z.enum(OPERATION_TYPES),
        name: z.string().min(2),
        description: z.string().optional(),
        targetCountryId: z.string().optional(),
        personnelDeployed: z.number().min(0).default(0),
        unitIds: z.array(z.string()).optional().default([]),
        assetIds: z.array(z.string()).optional().default([]),
        duration: z.number().min(1).optional(), // Planned in-game days on the realm clock
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertCountryWriteAccess(ctx, input.countryId);

      if (input.operationType === "peacekeeping" && input.personnelDeployed <= 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A peacekeeping operation must deploy personnel.",
        });
      }

      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
        select: { id: true },
      });
      if (!userProfile) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "User profile not found." });
      }

      // Get country GDP for cost calculation
      const country = await ctx.db.country.findUnique({
        where: { id: input.countryId },
        select: {
          id: true,
          name: true,
          realmId: true,
          currentGdpPerCapita: true,
          currentPopulation: true,
        },
      });

      if (!country) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Country not found" });
      }

      // Operations against another nation stay inside the realm.
      const target = input.targetCountryId
        ? await ctx.db.country.findUnique({
            where: { id: input.targetCountryId },
            select: { id: true, realmId: true },
          })
        : null;
      if (input.targetCountryId && !target) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Target country not found" });
      }
      if (target && target.realmId !== country.realmId) {
        throw new TRPCError({ code: "FORBIDDEN", message: CROSS_REALM_MESSAGE });
      }
      if (COMBAT_OPERATIONS.has(input.operationType) && !target) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "An intervention needs a target nation." });
      }

      // Units and assets must belong to this nation's active branches.
      const [ownUnits, ownAssets] = await Promise.all([
        input.unitIds.length > 0
          ? ctx.db.militaryUnit.findMany({
              where: {
                id: { in: input.unitIds },
                branch: { countryId: input.countryId, isActive: true },
              },
              select: { id: true, personnel: true },
            })
          : [],
        input.assetIds.length > 0
          ? ctx.db.militaryAsset.findMany({
              where: {
                id: { in: input.assetIds },
                branch: { countryId: input.countryId, isActive: true },
              },
              select: { id: true, maintenanceCost: true, quantity: true },
            })
          : [],
      ]);
      if (
        ownUnits.length !== new Set(input.unitIds).size ||
        ownAssets.length !== new Set(input.assetIds).size
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Deploy only your own nation's units and assets.",
        });
      }
      const unitIds = ownUnits.map((u) => u.id);
      const assetIds = ownAssets.map((a) => a.id);

      // Deployed units bring their own headcount; a typed figure only stands in when no units go.
      const personnelDeployed =
        ownUnits.length > 0
          ? ownUnits.reduce((sum, u) => sum + (u.personnel ?? 0), 0)
          : input.personnelDeployed;

      // Daily cost on the Defense budget's O&M line (the monthly tick pays operations first): personnel at the
      // operation type's rate of GDP per capita, plus 1.5x the deployed assets' annual upkeep per day.
      const dailyCost = operationDailyCost({
        type: input.operationType,
        personnel: personnelDeployed,
        gdpPerCapita: country.currentGdpPerCapita ?? 0,
        assetMaintenanceAnnual: ownAssets.reduce(
          (sum, a) => sum + (a.maintenanceCost ?? 0) * Math.max(1, a.quantity ?? 1),
          0
        ),
      });
      const gdp = (country.currentGdpPerCapita ?? 0) * (country.currentPopulation ?? 0);
      // Shown as the operation's share of GDP a year; no longer a GDP effect of its own.
      const gdpDrain = gdp > 0 ? (dailyCost * 365) / gdp : 0;

      // Peacekeeping raises the relation with its target once per target per window.
      const clock = await clockForCountry(ctx.db, country);
      const relation =
        input.operationType === "peacekeeping" && input.targetCountryId
          ? await peacekeepingRelation(ctx.db, input.countryId, input.targetCountryId, clock)
          : null;

      // An intervention is sealed now (orders, commit time, seed) and fought on the combat model when it ends.
      const operationId = newBattleId();
      const seal =
        COMBAT_OPERATIONS.has(input.operationType) && target
          ? await sealIntervention(ctx.db, {
              operationId,
              countryId: input.countryId,
              targetId: target.id,
              personnel: personnelDeployed,
              days: input.duration ?? null,
            })
          : {};

      // Create the operation
      const operation = await ctx.db.militaryOperation.create({
        data: {
          id: operationId,
          ...seal,
          countryId: input.countryId,
          operationType: input.operationType,
          name: input.name,
          description: input.description,
          targetCountryId: input.targetCountryId,
          status: "active",
          personnelDeployed,
          dailyCost,
          gdpDrain,
          duration: input.duration,
          startIxTime: clock.now(),
          readinessImpact: -DEPLOY_CONDITION_COST * 100,
          diplomaticImpact: relation ? PEACEKEEPING_RELATION_BONUS : 0,
        },
        include: {
          targetCountry: { select: { id: true, name: true } },
        },
      });

      // Create deployments for units
      if (unitIds.length > 0) {
        await ctx.db.deployment.createMany({
          data: unitIds.map((unitId) => ({
            operationId: operation.id,
            unitId,
            status: "deployed",
          })),
        });

      }

      // Create deployments for assets
      if (assetIds.length > 0) {
        await ctx.db.deployment.createMany({
          data: assetIds.map((assetId) => ({
            operationId: operation.id,
            assetId,
            status: "deployed",
          })),
        });
      }

      // The deployed branches' equipment condition wears (the model's readiness, not a typed one).
      await applyOperationReadiness(ctx.db, {
        countryId: input.countryId,
        unitIds,
        assetIds,
        change: "deploy",
      });

      if (relation && input.targetCountryId) {
        await applyRelationshipImpact(
          ctx.db,
          input.countryId,
          input.targetCountryId,
          PEACEKEEPING_RELATION_BONUS
        );
      }

      // Auto-news: military deployment
      void generateDiplomaticNews(ctx.db as any, input.countryId, "military_deployed", {
        countryName: country.name,
        operationName: input.name,
        personnel: personnelDeployed,
        targetName: operation.targetCountry?.name,
      });

      return withoutBattleInputs(operation);
    }),

  // Recall a deployment / end an operation. The server rates the outcome from how much of the
  // planned duration ran, and recalled units recover readiness (training gains overall).
  endOperation: premiumMutationProcedure
    .input(z.object({ operationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const operation = await ctx.db.militaryOperation.findUnique({
        where: { id: input.operationId },
        include: { deployments: true },
      });

      if (!operation) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Operation not found." });
      }

      await assertCountryWriteAccess(ctx, operation.countryId);

      if (operation.status !== "active" && operation.status !== "planned") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Operation is not active." });
      }

      // Recall all deployments
      await ctx.db.deployment.updateMany({
        where: { operationId: input.operationId, status: "deployed" },
        data: { status: "recalled", recalledAt: new Date() },
      });

      // A training exercise lifts the deployed branches' training (10% more with the Generals
      // satisfied); any other operation leaves a reset bill on their equipment condition.
      const deployed = operation.deployments.filter((d) => d.status === "deployed");
      const generals = await isBrokerSatisfied(ctx.db, operation.countryId, "generals");
      await applyOperationReadiness(ctx.db, {
        countryId: operation.countryId,
        unitIds: deployed.flatMap((d) => (d.unitId ? [d.unitId] : [])),
        assetIds: deployed.flatMap((d) => (d.assetId ? [d.assetId] : [])),
        change: operation.operationType === "training" ? "trainingEnded" : "operationEnded",
        generalsMultiplier: generals ? GENERALS_READINESS_MULTIPLIER : 1,
      });

      // End operation on the nation's realm clock. Rows from before startIxTime was stamped fall
      // back to their creation (on Ixnay's timeline, which every realm clock shares).
      const endIxTime = (await clockForCountry(ctx.db, operation.countryId)).now();
      const durationRating = operationSuccessRating({
        durationIxDays: operation.duration,
        startIxTime: operation.startIxTime || IxTime.convertToIxTime(operation.createdAt.getTime()),
        endIxTime,
      });
      // Claim the end once, then fight a sealed intervention against the target's real forces.
      const claimed = await ctx.db.militaryOperation.updateMany({
        where: { id: input.operationId, status: { in: ["active", "planned"] } },
        data: { status: "completed", endIxTime },
      });
      if (claimed.count === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Operation is not active." });
      }
      const battle = await resolveIntervention(ctx.db, operation);
      const successRating = combinedRating(durationRating, battle?.result.band ?? null);
      const updated = await ctx.db.militaryOperation.update({
        where: { id: input.operationId },
        data: {
          successRating,
          ...(battle
            ? {
                outcomeBand: battle.result.band,
                casualties: battle.data.initiatorCasualties,
                inputSnapshot: battle.data.inputSnapshot,
              }
            : {}),
        },
      });

      // End this operation's GDP drain without rewriting the projected past (rows from before
      // the operation key are matched by their description).
      await endStorytellerEffects(ctx.db, {
        countryId: operation.countryId,
        OR: [
          { createdBy: operationEffectKey(operation.id) },
          { description: `Military operation: ${operation.name} (${operation.operationType})` },
        ],
      });

      // Notification: operation completed (fire-and-forget)
      try {
        if (ctx.auth?.userId) {
          await notificationAPI.create({
            userId: ctx.auth.userId,
            countryId: operation.countryId,
            title: "Operation Complete",
            message: `Operation "${operation.name}" ended: ${successRating}`,
            type: "info",
            category: "military",
            priority: "high",
            metadata: { operationId: input.operationId, result: successRating },
          });
        }
      } catch (err) {
        console.warn(
          "[Security Operations] Completion notification failed for operation",
          input.operationId,
          err
        );
      }

      return withoutBattleInputs(updated);
    }),
});
