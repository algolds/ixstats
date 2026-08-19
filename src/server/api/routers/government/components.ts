// src/server/api/routers/government.ts

import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { COMPONENT_TYPE_VALUES, GovernmentBuilderStateSchema } from "~/types/government";
import { notificationHooks } from "~/lib/notifications/hooks";
import { notificationAPI } from "~/lib/notifications/api";
import { applyGovernmentComponentEffects } from "~/lib/government/component-effects";
import { ATOMIC_COMPONENTS } from "~/lib/government/atomic-data";
import { ATOMIC_ECONOMIC_COMPONENTS } from "~/lib/economy/atomic-data";
import { ATOMIC_TAX_COMPONENTS } from "~/components/mycountry/domains/government/tax/atoms/AtomicTaxComponents";
import {
  calculateImplementationDate,
  calculateCivilServiceCapacity,
  calculateTotalConsumedStaff,
  parseTimeToImplement,
} from "~/lib/government/atomic-utils";
import { mapTaxComponentTypeToId } from "~/lib/enums";
import { IxTime } from "~/lib/ixtime";

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

export const governmentComponentsRouter = createTRPCRouter({
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

  // Civil service capacity + rollout queue for the country dashboard.
  // Aggregates government / economic / tax components: staff is consumed by both
  // active and still-implementing components, while only implementing ones appear
  // in the rollout queue (with a progress estimate based on createdAt → implementationDate).
  getCivilServiceStatus: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      // implementationDate is stored in IxTime (game time), so compare against IxTime now.
      const nowMs = IxTime.getCurrentIxTime();
      const now = new Date(nowMs);
      const MONTH_MS = 30.44 * 24 * 60 * 60 * 1000;

      const [country, gov, econ, tax] = await Promise.all([
        ctx.db.country.findUnique({
          where: { id: input.countryId },
          select: {
            currentPopulation: true,
            governmentalEfficiency: true,
            governmentStructure: { select: { governmentEffectiveness: true } },
          },
        }),
        ctx.db.governmentComponent.findMany({
          where: { countryId: input.countryId },
          select: { id: true, componentType: true, isActive: true, implementationDate: true },
        }),
        ctx.db.economicComponent.findMany({
          where: { countryId: input.countryId },
          select: { id: true, componentType: true, isActive: true, implementationDate: true },
        }),
        ctx.db.taxComponent.findMany({
          where: { countryId: input.countryId },
          select: { id: true, componentType: true, isActive: true, implementationDate: true },
        }),
      ]);

      const isActive = (c: { isActive: boolean; implementationDate: Date | null }) =>
        c.isActive === true || (!!c.implementationDate && new Date(c.implementationDate) <= now);

      type RolloutEntry = {
        kind: "government" | "economic" | "tax";
        id: string;
        componentType: string;
        name: string;
        staffRequired: number;
        completionDate: number;
        remainingMs: number;
        progress: number;
      };

      const rolloutQueue: RolloutEntry[] = [];
      const allGovTypes: string[] = [];
      const allEconTypes: string[] = [];
      const allTaxIds: string[] = [];
      let activeCount = 0;

      const addRollout = (
        kind: RolloutEntry["kind"],
        id: string,
        componentType: string,
        name: string,
        staffRequired: number,
        timeToImplement: string | undefined,
        c: { implementationDate: Date | null }
      ) => {
        const completionMs = c.implementationDate
          ? new Date(c.implementationDate).getTime()
          : nowMs;
        // Estimate total rollout duration from the catalog timeframe (IxTime domain).
        const parsed = parseTimeToImplement(timeToImplement ?? "12 months");
        const totalMonths = parsed.years ? parsed.years * 12 : (parsed.months ?? 12);
        const durationMs = Math.max(1, totalMonths * MONTH_MS);
        const remainingMs = Math.max(0, completionMs - nowMs);
        const progress = Math.round(
          Math.min(100, Math.max(0, (1 - remainingMs / durationMs) * 100))
        );
        rolloutQueue.push({
          kind,
          id,
          componentType,
          name,
          staffRequired,
          completionDate: completionMs,
          remainingMs,
          progress,
        });
      };

      for (const c of gov) {
        const type = String(c.componentType);
        const data = (ATOMIC_COMPONENTS as Record<string, any>)[type];
        allGovTypes.push(type);
        if (isActive(c)) activeCount++;
        else
          addRollout(
            "government",
            c.id,
            type,
            data?.name ?? type,
            data?.metadata?.staffRequired ?? 0,
            data?.metadata?.timeToImplement,
            c
          );
      }
      for (const c of econ) {
        const type = String(c.componentType);
        const data = (ATOMIC_ECONOMIC_COMPONENTS as Record<string, any>)[type];
        allEconTypes.push(type);
        if (isActive(c)) activeCount++;
        else
          addRollout(
            "economic",
            c.id,
            type,
            data?.name ?? type,
            data?.metadata?.staffRequired ?? 0,
            data?.metadata?.timeToImplement,
            c
          );
      }
      for (const c of tax) {
        const id = mapTaxComponentTypeToId(String(c.componentType));
        const data = (ATOMIC_TAX_COMPONENTS as Record<string, any>)[id];
        allTaxIds.push(id);
        if (isActive(c)) activeCount++;
        else
          addRollout(
            "tax",
            c.id,
            id,
            data?.name ?? id,
            data?.metadata?.staffRequired ?? 0,
            data?.metadata?.timeToImplement,
            c
          );
      }

      // Staff is consumed by both active and implementing components.
      const consumedStaff = calculateTotalConsumedStaff(
        allGovTypes as any[],
        allEconTypes as any[],
        allTaxIds
      );
      const effectiveness =
        country?.governmentStructure?.governmentEffectiveness ??
        country?.governmentalEfficiency ??
        50;
      const capacity = calculateCivilServiceCapacity(
        country?.currentPopulation ?? 0,
        effectiveness
      );

      rolloutQueue.sort((a, b) => a.completionDate - b.completionDate);

      return {
        capacity,
        consumedStaff,
        availableStaff: Math.max(0, capacity - consumedStaff),
        utilizationPercent: capacity > 0 ? Math.round((consumedStaff / capacity) * 100) : 0,
        overCapacity: consumedStaff > capacity,
        activeCount,
        implementingCount: rolloutQueue.length,
        rolloutQueue,
      };
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

      // Look up component data
      const compData = ATOMIC_COMPONENTS[input.componentType];
      if (!compData) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Component not found in catalog",
        });
      }

      // Check budget
      const structure = await ctx.db.governmentStructure.findUnique({
        where: { countryId: input.countryId },
      });

      if (!structure) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message:
            "Government structure not found for this country. Please configure your government first.",
        });
      }

      const cost = compData.implementationCost || 0;
      if (structure.totalBudget < cost) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Insufficient budget. Required: ${cost}, Available: ${structure.totalBudget}`,
        });
      }

      // Deduct budget
      await ctx.db.governmentStructure.update({
        where: { countryId: input.countryId },
        data: {
          totalBudget: { decrement: cost },
        },
      });

      // Calculate implementationDate
      const isImmediate = input.isActive ?? false;
      const implementationDate = isImmediate
        ? new Date()
        : calculateImplementationDate(compData.metadata.timeToImplement);

      const component = await ctx.db.governmentComponent.create({
        data: {
          countryId: input.countryId,
          componentType: input.componentType,
          isActive: isImmediate,
          implementationCost: cost,
          maintenanceCost: compData.maintenanceCost || 0,
          requiredCapacity: compData.metadata.staffRequired || compData.requiredCapacity || 50,
          implementationDate,
        },
      });

      // Apply component effects to game state
      try {
        const result = await applyGovernmentComponentEffects(ctx.db, input.countryId);
        await notificationAPI.create({
          title: "Government Component Added",
          message: `Added ${input.componentType}. Government effectiveness: ${result.overallEffectiveness.toFixed(1)}%. ${result.effectsCreated} economic effect(s) applied.`,
          countryId: input.countryId,
          category: "governance",
          priority: "medium",
          type: "info",
          href: "/mycountry/government/builder",
          source: "government-components",
          actionable: false,
          metadata: {
            componentType: input.componentType,
            overallEffectiveness: result.overallEffectiveness,
            effectsCreated: result.effectsCreated,
          },
        });
      } catch (error) {
        console.error("[Government] Failed to apply component effects:", error);
      }

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

      // Apply component effects to game state after removal
      if (deleted.count > 0) {
        try {
          const result = await applyGovernmentComponentEffects(ctx.db, input.countryId);
          await notificationAPI.create({
            title: "Government Component Removed",
            message: `Removed ${input.componentType}. Government effectiveness: ${result.overallEffectiveness.toFixed(1)}%. ${result.effectsCreated} economic effect(s) active.`,
            countryId: input.countryId,
            category: "governance",
            priority: "medium",
            type: "info",
            href: "/mycountry/government/builder",
            source: "government-components",
            actionable: false,
            metadata: {
              componentType: input.componentType,
              overallEffectiveness: result.overallEffectiveness,
              effectsCreated: result.effectsCreated,
            },
          });
        } catch (error) {
          console.error("[Government] Failed to apply component effects after removal:", error);
        }
      }

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

  // Recalculate and apply government component effects on demand
  recalculateEffects: protectedProcedure
    .input(z.object({ countryId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userProfile = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
      });
      if (!userProfile || userProfile.countryId !== input.countryId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have permission to edit this country.",
        });
      }

      const result = await applyGovernmentComponentEffects(ctx.db, input.countryId);

      await notificationAPI.create({
        title: "Government Effects Recalculated",
        message: `Government effectiveness: ${result.overallEffectiveness.toFixed(1)}%. ${result.effectsCreated} economic effect(s) applied. Political metrics ${result.politicalMetricsUpdated ? "updated" : "unchanged"}.`,
        countryId: input.countryId,
        category: "governance",
        priority: "low",
        type: "info",
        href: "/mycountry/government/builder",
        source: "government-components",
        actionable: false,
        metadata: result,
      });

      return result;
    }),
});
