/**
 * Atomic Intelligence Integration
 * Generates intelligence feeds and alerts based on atomic government components
 */

import { ComponentType } from '~/types/government';
import { calculateAtomicTaxEffectiveness } from './atomic-tax-integration';
import { calculateAtomicEconomicImpact } from './atomic-economic-integration';

export interface AtomicIntelligenceItem {
  id: string;
  type: 'alert' | 'opportunity' | 'trend' | 'prediction';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
  category: 'governance' | 'economic' | 'stability' | 'policy' | 'institutional';
  timestamp: Date;
  source: 'atomic_analysis' | 'component_synergy' | 'effectiveness_model' | 'conflict_detection';
  relatedComponents: ComponentType[];
  actionable: boolean;
  recommendations?: string[];
  metrics?: {
    effectivenessScore?: number;
    trendDirection?: 'up' | 'down' | 'stable';
    confidence?: number;
  };
}

export interface AtomicGovernmentStability {
  overallStability: number;
  institutionalCapacity: number;
  legitimacyStrength: number;
  policyCoherence: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  stabilityTrend: 'improving' | 'stable' | 'declining';
  riskFactors: string[];
  strengths: string[];
}

// Component stability contributions
const STABILITY_MODIFIERS: Partial<Record<ComponentType, { stability: number; legitimacy: number; capacity: number; policy: number }>> = {
  // Power Distribution
  [ComponentType.CENTRALIZED_POWER]: { stability: 0.8, legitimacy: 0.7, capacity: 0.9, policy: 0.9 },
  [ComponentType.FEDERAL_SYSTEM]: { stability: 0.7, legitimacy: 0.8, capacity: 0.6, policy: 0.6 },
  [ComponentType.CONFEDERATE_SYSTEM]: { stability: 0.5, legitimacy: 0.6, capacity: 0.4, policy: 0.4 },
  [ComponentType.UNITARY_SYSTEM]: { stability: 0.9, legitimacy: 0.8, capacity: 0.8, policy: 0.9 },

  // Decision Processes
  [ComponentType.DEMOCRATIC_PROCESS]: { stability: 0.8, legitimacy: 0.9, capacity: 0.7, policy: 0.6 },
  [ComponentType.AUTOCRATIC_PROCESS]: { stability: 0.6, legitimacy: 0.5, capacity: 0.8, policy: 0.9 },
  [ComponentType.TECHNOCRATIC_PROCESS]: { stability: 0.9, legitimacy: 0.7, capacity: 0.95, policy: 0.95 },
  [ComponentType.CONSENSUS_PROCESS]: { stability: 0.9, legitimacy: 0.8, capacity: 0.6, policy: 0.5 },
  [ComponentType.OLIGARCHIC_PROCESS]: { stability: 0.4, legitimacy: 0.3, capacity: 0.7, policy: 0.7 },

  // Legitimacy Sources
  [ComponentType.ELECTORAL_LEGITIMACY]: { stability: 0.8, legitimacy: 0.95, capacity: 0.7, policy: 0.7 },
  [ComponentType.TRADITIONAL_LEGITIMACY]: { stability: 0.9, legitimacy: 0.8, capacity: 0.6, policy: 0.7 },
  [ComponentType.PERFORMANCE_LEGITIMACY]: { stability: 0.7, legitimacy: 0.85, capacity: 0.8, policy: 0.9 },
  [ComponentType.CHARISMATIC_LEGITIMACY]: { stability: 0.5, legitimacy: 0.9, capacity: 0.6, policy: 0.8 },
  [ComponentType.RELIGIOUS_LEGITIMACY]: { stability: 0.85, legitimacy: 0.9, capacity: 0.6, policy: 0.7 },
  [ComponentType.INSTITUTIONAL_LEGITIMACY]: { stability: 0.9, legitimacy: 0.95, capacity: 0.85, policy: 0.85 },

  // Institutions
  [ComponentType.PROFESSIONAL_BUREAUCRACY]: { stability: 0.9, legitimacy: 0.7, capacity: 0.95, policy: 0.9 },
  [ComponentType.MILITARY_ADMINISTRATION]: { stability: 0.7, legitimacy: 0.5, capacity: 0.8, policy: 0.85 },
  [ComponentType.INDEPENDENT_JUDICIARY]: { stability: 0.95, legitimacy: 0.9, capacity: 0.8, policy: 0.8 },
  [ComponentType.PARTISAN_INSTITUTIONS]: { stability: 0.4, legitimacy: 0.4, capacity: 0.5, policy: 0.4 },
  [ComponentType.TECHNOCRATIC_AGENCIES]: { stability: 0.85, legitimacy: 0.6, capacity: 0.95, policy: 0.95 },

  // Control Mechanisms
  [ComponentType.RULE_OF_LAW]: { stability: 0.95, legitimacy: 0.9, capacity: 0.8, policy: 0.85 },
  [ComponentType.SURVEILLANCE_SYSTEM]: { stability: 0.6, legitimacy: 0.4, capacity: 0.8, policy: 0.8 },
  [ComponentType.ECONOMIC_INCENTIVES]: { stability: 0.7, legitimacy: 0.6, capacity: 0.7, policy: 0.8 },
  [ComponentType.SOCIAL_PRESSURE]: { stability: 0.5, legitimacy: 0.7, capacity: 0.6, policy: 0.6 },
  [ComponentType.MILITARY_ENFORCEMENT]: { stability: 0.4, legitimacy: 0.3, capacity: 0.9, policy: 0.8 },

  // New Government Type Components
  [ComponentType.DIGITAL_GOVERNMENT]: { stability: 0.85, legitimacy: 0.75, capacity: 0.9, policy: 0.85 },
  [ComponentType.MINIMAL_GOVERNMENT]: { stability: 0.6, legitimacy: 0.65, capacity: 0.5, policy: 0.55 },
  [ComponentType.PRIVATE_SECTOR_LEADERSHIP]: { stability: 0.7, legitimacy: 0.6, capacity: 0.75, policy: 0.7 },
  [ComponentType.SOCIAL_DEMOCRACY]: { stability: 0.8, legitimacy: 0.85, capacity: 0.75, policy: 0.8 },
  [ComponentType.COMPREHENSIVE_WELFARE]: { stability: 0.75, legitimacy: 0.8, capacity: 0.7, policy: 0.75 },
  [ComponentType.PUBLIC_SECTOR_LEADERSHIP]: { stability: 0.7, legitimacy: 0.7, capacity: 0.8, policy: 0.75 },
  [ComponentType.ENVIRONMENTAL_FOCUS]: { stability: 0.7, legitimacy: 0.75, capacity: 0.65, policy: 0.7 },
  [ComponentType.ECONOMIC_PLANNING]: { stability: 0.75, legitimacy: 0.65, capacity: 0.85, policy: 0.9 },
  [ComponentType.DEVELOPMENTAL_STATE]: { stability: 0.8, legitimacy: 0.7, capacity: 0.85, policy: 0.85 },
  [ComponentType.WORKER_PROTECTION]: { stability: 0.65, legitimacy: 0.75, capacity: 0.6, policy: 0.65 },
  [ComponentType.MERITOCRATIC_SYSTEM]: { stability: 0.85, legitimacy: 0.8, capacity: 0.9, policy: 0.9 },
  [ComponentType.REGIONAL_DEVELOPMENT]: { stability: 0.75, legitimacy: 0.7, capacity: 0.8, policy: 0.75 }
} as const;

