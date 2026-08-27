import { ComponentType } from "~/components/mycountry/domains/government/atoms/AtomicGovernmentComponents";
import type { AtomicGovernmentMapping } from "./types";

export const international_relations_mapping: Partial<
  Record<ComponentType, AtomicGovernmentMapping>
> = {
  // International Relations Components
  [ComponentType.MULTILATERAL_DIPLOMACY]: {
    component: ComponentType.MULTILATERAL_DIPLOMACY,
    departments: [
      {
        name: "International Relations Department",
        category: "Foreign Affairs",
        functions: ["Multilateral Negotiations", "International Cooperation", "Global Governance"],
        priority: 2,
        budgetPercent: 8,
        effectiveness: 80,
        description: "Engages in multilateral diplomacy and international cooperation",
      },
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 8,
        rationale: "Multilateral diplomacy requires international engagement resources",
      },
    ],
    policies: [
      {
        name: "Multilateral Engagement",
        description: "Active participation in international organizations and agreements",
        impact: { international_influence: 25, cooperation: 20, sovereignty: -10 },
        enabled: true,
      },
    ],
  },

  [ComponentType.REGIONAL_INTEGRATION]: {
    component: ComponentType.REGIONAL_INTEGRATION,
    departments: [
      {
        name: "Regional Cooperation Office",
        category: "Foreign Affairs",
        functions: ["Regional Trade", "Regional Security", "Cultural Exchange"],
        priority: 2,
        budgetPercent: 6,
        effectiveness: 75,
        description: "Promotes regional integration and cooperation",
      },
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 6,
        rationale: "Regional integration requires coordination and cooperation resources",
      },
    ],
    policies: [
      {
        name: "Regional Partnership",
        description: "Deep integration with regional neighbors and partners",
        impact: { regional_influence: 20, trade: 25, security: 15 },
        enabled: true,
      },
    ],
  },

  [ComponentType.DEVELOPMENT_AID]: {
    component: ComponentType.DEVELOPMENT_AID,
    departments: [
      {
        name: "International Development Agency",
        category: "Foreign Affairs",
        functions: ["Foreign Aid", "Development Projects", "Capacity Building"],
        priority: 3,
        budgetPercent: 4,
        effectiveness: 70,
        description: "Provides development assistance and foreign aid",
      },
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 4,
        rationale: "Development assistance requires dedicated aid resources",
      },
    ],
    policies: [
      {
        name: "Global Development Partnership",
        description: "Provides development assistance to other countries",
        impact: { international_influence: 15, global_cooperation: 20, soft_power: 25 },
        enabled: true,
      },
    ],
  },

  [ComponentType.BILATERAL_RELATIONS]: {
    component: ComponentType.BILATERAL_RELATIONS,
    departments: [
      {
        name: "Cultural Relations Bureau",
        category: "Foreign Affairs",
        functions: ["Cultural Programs", "Educational Exchange", "Cultural Diplomacy"],
        priority: 3,
        budgetPercent: 3,
        effectiveness: 65,
        description: "Promotes cultural exchange and international cultural relations",
      },
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 3,
        rationale: "Cultural exchange requires cultural programs and exchange resources",
      },
    ],
    policies: [
      {
        name: "Cultural Diplomacy",
        description: "Promotes national culture and values internationally",
        impact: { soft_power: 20, cultural_influence: 25, understanding: 15 },
        enabled: true,
      },
    ],
  },

  [ComponentType.TRADE_AGREEMENTS]: {
    component: ComponentType.TRADE_AGREEMENTS,
    departments: [
      {
        name: "Trade Negotiation Office",
        category: "Foreign Affairs",
        functions: ["Trade Negotiations", "Trade Policy", "Economic Diplomacy"],
        priority: 2,
        budgetPercent: 5,
        effectiveness: 75,
        description: "Negotiates and manages international trade agreements",
      },
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 5,
        rationale: "Trade agreements require negotiation and policy expertise",
      },
    ],
    policies: [
      {
        name: "Strategic Trade Partnerships",
        description: "Comprehensive trade agreements with key partners",
        impact: { economic_growth: 20, trade_volume: 25, competitiveness: 15 },
        enabled: true,
      },
    ],
  },

  [ComponentType.INTERNATIONAL_LAW]: {
    component: ComponentType.INTERNATIONAL_LAW,
    departments: [
      {
        name: "Environmental Diplomacy Office",
        category: "Foreign Affairs",
        functions: ["Climate Agreements", "Environmental Standards", "Green Technology Transfer"],
        priority: 3,
        budgetPercent: 4,
        effectiveness: 70,
        description: "Coordinates international environmental cooperation and agreements",
      },
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 4,
        rationale: "Environmental cooperation requires international coordination",
      },
    ],
    policies: [
      {
        name: "Global Environmental Leadership",
        description: "Active participation in international environmental agreements",
        impact: { environmental_protection: 25, international_influence: 15, sustainability: 20 },
        enabled: true,
      },
    ],
  },

  [ComponentType.SECURITY_ALLIANCES]: {
    component: ComponentType.SECURITY_ALLIANCES,
    departments: [
      {
        name: "Alliance Coordination Office",
        category: "Foreign Affairs",
        functions: ["Military Cooperation", "Intelligence Sharing", "Joint Exercises"],
        priority: 2,
        budgetPercent: 6,
        effectiveness: 80,
        description: "Coordinates security alliances and military cooperation",
      },
    ],
    budgetAllocations: [
      {
        departmentId: "0",
        allocatedAmount: 0,
        allocatedPercent: 6,
        rationale: "Security alliances require military and intelligence coordination",
      },
    ],
    policies: [
      {
        name: "Collective Security",
        description: "Participates in security alliances for mutual defense",
        impact: { security: 25, military_capability: 20, international_cooperation: 15 },
        enabled: true,
      },
    ],
  },
};
