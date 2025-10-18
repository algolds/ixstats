/**
 * Atomic Tax Integration
 * Connects tax system effectiveness to atomic government components
 */

import { ComponentType } from '~/types/government';

// Tax collection effectiveness multipliers based on atomic components
export const TAX_EFFECTIVENESS_MODIFIERS: Record<ComponentType, {
  collectionEfficiency: number;
  complianceRate: number;
  auditCapacity: number;
  description: string;
}> = {
  // Power Distribution Components
  [ComponentType.CENTRALIZED_POWER]: {
    collectionEfficiency: 1.15,
    complianceRate: 1.10,
    auditCapacity: 1.20,
    description: "Centralized power enables efficient tax collection"
  },
  [ComponentType.FEDERAL_SYSTEM]: {
    collectionEfficiency: 0.95,
    complianceRate: 1.05,
    auditCapacity: 0.90,
    description: "Federal systems have coordination challenges but local compliance"
  },
  [ComponentType.CONFEDERATE_SYSTEM]: {
    collectionEfficiency: 0.80,
    complianceRate: 0.85,
    auditCapacity: 0.70,
    description: "Confederate systems have weak central tax authority"
  },
  [ComponentType.UNITARY_SYSTEM]: {
    collectionEfficiency: 1.10,
    complianceRate: 1.05,
    auditCapacity: 1.15,
    description: "Unitary systems enable consistent tax policy"
  },

  // Decision Process Components
  [ComponentType.DEMOCRATIC_PROCESS]: {
    collectionEfficiency: 0.95,
    complianceRate: 1.15,
    auditCapacity: 0.90,
    description: "Democratic processes increase voluntary compliance"
  },
  [ComponentType.AUTOCRATIC_PROCESS]: {
    collectionEfficiency: 1.20,
    complianceRate: 0.85,
    auditCapacity: 1.30,
    description: "Autocratic systems can enforce collection but reduce voluntary compliance"
  },
  [ComponentType.TECHNOCRATIC_PROCESS]: {
    collectionEfficiency: 1.25,
    complianceRate: 1.10,
    auditCapacity: 1.20,
    description: "Technocratic governance optimizes tax system efficiency"
  },
  [ComponentType.CONSENSUS_PROCESS]: {
    collectionEfficiency: 0.85,
    complianceRate: 1.20,
    auditCapacity: 0.80,
    description: "Consensus building delays implementation but increases acceptance"
  },
  [ComponentType.OLIGARCHIC_PROCESS]: {
    collectionEfficiency: 0.90,
    complianceRate: 0.75,
    auditCapacity: 1.10,
    description: "Oligarchic systems favor certain groups, reducing overall compliance"
  },

  // Legitimacy Source Components
  [ComponentType.ELECTORAL_LEGITIMACY]: {
    collectionEfficiency: 0.95,
    complianceRate: 1.20,
    auditCapacity: 0.90,
    description: "Electoral legitimacy increases voluntary tax compliance"
  },
  [ComponentType.TRADITIONAL_LEGITIMACY]: {
    collectionEfficiency: 1.00,
    complianceRate: 1.15,
    auditCapacity: 0.95,
    description: "Traditional authority maintains steady compliance"
  },
  [ComponentType.PERFORMANCE_LEGITIMACY]: {
    collectionEfficiency: 1.10,
    complianceRate: 1.25,
    auditCapacity: 1.05,
    description: "Performance-based legitimacy increases compliance through results"
  },
  [ComponentType.CHARISMATIC_LEGITIMACY]: {
    collectionEfficiency: 1.05,
    complianceRate: 1.30,
    auditCapacity: 0.85,
    description: "Charismatic leadership inspires voluntary compliance"
  },
  [ComponentType.RELIGIOUS_LEGITIMACY]: {
    collectionEfficiency: 1.00,
    complianceRate: 1.35,
    auditCapacity: 0.80,
    description: "Religious legitimacy creates moral obligation to pay taxes"
  },
  [ComponentType.INSTITUTIONAL_LEGITIMACY]: {
    collectionEfficiency: 1.15,
    complianceRate: 1.40,
    auditCapacity: 1.10,
    description: "Institutional legitimacy builds trust in the tax system"
  },

  // Institution Components
  [ComponentType.PROFESSIONAL_BUREAUCRACY]: {
    collectionEfficiency: 1.30,
    complianceRate: 1.10,
    auditCapacity: 1.40,
    description: "Professional bureaucracy maximizes tax administration efficiency"
  },
  [ComponentType.MILITARY_ADMINISTRATION]: {
    collectionEfficiency: 1.15,
    complianceRate: 0.80,
    auditCapacity: 1.25,
    description: "Military administration enforces collection but reduces trust"
  },
  [ComponentType.INDEPENDENT_JUDICIARY]: {
    collectionEfficiency: 1.05,
    complianceRate: 1.25,
    auditCapacity: 1.15,
    description: "Independent judiciary increases trust in fair tax enforcement"
  },
  [ComponentType.PARTISAN_INSTITUTIONS]: {
    collectionEfficiency: 0.85,
    complianceRate: 0.90,
    auditCapacity: 0.95,
    description: "Partisan institutions create inconsistent tax policy"
  },
  [ComponentType.TECHNOCRATIC_AGENCIES]: {
    collectionEfficiency: 1.35,
    complianceRate: 1.05,
    auditCapacity: 1.45,
    description: "Technocratic agencies optimize tax collection processes"
  },

  // Control Mechanism Components
  [ComponentType.RULE_OF_LAW]: {
    collectionEfficiency: 1.10,
    complianceRate: 1.30,
    auditCapacity: 1.20,
    description: "Rule of law creates predictable and fair tax environment"
  },
  [ComponentType.SURVEILLANCE_SYSTEM]: {
    collectionEfficiency: 1.25,
    complianceRate: 0.75,
    auditCapacity: 1.50,
    description: "Surveillance increases detection but reduces voluntary compliance"
  },
  [ComponentType.ECONOMIC_INCENTIVES]: {
    collectionEfficiency: 1.05,
    complianceRate: 1.15,
    auditCapacity: 0.95,
    description: "Economic incentives encourage voluntary tax compliance"
  },
  [ComponentType.SOCIAL_PRESSURE]: {
    collectionEfficiency: 0.95,
    complianceRate: 1.10,
    auditCapacity: 0.90,
    description: "Social pressure moderately increases compliance"
  },
  [ComponentType.MILITARY_ENFORCEMENT]: {
    collectionEfficiency: 1.20,
    complianceRate: 0.70,
    auditCapacity: 1.30,
    description: "Military enforcement maximizes collection but reduces voluntary compliance"
  },

  // New Government Type Components
  [ComponentType.DIGITAL_GOVERNMENT]: {
    collectionEfficiency: 1.35,
    complianceRate: 1.15,
    auditCapacity: 1.40,
    description: "Digital government enables highly efficient automated tax collection"
  },
  [ComponentType.MINIMAL_GOVERNMENT]: {
    collectionEfficiency: 0.80,
    complianceRate: 0.90,
    auditCapacity: 0.70,
    description: "Minimal government has limited tax collection infrastructure"
  },
  [ComponentType.PRIVATE_SECTOR_LEADERSHIP]: {
    collectionEfficiency: 0.95,
    complianceRate: 1.05,
    auditCapacity: 0.85,
    description: "Private sector focus emphasizes efficiency over enforcement"
  },
  [ComponentType.SOCIAL_DEMOCRACY]: {
    collectionEfficiency: 1.15,
    complianceRate: 1.30,
    auditCapacity: 1.10,
    description: "Social democracy builds strong tax compliance through social contract"
  },
  [ComponentType.COMPREHENSIVE_WELFARE]: {
    collectionEfficiency: 1.10,
    complianceRate: 1.25,
    auditCapacity: 1.05,
    description: "Comprehensive welfare requires effective tax collection systems"
  },
  [ComponentType.PUBLIC_SECTOR_LEADERSHIP]: {
    collectionEfficiency: 1.20,
    complianceRate: 1.10,
    auditCapacity: 1.15,
    description: "Strong public sector enables consistent tax policy implementation"
  },
  [ComponentType.ENVIRONMENTAL_FOCUS]: {
    collectionEfficiency: 0.95,
    complianceRate: 1.10,
    auditCapacity: 0.90,
    description: "Environmental focus may complicate tax structure but builds compliance"
  },
  [ComponentType.ECONOMIC_PLANNING]: {
    collectionEfficiency: 1.25,
    complianceRate: 1.05,
    auditCapacity: 1.30,
    description: "Economic planning requires strong tax revenue capacity"
  },
  [ComponentType.DEVELOPMENTAL_STATE]: {
    collectionEfficiency: 1.22,
    complianceRate: 1.15,
    auditCapacity: 1.25,
    description: "Developmental state prioritizes effective revenue collection for growth"
  },
  [ComponentType.WORKER_PROTECTION]: {
    collectionEfficiency: 0.90,
    complianceRate: 1.15,
    auditCapacity: 0.85,
    description: "Worker protection focus may complicate enforcement but builds trust"
  },
  [ComponentType.MERITOCRATIC_SYSTEM]: {
    collectionEfficiency: 1.30,
    complianceRate: 1.20,
    auditCapacity: 1.35,
    description: "Meritocratic systems maximize tax administration effectiveness"
  },
  [ComponentType.REGIONAL_DEVELOPMENT]: {
    collectionEfficiency: 0.92,
    complianceRate: 1.08,
    auditCapacity: 0.88,
    description: "Regional development focus may complicate central tax collection but builds local compliance"
  }
} as const;