// Critical component conflicts that trigger alerts
const CRITICAL_CONFLICTS = {
  'SURVEILLANCE_SYSTEM+DEMOCRATIC_PROCESS': {
    severity: 'high' as const,
    description: 'Surveillance systems undermining democratic legitimacy',
    risk: 'Democratic backsliding and reduced public trust'
  },
  'MILITARY_ADMINISTRATION+ELECTORAL_LEGITIMACY': {
    severity: 'high' as const,
    description: 'Military control conflicting with electoral mandate',
    risk: 'Civil-military tensions and legitimacy crisis'
  },
  'PARTISAN_INSTITUTIONS+RULE_OF_LAW': {
    severity: 'critical' as const,
    description: 'Partisan capture of institutions threatens rule of law',
    risk: 'Institutional breakdown and governance crisis'
  },
  'OLIGARCHIC_PROCESS+PROFESSIONAL_BUREAUCRACY': {
    severity: 'medium' as const,
    description: 'Elite capture undermining professional governance',
    risk: 'Policy capture and reduced administrative effectiveness'
  }
} as const;

// Beneficial synergies that create opportunities
const BENEFICIAL_SYNERGIES = {
  'TECHNOCRATIC_PROCESS+PROFESSIONAL_BUREAUCRACY': {
    opportunity: 'Optimal policy implementation capacity',
    description: 'Technical expertise combined with professional administration'
  },
  'RULE_OF_LAW+INDEPENDENT_JUDICIARY': {
    opportunity: 'Maximum institutional credibility',
    description: 'Strong rule of law backed by independent courts'
  },
  'DEMOCRATIC_PROCESS+ELECTORAL_LEGITIMACY': {
    opportunity: 'Strong democratic foundation',
    description: 'Democratic processes backed by electoral mandate'
  },
  'PERFORMANCE_LEGITIMACY+TECHNOCRATIC_AGENCIES': {
    opportunity: 'Results-driven governance',
    description: 'Performance focus backed by technical capability'
  }
} as const;

