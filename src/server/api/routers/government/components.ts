// src/server/api/routers/government.ts

import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { COMPONENT_TYPE_VALUES } from "~/types/government";

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

export const governmentComponentsRouter = createTRPCRouter({
  // Get government structure by country ID with configurable includes
  // Phase 1 optimization: Added limits to prevent unbounded data fetching

  // Get full government structure without limits (admin/export use cases)

  // Check for conflicts before creating/updating

  // Create complete government structure

  // Update government structure

  // Delete government structure

  // Get budget summary

  // Get revenue summary

  // Update budget allocation

  // Add sub-budget categories

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

  updatePoliticalMetrics: protectedProcedure
    .input(
      z.object({
        countryId: z.string(),
        politicalStability: z.number().min(0).max(1).optional(),
        democracyIndex: z.number().min(0).max(100).optional(),
        politicalPolarization: z.number().min(0).max(100).optional(),
        governmentEffectiveness: z.number().min(0).max(100).optional(),
        ruleOfLaw: z.number().min(0).max(100).optional(),
        corruptionIndex: z.number().min(0).max(100).optional(),
        electionCycle: z.number().int().min(1).max(20).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { countryId, ...metrics } = input;

      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
      });
      if (!userProfile || userProfile.countryId !== countryId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have permission to edit this country.",
        });
      }

      const updateData = Object.fromEntries(
        Object.entries(metrics).filter(([, v]) => v !== undefined)
      );

      await ctx.db.governmentStructure.upsert({
        where: { countryId },
        create: {
          countryId,
          governmentName: "National Government",
          governmentType: "Republic",
          ...updateData,
          politicalMetricsUpdated: new Date(),
        },
        update: {
          ...updateData,
          politicalMetricsUpdated: new Date(),
        },
      });

      return { success: true };
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
