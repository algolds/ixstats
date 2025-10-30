/**
 * Client-side atomic calculations
 * Pure functions without database dependencies for use in client components
 */

import { ComponentType, EconomicComponentType, TaxComponentType } from "@prisma/client";

export interface ClientAtomicEconomicModifiers {
  taxCollectionMultiplier: number;
  gdpGrowthModifier: number;
  stabilityBonus: number;
  innovationMultiplier: number;
  internationalTradeBonus: number;
  governmentEfficiencyMultiplier: number;
  gdpImpact?: number;
  stabilityIndex?: number;
  internationalStanding?: number;
  taxEfficiency?: number;
}

export interface ComponentEffectivenessData {
  baseEffectiveness: number;
  economicImpact: number;
  taxImpact: number;
  stabilityImpact: number;
  legitimacyImpact: number;
}

// Component effectiveness lookup table
const COMPONENT_EFFECTIVENESS: Partial<Record<ComponentType, ComponentEffectivenessData>> = {
  // Power Distribution
  [ComponentType.CENTRALIZED_POWER]: {
    baseEffectiveness: 75,
    economicImpact: 1.05,
    taxImpact: 1.15,
    stabilityImpact: 10,
    legitimacyImpact: 5,
  },
  [ComponentType.FEDERAL_SYSTEM]: {
    baseEffectiveness: 70,
    economicImpact: 1.02,
    taxImpact: 0.95,
    stabilityImpact: 5,
    legitimacyImpact: 8,
  },
  [ComponentType.CONFEDERATE_SYSTEM]: {
    baseEffectiveness: 60,
    economicImpact: 0.98,
    taxImpact: 0.85,
    stabilityImpact: -5,
    legitimacyImpact: 3,
  },
  [ComponentType.UNITARY_SYSTEM]: {
    baseEffectiveness: 72,
    economicImpact: 1.08,
    taxImpact: 1.12,
    stabilityImpact: 8,
    legitimacyImpact: 6,
  },

  // Decision Processes
  [ComponentType.DEMOCRATIC_PROCESS]: {
    baseEffectiveness: 68,
    economicImpact: 1.03,
    taxImpact: 1.05,
    stabilityImpact: 5,
    legitimacyImpact: 15,
  },
  [ComponentType.AUTOCRATIC_PROCESS]: {
    baseEffectiveness: 75,
    economicImpact: 1.02,
    taxImpact: 1.2,
    stabilityImpact: -5,
    legitimacyImpact: -10,
  },
  [ComponentType.TECHNOCRATIC_PROCESS]: {
    baseEffectiveness: 85,
    economicImpact: 1.15,
    taxImpact: 1.12,
    stabilityImpact: 8,
    legitimacyImpact: 5,
  },
  [ComponentType.CONSENSUS_PROCESS]: {
    baseEffectiveness: 60,
    economicImpact: 0.95,
    taxImpact: 0.9,
    stabilityImpact: 12,
    legitimacyImpact: 10,
  },
  [ComponentType.OLIGARCHIC_PROCESS]: {
    baseEffectiveness: 70,
    economicImpact: 1.08,
    taxImpact: 1.05,
    stabilityImpact: -8,
    legitimacyImpact: -15,
  },

  // Legitimacy Sources
  [ComponentType.ELECTORAL_LEGITIMACY]: {
    baseEffectiveness: 65,
    economicImpact: 1.02,
    taxImpact: 1.05,
    stabilityImpact: 5,
    legitimacyImpact: 20,
  },
  [ComponentType.TRADITIONAL_LEGITIMACY]: {
    baseEffectiveness: 70,
    economicImpact: 0.98,
    taxImpact: 1.1,
    stabilityImpact: 15,
    legitimacyImpact: 12,
  },
  [ComponentType.PERFORMANCE_LEGITIMACY]: {
    baseEffectiveness: 80,
    economicImpact: 1.12,
    taxImpact: 1.08,
    stabilityImpact: 8,
    legitimacyImpact: 15,
  },
  [ComponentType.CHARISMATIC_LEGITIMACY]: {
    baseEffectiveness: 75,
    economicImpact: 1.05,
    taxImpact: 1.02,
    stabilityImpact: -5,
    legitimacyImpact: 18,
  },
  [ComponentType.RELIGIOUS_LEGITIMACY]: {
    baseEffectiveness: 72,
    economicImpact: 0.95,
    taxImpact: 1.15,
    stabilityImpact: 12,
    legitimacyImpact: 15,
  },

  // Institutions
  [ComponentType.PROFESSIONAL_BUREAUCRACY]: {
    baseEffectiveness: 85,
    economicImpact: 1.2,
    taxImpact: 1.25,
    stabilityImpact: 15,
    legitimacyImpact: 8,
  },
  [ComponentType.MILITARY_ADMINISTRATION]: {
    baseEffectiveness: 78,
    economicImpact: 1.05,
    taxImpact: 1.15,
    stabilityImpact: 8,
    legitimacyImpact: -8,
  },
  [ComponentType.INDEPENDENT_JUDICIARY]: {
    baseEffectiveness: 80,
    economicImpact: 1.08,
    taxImpact: 1.12,
    stabilityImpact: 18,
    legitimacyImpact: 15,
  },
  [ComponentType.PARTISAN_INSTITUTIONS]: {
    baseEffectiveness: 65,
    economicImpact: 0.92,
    taxImpact: 0.95,
    stabilityImpact: -12,
    legitimacyImpact: -10,
  },
  [ComponentType.TECHNOCRATIC_AGENCIES]: {
    baseEffectiveness: 82,
    economicImpact: 1.18,
    taxImpact: 1.15,
    stabilityImpact: 10,
    legitimacyImpact: 5,
  },

  // Control Mechanisms
  [ComponentType.RULE_OF_LAW]: {
    baseEffectiveness: 85,
    economicImpact: 1.15,
    taxImpact: 1.2,
    stabilityImpact: 20,
    legitimacyImpact: 18,
  },
  [ComponentType.SURVEILLANCE_SYSTEM]: {
    baseEffectiveness: 78,
    economicImpact: 1.02,
    taxImpact: 1.18,
    stabilityImpact: 5,
    legitimacyImpact: -12,
  },

  // Compliance Mechanisms
  [ComponentType.ECONOMIC_INCENTIVES]: {
    baseEffectiveness: 73,
    economicImpact: 1.1,
    taxImpact: 1.08,
    stabilityImpact: 5,
    legitimacyImpact: 8,
  },
  [ComponentType.SOCIAL_PRESSURE]: {
    baseEffectiveness: 68,
    economicImpact: 1.02,
    taxImpact: 1.12,
    stabilityImpact: 8,
    legitimacyImpact: 5,
  },
  [ComponentType.MILITARY_ENFORCEMENT]: {
    baseEffectiveness: 80,
    economicImpact: 0.95,
    taxImpact: 1.25,
    stabilityImpact: -8,
    legitimacyImpact: -15,
  },

  // Additional Government Systems
  [ComponentType.DIGITAL_GOVERNMENT]: {
    baseEffectiveness: 82,
    economicImpact: 1.12,
    taxImpact: 1.18,
    stabilityImpact: 10,
    legitimacyImpact: 8,
  },
  [ComponentType.MINIMAL_GOVERNMENT]: {
    baseEffectiveness: 65,
    economicImpact: 1.15,
    taxImpact: 0.85,
    stabilityImpact: -5,
    legitimacyImpact: 5,
  },
  [ComponentType.PRIVATE_SECTOR_LEADERSHIP]: {
    baseEffectiveness: 75,
    economicImpact: 1.18,
    taxImpact: 0.95,
    stabilityImpact: 0,
    legitimacyImpact: 5,
  },
  [ComponentType.SOCIAL_DEMOCRACY]: {
    baseEffectiveness: 78,
    economicImpact: 1.05,
    taxImpact: 1.12,
    stabilityImpact: 12,
    legitimacyImpact: 12,
  },
  [ComponentType.COMPREHENSIVE_WELFARE]: {
    baseEffectiveness: 72,
    economicImpact: 1.02,
    taxImpact: 1.08,
    stabilityImpact: 10,
    legitimacyImpact: 10,
  },
  [ComponentType.PUBLIC_SECTOR_LEADERSHIP]: {
    baseEffectiveness: 70,
    economicImpact: 1.08,
    taxImpact: 1.1,
    stabilityImpact: 5,
    legitimacyImpact: 5,
  },
  [ComponentType.ENVIRONMENTAL_FOCUS]: {
    baseEffectiveness: 68,
    economicImpact: 1.0,
    taxImpact: 1.05,
    stabilityImpact: 8,
    legitimacyImpact: 10,
  },
  [ComponentType.ECONOMIC_PLANNING]: {
    baseEffectiveness: 80,
    economicImpact: 1.12,
    taxImpact: 1.15,
    stabilityImpact: 5,
    legitimacyImpact: 5,
  },
  [ComponentType.DEVELOPMENTAL_STATE]: {
    baseEffectiveness: 82,
    economicImpact: 1.2,
    taxImpact: 1.15,
    stabilityImpact: 8,
    legitimacyImpact: 8,
  },
  [ComponentType.WORKER_PROTECTION]: {
    baseEffectiveness: 65,
    economicImpact: 0.98,
    taxImpact: 1.05,
    stabilityImpact: 8,
    legitimacyImpact: 10,
  },
  [ComponentType.MERITOCRATIC_SYSTEM]: {
    baseEffectiveness: 88,
    economicImpact: 1.18,
    taxImpact: 1.2,
    stabilityImpact: 12,
    legitimacyImpact: 12,
  },
  [ComponentType.REGIONAL_DEVELOPMENT]: {
    baseEffectiveness: 68,
    economicImpact: 1.05,
    taxImpact: 1.02,
    stabilityImpact: 10,
    legitimacyImpact: 5,
  },
  [ComponentType.INSTITUTIONAL_LEGITIMACY]: {
    baseEffectiveness: 78,
    economicImpact: 1.08,
    taxImpact: 1.1,
    stabilityImpact: 15,
    legitimacyImpact: 18,
  },
};