/**
 * Calculate government stability based on atomic components
 */
export function calculateAtomicGovernmentStability(
  components: ComponentType[]
): AtomicGovernmentStability {
  if (components.length === 0) {
    return {
      overallStability: 50,
      institutionalCapacity: 50,
      legitimacyStrength: 50,
      policyCoherence: 50,
      riskLevel: 'medium',
      stabilityTrend: 'stable',
      riskFactors: ['No government structure defined'],
      strengths: []
    };
  }

  let stability = 0;
  let legitimacy = 0;
  let capacity = 0;
  let policy = 0;
  const riskFactors: string[] = [];
  const strengths: string[] = [];

  // Calculate base scores
  for (const component of components) {
    const modifier = STABILITY_MODIFIERS[component];
    if (modifier) {
      stability += modifier.stability;
      legitimacy += modifier.legitimacy;
      capacity += modifier.capacity;
      policy += modifier.policy;
    }
  }

  // Average scores
  const count = components.length;
  stability = (stability / count) * 100;
  legitimacy = (legitimacy / count) * 100;
  capacity = (capacity / count) * 100;
  policy = (policy / count) * 100;

  // Check for conflicts
  for (let i = 0; i < components.length; i++) {
    for (let j = i + 1; j < components.length; j++) {
      const conflictKey = `${components[i]}+${components[j]}` as keyof typeof CRITICAL_CONFLICTS;
      const conflict = CRITICAL_CONFLICTS[conflictKey];
      if (conflict) {
        riskFactors.push(conflict.description);
        stability *= 0.9; // Reduce stability for conflicts
        legitimacy *= 0.85;
      }

      const synergyKey = `${components[i]}+${components[j]}` as keyof typeof BENEFICIAL_SYNERGIES;
      const synergy = BENEFICIAL_SYNERGIES[synergyKey];
      if (synergy) {
        strengths.push(synergy.opportunity);
        stability *= 1.1; // Boost for synergies
        capacity *= 1.1;
      }
    }
  }

  // Check for specific risk patterns
  if (components.includes(ComponentType.PARTISAN_INSTITUTIONS) && components.length > 2) {
    riskFactors.push('Partisan institutions may undermine governance quality');
  }

  if (components.includes(ComponentType.OLIGARCHIC_PROCESS)) {
    riskFactors.push('Oligarchic decision-making may reduce legitimacy');
  }

  if (components.includes(ComponentType.PROFESSIONAL_BUREAUCRACY)) {
    strengths.push('Professional bureaucracy provides implementation capacity');
  }

  if (components.includes(ComponentType.RULE_OF_LAW)) {
    strengths.push('Rule of law provides institutional stability');
  }

  const overallStability = Math.round((stability + legitimacy + capacity + policy) / 4);
  
  // Determine risk level
  let riskLevel: 'low' | 'medium' | 'high' | 'critical';
  if (overallStability >= 80) riskLevel = 'low';
  else if (overallStability >= 60) riskLevel = 'medium';
  else if (overallStability >= 40) riskLevel = 'high';
  else riskLevel = 'critical';

  // Simple trend analysis (could be enhanced with historical data)
  const stabilityTrend: 'improving' | 'stable' | 'declining' = 
    strengths.length > riskFactors.length ? 'improving' :
    riskFactors.length > strengths.length ? 'declining' : 'stable';

  return {
    overallStability: Math.round(overallStability),
    institutionalCapacity: Math.round(capacity),
    legitimacyStrength: Math.round(legitimacy),
    policyCoherence: Math.round(policy),
    riskLevel,
    stabilityTrend,
    riskFactors,
    strengths
  };
}

