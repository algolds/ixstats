// src/server/api/routers/government.ts

import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import {
  detectGovernmentConflicts,
  syncGovernmentData,
  type ConflictWarning,
} from "~/server/services/builderIntegrationService";
import { GovernmentBuilderStateSchema } from "~/types/validation/government";
import { notificationHooks } from "~/lib/notification-hooks";

// Input validation schemas
// eslint-disable-next-line unused-imports/no-unused-vars
const governmentStructureInputSchema = z.object({
  governmentName: z.string().min(1, "Government name is required"),
  governmentType: z.enum([
    "Constitutional Monarchy",
    "Federal Republic",
    "Parliamentary Democracy",
    "Presidential Republic",
    "Federal Constitutional Republic",
    "Unitary State",
    "Federation",
    "Confederation",
    "Empire",
    "City-State",
    "Other",
  ]),
  headOfState: z.string().optional(),
  headOfGovernment: z.string().optional(),
  legislatureName: z.string().optional(),
  executiveName: z.string().optional(),
  judicialName: z.string().optional(),
  totalBudget: z.number().positive("Total budget must be positive"),
  fiscalYear: z.string().default("Calendar Year"),
  budgetCurrency: z.string().default("USD"),
});

// Base schema for government departments
const departmentBaseSchema = z.object({
  name: z.string().min(1, "Department name is required"),
  shortName: z.string().optional(),
  category: z.enum([
    "Defense",
    "Education",
    "Health",
    "Finance",
    "Foreign Affairs",
    "Interior",
    "Justice",
    "Transportation",
    "Agriculture",
    "Environment",
    "Labor",
    "Commerce",
    "Energy",
    "Communications",
    "Culture",
    "Science and Technology",
    "Social Services",
    "Housing",
    "Veterans Affairs",
    "Intelligence",
    "Emergency Management",
    "Other",
  ]),
  description: z.string().optional(),
  minister: z.string().optional(),
  ministerTitle: z.string().default("Minister"),
  headquarters: z.string().optional(),
  established: z.string().optional(),
  employeeCount: z.number().int().positive().optional(),
  icon: z.string().optional(),
  color: z.string().default("#6366f1"),
  priority: z.number().int().min(1).max(100).default(50),
  parentDepartmentId: z.string().optional(),
  organizationalLevel: z
    .enum(["Ministry", "Department", "Agency", "Bureau", "Office", "Commission"])
    .default("Ministry"),
  functions: z.array(z.string()).optional(),
  isActive: z.boolean().default(true),
});

// Create schema - all required fields with defaults
// eslint-disable-next-line unused-imports/no-unused-vars
const departmentCreateSchema = departmentBaseSchema;

// Update schema - all fields optional
// eslint-disable-next-line unused-imports/no-unused-vars
const departmentUpdateSchema = departmentBaseSchema.partial();

// eslint-disable-next-line unused-imports/no-unused-vars
const budgetAllocationInputSchema = z.object({
  departmentId: z.string().min(1),
  budgetYear: z.number().int().min(2020).max(2030),
  allocatedAmount: z.number().nonnegative(),
  allocatedPercent: z.number().min(0).max(100),
  notes: z.string().optional(),
});

// eslint-disable-next-line unused-imports/no-unused-vars
const subBudgetInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  amount: z.number().nonnegative(),
  percent: z.number().min(0).max(100),
  budgetType: z.enum(["Personnel", "Operations", "Capital", "Research", "Other"]),
  isRecurring: z.boolean().default(true),
  priority: z.enum(["Critical", "High", "Medium", "Low"]).default("Medium"),
});

// eslint-disable-next-line unused-imports/no-unused-vars
const revenueSourceInputSchema = z.object({
  name: z.string().min(1),
  category: z.enum(["Direct Tax", "Indirect Tax", "Non-Tax Revenue", "Fees and Fines", "Other"]),
  description: z.string().optional(),
  rate: z.number().min(0).max(100).optional(),
  revenueAmount: z.number().nonnegative(),
  collectionMethod: z.string().optional(),
  administeredBy: z.string().optional(),
});

// eslint-disable-next-line unused-imports/no-unused-vars
const governmentBuilderStateSchema = GovernmentBuilderStateSchema;

