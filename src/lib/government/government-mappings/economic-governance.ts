import { ComponentType } from "~/components/mycountry/domains/government/atoms/AtomicGovernmentComponents";
import type { AtomicGovernmentMapping } from "./types";

export const economic_governance_mapping: Partial<Record<ComponentType, AtomicGovernmentMapping>> =
  {
    // Economic Governance Components
    [ComponentType.FREE_MARKET_SYSTEM]: {
      component: ComponentType.FREE_MARKET_SYSTEM,
      departments: [
        {
          name: "Market Regulation Office",
          category: "Commerce",
          functions: ["Market Monitoring", "Competition Policy", "Consumer Protection"],
          priority: 3,
          budgetPercent: 5,
          effectiveness: 80,
          description: "Minimal regulatory oversight to ensure fair market competition",
        },
      ],
      budgetAllocations: [
        {
          departmentId: "0",
          allocatedAmount: 0,
          allocatedPercent: 5,
          rationale: "Minimal government intervention in markets",
        },
      ],
      policies: [
        {
          name: "Market Liberalization",
          description: "Reduce government intervention in economic activities",
          impact: { efficiency: 20, innovation: 15, inequality: -10 },
          enabled: true,
        },
      ],
    },

    [ComponentType.PLANNED_ECONOMY]: {
      component: ComponentType.PLANNED_ECONOMY,
      departments: [
        {
          name: "Economic Planning Commission",
          category: "Commerce",
          functions: ["Resource Allocation", "Production Planning", "Price Setting"],
          priority: 1,
          budgetPercent: 20,
          effectiveness: 85,
          description: "Central authority for all economic planning and resource allocation",
        },
      ],
      budgetAllocations: [
        {
          departmentId: "0",
          allocatedAmount: 0,
          allocatedPercent: 20,
          rationale: "Central economic planning requires significant resources",
        },
      ],
      policies: [
        {
          name: "Central Economic Planning",
          description: "Government controls major economic decisions",
          impact: { efficiency: -10, stability: 25, innovation: -15 },
          enabled: true,
        },
      ],
    },

    [ComponentType.MIXED_ECONOMY]: {
      component: ComponentType.MIXED_ECONOMY,
      departments: [
        {
          name: "Economic Coordination Bureau",
          category: "Commerce",
          functions: ["Market Regulation", "Public Sector Management", "Economic Policy"],
          priority: 2,
          budgetPercent: 12,
          effectiveness: 75,
          description: "Balances market forces with government intervention",
        },
      ],
      budgetAllocations: [
        {
          departmentId: "0",
          allocatedAmount: 0,
          allocatedPercent: 12,
          rationale: "Mixed approach requires moderate government involvement",
        },
      ],
      policies: [
        {
          name: "Balanced Economic Policy",
          description: "Combines market mechanisms with government oversight",
          impact: { efficiency: 10, stability: 15, flexibility: 5 },
          enabled: true,
        },
      ],
    },

    [ComponentType.CORPORATIST_SYSTEM]: {
      component: ComponentType.CORPORATIST_SYSTEM,
      departments: [
        {
          name: "Corporatist Coordination Office",
          category: "Commerce",
          functions: ["Interest Group Mediation", "Sectoral Planning", "Social Partnership"],
          priority: 2,
          budgetPercent: 8,
          effectiveness: 70,
          description: "Coordinates between government, business, and labor organizations",
        },
      ],
      budgetAllocations: [
        {
          departmentId: "0",
          allocatedAmount: 0,
          allocatedPercent: 8,
          rationale: "Corporatist coordination requires institutional support",
        },
      ],
      policies: [
        {
          name: "Tripartite Coordination",
          description: "Government, business, and labor work together on policy",
          impact: { stability: 20, consensus: 25, efficiency: -5 },
          enabled: true,
        },
      ],
    },

    [ComponentType.SOCIAL_MARKET_ECONOMY]: {
      component: ComponentType.SOCIAL_MARKET_ECONOMY,
      departments: [
        {
          name: "Social Market Coordination",
          category: "Commerce",
          functions: ["Market Regulation", "Social Safety Nets", "Competition Policy"],
          priority: 2,
          budgetPercent: 10,
          effectiveness: 80,
          description: "Combines free markets with strong social protections",
        },
      ],
      budgetAllocations: [
        {
          departmentId: "0",
          allocatedAmount: 0,
          allocatedPercent: 10,
          rationale: "Social market economy requires balanced approach",
        },
      ],
      policies: [
        {
          name: "Social Market Principles",
          description: "Free markets with social responsibility",
          impact: { efficiency: 15, social_cohesion: 20, innovation: 10 },
          enabled: true,
        },
      ],
    },

    [ComponentType.STATE_CAPITALISM]: {
      component: ComponentType.STATE_CAPITALISM,
      departments: [
        {
          name: "State Enterprise Board",
          category: "Commerce",
          functions: [
            "State-Owned Enterprise Management",
            "Strategic Investment",
            "Economic Planning",
          ],
          priority: 1,
          budgetPercent: 18,
          effectiveness: 75,
          description: "Manages state-owned enterprises and strategic investments",
        },
      ],
      budgetAllocations: [
        {
          departmentId: "0",
          allocatedAmount: 0,
          allocatedPercent: 18,
          rationale: "State capitalism requires significant state enterprise investment",
        },
      ],
      policies: [
        {
          name: "Strategic State Control",
          description: "Government controls key economic sectors",
          impact: { stability: 25, efficiency: -5, strategic_control: 30 },
          enabled: true,
        },
      ],
    },

    [ComponentType.RESOURCE_BASED_ECONOMY]: {
      component: ComponentType.RESOURCE_BASED_ECONOMY,
      departments: [
        {
          name: "Resource Management Authority",
          category: "Commerce",
          functions: ["Resource Extraction", "Environmental Protection", "Resource Allocation"],
          priority: 1,
          budgetPercent: 15,
          effectiveness: 70,
          description: "Manages natural resource extraction and distribution",
        },
      ],
      budgetAllocations: [
        {
          departmentId: "0",
          allocatedAmount: 0,
          allocatedPercent: 15,
          rationale: "Resource-based economy requires strong resource management",
        },
      ],
      policies: [
        {
          name: "Resource Sovereignty",
          description: "Government controls natural resource extraction",
          impact: { revenue: 25, sustainability: -10, stability: 15 },
          enabled: true,
        },
      ],
    },

    [ComponentType.KNOWLEDGE_ECONOMY]: {
      component: ComponentType.KNOWLEDGE_ECONOMY,
      departments: [
        {
          name: "Innovation and Technology Office",
          category: "Science and Technology",
          functions: ["R&D Funding", "Technology Transfer", "Innovation Policy"],
          priority: 2,
          budgetPercent: 12,
          effectiveness: 85,
          description: "Promotes knowledge-based economic development",
        },
      ],
      budgetAllocations: [
        {
          departmentId: "0",
          allocatedAmount: 0,
          allocatedPercent: 12,
          rationale: "Knowledge economy requires investment in innovation",
        },
      ],
      policies: [
        {
          name: "Innovation-Driven Growth",
          description: "Economic growth through knowledge and innovation",
          impact: { innovation: 30, productivity: 20, competitiveness: 25 },
          enabled: true,
        },
      ],
    },
  };
