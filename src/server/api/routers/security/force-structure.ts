/**
 * Force-structure authoring (MC-3; realm time D2a): country owners name, describe, add and delete their branches
 * and organise units. Headcounts, capital and readiness are derived from the defense budget on the nation's realm
 * clock (`~/server/modules/defense`), so no strength is typed here. Premium + per-procedure rate limit, the canonical
 * country-write check (owner, acting user or privileged role) and bounded inputs.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@prisma/client";
import { createTRPCRouter, premiumProcedure, premiumMutationProcedure } from "~/server/api/trpc";
import {
  assertCountryResourceWriteAccess,
  assertCountryWriteAccess,
} from "~/server/shared/country-authorization";
import { BRANCH_DOMAINS, FORCE_LIMITS } from "~/lib/military/force-structure";
import {
  createEmptyBranch,
  deleteBranch,
  previewStarterForce,
  seedStarterBranches,
  setBranchAllocation,
} from "~/server/modules/defense";

// ===========================
// Input Validation Schemas
// ===========================

/** Optional free text; an empty string clears the field. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

const optionalImageUrl = z
  .string()
  .trim()
  .max(2048)
  .refine(
    (v) => v === "" || /^https?:\/\//i.test(v),
    "Image URL must start with http:// or https://"
  )
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();

const headcount = (max: number) => z.number().int().min(0).max(max);

/** A branch's identity; its numbers come from the model. */
export const militaryBranchInputSchema = z.object({
  domain: z.enum(BRANCH_DOMAINS),
  name: z.string().trim().min(1, "Branch name is required").max(100),
  motto: optionalText(200),
  description: optionalText(2000),
  established: optionalText(50),
  imageUrl: optionalImageUrl,
  civilianStaff: headcount(FORCE_LIMITS.maxCivilianStaff).default(0),
});

export const militaryUnitInputSchema = z.object({
  name: z.string().trim().min(1, "Unit name is required").max(100),
  unitType: z.string().trim().min(1, "Unit type is required").max(50),
  designation: optionalText(50),
  description: optionalText(2000),
  personnel: headcount(FORCE_LIMITS.maxUnitPersonnel).default(0),
  commanderName: optionalText(100),
  commanderRank: optionalText(100),
  headquarters: optionalText(100),
  imageUrl: optionalImageUrl,
});

/** `.partial()` keeps zod defaults, which would reset omitted fields on update; strip them. The domain is fixed. */
const branchUpdateSchema = militaryBranchInputSchema
  .omit({ domain: true })
  .extend({ civilianStaff: headcount(FORCE_LIMITS.maxCivilianStaff) })
  .partial();

const unitUpdateSchema = militaryUnitInputSchema
  .extend({ personnel: headcount(FORCE_LIMITS.maxUnitPersonnel) })
  .partial();

// ===========================
// Guards
// ===========================

type Db = PrismaClient;
type AuthCtx = Parameters<typeof assertCountryWriteAccess>[0] & { db: Db };

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

/** NOT_FOUND unless the branch exists; then country-write access on its nation. */
async function loadWritableBranch(ctx: AuthCtx, branchId: string) {
  const branch = await ctx.db.militaryBranch.findUnique({
    where: { id: branchId },
    select: { id: true, countryId: true, activeDuty: true, reserves: true, isActive: true },
  });
  if (!branch) throw new TRPCError({ code: "NOT_FOUND", message: "Military branch not found" });
  await assertCountryResourceWriteAccess(ctx, branch.countryId, "Military branch");
  return branch;
}

/** NOT_FOUND unless the unit exists; then country-write access on its branch's nation. */
async function loadWritableUnit(ctx: AuthCtx, unitId: string) {
  const unit = await ctx.db.militaryUnit.findUnique({
    where: { id: unitId },
    select: {
      id: true,
      branchId: true,
      personnel: true,
      branch: { select: { countryId: true, activeDuty: true, reserves: true } },
    },
  });
  if (!unit) throw new TRPCError({ code: "NOT_FOUND", message: "Military unit not found" });
  await assertCountryResourceWriteAccess(ctx, unit.branch.countryId, "Military unit");
  return unit;
}