// Economic component effectiveness lookup table
const ECONOMIC_COMPONENT_EFFECTIVENESS: Record<EconomicComponentType, ComponentEffectivenessData> =
  {
    // Economic Model Components
    [EconomicComponentType.FREE_MARKET_SYSTEM]: {
      baseEffectiveness: 80,
      economicImpact: 1.1,
      taxImpact: 0.95,
      stabilityImpact: 5,
      legitimacyImpact: 8,
    },
    [EconomicComponentType.MIXED_ECONOMY]: {
      baseEffectiveness: 75,
      economicImpact: 1.05,
      taxImpact: 1.0,
      stabilityImpact: 8,
      legitimacyImpact: 10,
    },
    [EconomicComponentType.STATE_CAPITALISM]: {
      baseEffectiveness: 70,
      economicImpact: 1.02,
      taxImpact: 1.15,
      stabilityImpact: 10,
      legitimacyImpact: 6,
    },
    [EconomicComponentType.PLANNED_ECONOMY]: {
      baseEffectiveness: 65,
      economicImpact: 0.98,
      taxImpact: 1.2,
      stabilityImpact: 12,
      legitimacyImpact: 4,
    },
    [EconomicComponentType.SOCIAL_MARKET_ECONOMY]: {
      baseEffectiveness: 78,
      economicImpact: 1.08,
      taxImpact: 1.05,
      stabilityImpact: 10,
      legitimacyImpact: 12,
    },
    [EconomicComponentType.RESOURCE_BASED_ECONOMY]: {
      baseEffectiveness: 60,
      economicImpact: 0.9,
      taxImpact: 1.1,
      stabilityImpact: 3,
      legitimacyImpact: 5,
    },
    [EconomicComponentType.KNOWLEDGE_ECONOMY]: {
      baseEffectiveness: 85,
      economicImpact: 1.15,
      taxImpact: 1.05,
      stabilityImpact: 8,
      legitimacyImpact: 10,
    },
    [EconomicComponentType.INNOVATION_ECONOMY]: {
      baseEffectiveness: 90,
      economicImpact: 1.2,
      taxImpact: 1.08,
      stabilityImpact: 10,
      legitimacyImpact: 12,
    },

    // Sector Focus Components
    [EconomicComponentType.AGRICULTURE_LED]: {
      baseEffectiveness: 50,
      economicImpact: 0.85,
      taxImpact: 0.9,
      stabilityImpact: 5,
      legitimacyImpact: 6,
    },
    [EconomicComponentType.MANUFACTURING_LED]: {
      baseEffectiveness: 70,
      economicImpact: 1.05,
      taxImpact: 1.0,
      stabilityImpact: 8,
      legitimacyImpact: 8,
    },
    [EconomicComponentType.SERVICE_BASED]: {
      baseEffectiveness: 80,
      economicImpact: 1.1,
      taxImpact: 1.05,
      stabilityImpact: 6,
      legitimacyImpact: 9,
    },
    [EconomicComponentType.TECHNOLOGY_FOCUSED]: {
      baseEffectiveness: 90,
      economicImpact: 1.25,
      taxImpact: 1.1,
      stabilityImpact: 10,
      legitimacyImpact: 12,
    },
    [EconomicComponentType.FINANCE_CENTERED]: {
      baseEffectiveness: 85,
      economicImpact: 1.15,
      taxImpact: 1.2,
      stabilityImpact: 5,
      legitimacyImpact: 8,
    },
    [EconomicComponentType.EXPORT_ORIENTED]: {
      baseEffectiveness: 75,
      economicImpact: 1.08,
      taxImpact: 1.05,
      stabilityImpact: 6,
      legitimacyImpact: 7,
    },
    [EconomicComponentType.DOMESTIC_FOCUSED]: {
      baseEffectiveness: 65,
      economicImpact: 0.95,
      taxImpact: 1.0,
      stabilityImpact: 8,
      legitimacyImpact: 8,
    },
    [EconomicComponentType.TOURISM_BASED]: {
      baseEffectiveness: 60,
      economicImpact: 0.9,
      taxImpact: 0.95,
      stabilityImpact: 4,
      legitimacyImpact: 6,
    },

    // Labor System Components
    [EconomicComponentType.FLEXIBLE_LABOR]: {
      baseEffectiveness: 70,
      economicImpact: 1.05,
      taxImpact: 0.95,
      stabilityImpact: 3,
      legitimacyImpact: 5,
    },
    [EconomicComponentType.PROTECTED_WORKERS]: {
      baseEffectiveness: 75,
      economicImpact: 1.0,
      taxImpact: 1.05,
      stabilityImpact: 10,
      legitimacyImpact: 12,
    },
    [EconomicComponentType.UNION_BASED]: {
      baseEffectiveness: 72,
      economicImpact: 1.02,
      taxImpact: 1.08,
      stabilityImpact: 8,
      legitimacyImpact: 10,
    },
    [EconomicComponentType.GIG_ECONOMY]: {
      baseEffectiveness: 65,
      economicImpact: 1.08,
      taxImpact: 0.9,
      stabilityImpact: 2,
      legitimacyImpact: 4,
    },
    [EconomicComponentType.PROFESSIONAL_SERVICES]: {
      baseEffectiveness: 85,
      economicImpact: 1.12,
      taxImpact: 1.1,
      stabilityImpact: 8,
      legitimacyImpact: 10,
    },
    [EconomicComponentType.SKILL_BASED]: {
      baseEffectiveness: 80,
      economicImpact: 1.1,
      taxImpact: 1.05,
      stabilityImpact: 8,
      legitimacyImpact: 9,
    },
    [EconomicComponentType.EDUCATION_FIRST]: {
      baseEffectiveness: 85,
      economicImpact: 1.15,
      taxImpact: 1.08,
      stabilityImpact: 10,
      legitimacyImpact: 12,
    },
    [EconomicComponentType.MERIT_BASED]: {
      baseEffectiveness: 88,
      economicImpact: 1.12,
      taxImpact: 1.05,
      stabilityImpact: 9,
      legitimacyImpact: 11,
    },
    [EconomicComponentType.HIGH_SKILLED_WORKERS]: {
      baseEffectiveness: 90,
      economicImpact: 1.18,
      taxImpact: 1.12,
      stabilityImpact: 10,
      legitimacyImpact: 12,
    },
    [EconomicComponentType.EDUCATION_FOCUSED]: {
      baseEffectiveness: 85,
      economicImpact: 1.15,
      taxImpact: 1.08,
      stabilityImpact: 10,
      legitimacyImpact: 12,
    },
    [EconomicComponentType.HEALTHCARE_FOCUSED]: {
      baseEffectiveness: 80,
      economicImpact: 1.05,
      taxImpact: 1.1,
      stabilityImpact: 12,
      legitimacyImpact: 12,
    },
    [EconomicComponentType.VOCATIONAL_TRAINING]: {
      baseEffectiveness: 75,
      economicImpact: 1.08,
      taxImpact: 1.05,
      stabilityImpact: 8,
      legitimacyImpact: 9,
    },

    // Trade Policy Components
    [EconomicComponentType.FREE_TRADE]: {
      baseEffectiveness: 80,
      economicImpact: 1.12,
      taxImpact: 1.05,
      stabilityImpact: 6,
      legitimacyImpact: 8,
    },
    [EconomicComponentType.PROTECTIONIST]: {
      baseEffectiveness: 60,
      economicImpact: 0.9,
      taxImpact: 1.0,
      stabilityImpact: 8,
      legitimacyImpact: 6,
    },
    [EconomicComponentType.BALANCED_TRADE]: {
      baseEffectiveness: 75,
      economicImpact: 1.05,
      taxImpact: 1.02,
      stabilityImpact: 8,
      legitimacyImpact: 9,
    },
    [EconomicComponentType.EXPORT_SUBSIDY]: {
      baseEffectiveness: 70,
      economicImpact: 1.08,
      taxImpact: 0.95,
      stabilityImpact: 5,
      legitimacyImpact: 6,
    },
    [EconomicComponentType.IMPORT_SUBSTITUTION]: {
      baseEffectiveness: 65,
      economicImpact: 0.95,
      taxImpact: 1.05,
      stabilityImpact: 7,
      legitimacyImpact: 7,
    },
    [EconomicComponentType.TRADE_BLOC]: {
      baseEffectiveness: 78,
      economicImpact: 1.1,
      taxImpact: 1.08,
      stabilityImpact: 8,
      legitimacyImpact: 9,
    },
    [EconomicComponentType.BILATERAL_FOCUS]: {
      baseEffectiveness: 72,
      economicImpact: 1.05,
      taxImpact: 1.03,
      stabilityImpact: 7,
      legitimacyImpact: 8,
    },
    [EconomicComponentType.MULTILATERAL_FOCUS]: {
      baseEffectiveness: 80,
      economicImpact: 1.08,
      taxImpact: 1.05,
      stabilityImpact: 8,
      legitimacyImpact: 10,
    },
    [EconomicComponentType.TRADE_FACILITATION]: {
      baseEffectiveness: 85,
      economicImpact: 1.12,
      taxImpact: 1.08,
      stabilityImpact: 9,
      legitimacyImpact: 10,
    },
    [EconomicComponentType.COMPETITIVE_MARKETS]: {
      baseEffectiveness: 88,
      economicImpact: 1.15,
      taxImpact: 1.05,
      stabilityImpact: 8,
      legitimacyImpact: 10,
    },

    // Innovation Components
    [EconomicComponentType.RD_INVESTMENT]: {
      baseEffectiveness: 90,
      economicImpact: 1.2,
      taxImpact: 1.1,
      stabilityImpact: 10,
      legitimacyImpact: 12,
    },
    [EconomicComponentType.TECH_TRANSFER]: {
      baseEffectiveness: 85,
      economicImpact: 1.15,
      taxImpact: 1.08,
      stabilityImpact: 9,
      legitimacyImpact: 10,
    },
    [EconomicComponentType.STARTUP_ECOSYSTEM]: {
      baseEffectiveness: 88,
      economicImpact: 1.18,
      taxImpact: 1.05,
      stabilityImpact: 8,
      legitimacyImpact: 9,
    },
    [EconomicComponentType.PATENT_PROTECTION]: {
      baseEffectiveness: 82,
      economicImpact: 1.12,
      taxImpact: 1.08,
      stabilityImpact: 8,
      legitimacyImpact: 9,
    },
    [EconomicComponentType.OPEN_INNOVATION]: {
      baseEffectiveness: 85,
      economicImpact: 1.15,
      taxImpact: 1.05,
      stabilityImpact: 9,
      legitimacyImpact: 10,
    },
    [EconomicComponentType.UNIVERSITY_PARTNERSHIPS]: {
      baseEffectiveness: 87,
      economicImpact: 1.16,
      taxImpact: 1.08,
      stabilityImpact: 10,
      legitimacyImpact: 11,
    },
    [EconomicComponentType.VENTURE_CAPITAL]: {
      baseEffectiveness: 85,
      economicImpact: 1.18,
      taxImpact: 1.05,
      stabilityImpact: 7,
      legitimacyImpact: 8,
    },
    [EconomicComponentType.INTELLECTUAL_PROPERTY]: {
      baseEffectiveness: 80,
      economicImpact: 1.1,
      taxImpact: 1.08,
      stabilityImpact: 8,
      legitimacyImpact: 9,
    },
    [EconomicComponentType.RESEARCH_AND_DEVELOPMENT]: {
      baseEffectiveness: 90,
      economicImpact: 1.2,
      taxImpact: 1.1,
      stabilityImpact: 10,
      legitimacyImpact: 12,
    },

    // Resource Management Components
    [EconomicComponentType.SUSTAINABLE_DEVELOPMENT]: {
      baseEffectiveness: 85,
      economicImpact: 1.08,
      taxImpact: 1.05,
      stabilityImpact: 12,
      legitimacyImpact: 12,
    },
    [EconomicComponentType.EXTRACTION_FOCUSED]: {
      baseEffectiveness: 60,
      economicImpact: 0.9,
      taxImpact: 1.0,
      stabilityImpact: 3,
      legitimacyImpact: 5,
    },
    [EconomicComponentType.RENEWABLE_ENERGY]: {
      baseEffectiveness: 88,
      economicImpact: 1.12,
      taxImpact: 1.08,
      stabilityImpact: 12,
      legitimacyImpact: 12,
    },
    [EconomicComponentType.CIRCULAR_ECONOMY]: {
      baseEffectiveness: 90,
      economicImpact: 1.15,
      taxImpact: 1.1,
      stabilityImpact: 12,
      legitimacyImpact: 12,
    },
    [EconomicComponentType.LINEAR_ECONOMY]: {
      baseEffectiveness: 50,
      economicImpact: 0.85,
      taxImpact: 0.95,
      stabilityImpact: 2,
      legitimacyImpact: 3,
    },
    [EconomicComponentType.CONSERVATION_FIRST]: {
      baseEffectiveness: 85,
      economicImpact: 1.05,
      taxImpact: 1.08,
      stabilityImpact: 12,
      legitimacyImpact: 12,
    },
    [EconomicComponentType.GREEN_TECHNOLOGY]: {
      baseEffectiveness: 90,
      economicImpact: 1.18,
      taxImpact: 1.1,
      stabilityImpact: 12,
      legitimacyImpact: 12,
    },
    [EconomicComponentType.CARBON_NEUTRAL]: {
      baseEffectiveness: 92,
      economicImpact: 1.15,
      taxImpact: 1.12,
      stabilityImpact: 12,
      legitimacyImpact: 12,
    },
    [EconomicComponentType.CARBON_INTENSIVE]: {
      baseEffectiveness: 40,
      economicImpact: 0.8,
      taxImpact: 0.9,
      stabilityImpact: -5,
      legitimacyImpact: 2,
    },
    [EconomicComponentType.ECO_FRIENDLY]: {
      baseEffectiveness: 88,
      economicImpact: 1.1,
      taxImpact: 1.08,
      stabilityImpact: 12,
      legitimacyImpact: 12,
    },
    [EconomicComponentType.GREEN_ECONOMY]: {
      baseEffectiveness: 90,
      economicImpact: 1.15,
      taxImpact: 1.1,
      stabilityImpact: 12,
      legitimacyImpact: 12,
    },

    // Real Estate & Property Components
    [EconomicComponentType.REAL_ESTATE_FOCUSED]: {
      baseEffectiveness: 70,
      economicImpact: 1.05,
      taxImpact: 1.15,
      stabilityImpact: 6,
      legitimacyImpact: 7,
    },
    [EconomicComponentType.RULE_OF_LAW]: {
      baseEffectiveness: 95,
      economicImpact: 1.2,
      taxImpact: 1.15,
      stabilityImpact: 15,
      legitimacyImpact: 15,
    },
  };

