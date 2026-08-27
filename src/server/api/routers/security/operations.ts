/**
 * Security Operations Router (Plan 163 / Plan 191)
 *
 * Handles military operations lifecycle, unit/asset deployments,
 * GDP maintenance drag calculations, and mission recall.
 */

import { z } from "zod";
import { createTRPCRouter, publicProcedure, premiumProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { notificationAPI } from "~/lib/notifications/api";
import { generateDiplomaticNews } from "~/lib/diplomacy/news-generator";

export const securityOperationsRouter = createTRPCRouter({
  // Get active and past operations
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

      return operations.map((op) => ({
        ...op,
        targetCountry: op.targetCountry
          ? {
              id: op.targetCountry.id,
              name: op.targetCountry.name,
              flagUrl: op.targetCountry.flag,
            }
          : null,
      }));
    }),

  // Create a military operation and deploy units/assets
  createOperation: premiumProcedure
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
        duration: z.number().min(1).optional(), // Planned IxTime days
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
        select: { countryId: true, id: true },
      });

      if (userProfile?.countryId !== input.countryId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only create operations for your own country.",
        });
      }

      // Get country GDP for cost calculation
      const country = await ctx.db.country.findUnique({
        where: { id: input.countryId },
        select: { id: true, name: true, currentGdpPerCapita: true, currentPopulation: true },
      });

      if (!country) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Country not found" });
      }

      // Calculate daily cost: (personnel * $200/day) + (asset maintenance * 1.5x)
      let assetMaintenanceCost = 0;
      if (input.assetIds.length > 0) {
        const assets = await ctx.db.militaryAsset.findMany({
          where: { id: { in: input.assetIds } },
          select: { maintenanceCost: true },
        });
        assetMaintenanceCost = assets.reduce((sum, a) => sum + (a.maintenanceCost ?? 0), 0);
      }

      const dailyCost = input.personnelDeployed * 200 + assetMaintenanceCost * 1.5;
      const annualCost = dailyCost * 365;
      const gdp = (country.currentGdpPerCapita ?? 10000) * (country.currentPopulation ?? 1000000);
      const gdpDrain = gdp > 0 ? annualCost / gdp : 0;

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
        },
        include: {
          targetCountry: { select: { id: true, name: true } },
        },
      });

      // Create deployments for units
      if (input.unitIds.length > 0) {
        await ctx.db.deployment.createMany({
          data: input.unitIds.map((unitId) => ({
            operationId: operation.id,
            unitId,
            status: "deployed",
          })),
        });

        // Reduce unit readiness
        await ctx.db.militaryUnit.updateMany({
          where: { id: { in: input.unitIds } },
          data: { readiness: { decrement: 10 } },
        });
      }

      // Create deployments for assets
      if (input.assetIds.length > 0) {
        await ctx.db.deployment.createMany({
          data: input.assetIds.map((assetId) => ({
            operationId: operation.id,
            assetId,
            status: "deployed",
          })),
        });
      }

      // Create storyteller effects for GDP drain
      if (gdpDrain > 0) {
        await ctx.db.storytellerEffect.create({
          data: {
            countryId: input.countryId,
            ixTimeTimestamp: new Date(),
            inputType: "GDP_ADJUSTMENT",
            value: -gdpDrain,
            description: `Military operation: ${input.name} (${input.operationType})`,
            duration: input.duration ? Math.ceil(input.duration / 365) : 1,
            isActive: true,
            createdBy: userProfile.id,
          },
        });
      }

      // Diplomatic impact for certain operation types
      if (input.targetCountryId && input.operationType === "peacekeeping") {
        const relation = await ctx.db.diplomaticRelation.findFirst({
          where: {
            OR: [
              { country1: input.countryId, country2: input.targetCountryId },
              { country1: input.targetCountryId, country2: input.countryId },
            ],
          },
        });
        if (relation) {
          await ctx.db.diplomaticRelation.update({
            where: { id: relation.id },
            data: { strength: Math.min(100, relation.strength + 10) },
          });
        }
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

  // Recall a deployment / end an operation
  endOperation: premiumProcedure
    .input(
      z.object({
        operationId: z.string(),
        successRating: z.enum(["success", "partial", "failure"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
        select: { countryId: true },
      });

      const operation = await ctx.db.militaryOperation.findUnique({
        where: { id: input.operationId },
        include: { deployments: true },
      });

      if (!operation) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Operation not found." });
      }

      if (operation.countryId !== userProfile?.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not your operation." });
      }

      if (operation.status !== "active" && operation.status !== "planned") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Operation is not active." });
      }

      // Recall all deployments
      await ctx.db.deployment.updateMany({
        where: { operationId: input.operationId, status: "deployed" },
        data: { status: "recalled", recalledAt: new Date() },
      });

      // Restore partial unit readiness (+5 per recalled unit)
      const unitDeployments = operation.deployments.filter(
        (d) => d.unitId && d.status === "deployed"
      );
      if (unitDeployments.length > 0) {
        const unitIds = unitDeployments.map((d) => d.unitId!);
        await ctx.db.militaryUnit.updateMany({
          where: { id: { in: unitIds } },
          data: { readiness: { increment: 5 } },
        });
      }

      // End operation
      const updated = await ctx.db.militaryOperation.update({
        where: { id: input.operationId },
        data: {
          status: "completed",
          successRating: input.successRating,
        },
      });

      // Deactivate storyteller effects for this operation
      await ctx.db.storytellerEffect.updateMany({
        where: {
          countryId: operation.countryId,
          description: { contains: operation.name },
          isActive: true,
        },
        data: { isActive: false },
      });

      // Notification: operation completed (fire-and-forget)
      try {
        if (ctx.auth?.userId) {
          await notificationAPI.create({
            userId: ctx.auth.userId,
            countryId: operation.countryId,
            title: "Operation Complete",
            message: `Operation "${operation.name}" ended: ${input.successRating ?? "completed"}`,
            type: "info",
            category: "military",
            priority: "high",
            metadata: { operationId: input.operationId, result: input.successRating },
          });
        }
      } catch {}

      return updated;
    }),
});