export const governmentLifecycleRouter = createTRPCRouter({
  // Create complete government structure
  create: protectedProcedure
    .input(
      z.object({
        countryId: z.string(),
        data: GovernmentBuilderStateSchema,
        skipConflictCheck: z.boolean().optional().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { countryId, data, skipConflictCheck } = input;

      // Check if government structure already exists
      const existing = await ctx.db.governmentStructure.findUnique({
        where: { countryId },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Government structure already exists for this country. Use update instead.",
        });
      }

      // Detect conflicts if not skipped
      let warnings: ConflictWarning[] = [];
      if (!skipConflictCheck) {
        warnings = await detectGovernmentConflicts(ctx.db as any, countryId, data);
      }

      // Create in transaction with batched operations for performance
      // Phase 1 optimization: Reduces ~50 DB round-trips to ~5-10
      const result = await ctx.db.$transaction(async (tx) => {
        // Create government structure
        const governmentStructure = await tx.governmentStructure.create({
          data: {
            countryId,
            ...data.structure,
          },
        });

        // ============================================================
        // BATCH DEPARTMENT CREATION (was N+1, now single insert + fetch)
        // ============================================================
        const departmentIdMap = new Map<number, string>();

        if (data.departments.length > 0) {
          // Prepare department data for batch insert
          const departmentData = data.departments.map((deptData) => ({
            governmentStructureId: governmentStructure.id,
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
            where: { governmentStructureId: governmentStructure.id },
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

        // ============================================================
        // BATCH BUDGET ALLOCATIONS (was N+1, now single createMany)
        // ============================================================
        const allocationData = data.budgetAllocations
          .map((allocation) => {
            const departmentIndex = parseInt(allocation.departmentId);
            const departmentId = departmentIdMap.get(departmentIndex);
            if (!departmentId) return null;
            return {
              governmentStructureId: governmentStructure.id,
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

        // ============================================================
        // BATCH REVENUE SOURCES (was N+1, now single createMany)
        // ============================================================
        if (data.revenueSources.length > 0) {
          const revenueData = data.revenueSources.map((revenueSource) => ({
            governmentStructureId: governmentStructure.id,
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

        return governmentStructure;
      });

      // Sync with other tables (Country, GovernmentBudget, etc.)
      const syncResult = await syncGovernmentData(ctx.db as any, countryId, data);

      // Notify about government structure creation
      try {
        await notificationHooks.onGovernmentStructureChange({
          countryId,
          changeType: "component_added",
          componentName: data.structure.governmentName,
          details: `Government structure created with ${data.departments.length} departments`,
        });
      } catch (error) {
        console.error(
          "[Government] Failed to send government structure creation notification:",
          error
        );
      }

      return {
        governmentStructure: result,
        syncResult,
        warnings,
      };
    }),

  // Update government structure
  update: protectedProcedure
    .input(
      z.object({
        countryId: z.string(),
        data: GovernmentBuilderStateSchema,
        skipConflictCheck: z.boolean().optional().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { countryId, data, skipConflictCheck } = input;

      // Detect conflicts if not skipped
      let warnings: ConflictWarning[] = [];
      if (!skipConflictCheck) {
        warnings = await detectGovernmentConflicts(ctx.db as any, countryId, data);
      }

      const result = await ctx.db.$transaction(async (tx) => {
        // Update government structure
        const governmentStructure = await tx.governmentStructure.update({
          where: { countryId },
          data: data.structure,
        });

        // Delete existing related data (batch deletes are already efficient)
        await tx.budgetAllocation.deleteMany({
          where: { governmentStructureId: governmentStructure.id },
        });
        await tx.revenueSource.deleteMany({
          where: { governmentStructureId: governmentStructure.id },
        });
        await tx.governmentDepartment.deleteMany({
          where: { governmentStructureId: governmentStructure.id },
        });

        // ============================================================
        // BATCH DEPARTMENT RECREATION (was N+1, now single insert + fetch)
        // ============================================================
        const departmentIdMap = new Map<number, string>();

        if (data.departments.length > 0) {
          // Prepare department data for batch insert
          const departmentData = data.departments.map((deptData) => ({
            governmentStructureId: governmentStructure.id,
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

          // Fetch created departments to build ID map
          const createdDepartments = await tx.governmentDepartment.findMany({
            where: { governmentStructureId: governmentStructure.id },
            orderBy: { createdAt: "asc" },
            select: { id: true, name: true },
          });

          // Build ID map by matching names
          data.departments.forEach((deptData, index) => {
            const created = createdDepartments.find((d) => d.name === deptData.name);
            if (created) {
              departmentIdMap.set(index, created.id);
            }
          });

          // Update parent relationships (parallelized)
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

        // ============================================================
        // BATCH BUDGET ALLOCATIONS (was N+1, now single createMany)
        // ============================================================
        const allocationData = data.budgetAllocations
          .map((allocation) => {
            const departmentIndex = parseInt(allocation.departmentId);
            const departmentId = departmentIdMap.get(departmentIndex);
            if (!departmentId) return null;
            return {
              governmentStructureId: governmentStructure.id,
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

        // ============================================================
        // BATCH REVENUE SOURCES (was N+1, now single createMany)
        // ============================================================
        if (data.revenueSources.length > 0) {
          const revenueData = data.revenueSources.map((revenueSource) => ({
            governmentStructureId: governmentStructure.id,
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

        return governmentStructure;
      });

      // Sync with other tables (Country, GovernmentBudget, etc.)
      const syncResult = await syncGovernmentData(ctx.db as any, countryId, data);

      // Notify about government structure update
      try {
        await notificationHooks.onGovernmentStructureChange({
          countryId,
          changeType: "component_added",
          componentName: data.structure.governmentName,
          details: `Government structure updated with ${data.departments.length} departments`,
        });
      } catch (error) {
        console.error(
          "[Government] Failed to send government structure update notification:",
          error
        );
      }

      return {
        governmentStructure: result,
        syncResult,
        warnings,
      };
    }),
});