// Tax component effectiveness lookup table
const TAX_COMPONENT_EFFECTIVENESS: Record<TaxComponentType, ComponentEffectivenessData> = {
  // Tax System Components
  [TaxComponentType.PROGRESSIVE_TAX]: {
    baseEffectiveness: 80,
    economicImpact: 1.05,
    taxImpact: 1.2,
    stabilityImpact: 10,
    legitimacyImpact: 12,
  },
  [TaxComponentType.FLAT_TAX]: {
    baseEffectiveness: 75,
    economicImpact: 1.08,
    taxImpact: 1.1,
    stabilityImpact: 8,
    legitimacyImpact: 8,
  },
  [TaxComponentType.REGRESSIVE_TAX]: {
    baseEffectiveness: 60,
    economicImpact: 1.02,
    taxImpact: 1.05,
    stabilityImpact: 5,
    legitimacyImpact: 4,
  },
  [TaxComponentType.CONSUMPTION_TAX]: {
    baseEffectiveness: 70,
    economicImpact: 1.05,
    taxImpact: 1.15,
    stabilityImpact: 6,
    legitimacyImpact: 6,
  },
  [TaxComponentType.WEALTH_TAX]: {
    baseEffectiveness: 85,
    economicImpact: 1.0,
    taxImpact: 1.25,
    stabilityImpact: 12,
    legitimacyImpact: 12,
  },
  [TaxComponentType.INHERITANCE_TAX]: {
    baseEffectiveness: 80,
    economicImpact: 1.02,
    taxImpact: 1.18,
    stabilityImpact: 10,
    legitimacyImpact: 10,
  },
  [TaxComponentType.CAPITAL_GAINS_TAX]: {
    baseEffectiveness: 75,
    economicImpact: 1.05,
    taxImpact: 1.15,
    stabilityImpact: 8,
    legitimacyImpact: 8,
  },
  [TaxComponentType.CORPORATE_TAX]: {
    baseEffectiveness: 70,
    economicImpact: 1.08,
    taxImpact: 1.2,
    stabilityImpact: 6,
    legitimacyImpact: 7,
  },
  [TaxComponentType.PAYROLL_TAX]: {
    baseEffectiveness: 65,
    economicImpact: 1.0,
    taxImpact: 1.1,
    stabilityImpact: 8,
    legitimacyImpact: 8,
  },
  [TaxComponentType.PROPERTY_TAX]: {
    baseEffectiveness: 75,
    economicImpact: 1.02,
    taxImpact: 1.15,
    stabilityImpact: 8,
    legitimacyImpact: 8,
  },
  [TaxComponentType.SALES_TAX]: {
    baseEffectiveness: 70,
    economicImpact: 1.05,
    taxImpact: 1.12,
    stabilityImpact: 6,
    legitimacyImpact: 6,
  },
  [TaxComponentType.VAT_TAX]: {
    baseEffectiveness: 80,
    economicImpact: 1.08,
    taxImpact: 1.18,
    stabilityImpact: 8,
    legitimacyImpact: 9,
  },
  [TaxComponentType.CARBON_TAX]: {
    baseEffectiveness: 85,
    economicImpact: 1.05,
    taxImpact: 1.1,
    stabilityImpact: 12,
    legitimacyImpact: 12,
  },
  [TaxComponentType.FINANCIAL_TRANSACTION_TAX]: {
    baseEffectiveness: 75,
    economicImpact: 1.02,
    taxImpact: 1.15,
    stabilityImpact: 8,
    legitimacyImpact: 8,
  },
  [TaxComponentType.DIGITAL_SERVICES_TAX]: {
    baseEffectiveness: 80,
    economicImpact: 1.05,
    taxImpact: 1.12,
    stabilityImpact: 8,
    legitimacyImpact: 9,
  },

  // Tax Administration Components
  [TaxComponentType.AUTOMATED_COLLECTION]: {
    baseEffectiveness: 90,
    economicImpact: 1.1,
    taxImpact: 1.25,
    stabilityImpact: 10,
    legitimacyImpact: 10,
  },
  [TaxComponentType.MANUAL_COLLECTION]: {
    baseEffectiveness: 60,
    economicImpact: 0.95,
    taxImpact: 0.9,
    stabilityImpact: 5,
    legitimacyImpact: 5,
  },
  [TaxComponentType.THIRD_PARTY_REPORTING]: {
    baseEffectiveness: 85,
    economicImpact: 1.08,
    taxImpact: 1.2,
    stabilityImpact: 10,
    legitimacyImpact: 10,
  },
  [TaxComponentType.WITHHOLDING_SYSTEM]: {
    baseEffectiveness: 80,
    economicImpact: 1.05,
    taxImpact: 1.15,
    stabilityImpact: 8,
    legitimacyImpact: 8,
  },
  [TaxComponentType.SELF_ASSESSMENT]: {
    baseEffectiveness: 70,
    economicImpact: 1.02,
    taxImpact: 1.05,
    stabilityImpact: 6,
    legitimacyImpact: 7,
  },
  [TaxComponentType.AUDIT_SYSTEM]: {
    baseEffectiveness: 85,
    economicImpact: 1.05,
    taxImpact: 1.2,
    stabilityImpact: 10,
    legitimacyImpact: 10,
  },
  [TaxComponentType.COMPLIANCE_MONITORING]: {
    baseEffectiveness: 88,
    economicImpact: 1.08,
    taxImpact: 1.22,
    stabilityImpact: 12,
    legitimacyImpact: 11,
  },
  [TaxComponentType.TAX_COURTS]: {
    baseEffectiveness: 90,
    economicImpact: 1.1,
    taxImpact: 1.25,
    stabilityImpact: 12,
    legitimacyImpact: 12,
  },
  [TaxComponentType.APPEALS_PROCESS]: {
    baseEffectiveness: 85,
    economicImpact: 1.05,
    taxImpact: 1.18,
    stabilityImpact: 10,
    legitimacyImpact: 11,
  },
  [TaxComponentType.PENALTY_SYSTEM]: {
    baseEffectiveness: 80,
    economicImpact: 1.02,
    taxImpact: 1.15,
    stabilityImpact: 8,
    legitimacyImpact: 8,
  },

  // Tax Technology Components
  [TaxComponentType.E_FILING_SYSTEM]: {
    baseEffectiveness: 90,
    economicImpact: 1.12,
    taxImpact: 1.25,
    stabilityImpact: 10,
    legitimacyImpact: 10,
  },
  [TaxComponentType.DIGITAL_PAYMENTS]: {
    baseEffectiveness: 88,
    economicImpact: 1.1,
    taxImpact: 1.22,
    stabilityImpact: 9,
    legitimacyImpact: 9,
  },
  [TaxComponentType.BLOCKCHAIN_TRACKING]: {
    baseEffectiveness: 92,
    economicImpact: 1.15,
    taxImpact: 1.28,
    stabilityImpact: 12,
    legitimacyImpact: 11,
  },
  [TaxComponentType.AI_AUDIT]: {
    baseEffectiveness: 95,
    economicImpact: 1.18,
    taxImpact: 1.3,
    stabilityImpact: 12,
    legitimacyImpact: 12,
  },
  [TaxComponentType.PREDICTIVE_ANALYTICS]: {
    baseEffectiveness: 90,
    economicImpact: 1.12,
    taxImpact: 1.25,
    stabilityImpact: 10,
    legitimacyImpact: 10,
  },
  [TaxComponentType.RISK_ASSESSMENT]: {
    baseEffectiveness: 88,
    economicImpact: 1.08,
    taxImpact: 1.22,
    stabilityImpact: 10,
    legitimacyImpact: 10,
  },
  [TaxComponentType.DATA_MINING]: {
    baseEffectiveness: 85,
    economicImpact: 1.05,
    taxImpact: 1.2,
    stabilityImpact: 8,
    legitimacyImpact: 8,
  },
  [TaxComponentType.CROSS_BORDER_COORDINATION]: {
    baseEffectiveness: 90,
    economicImpact: 1.15,
    taxImpact: 1.25,
    stabilityImpact: 12,
    legitimacyImpact: 12,
  },

  // Tax Policy Components
  [TaxComponentType.TAX_INCENTIVES]: {
    baseEffectiveness: 85,
    economicImpact: 1.15,
    taxImpact: 0.9,
    stabilityImpact: 8,
    legitimacyImpact: 8,
  },
  [TaxComponentType.TAX_HOLIDAYS]: {
    baseEffectiveness: 80,
    economicImpact: 1.12,
    taxImpact: 0.85,
    stabilityImpact: 6,
    legitimacyImpact: 6,
  },
  [TaxComponentType.TAX_EXEMPTIONS]: {
    baseEffectiveness: 75,
    economicImpact: 1.08,
    taxImpact: 0.8,
    stabilityImpact: 5,
    legitimacyImpact: 5,
  },
  [TaxComponentType.TAX_CREDITS]: {
    baseEffectiveness: 82,
    economicImpact: 1.1,
    taxImpact: 0.88,
    stabilityImpact: 7,
    legitimacyImpact: 7,
  },
  [TaxComponentType.TAX_DEDUCTIONS]: {
    baseEffectiveness: 78,
    economicImpact: 1.05,
    taxImpact: 0.92,
    stabilityImpact: 6,
    legitimacyImpact: 6,
  },
  [TaxComponentType.TAX_AMNESTY]: {
    baseEffectiveness: 70,
    economicImpact: 1.02,
    taxImpact: 1.05,
    stabilityImpact: 4,
    legitimacyImpact: 4,
  },
  [TaxComponentType.TAX_AVOIDANCE_PREVENTION]: {
    baseEffectiveness: 90,
    economicImpact: 1.08,
    taxImpact: 1.25,
    stabilityImpact: 12,
    legitimacyImpact: 12,
  },
  [TaxComponentType.TAX_EVASION_PREVENTION]: {
    baseEffectiveness: 92,
    economicImpact: 1.1,
    taxImpact: 1.28,
    stabilityImpact: 12,
    legitimacyImpact: 12,
  },
  [TaxComponentType.TAX_FAIRNESS]: {
    baseEffectiveness: 95,
    economicImpact: 1.12,
    taxImpact: 1.2,
    stabilityImpact: 15,
    legitimacyImpact: 15,
  },
  [TaxComponentType.TAX_SIMPLIFICATION]: {
    baseEffectiveness: 88,
    economicImpact: 1.15,
    taxImpact: 1.18,
    stabilityImpact: 10,
    legitimacyImpact: 10,
  },
};

