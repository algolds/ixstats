import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { ComponentType, EconomicComponentType, TaxComponentType } from "@prisma/client";

export const unifiedAtomicRouter = createTRPCRouter({
  // Get all components (government, economic, tax) for a country
  getAll: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [governmentComponents, economicComponents, taxComponents] = await Promise.all([
        ctx.db.governmentComponent.findMany({
          where: { countryId: input.countryId, isActive: true },
        }),
        ctx.db.economicComponent.findMany({
          where: { countryId: input.countryId, isActive: true },
        }),
        ctx.db.taxComponent.findMany({
          where: { countryId: input.countryId, isActive: true },
        }),
      ]);

      return {
        government: governmentComponents,
        economic: economicComponents,
        tax: taxComponents,
        totalCount: governmentComponents.length + economicComponents.length + taxComponents.length,
      };
    }),

  // Detect synergies between different builder types
  detectSynergies: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [governmentComponents, economicComponents, taxComponents] = await Promise.all([
        ctx.db.governmentComponent.findMany({
          where: { countryId: input.countryId, isActive: true },
        }),
        ctx.db.economicComponent.findMany({
          where: { countryId: input.countryId, isActive: true },
        }),
        ctx.db.taxComponent.findMany({
          where: { countryId: input.countryId, isActive: true },
        }),
      ]);

      const synergies = [];

      // Government + Economic synergies
      for (const gov of governmentComponents) {
        for (const econ of economicComponents) {
          // Check for synergies based on component types
          const synergy = detectComponentSynergy(gov.componentType, econ.componentType, "GOV_ECON");
          if (synergy) {
            synergies.push({
              type: "GOV_ECON",
              governmentComponent: gov,
              economicComponent: econ,
              bonus: synergy.bonus,
              description: synergy.description,
            });
          }
        }
      }

      // Government + Tax synergies
      for (const gov of governmentComponents) {
        for (const tax of taxComponents) {
          const synergy = detectComponentSynergy(gov.componentType, tax.componentType, "GOV_TAX");
          if (synergy) {
            synergies.push({
              type: "GOV_TAX",
              governmentComponent: gov,
              taxComponent: tax,
              bonus: synergy.bonus,
              description: synergy.description,
            });
          }
        }
      }

      // Economic + Tax synergies
      for (const econ of economicComponents) {
        for (const tax of taxComponents) {
          const synergy = detectComponentSynergy(econ.componentType, tax.componentType, "ECON_TAX");
          if (synergy) {
            synergies.push({
              type: "ECON_TAX",
              economicComponent: econ,
              taxComponent: tax,
              bonus: synergy.bonus,
              description: synergy.description,
            });
          }
        }
      }

      // Three-way synergies (if all three types exist)
      if (
        governmentComponents.length > 0 &&
        economicComponents.length > 0 &&
        taxComponents.length > 0
      ) {
        synergies.push({
          type: "ALL_THREE",
          description:
            "Comprehensive policy framework with government, economic, and tax components working together",
          bonus: 15, // Higher bonus for three-way synergy
        });
      }

      return synergies;
    }),

  // Detect conflicts between different builder types
  detectConflicts: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [governmentComponents, economicComponents, taxComponents] = await Promise.all([
        ctx.db.governmentComponent.findMany({
          where: { countryId: input.countryId, isActive: true },
        }),
        ctx.db.economicComponent.findMany({
          where: { countryId: input.countryId, isActive: true },
        }),
        ctx.db.taxComponent.findMany({
          where: { countryId: input.countryId, isActive: true },
        }),
      ]);

      const conflicts = [];

      // Check for conflicts between different component types
      for (const gov of governmentComponents) {
        for (const econ of economicComponents) {
          const conflict = detectComponentConflict(gov.componentType, econ.componentType);
          if (conflict) {
            conflicts.push({
              type: "GOV_ECON",
              governmentComponent: gov,
              economicComponent: econ,
              penalty: conflict.penalty,
              description: conflict.description,
            });
          }
        }
      }

      return conflicts;
    }),

  // Calculate combined effectiveness score
  calculateCombinedEffectiveness: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [governmentComponents, economicComponents, taxComponents] = await Promise.all([
        ctx.db.governmentComponent.findMany({
          where: { countryId: input.countryId, isActive: true },
        }),
        ctx.db.economicComponent.findMany({
          where: { countryId: input.countryId, isActive: true },
        }),
        ctx.db.taxComponent.findMany({
          where: { countryId: input.countryId, isActive: true },
        }),
      ]);

      // Calculate individual effectiveness scores
      const govScore =
        governmentComponents.length > 0
          ? governmentComponents.reduce((sum, comp) => sum + comp.effectivenessScore, 0) /
            governmentComponents.length
          : 0;

      const econScore =
        economicComponents.length > 0
          ? economicComponents.reduce((sum, comp) => sum + comp.effectivenessScore, 0) /
            economicComponents.length
          : 0;

      const taxScore =
        taxComponents.length > 0
          ? taxComponents.reduce((sum, comp) => sum + comp.effectivenessScore, 0) /
            taxComponents.length
          : 0;

      // Calculate synergies and conflicts
      const synergies = await ctx.db.crossBuilderSynergy.findMany({
        where: { countryId: input.countryId, isActive: true },
      });

      const synergyBonus = synergies.reduce((sum, syn) => sum + syn.effectivenessBonus, 0);

      // Calculate combined score with weights
      const combinedScore = govScore * 0.4 + econScore * 0.35 + taxScore * 0.25 + synergyBonus;

      return {
        governmentScore: govScore,
        economicScore: econScore,
        taxScore: taxScore,
        synergyBonus,
        combinedScore: Math.min(100, Math.max(0, combinedScore)),
        componentCounts: {
          government: governmentComponents.length,
          economic: economicComponents.length,
          tax: taxComponents.length,
        },
      };
    }),

  // Get historical changes for components
  getHistoricalChanges: publicProcedure
    .input(
      z.object({
        countryId: z.string(),
        limit: z.number().default(50),
        componentType: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      return await ctx.db.componentChangeLog.findMany({
        where: {
          countryId: input.countryId,
          ...(input.componentType && { componentType: input.componentType }),
        },
        orderBy: { timestamp: "desc" },
        take: input.limit,
      });
    }),

  // Save cross-builder synergies
  saveSynergies: protectedProcedure
    .input(
      z.object({
        countryId: z.string(),
        synergies: z.array(
          z.object({
            governmentComponents: z.array(z.string()),
            economicComponents: z.array(z.string()),
            taxComponents: z.array(z.string()),
            synergyType: z.string(),
            effectivenessBonus: z.number(),
            description: z.string(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Clear existing synergies
      await ctx.db.crossBuilderSynergy.deleteMany({
        where: { countryId: input.countryId },
      });

      // Create new synergies
      const results = [];
      for (const synergy of input.synergies) {
        const created = await ctx.db.crossBuilderSynergy.create({
          data: {
            countryId: input.countryId,
            governmentComponents: JSON.stringify(synergy.governmentComponents),
            economicComponents: JSON.stringify(synergy.economicComponents),
            taxComponents: JSON.stringify(synergy.taxComponents),
            synergyType: synergy.synergyType,
            effectivenessBonus: synergy.effectivenessBonus,
            description: synergy.description,
          },
        });
        results.push(created);
      }

      return results;
    }),
});

// Helper function to detect component synergies
function detectComponentSynergy(
  component1: string,
  component2: string,
  synergyType: string
): { bonus: number; description: string } | null {
  // Define synergy rules based on component types
  const synergyRules: Record<string, Record<string, { bonus: number; description: string }>> = {
    // Government + Economic synergies
    FREE_MARKET_SYSTEM: {
      FREE_MARKET_SYSTEM: {
        bonus: 10,
        description: "Free market government supports free market economy",
      },
      MIXED_ECONOMY: {
        bonus: 5,
        description: "Free market government with mixed economy creates balance",
      },
    },
    PLANNED_ECONOMY: {
      PLANNED_ECONOMY: {
        bonus: 10,
        description: "Planned government with planned economy creates efficiency",
      },
    },
    SOCIAL_MARKET_ECONOMY: {
      SOCIAL_MARKET_ECONOMY: {
        bonus: 10,
        description: "Social market government with social market economy",
      },
    },
    // Government + Tax synergies
    PROGRESSIVE_TAX: {
      PROGRESSIVE_TAX: {
        bonus: 8,
        description: "Progressive government with progressive taxation",
      },
    },
    FLAT_TAX: {
      FLAT_TAX: { bonus: 8, description: "Simplified government with flat taxation" },
    },
    // Economic + Tax synergies
    FREE_TRADE: {
      FREE_TRADE: { bonus: 6, description: "Free trade economy with free trade taxation" },
    },
  };

  const rules = synergyRules[component1];
  if (rules && rules[component2]) {
    return rules[component2];
  }

  return null;
}

// Helper function to detect component conflicts
function detectComponentConflict(
  component1: string,
  component2: string
): { penalty: number; description: string } | null {
  // Define conflict rules
  const conflictRules: Record<string, Record<string, { penalty: number; description: string }>> = {
    FREE_MARKET_SYSTEM: {
      PLANNED_ECONOMY: {
        penalty: 15,
        description: "Free market government conflicts with planned economy",
      },
    },
    PLANNED_ECONOMY: {
      FREE_MARKET_SYSTEM: {
        penalty: 15,
        description: "Planned government conflicts with free market economy",
      },
    },
  };

  const rules = conflictRules[component1];
  if (rules && rules[component2]) {
    return rules[component2];
  }

  return null;
}