// Component synergies for tax effectiveness
export const TAX_COMPONENT_SYNERGIES = {
  // Professional bureaucracy + Rule of law = Optimal tax administration
  'PROFESSIONAL_BUREAUCRACY+RULE_OF_LAW': {
    collectionEfficiency: 1.20,
    complianceRate: 1.15,
    description: "Professional bureaucracy with rule of law creates optimal tax administration"
  },
  
  // Technocratic process + Technocratic agencies = Maximum efficiency
  'TECHNOCRATIC_PROCESS+TECHNOCRATIC_AGENCIES': {
    collectionEfficiency: 1.25,
    auditCapacity: 1.20,
    description: "Technocratic governance and agencies maximize tax efficiency"
  },
  
  // Democratic process + Electoral legitimacy = High voluntary compliance
  'DEMOCRATIC_PROCESS+ELECTORAL_LEGITIMACY': {
    complianceRate: 1.25,
    collectionEfficiency: 0.95,
    description: "Democratic legitimacy increases voluntary tax compliance"
  },
  
  // Centralized power + Autocratic process = Strong enforcement
  'CENTRALIZED_POWER+AUTOCRATIC_PROCESS': {
    collectionEfficiency: 1.30,
    auditCapacity: 1.25,
    complianceRate: 0.80,
    description: "Centralized autocracy enables strong tax enforcement"
  },
  
  // Independent judiciary + Rule of law = Fair enforcement
  'INDEPENDENT_JUDICIARY+RULE_OF_LAW': {
    complianceRate: 1.20,
    collectionEfficiency: 1.10,
    description: "Independent judiciary with rule of law ensures fair tax enforcement"
  }
} as const;