// Synergy definitions
const SYNERGY_COMBINATIONS: Array<{
  components: ComponentType[];
  economicBonus: number;
  taxBonus: number;
  stabilityBonus: number;
  description: string;
}> = [
  {
    components: [ComponentType.TECHNOCRATIC_PROCESS, ComponentType.PROFESSIONAL_BUREAUCRACY],
    economicBonus: 0.15,
    taxBonus: 0.2,
    stabilityBonus: 10,
    description: "Optimal policy implementation synergy",
  },
  {
    components: [ComponentType.RULE_OF_LAW, ComponentType.INDEPENDENT_JUDICIARY],
    economicBonus: 0.12,
    taxBonus: 0.15,
    stabilityBonus: 15,
    description: "Strong institutional framework synergy",
  },
  {
    components: [ComponentType.DEMOCRATIC_PROCESS, ComponentType.ELECTORAL_LEGITIMACY],
    economicBonus: 0.08,
    taxBonus: 0.1,
    stabilityBonus: 12,
    description: "Democratic legitimacy synergy",
  },
  {
    components: [ComponentType.PERFORMANCE_LEGITIMACY, ComponentType.TECHNOCRATIC_AGENCIES],
    economicBonus: 0.18,
    taxBonus: 0.12,
    stabilityBonus: 8,
    description: "Results-driven governance synergy",
  },
];

