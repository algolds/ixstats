// src/server/api/routers/security.ts
// Comprehensive Security & Defense System Router

import { z } from "zod";
import { createTRPCRouter, publicProcedure, premiumProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@prisma/client";
import { hasCountryWriteAccess } from "~/server/shared/country-authorization";
import { redactMilitaryBranchBudget } from "~/lib/country/public-record";

// ===========================
// Input Validation Schemas
// ===========================

const militaryAssetInputSchema = z.object({
  assetType: z.enum(["aircraft", "ship", "vehicle", "weapon_system", "installation"]),
  category: z.string(),
  name: z.string().min(1),
  quantity: z.number().int().positive().default(1),
  operational: z.number().int().nonnegative().default(1),
  capability: z.string().optional(),
  status: z.enum(["operational", "maintenance", "reserve", "retired"]).default("operational"),
  modernizationLevel: z.number().min(0).max(100).default(50),
  acquisitionCost: z.number().nonnegative().default(0),
  maintenanceCost: z.number().nonnegative().default(0),
  imageUrl: z.string().optional(),
});

type AuthedCtx = {
  db: PrismaClient;
  auth: { userId: string };
};

/** FORBIDDEN unless the caller's linked country is `countryId`. */
async function assertOwnsCountry(ctx: AuthedCtx, countryId: string, message: string) {
  const userProfile = await ctx.db.user.findUnique({
    where: { clerkUserId: ctx.auth.userId },
    select: { countryId: true },
  });
  if (userProfile?.countryId !== countryId) {
    throw new TRPCError({ code: "FORBIDDEN", message });
  }
}

/** NOT_FOUND unless the asset exists; FORBIDDEN unless its branch belongs to the caller's country. */
async function assertOwnsAsset(ctx: AuthedCtx, assetId: string, message: string) {
  const asset = await ctx.db.militaryAsset.findUnique({
    where: { id: assetId },
    include: { branch: { select: { countryId: true } } },
  });
  if (!asset) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Military asset not found" });
  }
  await assertOwnsCountry(ctx, asset.branch.countryId, message);
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

  createMilitaryAsset: premiumProcedure
    .input(
      z.object({
        branchId: z.string(),
        asset: militaryAssetInputSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify user owns the branch
      const branch = await ctx.db.militaryBranch.findUnique({
        where: { id: input.branchId },
        select: { countryId: true },
      });

      if (!branch) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Military branch not found",
        });
      }

      await assertOwnsCountry(
        ctx,
        branch.countryId,
        "You can only create assets for your own military branches"
      );

      return ctx.db.militaryAsset.create({
        data: {
          branchId: input.branchId,
          ...input.asset,
        },
      });
    }),

  updateMilitaryAsset: premiumProcedure
    .input(
      z.object({
        id: z.string(),
        asset: militaryAssetInputSchema.partial(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership through branch
      await assertOwnsAsset(ctx, input.id, "You can only update your own military assets");

      return ctx.db.militaryAsset.update({
        where: { id: input.id },
        data: input.asset,
      });
    }),

  deleteMilitaryAsset: premiumProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership through branch
      await assertOwnsAsset(ctx, input.id, "You can only delete your own military assets");

      return ctx.db.militaryAsset.delete({
        where: { id: input.id },
      });
    }),
});
