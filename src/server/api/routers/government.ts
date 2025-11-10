// src/server/api/routers/government.ts

import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { COMPONENT_TYPE_VALUES } from "~/types/government";
import {
  detectGovernmentConflicts,
  syncGovernmentData,
  type ConflictWarning,
} from "~/server/services/builderIntegrationService";
import { GovernmentBuilderStateSchema } from "~/types/validation/government";
import { notificationAPI } from "~/lib/notification-api";
import { notificationHooks } from "~/lib/notification-hooks";

// Input validation schemas
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
const departmentCreateSchema = departmentBaseSchema;

// Update schema - all fields optional
const departmentUpdateSchema = departmentBaseSchema.partial();

const budgetAllocationInputSchema = z.object({
  departmentId: z.string().min(1),
  budgetYear: z.number().int().min(2020).max(2030),
  allocatedAmount: z.number().nonnegative(),
  allocatedPercent: z.number().min(0).max(100),
  notes: z.string().optional(),
});

const subBudgetInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  amount: z.number().nonnegative(),
  percent: z.number().min(0).max(100),
  budgetType: z.enum(["Personnel", "Operations", "Capital", "Research", "Other"]),
  isRecurring: z.boolean().default(true),
  priority: z.enum(["Critical", "High", "Medium", "Low"]).default("Medium"),
});

const revenueSourceInputSchema = z.object({
  name: z.string().min(1),
  category: z.enum(["Direct Tax", "Indirect Tax", "Non-Tax Revenue", "Fees and Fines", "Other"]),
  description: z.string().optional(),
  rate: z.number().min(0).max(100).optional(),
  revenueAmount: z.number().nonnegative(),
  collectionMethod: z.string().optional(),
  administeredBy: z.string().optional(),
});

const governmentBuilderStateSchema = GovernmentBuilderStateSchema;