// Conflict definitions
const CONFLICT_COMBINATIONS: Array<{
  components: ComponentType[];
  economicPenalty: number;
  taxPenalty: number;
  stabilityPenalty: number;
  description: string;
}> = [
  {
    components: [ComponentType.DEMOCRATIC_PROCESS, ComponentType.SURVEILLANCE_SYSTEM],
    economicPenalty: 0.1,
    taxPenalty: 0.05,
    stabilityPenalty: 8,
    description: "Democratic surveillance conflict",
  },
  {
    components: [ComponentType.MILITARY_ADMINISTRATION, ComponentType.ELECTORAL_LEGITIMACY],
    economicPenalty: 0.08,
    taxPenalty: 0.0,
    stabilityPenalty: 12,
    description: "Military-electoral tension",
  },
  {
    components: [ComponentType.PARTISAN_INSTITUTIONS, ComponentType.RULE_OF_LAW],
    economicPenalty: 0.15,
    taxPenalty: 0.1,
    stabilityPenalty: 15,
    description: "Partisan capture of institutions",
  },
];

/**
 * Calculate economic modifiers from atomic components (client-safe)
 */
export function calculateClientAtomicEconomicImpact(
  components: ComponentType[],
  baseGdpPerCapita: number = 15000,
  baseTaxRevenue: number = 0.2
): ClientAtomicEconomicModifiers {
  if (components.length === 0) {
    return {
      taxCollectionMultiplier: 1.0,
      gdpGrowthModifier: 1.0,
      stabilityBonus: 0,
      innovationMultiplier: 1.0,
      internationalTradeBonus: 0,
      governmentEfficiencyMultiplier: 1.0,
      gdpImpact: 0,
      stabilityIndex: 50,
      internationalStanding: 50,
      taxEfficiency: 1.0,
    };
  }

  let modifiers: ClientAtomicEconomicModifiers = {
    taxCollectionMultiplier: 1.0,
    gdpGrowthModifier: 1.0,
    stabilityBonus: 0,
    innovationMultiplier: 1.0,
    internationalTradeBonus: 0,
    governmentEfficiencyMultiplier: 1.0,
    gdpImpact: 0,
    stabilityIndex: 50,
    internationalStanding: 50,
    taxEfficiency: 1.0,
  };

  // Apply base component effects
  components.forEach((component) => {
    const data = COMPONENT_EFFECTIVENESS[component];
    if (data) {
      modifiers.taxCollectionMultiplier *= data.taxImpact;
      modifiers.gdpGrowthModifier *= data.economicImpact;
      modifiers.stabilityBonus += data.stabilityImpact;
      modifiers.governmentEfficiencyMultiplier *= data.baseEffectiveness / 70; // Normalize around 70

      // Innovation effects (primarily from technocratic components)
      if (
        [ComponentType.TECHNOCRATIC_PROCESS, ComponentType.TECHNOCRATIC_AGENCIES].includes(
          component as any
        )
      ) {
        modifiers.innovationMultiplier *= 1.15;
      }

      // International trade bonuses (from rule of law, stability)
      if (
        [ComponentType.RULE_OF_LAW, ComponentType.INDEPENDENT_JUDICIARY].includes(component as any)
      ) {
        modifiers.internationalTradeBonus += 5;
      }
    }
  });

  // Apply synergy bonuses
  SYNERGY_COMBINATIONS.forEach((synergy) => {
    if (synergy.components.every((comp) => components.includes(comp))) {
      modifiers.gdpGrowthModifier *= 1 + synergy.economicBonus;
      modifiers.taxCollectionMultiplier *= 1 + synergy.taxBonus;
      modifiers.stabilityBonus += synergy.stabilityBonus;
    }
  });

  // Apply conflict penalties
  CONFLICT_COMBINATIONS.forEach((conflict) => {
    if (conflict.components.every((comp) => components.includes(comp))) {
      modifiers.gdpGrowthModifier *= 1 - conflict.economicPenalty;
      modifiers.taxCollectionMultiplier *= 1 - conflict.taxPenalty;
      modifiers.stabilityBonus -= conflict.stabilityPenalty;
    }
  });

  return modifiers;
}

