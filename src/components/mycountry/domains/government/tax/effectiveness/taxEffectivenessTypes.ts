import type React from "react";
import type { TaxSystem } from "~/types/tax-system";
import type { ComponentType } from "~/types/government";
import type { CoreEconomicIndicatorsData } from "~/types/economics";
import {
  calculateAtomicTaxEffectiveness,
  getAtomicTaxRecommendations,
} from "~/lib/economy/atomic-tax-integration";

export interface TaxComponent {
  id: string;
  type: string;
  name: string;
  effectiveness: number;
}

export interface GovernmentComponent {
  id: string;
  type: ComponentType;
  name: string;
  effectiveness: number;
}

export interface UnifiedTaxEffectivenessDisplayProps {
  taxComponents?: TaxComponent[];
  governmentComponents?: GovernmentComponent[];
  economicData?: CoreEconomicIndicatorsData;
  taxSystem?: TaxSystem;
  onViewDetails?: () => void;
  className?: string;
}

export interface EconomicImpact {
  gdpGrowthEffect: number;
  inequalityEffect: number;
  investmentEffect: number;
  spendingEffect: number;
}

export interface UnifiedEffectiveness {
  overallScore: number;
  collectionEfficiency: number;
  complianceRate: number;
  auditCapacity: number;
  synergies: string[];
  conflicts: string[];
  economicImpact: EconomicImpact;
  governmentIntegration: {
    digitalInfrastructure: boolean;
    enforcementCapacity: number;
    institutionalQuality: number;
    administrativeEfficiency: number;
  };
}

export function computeUnifiedTaxEffectiveness(
  taxComponents: TaxComponent[] = [],
  governmentComponents: GovernmentComponent[] = [],
  economicData?: CoreEconomicIndicatorsData,
  taxSystem?: TaxSystem
): UnifiedEffectiveness {
  // Base tax system metrics
  const baseTaxSystem = {
    collectionEfficiency: taxSystem?.collectionEfficiency || 65,
    complianceRate: taxSystem?.complianceRate || 70,
    auditCapacity: 50,
  };

  // Get atomic tax effectiveness from government components
  const componentTypes = governmentComponents.map((c) => c.type);
  const atomicEffectiveness = calculateAtomicTaxEffectiveness(componentTypes, baseTaxSystem);
  // Recommendations available if needed
  void getAtomicTaxRecommendations(componentTypes);

  // Calculate tax component contribution
  const taxComponentBonus =
    taxComponents.length > 0
      ? (taxComponents.reduce((sum, c) => sum + c.effectiveness, 0) / taxComponents.length) * 0.1
      : 0;

  // Calculate economic impact
  const baseGrowth = economicData?.realGDPGrowthRate || 0.03;
  const baseInequality = economicData?.giniCoefficient || 40;

  const economicImpact: EconomicImpact = {
    gdpGrowthEffect: baseGrowth * (atomicEffectiveness.effectivenessScore / 100) * 1.2,
    inequalityEffect: baseInequality - (atomicEffectiveness.complianceRate / 100) * 5,
    investmentEffect: (atomicEffectiveness.collectionEfficiency / 100) * 15,
    spendingEffect: (atomicEffectiveness.effectivenessScore / 100) * 20,
  };

  // Check for government integration benefits
  const hasDigitalInfrastructure =
    componentTypes.includes("DIGITAL_GOVERNMENT" as ComponentType) ||
    componentTypes.includes("DIGITAL_INFRASTRUCTURE" as ComponentType);
  const hasProfessionalBureaucracy = componentTypes.includes(
    "PROFESSIONAL_BUREAUCRACY" as ComponentType
  );
  const hasTechnocraticAgencies = componentTypes.includes(
    "TECHNOCRATIC_AGENCIES" as ComponentType
  );
  const hasRuleOfLaw = componentTypes.includes("RULE_OF_LAW" as ComponentType);

  const governmentIntegration = {
    digitalInfrastructure: hasDigitalInfrastructure,
    enforcementCapacity: (hasProfessionalBureaucracy ? 30 : 0) + (hasRuleOfLaw ? 25 : 0) + 45,
    institutionalQuality:
      (hasProfessionalBureaucracy ? 25 : 0) + (hasTechnocraticAgencies ? 30 : 0) + 45,
    administrativeEfficiency:
      (hasDigitalInfrastructure ? 35 : 0) + (hasProfessionalBureaucracy ? 20 : 0) + 45,
  };

  return {
    overallScore: Math.min(100, atomicEffectiveness.effectivenessScore + taxComponentBonus),
    collectionEfficiency: atomicEffectiveness.collectionEfficiency,
    complianceRate: atomicEffectiveness.complianceRate,
    auditCapacity: atomicEffectiveness.auditCapacity,
    synergies: atomicEffectiveness.synergies,
    conflicts: atomicEffectiveness.conflicts,
    economicImpact,
    governmentIntegration,
  };
}

export const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

export const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export function getEffectivenessColor(score: number): string {
  if (score >= 80) return "text-green-600 dark:text-green-400";
  if (score >= 60) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

export function getEffectivenessBgColor(score: number): string {
  if (score >= 80) {
    return "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800";
  }
  if (score >= 60) {
    return "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800";
  }
  return "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800";
}

export function getEffectivenessLabel(score: number): string {
  if (score >= 90) return "Exceptional";
  if (score >= 80) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 60) return "Fair";
  if (score >= 50) return "Needs Work";
  return "Critical";
}
