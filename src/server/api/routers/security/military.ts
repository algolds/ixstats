/**
 * Order of battle and assets in service (realm time D2a). Branch numbers are brought up to date on the nation's
 * realm clock on read; the owner also gets each branch's derived state, everyone else the public order of battle.
 * Assets arrive only through procurement (`security.orderProcurement`); here a player renames, marks or scraps them.
 */
import { z } from "zod";
import { createTRPCRouter, publicProcedure, premiumMutationProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@prisma/client";
import {
  assertCountryResourceWriteAccess,
  hasCountryWriteAccess,
} from "~/server/shared/country-authorization";
import { redactBranchInternals } from "~/lib/military/owner-redaction";
import { scrapAsset, syncDefense } from "~/server/modules/defense";

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

const assetEditSchema = z
  .object({
    name: z.string().trim().min(1).max(150),
    capability: z.string().max(2000).nullable(),
    status: z.enum(["operational", "maintenance", "reserve"]),
    operational: z.number().int().nonnegative(),
    imageUrl: z.string().max(2048).nullable(),
  })
  .partial();

export const securityMilitaryRouter = createTRPCRouter({
  // Public order of battle. The owner and privileged roles also get each branch's model state and `derived`
  // (readiness, C-level, combat power); others get identities and rounded headcounts.
  getMilitaryBranches: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const snapshot = await syncDefense(ctx.db, input.countryId);
      const branches = await ctx.db.militaryBranch.findMany({
        where: { countryId: input.countryId, isActive: true },
        include: { units: true, assets: true },
        orderBy: { createdAt: "asc" },
      });
      if (await hasCountryWriteAccess(ctx, input.countryId)) {
        const derived = new Map(snapshot.view.branches.map((b) => [b.id, b]));
        return branches.map((b) => ({ ...b, derived: derived.get(b.id) ?? null }));
      }
      return branches.map((b) => ({ ...redactBranchInternals(b), derived: null }));
    }),

  updateMilitaryAsset: premiumMutationProcedure
    .input(z.object({ id: z.string(), asset: assetEditSchema }))
    .mutation(async ({ ctx, input }) => {
      const asset = await loadWritableAsset(ctx, input.id);
      if ((input.asset.operational ?? asset.operational) > asset.quantity) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Operational count cannot exceed quantity",
        });
      }
      return ctx.db.militaryAsset.update({ where: { id: input.id }, data: input.asset });
    }),

  // Scrap: the asset's share of its branch's capital goes with it.
  deleteMilitaryAsset: premiumMutationProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const asset = await loadWritableAsset(ctx, input.id);
      return scrapAsset(ctx.db, { countryId: asset.branch.countryId, assetId: asset.id });
    }),
});