/**
 * Get component effectiveness breakdown (client-safe)
 */
export function getComponentBreakdown(components: ComponentType[]) {
  return components.map((component) => ({
    type: component,
    ...COMPONENT_EFFECTIVENESS[component],
  }));
}

/**
 * Detect potential synergies (client-safe)
 */
export function detectPotentialSynergies(components: ComponentType[]) {
  return SYNERGY_COMBINATIONS.filter((synergy) =>
    synergy.components.every((comp) => components.includes(comp))
  );
}

/**
 * Detect conflicts (client-safe)
 */
export function detectConflicts(components: ComponentType[]) {
  return CONFLICT_COMBINATIONS.filter((conflict) =>
    conflict.components.every((comp) => components.includes(comp))
  );
}

/**
 * Calculate overall effectiveness score (client-safe)
 */
export function calculateOverallEffectiveness(components: ComponentType[]): number {
  if (components.length === 0) return 0;

  // Base effectiveness
  const baseScore =
    components.reduce((sum, comp) => {
      return sum + (COMPONENT_EFFECTIVENESS[comp]?.baseEffectiveness || 50);
    }, 0) / components.length;

  // Synergy bonuses
  const synergies = detectPotentialSynergies(components);
  const synergyBonus = synergies.length * 5; // 5 points per synergy

  // Conflict penalties
  const conflicts = detectConflicts(components);
  const conflictPenalty = conflicts.length * 8; // 8 points penalty per conflict

  return Math.max(0, Math.min(100, baseScore + synergyBonus - conflictPenalty));
}

