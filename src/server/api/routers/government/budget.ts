// src/server/api/routers/government.ts

import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";

import { GovernmentBuilderStateSchema } from "~/types/validation/government";
import { notificationAPI } from "~/lib/notification-api";

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

export const governmentBudgetRouter = createTRPCRouter({
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
            select: {
              name: true,
              governmentStructure: {
                select: { countryId: true },
              },
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
});