/**
 * Generate atomic intelligence items based on government composition
 */
export async function generateAtomicIntelligence(
  components: ComponentType[],
  economicData: {
    gdpGrowthRate: number;
    inflationRate: number;
    gdpPerCapita: number;
  },
  taxData: {
    collectionEfficiency: number;
    complianceRate: number;
  }
): Promise<AtomicIntelligenceItem[]> {
  const intelligence: AtomicIntelligenceItem[] = [];
  
  if (components.length === 0) {
    intelligence.push({
      id: `no-components-${Date.now()}`,
      type: 'alert',
      severity: 'high',
      title: 'No Government Structure Defined',
      description: 'Country lacks defined atomic government components, limiting governance analysis.',
      category: 'governance',
      timestamp: new Date(),
      source: 'atomic_analysis',
      relatedComponents: [],
      actionable: true,
      recommendations: ['Define government power distribution structure', 'Establish decision-making processes', 'Set up legitimacy sources']
    });
    return intelligence;
  }

  // Calculate effectiveness metrics
  const stability = calculateAtomicGovernmentStability(components);
  const economic = calculateAtomicEconomicImpact(components, economicData.gdpPerCapita || 15000, (economicData as any).taxRevenue || 0.2);
  const tax = calculateAtomicTaxEffectiveness(components, taxData);

  // Government stability analysis
  if (stability.riskLevel === 'critical') {
    intelligence.push({
      id: `stability-critical-${Date.now()}`,
      type: 'alert',
      severity: 'critical',
      title: 'Critical Government Stability Risk',
      description: `Government stability at ${stability.overallStability}% with multiple risk factors identified.`,
      category: 'stability',
      timestamp: new Date(),
      source: 'atomic_analysis',
      relatedComponents: components,
      actionable: true,
      recommendations: [
        'Review component conflicts immediately',
        'Consider institutional reforms',
        'Strengthen legitimacy mechanisms'
      ],
      metrics: {
        effectivenessScore: stability.overallStability,
        trendDirection: stability.stabilityTrend === 'declining' ? 'down' : stability.stabilityTrend === 'improving' ? 'up' : 'stable',
        confidence: 85
      }
    });
  }

  // Economic performance alerts
  if ((economic as any).overallScore < 60) {
    intelligence.push({
      id: `economic-concern-${Date.now()}`,
      type: 'alert',
      severity: (economic as any).overallScore < 40 ? 'high' : 'medium',
      title: 'Economic Performance Below Optimal',
      description: `Atomic component configuration resulting in ${(economic as any).overallScore}% economic effectiveness.`,
      category: 'economic',
      timestamp: new Date(),
      source: 'effectiveness_model',
      relatedComponents: components,
      actionable: true,
      recommendations: (economic as any).synergies.length > 0 
        ? ['Leverage existing synergies for improvement', 'Address component conflicts']
        : ['Consider adding technocratic elements', 'Strengthen institutional capacity']
    });
  }

  // Tax system effectiveness
  if (tax.effectivenessScore < 70) {
    intelligence.push({
      id: `tax-effectiveness-${Date.now()}`,
      type: 'alert',
      severity: tax.effectivenessScore < 50 ? 'high' : 'medium',
      title: 'Tax Collection Effectiveness Concerns',
      description: `Current government structure achieving ${tax.effectivenessScore}% tax effectiveness.`,
      category: 'policy',
      timestamp: new Date(),
      source: 'effectiveness_model',
      relatedComponents: components,
      actionable: true,
      recommendations: [
        'Review tax administration capacity',
        'Consider strengthening rule of law',
        'Evaluate bureaucratic professionalization'
      ]
    });
  }

  // Check for specific conflicts
  for (let i = 0; i < components.length; i++) {
    for (let j = i + 1; j < components.length; j++) {
      const conflictKey = `${components[i]}+${components[j]}` as keyof typeof CRITICAL_CONFLICTS;
      const conflict = CRITICAL_CONFLICTS[conflictKey];
      
      if (conflict) {
        intelligence.push({
          id: `conflict-${components[i]}-${components[j]}-${Date.now()}`,
          type: 'alert',
          severity: conflict.severity,
          title: 'Component Conflict Detected',
          description: conflict.description,
          category: 'institutional',
          timestamp: new Date(),
          source: 'conflict_detection',
          relatedComponents: [components[i], components[j]],
          actionable: true,
          recommendations: ['Review component compatibility', 'Consider institutional reforms']
        });
      }

      // Identify opportunities from synergies
      const synergyKey = `${components[i]}+${components[j]}` as keyof typeof BENEFICIAL_SYNERGIES;
      const synergy = BENEFICIAL_SYNERGIES[synergyKey];
      
      if (synergy) {
        intelligence.push({
          id: `synergy-${components[i]}-${components[j]}-${Date.now()}`,
          type: 'opportunity',
          severity: 'info',
          title: 'Component Synergy Advantage',
          description: synergy.description,
          category: 'governance',
          timestamp: new Date(),
          source: 'component_synergy',
          relatedComponents: [components[i], components[j]],
          actionable: true,
          recommendations: ['Leverage this synergy for enhanced effectiveness', 'Build upon this institutional strength']
        });
      }
    }
  }

  // Performance trends
  if (stability.stabilityTrend === 'improving') {
    intelligence.push({
      id: `trend-positive-${Date.now()}`,
      type: 'trend',
      severity: 'info',
      title: 'Positive Governance Trend',
      description: 'Government stability indicators show improving trajectory.',
      category: 'governance',
      timestamp: new Date(),
      source: 'atomic_analysis',
      relatedComponents: components,
      actionable: false,
      metrics: {
        trendDirection: 'up',
        confidence: 75
      }
    });
  }

  // Predictive analysis
  if (components.includes(ComponentType.TECHNOCRATIC_PROCESS) && components.includes(ComponentType.PROFESSIONAL_BUREAUCRACY)) {
    intelligence.push({
      id: `prediction-optimal-${Date.now()}`,
      type: 'prediction',
      severity: 'info',
      title: 'High Policy Implementation Capacity',
      description: 'Current configuration predicts strong policy implementation outcomes.',
      category: 'policy',
      timestamp: new Date(),
      source: 'effectiveness_model',
      relatedComponents: [ComponentType.TECHNOCRATIC_PROCESS, ComponentType.PROFESSIONAL_BUREAUCRACY],
      actionable: false,
      recommendations: ['Capitalize on implementation advantages', 'Consider ambitious reform agenda'],
      metrics: {
        effectivenessScore: 90,
        confidence: 90
      }
    });
  }

  return intelligence.sort((a, b) => {
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
}