/**
 * Calculate economic component modifiers (client-safe)
 */
export function calculateEconomicComponentModifiers(
  economicComponents: EconomicComponentType[]
): ClientAtomicEconomicModifiers {
  const modifiers: ClientAtomicEconomicModifiers = {
    taxCollectionMultiplier: 1.0,
    gdpGrowthModifier: 1.0,
    stabilityBonus: 0,
    innovationMultiplier: 1.0,
    internationalTradeBonus: 0,
    governmentEfficiencyMultiplier: 1.0,
    gdpImpact: 0,
    stabilityIndex: 50,
    internationalStanding: 50,
    taxEfficiency: 1.0,
  };

  if (economicComponents.length === 0) {
    return modifiers;
  }

  // Apply base component effects
  economicComponents.forEach((component) => {
    const effectiveness = ECONOMIC_COMPONENT_EFFECTIVENESS[component];
    if (effectiveness) {
      modifiers.gdpGrowthModifier *= effectiveness.economicImpact;
      modifiers.taxCollectionMultiplier *= effectiveness.taxImpact;
      modifiers.stabilityBonus += effectiveness.stabilityImpact;
      modifiers.innovationMultiplier *= effectiveness.economicImpact;
      modifiers.internationalTradeBonus += effectiveness.economicImpact > 1.1 ? 5 : 0;
      modifiers.governmentEfficiencyMultiplier *= effectiveness.economicImpact;
    }
  });

  return modifiers;
}

/**
 * Calculate tax component modifiers (client-safe)
 */
