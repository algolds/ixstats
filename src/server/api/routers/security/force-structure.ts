/**
 * Force-structure authoring (MC-3, decision D2): country owners create, edit and delete their
 * military branches and units, or start from a force planned from their builder data. Restores
 * the CRUD plan 312 deleted, on today's conventions: premium + per-procedure rate limit, the
 * canonical country-write check (owner, acting user or privileged role) and bounded inputs.
 *
 * Strength (`~/lib/military/force-structure`) reads these rows, so PvNPC strikes and PvP
 * resolution reflect what the player authored.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@prisma/client";
import { createTRPCRouter, premiumProcedure, premiumMutationProcedure } from "~/server/api/trpc";
import {
  assertCountryResourceWriteAccess,
  assertCountryWriteAccess,
} from "~/server/shared/country-authorization";
import {
  BRANCH_TYPES,
  FORCE_LIMITS,
  builderDefenseSpending,
  planStarterForce,
  populationPersonnelCap,
} from "~/lib/military/force-structure";

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

const level = z.number().finite().min(0).max(100);
const headcount = (max: number) => z.number().int().min(0).max(max);

export const militaryBranchInputSchema = z.object({
  branchType: z.enum(BRANCH_TYPES),
  name: z.string().trim().min(1, "Branch name is required").max(100),
  motto: optionalText(200),
  description: optionalText(2000),
  established: optionalText(50),
  imageUrl: optionalImageUrl,
  activeDuty: headcount(FORCE_LIMITS.maxActiveDuty).default(0),
  reserves: headcount(FORCE_LIMITS.maxReserves).default(0),
  civilianStaff: headcount(FORCE_LIMITS.maxCivilianStaff).default(0),
  annualBudget: z.number().finite().min(0).max(FORCE_LIMITS.maxBudget).default(0),
  budgetPercent: level.default(0),
  readinessLevel: level.default(50),
  technologyLevel: level.default(50),
  trainingLevel: level.default(50),
  morale: level.default(50),
  deploymentCapacity: level.default(50),
  sustainmentCapacity: level.default(50),
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
  readiness: level.default(50),
  imageUrl: optionalImageUrl,
});

/** `.partial()` keeps zod defaults, which would reset omitted fields on update; strip them. */
const branchUpdateSchema = militaryBranchInputSchema
  .extend({
    activeDuty: headcount(FORCE_LIMITS.maxActiveDuty),
    reserves: headcount(FORCE_LIMITS.maxReserves),
    civilianStaff: headcount(FORCE_LIMITS.maxCivilianStaff),
    annualBudget: z.number().finite().min(0).max(FORCE_LIMITS.maxBudget),
    budgetPercent: level,
    readinessLevel: level,
    technologyLevel: level,
    trainingLevel: level,
    morale: level,
    deploymentCapacity: level,
    sustainmentCapacity: level,
  })
  .partial();

const unitUpdateSchema = militaryUnitInputSchema
  .extend({ personnel: headcount(FORCE_LIMITS.maxUnitPersonnel), readiness: level })
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

/** Active duty plus reserves across the nation's active branches may not pass 25% of population. */
async function assertWithinPopulation(
  db: Db,
  countryId: string,
  personnel: number,
  excludeBranchId?: string
) {
  const [country, others] = await Promise.all([
    db.country.findUnique({ where: { id: countryId }, select: { currentPopulation: true } }),
    db.militaryBranch.aggregate({
      where: {
        countryId,
        isActive: true,
        ...(excludeBranchId ? { id: { not: excludeBranchId } } : {}),
      },
      _sum: { activeDuty: true, reserves: true },
    }),
  ]);
  const cap = populationPersonnelCap(country?.currentPopulation);
  if (cap === null) return;
  const total = (others._sum.activeDuty ?? 0) + (others._sum.reserves ?? 0) + personnel;
  if (total > cap) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Active duty plus reserves across all branches (${fmt(total)}) cannot exceed 25% of the population (${fmt(cap)}).`,
    });
  }
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
      message: `Units would hold ${fmt(total)} personnel but the branch has ${fmt(branchPersonnel)} active duty and reserves. Raise the branch's personnel first.`,
    });
  }
}

// ===========================
// Router
// ===========================

export const securityForceStructureRouter = createTRPCRouter({
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
      await assertWithinPopulation(
        ctx.db,
        input.countryId,
        input.branch.activeDuty + input.branch.reserves
      );

      return ctx.db.militaryBranch.create({
        data: { countryId: input.countryId, ...input.branch },
      });
    }),

  updateMilitaryBranch: premiumMutationProcedure
    .input(z.object({ id: z.string().min(1), branch: branchUpdateSchema }))
    .mutation(async ({ ctx, input }) => {
      const branch = await loadWritableBranch(ctx, input.id);

      const { activeDuty, reserves } = input.branch;
      if (activeDuty !== undefined || reserves !== undefined) {
        const personnel = (activeDuty ?? branch.activeDuty) + (reserves ?? branch.reserves);
        await assertUnitsFit(ctx.db, branch.id, personnel, 0);
        if (branch.isActive) {
          await assertWithinPopulation(ctx.db, branch.countryId, personnel, branch.id);
        }
      }

      return ctx.db.militaryBranch.update({ where: { id: branch.id }, data: input.branch });
    }),

  // Hard delete: units and assets cascade. Deployments keep their (now dangling) unit ids as
  // history, and achievement counts cannot be farmed with soft-deleted rows.
  deleteMilitaryBranch: premiumMutationProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const branch = await loadWritableBranch(ctx, input.id);
      await ctx.db.militaryBranch.delete({ where: { id: branch.id } });
      return { id: branch.id };
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

  // The starter force a nation with no branches would get, for the confirm dialog.
  previewStarterForceStructure: premiumProcedure
    .input(z.object({ countryId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await assertCountryWriteAccess(ctx, input.countryId);
      return loadStarterPlan(ctx.db, input.countryId);
    }),

  // Create army, navy and air force sized from population and the builder's Defense spending.
  // Only for a nation with no active branches, so it never duplicates authored structure.
  seedStarterForceStructure: premiumMutationProcedure
    .input(z.object({ countryId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await assertCountryWriteAccess(ctx, input.countryId);

      const existing = await ctx.db.militaryBranch.count({
        where: { countryId: input.countryId, isActive: true },
      });
      if (existing > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This nation already has military branches.",
        });
      }

      const plan = await loadStarterPlan(ctx.db, input.countryId);
      await ctx.db.militaryBranch.createMany({
        data: plan.branches.map((b) => ({ countryId: input.countryId, ...b })),
      });
      return { created: plan.branches.length, budgetSource: plan.budgetSource };
    }),
});

async function loadStarterPlan(db: Db, countryId: string) {
  const [country, governmentBudget, defenseBudget] = await Promise.all([
    db.country.findUnique({
      where: { id: countryId },
      select: { currentPopulation: true, currentTotalGdp: true },
    }),
    db.governmentBudget.findUnique({
      where: { countryId },
      select: { spendingCategories: true },
    }),
    db.defenseBudget.findUnique({ where: { countryId }, select: { totalBudget: true } }),
  ]);
  if (!country) throw new TRPCError({ code: "NOT_FOUND", message: "Country not found" });
  return planStarterForce({
    population: country.currentPopulation,
    totalGdp: country.currentTotalGdp,
    builderDefenseSpending: builderDefenseSpending(governmentBudget?.spendingCategories),
    defenseBudgetTotal: defenseBudget?.totalBudget,
  });
}