// Component conflicts that reduce tax effectiveness
export const TAX_COMPONENT_CONFLICTS = {
  // Surveillance + Democratic process = Reduced trust
  'SURVEILLANCE_SYSTEM+DEMOCRATIC_PROCESS': {
    complianceRate: 0.85,
    description: "Surveillance undermines trust in democratic tax policy"
  },
  
  // Military administration + Electoral legitimacy = Authority conflict
  'MILITARY_ADMINISTRATION+ELECTORAL_LEGITIMACY': {
    complianceRate: 0.80,
    description: "Military administration conflicts with electoral legitimacy"
  },
  
  // Federal system + Centralized power = Coordination problems
  'FEDERAL_SYSTEM+CENTRALIZED_POWER': {
    collectionEfficiency: 0.85,
    description: "Federal structure conflicts with centralized power"
  },
  
  // Partisan institutions + Professional bureaucracy = Politicization
  'PARTISAN_INSTITUTIONS+PROFESSIONAL_BUREAUCRACY': {
    collectionEfficiency: 0.90,
    description: "Partisan institutions undermine professional tax administration"
  }
} as const;

/**
 * Calculate tax effectiveness based on atomic government components
 */
export function calculateAtomicTaxEffectiveness(
  components: ComponentType[],
  baseTaxSystem: {
    collectionEfficiency: number;
    complianceRate: number;
    auditCapacity?: number;
  }
): {
  collectionEfficiency: number;
  complianceRate: number;
  auditCapacity: number;
  effectivenessScore: number;
  modifierBreakdown: {
    component: ComponentType;
    modifiers: any;
    description: string;
  }[];
  synergies: string[];
  conflicts: string[];
} {
  let collectionMultiplier = 1.0;
  let complianceMultiplier = 1.0;
  let auditMultiplier = 1.0;
  
  const modifierBreakdown: any[] = [];
  const synergies: string[] = [];
  const conflicts: string[] = [];

  // Apply individual component modifiers
  for (const component of components) {
    const modifier = TAX_EFFECTIVENESS_MODIFIERS[component];
    if (modifier) {
      collectionMultiplier *= modifier.collectionEfficiency;
      complianceMultiplier *= modifier.complianceRate;
      auditMultiplier *= modifier.auditCapacity;
      
      modifierBreakdown.push({
        component,
        modifiers: modifier,
        description: modifier.description
      });
    }
  }

  // Check for synergies
  for (let i = 0; i < components.length; i++) {
    for (let j = i + 1; j < components.length; j++) {
      const synergyKey = `${components[i]}+${components[j]}` as keyof typeof TAX_COMPONENT_SYNERGIES;
      const synergy = TAX_COMPONENT_SYNERGIES[synergyKey];
      
      if (synergy) {
        if ((synergy as any).collectionEfficiency) collectionMultiplier *= (synergy as any).collectionEfficiency;
        if ((synergy as any).complianceRate) complianceMultiplier *= (synergy as any).complianceRate;
        if ((synergy as any).auditCapacity) auditMultiplier *= (synergy as any).auditCapacity;
        synergies.push(synergy.description);
      }

      // Check for conflicts
      const conflictKey = `${components[i]}+${components[j]}` as keyof typeof TAX_COMPONENT_CONFLICTS;
      const conflict = TAX_COMPONENT_CONFLICTS[conflictKey];
      
      if (conflict) {
        if ((conflict as any).collectionEfficiency) collectionMultiplier *= (conflict as any).collectionEfficiency;
        if ((conflict as any).complianceRate) complianceMultiplier *= (conflict as any).complianceRate;
        conflicts.push(conflict.description);
      }
    }
  }

  // Calculate final values
  const finalCollectionEfficiency = Math.min(100, baseTaxSystem.collectionEfficiency * collectionMultiplier);
  const finalComplianceRate = Math.min(100, baseTaxSystem.complianceRate * complianceMultiplier);
  const finalAuditCapacity = Math.min(100, (baseTaxSystem.auditCapacity || 50) * auditMultiplier);

  // Calculate overall effectiveness score
  const effectivenessScore = Math.round(
    (finalCollectionEfficiency * 0.4 + finalComplianceRate * 0.4 + finalAuditCapacity * 0.2)
  );

  return {
    collectionEfficiency: Math.round(finalCollectionEfficiency * 100) / 100,
    complianceRate: Math.round(finalComplianceRate * 100) / 100,
    auditCapacity: Math.round(finalAuditCapacity * 100) / 100,
    effectivenessScore,
    modifierBreakdown,
    synergies,
    conflicts
  };
}