export function calculateTaxComponentModifiers(
  taxComponents: TaxComponentType[]
): ClientAtomicEconomicModifiers {
  const modifiers: ClientAtomicEconomicModifiers = {
    taxCollectionMultiplier: 1.0,
    gdpGrowthModifier: 1.0,
    stabilityBonus: 0,
    innovationMultiplier: 1.0,
    internationalTradeBonus: 0,
    governmentEfficiencyMultiplier: 1.0,
    gdpImpact: 0,
    stabilityIndex: 50,
    internationalStanding: 50,
    taxEfficiency: 1.0,
  };

  if (taxComponents.length === 0) {
    return modifiers;
  }

  // Apply base component effects
  taxComponents.forEach((component) => {
    const effectiveness = TAX_COMPONENT_EFFECTIVENESS[component];
    if (effectiveness) {
      modifiers.gdpGrowthModifier *= effectiveness.economicImpact;
      modifiers.taxCollectionMultiplier *= effectiveness.taxImpact;
      modifiers.stabilityBonus += effectiveness.stabilityImpact;
      modifiers.taxEfficiency = (modifiers.taxEfficiency ?? 1.0) * effectiveness.taxImpact;
      modifiers.governmentEfficiencyMultiplier *= effectiveness.economicImpact;
    }
  });

  return modifiers;
}

/**
 * Calculate atomic economic modifiers (alias for backward compatibility)
 */
export function calculateAtomicEconomicModifiers(
  components: ComponentType[],
  baseGdpPerCapita: number = 15000,
  baseTaxRevenue: number = 0.2
): ClientAtomicEconomicModifiers {
  return calculateClientAtomicEconomicImpact(components, baseGdpPerCapita, baseTaxRevenue);
}

/**
 * Calculate unified atomic modifiers (all component types)
 */
export function calculateUnifiedAtomicModifiers(
  governmentComponents: ComponentType[],
  economicComponents: EconomicComponentType[],
  taxComponents: TaxComponentType[]
): ClientAtomicEconomicModifiers {
  // Get individual modifiers
  const governmentModifiers = calculateClientAtomicEconomicImpact(governmentComponents);
  const economicModifiers = calculateEconomicComponentModifiers(economicComponents);
  const taxModifiers = calculateTaxComponentModifiers(taxComponents);

  // Combine modifiers
  const combinedModifiers: ClientAtomicEconomicModifiers = {
    taxCollectionMultiplier:
      governmentModifiers.taxCollectionMultiplier *
      economicModifiers.taxCollectionMultiplier *
      taxModifiers.taxCollectionMultiplier,
    gdpGrowthModifier:
      governmentModifiers.gdpGrowthModifier *
      economicModifiers.gdpGrowthModifier *
      taxModifiers.gdpGrowthModifier,
    stabilityBonus:
      governmentModifiers.stabilityBonus +
      economicModifiers.stabilityBonus +
      taxModifiers.stabilityBonus,
    innovationMultiplier:
      governmentModifiers.innovationMultiplier *
      economicModifiers.innovationMultiplier *
      taxModifiers.innovationMultiplier,
    internationalTradeBonus:
      governmentModifiers.internationalTradeBonus +
      economicModifiers.internationalTradeBonus +
      taxModifiers.internationalTradeBonus,
    governmentEfficiencyMultiplier:
      governmentModifiers.governmentEfficiencyMultiplier *
      economicModifiers.governmentEfficiencyMultiplier *
      taxModifiers.governmentEfficiencyMultiplier,
    gdpImpact:
      (governmentModifiers.gdpImpact ?? 0) +
      (economicModifiers.gdpImpact ?? 0) +
      (taxModifiers.gdpImpact ?? 0),
    stabilityIndex: Math.min(
      100,
      Math.max(
        0,
        ((governmentModifiers.stabilityIndex ?? 50) +
          (economicModifiers.stabilityIndex ?? 50) +
          (taxModifiers.stabilityIndex ?? 50)) /
          3
      )
    ),
    internationalStanding: Math.min(
      100,
      Math.max(
        0,
        ((governmentModifiers.internationalStanding ?? 50) +
          (economicModifiers.internationalStanding ?? 50) +
          (taxModifiers.internationalStanding ?? 50)) /
          3
      )
    ),
    taxEfficiency:
      (governmentModifiers.taxEfficiency ?? 1.0) *
      (economicModifiers.taxEfficiency ?? 1.0) *
      (taxModifiers.taxEfficiency ?? 1.0),
  };

  return combinedModifiers;
}

/**
 * Get economic component effectiveness breakdown (client-safe)
 */
export function getEconomicComponentBreakdown(economicComponents: EconomicComponentType[]) {
  return economicComponents.map((component) => ({
    type: component,
    ...ECONOMIC_COMPONENT_EFFECTIVENESS[component],
  }));
}

/**
 * Get tax component effectiveness breakdown (client-safe)
 */
export function getTaxComponentBreakdown(taxComponents: TaxComponentType[]) {
  return taxComponents.map((component) => ({
    type: component,
    ...TAX_COMPONENT_EFFECTIVENESS[component],
  }));
}

/**
 * Calculate overall effectiveness score for all component types (client-safe)
 */
export function calculateUnifiedEffectiveness(
  governmentComponents: ComponentType[],
  economicComponents: EconomicComponentType[],
  taxComponents: TaxComponentType[]
): number {
  const governmentScore = calculateOverallEffectiveness(governmentComponents);
  const economicScore =
    economicComponents.length > 0
      ? economicComponents.reduce((sum, comp) => {
          return sum + (ECONOMIC_COMPONENT_EFFECTIVENESS[comp]?.baseEffectiveness || 50);
        }, 0) / economicComponents.length
      : 0;
  const taxScore =
    taxComponents.length > 0
      ? taxComponents.reduce((sum, comp) => {
          return sum + (TAX_COMPONENT_EFFECTIVENESS[comp]?.baseEffectiveness || 50);
        }, 0) / taxComponents.length
      : 0;

  // Weighted average with government components having higher weight
  const totalComponents =
    governmentComponents.length + economicComponents.length + taxComponents.length;
  if (totalComponents === 0) return 0;

  const weightedScore = governmentScore * 0.4 + economicScore * 0.35 + taxScore * 0.25;

  return Math.max(0, Math.min(100, weightedScore));
}
