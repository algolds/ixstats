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
import { StorytellerEffectType } from "~/lib/economy/calculations";
import { createStorytellerEffect, endStorytellerEffects } from "~/lib/economy/storyteller-effects";
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
import { clockForCountry, type RealmClockReader } from "~/server/shared/realm-time";
import type { PrismaClient } from "@prisma/client";

/** `createdBy` of a military operation's GDP-drain StorytellerEffect. */
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

      const rows = operations.map((op) => ({
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
        operationType: z.enum([
          "peacekeeping",
          "defense_pact",
          "blockade",
          "intervention",
          "training",
        ]),
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

      // Units and assets must belong to this nation's active branches.
      const [ownUnits, ownAssets] = await Promise.all([
        input.unitIds.length > 0
          ? ctx.db.militaryUnit.findMany({
              where: {
                id: { in: input.unitIds },
                branch: { countryId: input.countryId, isActive: true },
              },
              select: { id: true },
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

      // Daily cost: personnel at $200/day plus 1.5x the deployed assets' upkeep. Catalog
      // maintenanceCost is annual per unit, so it is spread over the year and counted per unit.
      const assetMaintenanceCost = ownAssets.reduce(
        (sum, a) => sum + ((a.maintenanceCost ?? 0) * Math.max(1, a.quantity ?? 1)) / 365,
        0
      );

      const dailyCost = input.personnelDeployed * 200 + assetMaintenanceCost * 1.5;
      const annualCost = dailyCost * 365;
      const gdp = (country.currentGdpPerCapita ?? 10000) * (country.currentPopulation ?? 1000000);
      const gdpDrain = gdp > 0 ? annualCost / gdp : 0;

      // Peacekeeping raises the relation with its target once per target per window.
      const clock = await clockForCountry(ctx.db, country);
      const relation =
        input.operationType === "peacekeeping" && input.targetCountryId
          ? await peacekeepingRelation(ctx.db, input.countryId, input.targetCountryId, clock)
          : null;

      // Create the operation
      const operation = await ctx.db.militaryOperation.create({
        data: {
          countryId: input.countryId,
          operationType: input.operationType,
          name: input.name,
          description: input.description,
          targetCountryId: input.targetCountryId,
          status: "active",
          personnelDeployed: input.personnelDeployed,
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

      // GDP drain: a GDP level effect of -(annual cost / GDP), phased in while the operation
      // runs; ending the operation unwinds it from then on.
      if (gdpDrain > 0) {
        await createStorytellerEffect(ctx.db, {
          countryId: input.countryId,
          inputType: StorytellerEffectType.GDP_LEVEL_ADJUSTMENT,
          value: -gdpDrain,
          description: `Military operation: ${input.name} (${input.operationType})`,
          duration: input.duration ? Math.ceil(input.duration / 365) : 1,
          createdBy: operationEffectKey(operation.id),
        });
      }

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
        personnel: input.personnelDeployed,
        targetName: operation.targetCountry?.name,
      });

      return operation;
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
      const successRating = operationSuccessRating({
        durationIxDays: operation.duration,
        startIxTime: operation.startIxTime || IxTime.convertToIxTime(operation.createdAt.getTime()),
        endIxTime,
      });
      const updated = await ctx.db.militaryOperation.update({
        where: { id: input.operationId },
        data: { status: "completed", successRating, endIxTime },
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

      return updated;
    }),
});
