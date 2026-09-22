import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";

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

      const synergiesList: any = synergies;
      synergiesList.governmentSynergies = [];
      synergiesList.governmentConflicts = [];
      synergiesList.crossBuilderSynergies = [];

      return synergiesList;
    }),

  // Detect conflicts between different builder types
  detectConflicts: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [governmentComponents, economicComponents, _taxComponents] = await Promise.all([
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
        governmentEffectiveness: govScore,
        economicScore: econScore,
        economicEffectiveness: econScore,
        taxScore: taxScore,
        taxEffectiveness: taxScore,
        synergyBonus,
        combinedScore: Math.min(100, Math.max(0, combinedScore)),
        economicModifiers: {},
        taxModifiers: {},
        stabilityScore: 100,
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
  if (synergyType === "GOV_ECON") {
    const govEconRules: Record<string, Record<string, { bonus: number; description: string }>> = {
      ECONOMIC_INCENTIVES: {
        FREE_MARKET_SYSTEM: {
          bonus: 10,
          description: "Economic incentive governance supercharges free market pricing mechanics",
        },
        COMPETITIVE_MARKETS: {
          bonus: 8,
          description: "Economic incentives foster competitive enterprise",
        },
      },
      RULE_OF_LAW: {
        FREE_MARKET_SYSTEM: {
          bonus: 8,
          description: "Judicial contract enforcement secures market transactions and private property",
        },
        STARTUP_ECOSYSTEM: {
          bonus: 6,
          description: "Transparent legal frameworks attract venture capital and startup investments",
        },
      },
      WELFARE_STATE: {
        SOCIAL_MARKET_ECONOMY: {
          bonus: 12,
          description: "Welfare institutions provide the social safety net foundational to social market capitalism",
        },
        PROTECTED_WORKERS: {
          bonus: 10,
          description: "State welfare programs harmonize with statutory labor protections",
        },
      },
      TECHNOCRATIC_PROCESS: {
        PLANNED_ECONOMY: {
          bonus: 10,
          description: "Data-driven technocratic governance optimizes planned resource allocation",
        },
        TECHNOLOGY_FOCUSED: {
          bonus: 8,
          description: "Technocratic policymaking accelerates tech sector growth",
        },
      },
      WORKER_PROTECTION: {
        PROTECTED_WORKERS: {
          bonus: 10,
          description: "Statutory labor protections align with union and worker safety standards",
        },
        UNION_BASED: {
          bonus: 8,
          description: "Worker protection policies empower organized labor institutions",
        },
      },
      RESEARCH_AND_DEVELOPMENT: {
        INNOVATION_ECONOMY: {
          bonus: 12,
          description: "Public research investment fuels breakthrough private sector innovation",
        },
        STARTUP_ECOSYSTEM: {
          bonus: 10,
          description: "Government R&D grants catalyze startup technology commercialization",
        },
      },
      TRADE_AGREEMENTS: {
        FREE_TRADE: {
          bonus: 10,
          description: "Multilateral trade pacts remove export tariffs and trade barriers",
        },
        EXPORT_ORIENTED: {
          bonus: 8,
          description: "Diplomatic trade agreements unlock foreign export markets",
        },
      },
      DEMOCRATIC_PROCESS: {
        FREE_MARKET_SYSTEM: {
          bonus: 8,
          description: "Democratic accountability protects open competitive markets",
        },
      },
    };
    return govEconRules[component1]?.[component2] ?? null;
  }

  if (synergyType === "GOV_TAX") {
    const govTaxRules: Record<string, Record<string, { bonus: number; description: string }>> = {
      WELFARE_STATE: {
        PROGRESSIVE_TAX: {
          bonus: 10,
          description: "Progressive taxation funds universal welfare state programs",
        },
      },
      DIGITAL_GOVERNMENT: {
        E_FILING_SYSTEM: {
          bonus: 10,
          description: "Digital governance infrastructure streamlines electronic tax filing",
        },
        AUTOMATED_COLLECTION: {
          bonus: 8,
          description: "Automated public data platforms optimize tax collection",
        },
      },
      RULE_OF_LAW: {
        TAX_AVOIDANCE_PREVENTION: {
          bonus: 8,
          description: "Strong legal institutions enforce tax compliance and prevent evasion",
        },
      },
      ECONOMIC_INCENTIVES: {
        TAX_INCENTIVES: {
          bonus: 8,
          description: "Targeted policy incentives maximize tax incentive efficacy",
        },
      },
    };
    return govTaxRules[component1]?.[component2] ?? null;
  }

  if (synergyType === "ECON_TAX") {
    const econTaxRules: Record<string, Record<string, { bonus: number; description: string }>> = {
      FREE_TRADE: {
        TAX_INCENTIVES: {
          bonus: 8,
          description: "Export and trade tax incentives expand international commerce",
        },
      },
      STARTUP_ECOSYSTEM: {
        TAX_CREDITS: {
          bonus: 10,
          description: "Targeted R&D tax credits accelerate startup innovation",
        },
      },
      FREE_MARKET_SYSTEM: {
        FLAT_TAX: {
          bonus: 8,
          description: "Simplified flat taxation lowers market friction and compliance overhead",
        },
      },
      SOCIAL_MARKET_ECONOMY: {
        PROGRESSIVE_TAX: {
          bonus: 8,
          description: "Progressive tax revenues support balanced social market infrastructure",
        },
      },
    };
    return econTaxRules[component1]?.[component2] ?? null;
  }

  return null;
}

// Helper function to detect component conflicts
function detectComponentConflict(
  component1: string,
  component2: string
): { penalty: number; description: string } | null {
  const conflictRules: Record<string, Record<string, { penalty: number; description: string }>> = {
    SURVEILLANCE_SYSTEM: {
      FREE_MARKET_SYSTEM: {
        penalty: 12,
        description: "Heavy state surveillance undermines free commerce and capital confidence",
      },
    },
    AUTOCRATIC_PROCESS: {
      COMPETITIVE_MARKETS: {
        penalty: 10,
        description: "Arbitrary autocratic decrees disrupt competitive free enterprise",
      },
      FREE_MARKET_SYSTEM: {
        penalty: 10,
        description: "Authoritarian control limits decentralized market decisions",
      },
    },
    CENTRALIZED_POWER: {
      COMPETITIVE_MARKETS: {
        penalty: 8,
        description: "Over-centralization hinders regional market competition",
      },
    },
    MILITARY_ADMINISTRATION: {
      FREE_TRADE: {
        penalty: 12,
        description: "Militarized governance and borders choke open international trade flows",
      },
    },
  };

  return conflictRules[component1]?.[component2] ?? null;
}
