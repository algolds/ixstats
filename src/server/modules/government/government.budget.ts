/**
 * The owner's National budget edits (owner decision 1): create a government structure for a nation
 * that has none, add and remove departments, and set a department's share of the budget in effect.
 * Callers check write access to the country first; every department id is checked against it here.
 *
 * Amounts always follow shares (`allocationAt`). An owner edit stamps `lastReviewed`, which is what
 * the "Review your budget" first step reads; generated rows keep the nation's founding time there.
 */
import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@prisma/client";
import { departmentsForForm, governmentTypeForForm } from "~/lib/government/form-departments";
import { countryBudgetYear, findEffectiveBudgetYear } from "~/lib/government/budget-allocations";
import {
  allocationAt,
  allocationOverCap,
  initialTotalBudget,
  maintenanceByYear,
  nudgeShare,
  sharesForDepartments,
} from "~/lib/government/budget-math";
import { MAINTENANCE_DEBIT_EFFECT } from "~/lib/policies/lifecycle";
import { inferFormId } from "~/server/shared/founding-snapshot";
// Pure, client-safe: the one revenue figure every Economy tab shows (saved rates x live GDP, else founding).
import { nationalRevenue } from "~/components/mycountry/shell/fiscal/nationalRevenue";
import type { DepartmentCategory } from "~/types/government";

type Db = PrismaClient;

const round2 = (n: number) => Math.round(n * 100) / 100;

function notFound(message: string): never {
  throw new TRPCError({ code: "NOT_FOUND", message });
}

/** The budget year owner edits write to: the budget in effect, else the current year (on the nation's clock). */
async function editableBudgetYear(db: Db, countryId: string): Promise<number> {
  const current = await countryBudgetYear(db, countryId);
  return (await findEffectiveBudgetYear(db, countryId, current)) ?? current;
}

/**
 * Give a nation the default departments of its government form, each with its share of a yearly
 * budget. Creates the structure when there is none; a structure with no departments gets the
 * departments. A structure that already has departments is left alone (CONFLICT), unless it never
 * had a budget (no total, no allocations): its departments get one, split by the form's shares. A new budget
 * starts at the nation's yearly revenue as the Economy tabs show it (`nationalRevenue`, read here, never sent by
 * the client; capped, see `initialTotalBudget`), so it does not open in deficit.
 */
export async function createGovernmentStructure(db: Db, countryId: string) {
  const [country, departments, allocationCount] = await Promise.all([
    db.country.findUnique({
      where: { id: countryId },
      select: {
        name: true,
        createdAt: true,
        totalGovernmentSpending: true,
        currentTotalGdp: true,
        governmentRevenueTotal: true,
        economicProfile: true,
        fiscalSystem: true,
        governmentComponents: { where: { isActive: true }, select: { componentType: true } },
        governmentStructure: { select: { id: true, totalBudget: true } },
      },
    }),
    db.governmentDepartment.findMany({
      where: { governmentStructure: { countryId } },
      select: { id: true, category: true },
      orderBy: { priority: "desc" },
    }),
    db.budgetAllocation.count({ where: { governmentStructure: { countryId } } }),
  ]);
  if (!country) notFound("Country not found");
  const existing = country.governmentStructure;
  // Departments with no budget at all (older builders wrote departments without one) get one below.
  const budgetless = !existing || (existing.totalBudget <= 0 && allocationCount === 0);
  if (departments.length > 0 && !budgetless) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "This nation already has a government structure",
    });
  }

  const formId = inferFormId(country.governmentComponents.map((c) => c.componentType));
  const totalBudget =
    existing && existing.totalBudget > 0
      ? existing.totalBudget
      : initialTotalBudget(country, nationalRevenue(country).total);
  const budgetYear = await countryBudgetYear(db, countryId);
  if (existing && departments.length > 0) {
    return budgetExistingDepartments(db, {
      structureId: existing.id,
      countryId,
      departments,
      totalBudget,
      budgetYear,
      formId,
      reviewedAt: country.createdAt,
    });
  }

  return db.$transaction(async (tx) => {
    const structure = existing
      ? await tx.governmentStructure.update({ where: { countryId }, data: { totalBudget } })
      : await tx.governmentStructure.create({
          data: {
            countryId,
            governmentName: `Government of ${country.name}`,
            governmentType: governmentTypeForForm(formId) ?? "Parliamentary Republic",
            totalBudget,
          },
        });
    const departments = departmentsForForm(formId);
    for (const dept of departments) {
      const created = await tx.governmentDepartment.create({
        data: {
          governmentStructureId: structure.id,
          name: dept.name,
          shortName: dept.shortName,
          category: dept.category,
          ministerTitle: dept.ministerTitle,
          priority: dept.priority,
        },
      });
      const figures = allocationAt(totalBudget, round2(dept.spendingShare * 100));
      await tx.budgetAllocation.create({
        data: {
          governmentStructureId: structure.id,
          departmentId: created.id,
          budgetYear,
          ...figures,
          availableAmount: figures.allocatedAmount,
          // Generated, not yet reviewed by the owner.
          lastReviewed: country.createdAt,
        },
      });
    }
    return { structureId: structure.id, departments: departments.length };
  });
}