/** Unit personnel in a branch is drawn from its active duty and reserves. */
async function assertUnitsFit(
  db: Db,
  branchId: string,
  branchPersonnel: number,
  extra: number,
  excludeUnitId?: string
) {
  const assigned = await db.militaryUnit.aggregate({
    where: { branchId, ...(excludeUnitId ? { id: { not: excludeUnitId } } : {}) },
    _sum: { personnel: true },
  });
  const total = (assigned._sum.personnel ?? 0) + extra;
  if (total > branchPersonnel) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Units would hold ${fmt(total)} personnel but the branch has ${fmt(branchPersonnel)} active duty and reserves.`,
    });
  }
}

// ===========================
// Router
// ===========================

export const securityForceStructureRouter = createTRPCRouter({
  // A new branch starts empty and grows from the defense budget on the realm clock.
  createMilitaryBranch: premiumMutationProcedure
    .input(z.object({ countryId: z.string().min(1), branch: militaryBranchInputSchema }))
    .mutation(async ({ ctx, input }) => {
      await assertCountryWriteAccess(ctx, input.countryId);

      const existing = await ctx.db.militaryBranch.count({
        where: { countryId: input.countryId, isActive: true },
      });
      if (existing >= FORCE_LIMITS.maxBranchesPerCountry) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `A nation can have at most ${FORCE_LIMITS.maxBranchesPerCountry} branches.`,
        });
      }
      const { domain, name, ...identity } = input.branch;
      return createEmptyBranch(ctx.db, { countryId: input.countryId, domain, name, identity });
    }),

  updateMilitaryBranch: premiumMutationProcedure
    .input(z.object({ id: z.string().min(1), branch: branchUpdateSchema }))
    .mutation(async ({ ctx, input }) => {
      const branch = await loadWritableBranch(ctx, input.id);
      return ctx.db.militaryBranch.update({ where: { id: branch.id }, data: input.branch });
    }),

  // The branch's effort share across branches and its desired strength (null follows the budget).
  setBranchAllocation: premiumMutationProcedure
    .input(
      z.object({
        id: z.string().min(1),
        effortShare: z.number().finite().min(0).max(1).optional(),
        targetActive: headcount(FORCE_LIMITS.maxActiveDuty).nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const branch = await loadWritableBranch(ctx, input.id);
      return setBranchAllocation(ctx.db, {
        countryId: branch.countryId,
        branchId: branch.id,
        effortShare: input.effortShare,
        targetActive: input.targetActive,
      });
    }),

  // Hard delete: units, assets and orders cascade (the branch's capital is lost). Deployments keep their (now
  // dangling) unit ids as history, and achievement counts cannot be farmed with soft-deleted rows.
  deleteMilitaryBranch: premiumMutationProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const branch = await loadWritableBranch(ctx, input.id);
      return deleteBranch(ctx.db, { countryId: branch.countryId, branchId: branch.id });
    }),

  createMilitaryUnit: premiumMutationProcedure
    .input(z.object({ branchId: z.string().min(1), unit: militaryUnitInputSchema }))
    .mutation(async ({ ctx, input }) => {
      const branch = await loadWritableBranch(ctx, input.branchId);

      const existing = await ctx.db.militaryUnit.count({ where: { branchId: branch.id } });
      if (existing >= FORCE_LIMITS.maxUnitsPerBranch) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `A branch can have at most ${FORCE_LIMITS.maxUnitsPerBranch} units.`,
        });
      }
      await assertUnitsFit(
        ctx.db,
        branch.id,
        branch.activeDuty + branch.reserves,
        input.unit.personnel
      );

      return ctx.db.militaryUnit.create({ data: { branchId: branch.id, ...input.unit } });
    }),

  updateMilitaryUnit: premiumMutationProcedure
    .input(z.object({ id: z.string().min(1), unit: unitUpdateSchema }))
    .mutation(async ({ ctx, input }) => {
      const unit = await loadWritableUnit(ctx, input.id);

      if (input.unit.personnel !== undefined && input.unit.personnel > unit.personnel) {
        await assertUnitsFit(
          ctx.db,
          unit.branchId,
          unit.branch.activeDuty + unit.branch.reserves,
          input.unit.personnel,
          unit.id
        );
      }

      return ctx.db.militaryUnit.update({ where: { id: unit.id }, data: input.unit });
    }),

  deleteMilitaryUnit: premiumMutationProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const unit = await loadWritableUnit(ctx, input.id);
      await ctx.db.militaryUnit.delete({ where: { id: unit.id } });
      return { id: unit.id };
    }),

  // The starter force the nation's budget gives (the equilibrium the reset applies), for the confirm dialog.
  previewStarterForceStructure: premiumProcedure
    .input(z.object({ countryId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await assertCountryWriteAccess(ctx, input.countryId);
      return previewStarterForce(ctx.db, input.countryId);
    }),

  // A nation's forces exist from its first read (its starter force, once). After deleting every branch this adds
  // empty army, navy and air force branches that grow from the budget.
  seedStarterForceStructure: premiumMutationProcedure
    .input(z.object({ countryId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await assertCountryWriteAccess(ctx, input.countryId);
      return seedStarterBranches(ctx.db, input.countryId);
    }),
});
