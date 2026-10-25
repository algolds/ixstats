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
import { findEffectiveBudgetYear } from "~/lib/government/budget-allocations";
import {
  allocationAt,
  initialTotalBudget,
  maintenanceByYear,
  nudgeShare,
} from "~/lib/government/budget-math";
import { currentBudgetYear } from "~/lib/government/budget-year";
import { MAINTENANCE_DEBIT_EFFECT } from "~/lib/policies/lifecycle";
import { inferFormId } from "~/server/shared/founding-snapshot";
import type { DepartmentCategory } from "~/types/government";

type Db = PrismaClient;

const round2 = (n: number) => Math.round(n * 100) / 100;

function notFound(message: string): never {
  throw new TRPCError({ code: "NOT_FOUND", message });
}

/** The budget year owner edits write to: the budget in effect, else the current year. */
async function editableBudgetYear(db: Db, countryId: string): Promise<number> {
  const current = currentBudgetYear();
  return (await findEffectiveBudgetYear(db, countryId, current)) ?? current;
}

/**
 * Give a nation the default departments of its government form, each with its share of a yearly
 * budget. Creates the structure when there is none; a structure with no departments gets the
 * departments. A structure that already has departments is left alone (CONFLICT). `revenue` is
 * the nation's yearly revenue as the Economy tabs show it; a new budget starts at it (capped, see
 * `initialTotalBudget`), so it does not open in deficit.
 */
export async function createGovernmentStructure(
  db: Db,
  countryId: string,
  revenue?: number | null
) {
  const [country, departmentCount] = await Promise.all([
    db.country.findUnique({
      where: { id: countryId },
      select: {
        name: true,
        createdAt: true,
        totalGovernmentSpending: true,
        currentTotalGdp: true,
        governmentComponents: { where: { isActive: true }, select: { componentType: true } },
        governmentStructure: { select: { id: true, totalBudget: true } },
      },
    }),
    db.governmentDepartment.count({ where: { governmentStructure: { countryId } } }),
  ]);
  if (!country) notFound("Country not found");
  if (departmentCount > 0) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "This nation already has a government structure",
    });
  }

  const formId = inferFormId(country.governmentComponents.map((c) => c.componentType));
  const existing = country.governmentStructure;
  const totalBudget =
    existing && existing.totalBudget > 0
      ? existing.totalBudget
      : initialTotalBudget(country, revenue);
  const budgetYear = currentBudgetYear();

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
  const budgetYear = await findEffectiveBudgetYear(db, input.countryId, currentBudgetYear());
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
