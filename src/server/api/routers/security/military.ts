// src/server/api/routers/security.ts
// Comprehensive Security & Defense System Router

import { z } from "zod";
import { createTRPCRouter, publicProcedure, premiumMutationProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@prisma/client";
import {
  assertCountryResourceWriteAccess,
  hasCountryWriteAccess,
} from "~/server/shared/country-authorization";
import { redactMilitaryBranchBudget } from "~/lib/country/public-record";
import { FORCE_LIMITS } from "~/lib/military/force-structure";

// ===========================
// Input Validation Schemas
// ===========================

const militaryAssetFields = z.object({
  assetType: z.enum(["aircraft", "ship", "vehicle", "weapon_system", "installation"]),
  category: z.string().trim().max(100),
  name: z.string().trim().min(1).max(150),
  quantity: z.number().int().positive().max(FORCE_LIMITS.maxAssetQuantity).default(1),
  operational: z.number().int().nonnegative().max(FORCE_LIMITS.maxAssetQuantity).default(1),
  capability: z.string().max(2000).optional(),
  status: z.enum(["operational", "maintenance", "reserve", "retired"]).default("operational"),
  modernizationLevel: z.number().min(0).max(100).default(50),
  acquisitionCost: z.number().nonnegative().max(FORCE_LIMITS.maxBudget).default(0),
  maintenanceCost: z.number().nonnegative().max(FORCE_LIMITS.maxBudget).default(0),
  imageUrl: z.string().max(2048).optional(),
});

const militaryAssetInputSchema = militaryAssetFields.refine(
  (a) => a.operational <= a.quantity,
  "Operational count cannot exceed quantity"
);

type AuthedCtx = Parameters<typeof assertCountryResourceWriteAccess>[0] & { db: PrismaClient };

/** NOT_FOUND unless the asset exists; then country-write access (owner or privileged role). */
async function loadWritableAsset(ctx: AuthedCtx, assetId: string) {
  const asset = await ctx.db.militaryAsset.findUnique({
    where: { id: assetId },
    include: { branch: { select: { countryId: true } } },
  });
  if (!asset) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Military asset not found" });
  }
  await assertCountryResourceWriteAccess(ctx, asset.branch.countryId, "Military asset");
  return asset;
}

// ===========================
// Security Router
// ===========================

export const securityMilitaryRouter = createTRPCRouter({
  // ===========================
  // Military Branch Endpoints
  // ===========================

  // Public order of battle; branch budgets (`annualBudget`, `budgetPercent`) go to the
  // nation's owner and privileged roles only.
  getMilitaryBranches: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const branches = await ctx.db.militaryBranch.findMany({
        where: {
          countryId: input.countryId,
          isActive: true,
        },
        include: {
          units: true,
          assets: true,
        },
        orderBy: { createdAt: "asc" },
      });
      if (await hasCountryWriteAccess(ctx, input.countryId)) return branches;
      return branches.map(redactMilitaryBranchBudget);
    }),

  // ===========================
  // Military Asset Endpoints
  // ===========================

  createMilitaryAsset: premiumMutationProcedure
    .input(
      z.object({
        branchId: z.string(),
        asset: militaryAssetInputSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const branch = await ctx.db.militaryBranch.findUnique({
        where: { id: input.branchId },
        select: { countryId: true },
      });
      if (!branch) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Military branch not found" });
      }
      await assertCountryResourceWriteAccess(ctx, branch.countryId, "Military branch");

      const existing = await ctx.db.militaryAsset.count({ where: { branchId: input.branchId } });
      if (existing >= FORCE_LIMITS.maxAssetsPerBranch) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `A branch can have at most ${FORCE_LIMITS.maxAssetsPerBranch} assets.`,
        });
      }

      return ctx.db.militaryAsset.create({
        data: {
          branchId: input.branchId,
          ...input.asset,
        },
      });
    }),

  updateMilitaryAsset: premiumMutationProcedure
    .input(
      z.object({
        id: z.string(),
        asset: militaryAssetFields
          .extend({
            quantity: z.number().int().positive().max(FORCE_LIMITS.maxAssetQuantity),
            operational: z.number().int().nonnegative().max(FORCE_LIMITS.maxAssetQuantity),
            status: z.enum(["operational", "maintenance", "reserve", "retired"]),
            modernizationLevel: z.number().min(0).max(100),
            acquisitionCost: z.number().nonnegative().max(FORCE_LIMITS.maxBudget),
            maintenanceCost: z.number().nonnegative().max(FORCE_LIMITS.maxBudget),
          })
          .partial(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const asset = await loadWritableAsset(ctx, input.id);
      const quantity = input.asset.quantity ?? asset.quantity;
      const operational = input.asset.operational ?? asset.operational;
      if (operational > quantity) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Operational count cannot exceed quantity",
        });
      }

      return ctx.db.militaryAsset.update({
        where: { id: input.id },
        data: input.asset,
      });
    }),

  deleteMilitaryAsset: premiumMutationProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await loadWritableAsset(ctx, input.id);

      return ctx.db.militaryAsset.delete({
        where: { id: input.id },
      });
    }),
});