/**
 * Get tax policy recommendations based on atomic components
 */
export function getAtomicTaxRecommendations(
  components: ComponentType[]
): {
  recommendedPolicies: string[];
  warnings: string[];
  optimizations: string[];
} {
  const recommendedPolicies: string[] = [];
  const warnings: string[] = [];
  const optimizations: string[] = [];

  // Professional bureaucracy recommendations
  if (components.includes(ComponentType.PROFESSIONAL_BUREAUCRACY)) {
    recommendedPolicies.push("Implement complex progressive tax structures");
    recommendedPolicies.push("Deploy advanced tax technology systems");
    optimizations.push("Leverage professional capacity for sophisticated tax policy");
  }

  // Democratic legitimacy recommendations
  if (components.includes(ComponentType.ELECTORAL_LEGITIMACY) || components.includes(ComponentType.DEMOCRATIC_PROCESS)) {
    recommendedPolicies.push("Focus on transparent tax spending");
    recommendedPolicies.push("Implement taxpayer bill of rights");
    optimizations.push("Build public support through democratic participation");
  }

  // Surveillance system warnings
  if (components.includes(ComponentType.SURVEILLANCE_SYSTEM)) {
    warnings.push("High surveillance may reduce voluntary compliance");
    optimizations.push("Balance enforcement with trust-building measures");
  }

  // Federal system considerations
  if (components.includes(ComponentType.FEDERAL_SYSTEM)) {
    recommendedPolicies.push("Coordinate federal and state tax policies");
    warnings.push("Watch for tax competition between jurisdictions");
  }

  // Rule of law synergies
  if (components.includes(ComponentType.RULE_OF_LAW)) {
    recommendedPolicies.push("Strengthen tax court system");
    optimizations.push("Emphasize consistent and fair enforcement");
  }

  return {
    recommendedPolicies,
    warnings,
    optimizations
  };
}