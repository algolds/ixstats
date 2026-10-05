import { z } from "zod";
import type { Prisma, PrismaClient } from "@prisma/client";
import { createTRPCRouter, rateLimitedMutationProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import {
  detectGovernmentConflicts,
  syncGovernmentData,
  type ConflictWarning,
} from "~/server/services/builderIntegrationService";
import { GovernmentBuilderStateSchema } from "~/types/government";
import { notificationHooks } from "~/lib/notifications/hooks";
import { assertCountryWriteAccess } from "~/server/shared/country-authorization";

type GovernmentBuilderData = z.infer<typeof GovernmentBuilderStateSchema>;

/** Insert a government structure's departments (with parent links), budget allocations and revenue sources. */
async function writeGovernmentChildren(
  tx: Prisma.TransactionClient,
  governmentStructureId: string,
  data: GovernmentBuilderData
) {
  const departmentIdMap = new Map<number, string>();

  if (data.departments.length > 0) {
    // Prepare department data for batch insert
    const departmentData = data.departments.map((deptData) => ({
      governmentStructureId,
      name: deptData.name,
      shortName: deptData.shortName ?? null,
      category: deptData.category,
      description: deptData.description ?? null,
      minister: deptData.minister ?? null,
      ministerTitle: deptData.ministerTitle ?? "Minister",
      headquarters: deptData.headquarters ?? null,
      established: deptData.established ?? null,
      employeeCount: deptData.employeeCount ?? null,
      icon: deptData.icon ?? null,
      color: deptData.color ?? "#6366f1",
      priority: deptData.priority ?? 50,
      organizationalLevel: deptData.organizationalLevel ?? "Ministry",
      functions: deptData.functions ? JSON.stringify(deptData.functions) : null,
    }));

    // Batch create all departments (single INSERT)
    await tx.governmentDepartment.createMany({ data: departmentData });

    // Fetch created departments to build ID map (ordered by creation)
    const createdDepartments = await tx.governmentDepartment.findMany({
      where: { governmentStructureId },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    });

    // Build ID map by matching names (maintains order relationship)
    data.departments.forEach((deptData, index) => {
      const created = createdDepartments.find((d) => d.name === deptData.name);
      if (created) {
        departmentIdMap.set(index, created.id);
      }
    });

    // Update parent department relationships (parallelized where possible)
    const parentUpdates = data.departments
      .map((deptData, i) => {
        if (!deptData.parentDepartmentId) return null;
        const parentIndex = parseInt(deptData.parentDepartmentId);
        const parentId = departmentIdMap.get(parentIndex);
        const currentId = departmentIdMap.get(i);
        if (!parentId || !currentId) return null;
        return { id: currentId, parentDepartmentId: parentId };
      })
      .filter((u): u is { id: string; parentDepartmentId: string } => u !== null);

    if (parentUpdates.length > 0) {
      await Promise.all(
        parentUpdates.map(({ id, parentDepartmentId }) =>
          tx.governmentDepartment.update({
            where: { id },
            data: { parentDepartmentId },
          })
        )
      );
    }
  }

  const allocationData = data.budgetAllocations
    .map((allocation) => {
      const departmentIndex = parseInt(allocation.departmentId);
      const departmentId = departmentIdMap.get(departmentIndex);
      if (!departmentId) return null;
      return {
        governmentStructureId,
        departmentId,
        budgetYear: allocation.budgetYear,
        allocatedAmount: allocation.allocatedAmount,
        allocatedPercent: allocation.allocatedPercent,
        availableAmount: allocation.allocatedAmount,
        notes: allocation.notes ?? null,
      };
    })
    .filter((d): d is NonNullable<typeof d> => d !== null);

  if (allocationData.length > 0) {
    await tx.budgetAllocation.createMany({ data: allocationData });
  }

  if (data.revenueSources.length > 0) {
    const revenueData = data.revenueSources.map((revenueSource) => ({
      governmentStructureId,
      name: revenueSource.name,
      category: revenueSource.category,
      description: revenueSource.description ?? null,
      rate: revenueSource.rate ?? null,
      revenueAmount: revenueSource.revenueAmount,
      revenuePercent:
        data.structure.totalBudget > 0
          ? (revenueSource.revenueAmount / data.structure.totalBudget) * 100
          : 0,
      collectionMethod: revenueSource.collectionMethod ?? null,
      administeredBy: revenueSource.administeredBy ?? null,
    }));

    await tx.revenueSource.createMany({ data: revenueData });
  }
}

const lifecycleInput = z.object({
  countryId: z.string(),
  data: GovernmentBuilderStateSchema,
  skipConflictCheck: z.boolean().optional().default(false),
});

type LifecycleInput = z.infer<typeof lifecycleInput>;

const NOTIFICATION_NOUN = { created: "creation", updated: "update" } as const;

/** Syncing of dependent tables and the change notification shared by create and update. */
async function finishLifecycle(
  db: PrismaClient,
  { countryId, data }: LifecycleInput,
  verb: "created" | "updated",
  governmentStructure: unknown
) {
  const syncResult = await syncGovernmentData(db as any, countryId, data);

  try {
    await notificationHooks.onGovernmentStructureChange({
      countryId,
      changeType: "component_added",
      componentName: data.structure.governmentName,
      details: `Government structure ${verb} with ${data.departments.length} departments`,
    });
  } catch (error) {
    console.error(
      `[Government] Failed to send government structure ${NOTIFICATION_NOUN[verb]} notification:`,
      error
    );
  }

  return { governmentStructure, syncResult };
}

const detectWarnings = (db: PrismaClient, input: LifecycleInput): Promise<ConflictWarning[]> =>
  input.skipConflictCheck
    ? Promise.resolve([])
    : detectGovernmentConflicts(db as any, input.countryId, input.data);

export const governmentLifecycleRouter = createTRPCRouter({
  // Create complete government structure
  create: rateLimitedMutationProcedure.input(lifecycleInput).mutation(async ({ ctx, input }) => {
    const { countryId, data } = input;
    await assertCountryWriteAccess(ctx, countryId);

    const existing = await ctx.db.governmentStructure.findUnique({ where: { countryId } });
    if (existing) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Government structure already exists for this country. Use update instead.",
      });
    }

    const warnings = await detectWarnings(ctx.db, input);

    // Batched writes in one transaction (~5-10 DB round-trips instead of ~50)
    const result = await ctx.db.$transaction(async (tx) => {
      const governmentStructure = await tx.governmentStructure.create({
        data: { countryId, ...data.structure },
      });
      await writeGovernmentChildren(tx, governmentStructure.id, data);
      return governmentStructure;
    });

    return { ...(await finishLifecycle(ctx.db, input, "created", result)), warnings };
  }),

  // Update government structure
  update: rateLimitedMutationProcedure.input(lifecycleInput).mutation(async ({ ctx, input }) => {
    const { countryId, data } = input;
    await assertCountryWriteAccess(ctx, countryId);

    const warnings = await detectWarnings(ctx.db, input);

    const result = await ctx.db.$transaction(async (tx) => {
      const governmentStructure = await tx.governmentStructure.update({
        where: { countryId },
        data: data.structure,
      });

      // Replace the existing related data
      const where = { governmentStructureId: governmentStructure.id };
      await tx.budgetAllocation.deleteMany({ where });
      await tx.revenueSource.deleteMany({ where });
      await tx.governmentDepartment.deleteMany({ where });

      await writeGovernmentChildren(tx, governmentStructure.id, data);
      return governmentStructure;
    });

    return { ...(await finishLifecycle(ctx.db, input, "updated", result)), warnings };
  }),
});