/** A budget for a government's existing departments: `totalBudget`, split by its form's default shares. */
async function budgetExistingDepartments(
  db: Db,
  input: {
    structureId: string;
    countryId: string;
    departments: { id: string; category: string }[];
    totalBudget: number;
    budgetYear: number;
    formId: string;
    reviewedAt: Date;
  }
) {
  const defaults = new Map(
    departmentsForForm(input.formId).map((d) => [d.category, d.spendingShare])
  );
  const shares = sharesForDepartments(
    input.departments.map((d) => d.category),
    defaults
  );
  await db.$transaction(async (tx) => {
    await tx.governmentStructure.update({
      where: { countryId: input.countryId },
      data: { totalBudget: input.totalBudget },
    });
    for (const [i, dept] of input.departments.entries()) {
      const figures = allocationAt(input.totalBudget, round2(shares[i]!));
      await tx.budgetAllocation.create({
        data: {
          governmentStructureId: input.structureId,
          departmentId: dept.id,
          budgetYear: input.budgetYear,
          ...figures,
          availableAmount: figures.allocatedAmount,
          lastReviewed: input.reviewedAt,
        },
      });
    }
  });
  return { structureId: input.structureId, departments: input.departments.length };
}

/** The department, when it belongs to the country's government. */
async function ownDepartment(db: Db, countryId: string, departmentId: string) {
  const department = await db.governmentDepartment.findFirst({
    where: { id: departmentId, governmentStructure: { countryId } },
    select: {
      id: true,
      governmentStructureId: true,
      governmentStructure: { select: { totalBudget: true } },
    },
  });
  return department ?? notFound("Department not found");
}

/** Set a department's share of the budget in effect; its amount follows. */
export async function setDepartmentAllocation(
  db: Db,
  input: { countryId: string; departmentId: string; allocatedPercent: number }
) {
  const department = await ownDepartment(db, input.countryId, input.departmentId);
  const budgetYear = await editableBudgetYear(db, input.countryId);
  const figures = allocationAt(department.governmentStructure.totalBudget, input.allocatedPercent);
  const lines = await db.budgetAllocation.findMany({
    where: { governmentStructureId: department.governmentStructureId, budgetYear },
    select: { departmentId: true, allocatedPercent: true },
  });
  const problem = allocationOverCap({
    current: lines.find((l) => l.departmentId === department.id)?.allocatedPercent ?? 0,
    next: figures.allocatedPercent,
    othersTotal: lines
      .filter((l) => l.departmentId !== department.id)
      .reduce((sum, l) => sum + l.allocatedPercent, 0),
  });
  if (problem) throw new TRPCError({ code: "BAD_REQUEST", message: problem });
  const values = { ...figures, availableAmount: figures.allocatedAmount, lastReviewed: new Date() };
  return db.budgetAllocation.upsert({
    where: { departmentId_budgetYear: { departmentId: department.id, budgetYear } },
    create: {
      governmentStructureId: department.governmentStructureId,
      departmentId: department.id,
      budgetYear,
      ...values,
    },
    update: values,
  });
}

/**
 * A directive's budget line (directives still nudge allocations, owner decision 1): move the
 * largest line of `category` in the budget in effect by `deltaPercent` (to at most `max`). When
 * that would allocate more than 100%, the other departments give up the excess in proportion to
 * their shares (`nudgeShare`). Amounts follow shares. No-op without a line of that category.
 */
export async function nudgeDepartmentShare(
  db: Db,
  input: { countryId: string; category: string; deltaPercent: number; max: number }
) {
  const budgetYear = await findEffectiveBudgetYear(
    db,
    input.countryId,
    await countryBudgetYear(db, input.countryId)
  );
  if (budgetYear === null) return;
  const lines = await db.budgetAllocation.findMany({
    where: { governmentStructure: { countryId: input.countryId }, budgetYear },
    select: {
      id: true,
      allocatedPercent: true,
      department: { select: { category: true } },
      governmentStructure: { select: { totalBudget: true } },
    },
    orderBy: { allocatedPercent: "desc" },
  });
  const target = lines.find((line) => line.department.category === input.category);
  if (!target) return;
  const totalBudget = target.governmentStructure.totalBudget;
  const moved = nudgeShare(lines, target.id, input.deltaPercent, input.max).filter(
    (line, i) => line.allocatedPercent !== lines[i]!.allocatedPercent
  );
  await db.$transaction(async (tx) => {
    for (const line of moved) {
      await tx.budgetAllocation.update({
        where: { id: line.id },
        data: allocationAt(totalBudget, line.allocatedPercent),
      });
    }
  });
}

/** Add a department with no allocation yet. */
export async function addDepartment(
  db: Db,
  input: { countryId: string; name: string; category: DepartmentCategory }
) {
  const structure = await db.governmentStructure.findUnique({
    where: { countryId: input.countryId },
    select: { id: true },
  });
  if (!structure) notFound("Create a government structure first");
  return db.governmentDepartment.create({
    data: { governmentStructureId: structure.id, name: input.name, category: input.category },
  });
}

/** Remove a department, with its allocations and officials (cascade). */
export async function removeDepartment(db: Db, input: { countryId: string; departmentId: string }) {
  const department = await ownDepartment(db, input.countryId, input.departmentId);
  await db.governmentDepartment.delete({ where: { id: department.id } });
  return { removed: department.id };
}

/** Policy maintenance spent per budget year (spending within the year, see lib/policies/lifecycle). */
export async function loadPolicyMaintenance(db: Db, countryId: string) {
  const rows = await db.policyEffectLog.findMany({
    where: { policy: { countryId }, effectType: MAINTENANCE_DEBIT_EFFECT },
    select: { notes: true, actualEffect: true },
  });
  return maintenanceByYear(rows);
}
