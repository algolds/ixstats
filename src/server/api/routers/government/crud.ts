// src/server/api/routers/government.ts

import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { detectGovernmentConflicts } from "~/server/services/builderIntegrationService";
import { GovernmentBuilderStateSchema } from "~/types/validation/government";

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

export const governmentCrudRouter = createTRPCRouter({
  // Get government structure by country ID with configurable includes
  // Phase 1 optimization: Added limits to prevent unbounded data fetching
  getByCountryId: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
        // Pagination options for nested data (defaults are optimized for typical use)
        budgetYearsLimit: z.number().min(1).max(10).default(3),
        includeSubDepartments: z.boolean().default(false),
        includeSubBudgets: z.boolean().default(false),
        revenueSourcesLimit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const {
        countryId,
        budgetYearsLimit,
        includeSubDepartments,
        includeSubBudgets,
        revenueSourcesLimit,
      } = input;

      const governmentStructure = await ctx.db.governmentStructure.findUnique({
        where: { countryId },
        include: {
          departments: {
            include: {
              // Conditionally include sub-departments to reduce payload
              ...(includeSubDepartments && { subDepartments: true }),
              budgetAllocations: {
                orderBy: { budgetYear: "desc" },
                take: budgetYearsLimit, // Limit budget history per department
              },
              ...(includeSubBudgets && { subBudgets: true }),
            },
            orderBy: { priority: "desc" },
          },
          budgetAllocations: {
            include: { department: true },
            orderBy: { budgetYear: "desc" },
            take: budgetYearsLimit * 20, // Limit total allocations (years * estimated departments)
          },
          revenueSources: {
            where: { isActive: true },
            orderBy: { revenueAmount: "desc" },
            take: revenueSourcesLimit,
          },
        },
      });

      if (!governmentStructure) {
        return null;
      }

      return governmentStructure;
    }),

  // Get full government structure without limits (admin/export use cases)
  getFullByCountryId: publicProcedure
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
      const warnings = await detectGovernmentConflicts(ctx.db as any, input.countryId, input.data);
      return { warnings };
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
});