export const governmentRouter = createTRPCRouter({
  // Get government structure by country ID
  getByCountryId: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const governmentStructure = await ctx.db.governmentStructure.findUnique({
        where: { countryId: input.countryId },
        include: {
          departments: {
            include: {
              subDepartments: true,
              budgetAllocations: {
                orderBy: { budgetYear: "desc" },
              },
              subBudgets: true,
            },
            orderBy: { priority: "desc" },
          },
          budgetAllocations: {
            include: { department: true },
            orderBy: { budgetYear: "desc" },
          },
          revenueSources: {
            where: { isActive: true },
            orderBy: { revenueAmount: "desc" },
          },
        },
      });

      if (!governmentStructure) {
        return null;
      }

      return governmentStructure;
    }),

  // Check for conflicts before creating/updating
  checkConflicts: protectedProcedure
    .input(
      z.object({
        countryId: z.string(),
        data: GovernmentBuilderStateSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const warnings = await detectGovernmentConflicts(ctx.db, input.countryId, input.data);
      return { warnings };
    }),

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
        warnings = await detectGovernmentConflicts(ctx.db, countryId, data);
      }

      // Create in transaction
      const result = await ctx.db.$transaction(async (tx) => {
        // Create government structure
        const governmentStructure = await tx.governmentStructure.create({
          data: {
            countryId,
            ...data.structure,
          },
        });

        // Create departments
        const departmentIdMap = new Map<number, string>();
        const departments = [];

        for (let i = 0; i < data.departments.length; i++) {
          const deptData = data.departments[i]!;
          const department = await tx.governmentDepartment.create({
            data: {
              governmentStructureId: governmentStructure.id,
              name: deptData.name,
              shortName: deptData.shortName,
              category: deptData.category,
              description: deptData.description,
              minister: deptData.minister,
              ministerTitle: deptData.ministerTitle,
              headquarters: deptData.headquarters,
              established: deptData.established,
              employeeCount: deptData.employeeCount,
              icon: deptData.icon,
              color: deptData.color,
              priority: deptData.priority,
              organizationalLevel: deptData.organizationalLevel,
              functions: deptData.functions ? JSON.stringify(deptData.functions) : null,
            },
          });

          departmentIdMap.set(i, department.id);
          departments.push(department);
        }

        // Update parent department relationships
        for (let i = 0; i < data.departments.length; i++) {
          const deptData = data.departments[i]!;
          if (deptData.parentDepartmentId) {
            const parentIndex = parseInt(deptData.parentDepartmentId);
            const parentId = departmentIdMap.get(parentIndex);
            const currentId = departmentIdMap.get(i);

            if (parentId && currentId) {
              await tx.governmentDepartment.update({
                where: { id: currentId },
                data: { parentDepartmentId: parentId },
              });
            }
          }
        }

        // Create budget allocations
        for (const allocation of data.budgetAllocations) {
          const departmentIndex = parseInt(allocation.departmentId);
          const departmentId = departmentIdMap.get(departmentIndex);

          if (departmentId) {
            await tx.budgetAllocation.create({
              data: {
                governmentStructureId: governmentStructure.id,
                departmentId,
                budgetYear: allocation.budgetYear,
                allocatedAmount: allocation.allocatedAmount,
                allocatedPercent: allocation.allocatedPercent,
                availableAmount: allocation.allocatedAmount, // Initially all available
                notes: allocation.notes,
              },
            });
          }
        }

        // Create revenue sources
        for (const revenueSource of data.revenueSources) {
          await tx.revenueSource.create({
            data: {
              governmentStructureId: governmentStructure.id,
              name: revenueSource.name,
              category: revenueSource.category,
              description: revenueSource.description,
              rate: revenueSource.rate,
              revenueAmount: revenueSource.revenueAmount,
              revenuePercent:
                data.structure.totalBudget > 0
                  ? (revenueSource.revenueAmount / data.structure.totalBudget) * 100
                  : 0,
              collectionMethod: revenueSource.collectionMethod,
              administeredBy: revenueSource.administeredBy,
            },
          });
        }

        return governmentStructure;
      });

      // Sync with other tables (Country, GovernmentBudget, etc.)
      const syncResult = await syncGovernmentData(ctx.db, countryId, data);

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
        warnings = await detectGovernmentConflicts(ctx.db, countryId, data);
      }

      const result = await ctx.db.$transaction(async (tx) => {
        // Update government structure
        const governmentStructure = await tx.governmentStructure.update({
          where: { countryId },
          data: data.structure,
        });

        // Delete existing related data
        await tx.budgetAllocation.deleteMany({
          where: { governmentStructureId: governmentStructure.id },
        });
        await tx.revenueSource.deleteMany({
          where: { governmentStructureId: governmentStructure.id },
        });
        await tx.governmentDepartment.deleteMany({
          where: { governmentStructureId: governmentStructure.id },
        });

        // Recreate departments and related data (same logic as create)
        const departmentIdMap = new Map<number, string>();

        for (let i = 0; i < data.departments.length; i++) {
          const deptData = data.departments[i]!;
          const department = await tx.governmentDepartment.create({
            data: {
              governmentStructureId: governmentStructure.id,
              name: deptData.name,
              shortName: deptData.shortName,
              category: deptData.category,
              description: deptData.description,
              minister: deptData.minister,
              ministerTitle: deptData.ministerTitle,
              headquarters: deptData.headquarters,
              established: deptData.established,
              employeeCount: deptData.employeeCount,
              icon: deptData.icon,
              color: deptData.color,
              priority: deptData.priority,
              organizationalLevel: deptData.organizationalLevel,
              functions: deptData.functions ? JSON.stringify(deptData.functions) : null,
            },
          });

          departmentIdMap.set(i, department.id);
        }

        // Update parent relationships
        for (let i = 0; i < data.departments.length; i++) {
          const deptData = data.departments[i]!;
          if (deptData.parentDepartmentId) {
            const parentIndex = parseInt(deptData.parentDepartmentId);
            const parentId = departmentIdMap.get(parentIndex);
            const currentId = departmentIdMap.get(i);

            if (parentId && currentId) {
              await tx.governmentDepartment.update({
                where: { id: currentId },
                data: { parentDepartmentId: parentId },
              });
            }
          }
        }

        // Recreate budget allocations
        for (const allocation of data.budgetAllocations) {
          const departmentIndex = parseInt(allocation.departmentId);
          const departmentId = departmentIdMap.get(departmentIndex);

          if (departmentId) {
            await tx.budgetAllocation.create({
              data: {
                governmentStructureId: governmentStructure.id,
                departmentId,
                budgetYear: allocation.budgetYear,
                allocatedAmount: allocation.allocatedAmount,
                allocatedPercent: allocation.allocatedPercent,
                availableAmount: allocation.allocatedAmount,
                notes: allocation.notes,
              },
            });
          }
        }

        // Recreate revenue sources
        for (const revenueSource of data.revenueSources) {
          await tx.revenueSource.create({
            data: {
              governmentStructureId: governmentStructure.id,
              name: revenueSource.name,
              category: revenueSource.category,
              description: revenueSource.description,
              rate: revenueSource.rate,
              revenueAmount: revenueSource.revenueAmount,
              revenuePercent:
                data.structure.totalBudget > 0
                  ? (revenueSource.revenueAmount / data.structure.totalBudget) * 100
                  : 0,
              collectionMethod: revenueSource.collectionMethod,
              administeredBy: revenueSource.administeredBy,
            },
          });
        }

        return governmentStructure;
      });

      // Sync with other tables (Country, GovernmentBudget, etc.)
      const syncResult = await syncGovernmentData(ctx.db, countryId, data);

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

  // Delete government structure
  delete: protectedProcedure
    .input(z.object({ countryId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await ctx.db.governmentStructure.delete({
        where: { countryId: input.countryId },
      });

      return { success: true, id: deleted.id };
    }),

  // Get budget summary
  getBudgetSummary: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
        budgetYear: z.number().int().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const currentYear = input.budgetYear || new Date().getFullYear();

      const governmentStructure = await ctx.db.governmentStructure.findUnique({
        where: { countryId: input.countryId },
        include: {
          departments: {
            include: {
              budgetAllocations: {
                where: { budgetYear: currentYear },
              },
            },
          },
          budgetAllocations: {
            where: { budgetYear: currentYear },
            include: { department: true },
          },
        },
      });

      if (!governmentStructure) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Government structure not found",
        });
      }

      const totalAllocated = governmentStructure.budgetAllocations.reduce(
        (sum, a) => sum + a.allocatedAmount,
        0
      );
      const totalSpent = governmentStructure.budgetAllocations.reduce(
        (sum, a) => sum + a.spentAmount,
        0
      );
      const totalAvailable = totalAllocated - totalSpent;
      const utilizationRate = totalAllocated > 0 ? (totalSpent / totalAllocated) * 100 : 0;

      const topSpendingDepartments = governmentStructure.budgetAllocations
        .map((allocation) => ({
          department: allocation.department,
          allocation,
        }))
        .sort((a, b) => b.allocation.allocatedAmount - a.allocation.allocatedAmount)
        .slice(0, 5);

      return {
        totalBudget: governmentStructure.totalBudget,
        totalAllocated,
        totalSpent,
        totalAvailable,
        utilizationRate,
        departmentCount: governmentStructure.departments.length,
        topSpendingDepartments,
      };
    }),

  // Get revenue summary
  getRevenueSummary: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const revenueSources = await ctx.db.revenueSource.findMany({
        where: {
          governmentStructure: { countryId: input.countryId },
          isActive: true,
        },
        orderBy: { revenueAmount: "desc" },
      });

      const totalRevenue = revenueSources.reduce((sum, r) => sum + r.revenueAmount, 0);
      const totalTaxRevenue = revenueSources
        .filter((r) => r.category.includes("Tax"))
        .reduce((sum, r) => sum + r.revenueAmount, 0);
      const totalNonTaxRevenue = totalRevenue - totalTaxRevenue;

      const revenueCategories = [
        "Direct Tax",
        "Indirect Tax",
        "Non-Tax Revenue",
        "Fees and Fines",
        "Other",
      ] as const;
      const revenueBreakdown = revenueCategories
        .map((category) => {
          const amount = revenueSources
            .filter((r) => r.category === category)
            .reduce((sum, r) => sum + r.revenueAmount, 0);
          return {
            category,
            amount,
            percent: totalRevenue > 0 ? (amount / totalRevenue) * 100 : 0,
          };
        })
        .filter((item) => item.amount > 0);

      const topRevenueSources = revenueSources.slice(0, 5);

      return {
        totalRevenue,
        totalTaxRevenue,
        totalNonTaxRevenue,
        revenueBreakdown,
        topRevenueSources,
      };
    }),

  // Update budget allocation
  updateBudgetAllocation: protectedProcedure
    .input(
      z.object({
        allocationId: z.string(),
        data: z.object({
          allocatedAmount: z.number().nonnegative().optional(),
          allocatedPercent: z.number().min(0).max(100).optional(),
          spentAmount: z.number().nonnegative().optional(),
          encumberedAmount: z.number().nonnegative().optional(),
          notes: z.string().optional(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const updated = await ctx.db.budgetAllocation.update({
        where: { id: input.allocationId },
        data: {
          ...input.data,
          availableAmount:
            input.data.allocatedAmount !== undefined
              ? input.data.allocatedAmount -
                (input.data.spentAmount || 0) -
                (input.data.encumberedAmount || 0)
              : undefined,
          lastReviewed: new Date(),
        },
        include: {
          department: {
            include: {
              governmentStructure: true,
            },
          },
        },
      });

      // 🔔 Check for budget overspending and notify
      try {
        const allocated = updated.allocatedAmount || 0;
        const spent = updated.spentAmount || 0;
        const utilizationRate = allocated > 0 ? (spent / allocated) * 100 : 0;

        if (utilizationRate > 90 && utilizationRate <= 100) {
          // Warning: nearing budget limit
          await notificationAPI.create({
            title: "⚠️ Budget Alert",
            message: `${updated.department.name} has used ${utilizationRate.toFixed(1)}% of allocated budget`,
            countryId: updated.department.governmentStructure.countryId,
            category: "economic",
            priority: "medium",
            type: "warning",
            href: "/mycountry/government/budget",
            source: "budget-system",
            actionable: true,
            metadata: { departmentId: updated.departmentId, utilizationRate },
          });
        } else if (utilizationRate > 100) {
          // Critical: budget overspent
          await notificationAPI.create({
            title: "🚨 Budget Overspent!",
            message: `${updated.department.name} has exceeded allocated budget by ${(utilizationRate - 100).toFixed(1)}%`,
            countryId: updated.department.governmentStructure.countryId,
            category: "economic",
            priority: "high",
            type: "error",
            href: "/mycountry/government/budget",
            source: "budget-system",
            actionable: true,
            metadata: { departmentId: updated.departmentId, utilizationRate },
          });
        }
      } catch (error) {
        console.error("[Government] Failed to send budget alert notification:", error);
      }

      return updated;
    }),

  // Add sub-budget categories
  addSubBudget: protectedProcedure
    .input(
      z.object({
        departmentId: z.string(),
        data: subBudgetInputSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const subBudget = await ctx.db.subBudgetCategory.create({
        data: {
          departmentId: input.departmentId,
          ...input.data,
        },
      });

      return subBudget;
    }),

  // Get department hierarchy
  getDepartmentHierarchy: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const governmentStructure = await ctx.db.governmentStructure.findUnique({
        where: { countryId: input.countryId },
        include: {
          departments: {
            include: {
              subDepartments: {
                include: {
                  subDepartments: true, // Get nested departments
                  budgetAllocations: true,
                },
              },
              budgetAllocations: true,
            },
            where: { parentDepartmentId: null }, // Only top-level departments
            orderBy: { priority: "desc" },
          },
        },
      });

      if (!governmentStructure) {
        return [];
      }

      // Build hierarchy recursively
      const buildHierarchy = (department: any): any => {
        const totalBudget = department.budgetAllocations.reduce(
          (sum: number, a: any) => sum + a.allocatedAmount,
          0
        );
        const totalEmployees =
          (department.employeeCount || 0) +
          department.subDepartments.reduce(
            (sum: number, sub: any) => sum + (sub.employeeCount || 0),
            0
          );

        return {
          department,
          children: department.subDepartments.map(buildHierarchy),
          totalBudget,
          totalEmployees,
        };
      };

      return governmentStructure.departments.map(buildHierarchy);
    }),

  // Autosave government structure (partial updates)
  autosave: protectedProcedure
    .input(
      z.object({
        countryId: z.string(),
        data: z.object({
          governmentName: z.string().optional(),
          governmentType: z.string().optional(),
          headOfState: z.string().optional(),
          headOfGovernment: z.string().optional(),
          legislatureName: z.string().optional(),
          executiveName: z.string().optional(),
          judicialName: z.string().optional(),
          totalBudget: z.number().optional(),
          fiscalYear: z.string().optional(),
          budgetCurrency: z.string().optional(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { countryId, data } = input;

      // Verify user owns the country
      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
      });

      if (!userProfile || userProfile.countryId !== countryId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have permission to edit this country.",
        });
      }

      try {
        // Upsert government structure with partial data
        const governmentStructure = await ctx.db.governmentStructure.upsert({
          where: { countryId },
          create: {
            countryId,
            governmentName: data.governmentName || "National Government",
            governmentType: data.governmentType || "Federal Republic",
            headOfState: data.headOfState,
            headOfGovernment: data.headOfGovernment,
            legislatureName: data.legislatureName,
            executiveName: data.executiveName,
            judicialName: data.judicialName,
            totalBudget: data.totalBudget || 0,
            fiscalYear: data.fiscalYear || "Calendar Year",
            budgetCurrency: data.budgetCurrency || "USD",
          },
          update: {
            ...(data.governmentName && { governmentName: data.governmentName }),
            ...(data.governmentType && { governmentType: data.governmentType }),
            ...(data.headOfState !== undefined && { headOfState: data.headOfState }),
            ...(data.headOfGovernment !== undefined && { headOfGovernment: data.headOfGovernment }),
            ...(data.legislatureName !== undefined && { legislatureName: data.legislatureName }),
            ...(data.executiveName !== undefined && { executiveName: data.executiveName }),
            ...(data.judicialName !== undefined && { judicialName: data.judicialName }),
            ...(data.totalBudget !== undefined && { totalBudget: data.totalBudget }),
            ...(data.fiscalYear && { fiscalYear: data.fiscalYear }),
            ...(data.budgetCurrency && { budgetCurrency: data.budgetCurrency }),
          },
        });

        // Log autosave to audit trail
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.auth.userId,
            action: "autosave:government",
            target: countryId,
            details: JSON.stringify({
              fields: Object.keys(data),
              timestamp: new Date().toISOString(),
            }),
            success: true,
          },
        });

        return {
          success: true,
          data: governmentStructure,
          message: "Government structure autosaved successfully",
        };
      } catch (error) {
        // Log autosave failure to audit trail
        await ctx.db.auditLog.create({
          data: {
            userId: ctx.auth.userId,
            action: "autosave:government",
            target: countryId,
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          },
        });

        throw error;
      }
    }),

  // Get atomic government components for a country
  getComponents: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const components = await ctx.db.governmentComponent.findMany({
        where: { countryId: input.countryId },
        include: {
          synergies: {
            include: {
              secondaryComponent: true,
            },
          },
          conflictsWith: {
            include: {
              primaryComponent: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      });

      return components;
    }),

  // Add atomic government component
  addComponent: protectedProcedure
    .input(
      z.object({
        countryId: z.string(),
        componentType: z.enum(COMPONENT_TYPE_VALUES),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if component already exists
      const existing = await ctx.db.governmentComponent.findFirst({
        where: {
          countryId: input.countryId,
          componentType: input.componentType,
        },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This component is already selected",
        });
      }

      const component = await ctx.db.governmentComponent.create({
        data: {
          countryId: input.countryId,
          componentType: input.componentType,
          isActive: input.isActive ?? true,
        },
      });

      // Notify about component addition
      try {
        await notificationHooks.onGovernmentStructureChange({
          countryId: input.countryId,
          changeType: "component_added",
          componentName: input.componentType,
          details: `Atomic government component added: ${input.componentType}`,
        });
      } catch (error) {
        console.error("[Government] Failed to send component addition notification:", error);
      }

      return component;
    }),

  // Remove atomic government component
  removeComponent: protectedProcedure
    .input(
      z.object({
        countryId: z.string(),
        componentType: z.enum(COMPONENT_TYPE_VALUES),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const deleted = await ctx.db.governmentComponent.deleteMany({
        where: {
          countryId: input.countryId,
          componentType: input.componentType,
        },
      });

      // Notify about component removal
      try {
        if (deleted.count > 0) {
          await notificationHooks.onGovernmentStructureChange({
            countryId: input.countryId,
            changeType: "component_removed",
            componentName: input.componentType,
            details: `Atomic government component removed: ${input.componentType}`,
          });
        }
      } catch (error) {
        console.error("[Government] Failed to send component removal notification:", error);
      }

      return { success: deleted.count > 0 };
    }),

  // Get effectiveness analysis for atomic components
  getEffectivenesAnalysis: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const components = await ctx.db.governmentComponent.findMany({
        where: {
          countryId: input.countryId,
          isActive: true,
        },
        include: {
          synergies: {
            include: {
              secondaryComponent: true,
            },
          },
          conflictsWith: {
            include: {
              primaryComponent: true,
            },
          },
        },
      });

      // Calculate overall effectiveness score
      let totalScore = 0;
      let synergyBonus = 0;
      let conflictPenalty = 0;

      for (const component of components) {
        // Use the actual effectiveness score from the component
        totalScore += component.effectivenessScore;

        // Add synergy bonuses
        const activeSynergies = component.synergies.filter(
          (s) => s.synergyType === "SYNERGY" && s.secondaryComponent.isActive
        );
        synergyBonus += activeSynergies.length * 5;

        // Subtract conflict penalties
        const activeConflicts = component.conflictsWith.filter(
          (s) => s.synergyType === "CONFLICT" && s.primaryComponent.isActive
        );
        conflictPenalty += activeConflicts.length * 10;
      }

      const averageScore = components.length > 0 ? totalScore / components.length : 0;
      const finalScore = Math.max(0, Math.min(100, averageScore + synergyBonus - conflictPenalty));

      // Check for synergies and notify
      try {
        for (const component of components) {
          const activeSynergies = component.synergies.filter(
            (s) => s.synergyType === "SYNERGY" && s.secondaryComponent.isActive
          );

          if (activeSynergies.length > 0) {
            const synergyBonusPerComponent = activeSynergies.length * 5;
            await notificationHooks.onGovernmentStructureChange({
              countryId: input.countryId,
              changeType: "synergy_detected",
              componentName: component.componentType,
              synergyBonus: synergyBonusPerComponent,
              details: `${activeSynergies.length} synergies detected`,
            });
          }
        }

        // Notify about significant effectiveness changes
        // Note: Would need to track previous score in database for accurate comparison
        const previousEffectiveness = 50; // Placeholder - should be fetched from history
        if (Math.abs(finalScore - previousEffectiveness) > 10) {
          await notificationHooks.onGovernmentStructureChange({
            countryId: input.countryId,
            changeType: "effectiveness_change",
            componentName: "Government",
            effectivenessScore: finalScore,
            previousScore: previousEffectiveness,
          });
        }
      } catch (error) {
        console.error("[Government] Failed to send effectiveness analysis notification:", error);
      }

      return {
        overallEffectiveness: finalScore,
        componentCount: components.length,
        synergyBonus,
        conflictPenalty,
        components: components.map((c) => ({
          componentType: c.componentType,
          isActive: c.isActive,
          effectivenessScore: c.effectivenessScore,
        })),
      };
    }),
});
