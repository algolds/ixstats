/**
 * Smart Recommendations Engine for Atomic Components
 * Phase 2: AI-powered component suggestions based on country profile and current selection
 */

import { ComponentType } from '@prisma/client';
import { SYNERGY_RULES, CONFLICT_RULES } from './atomic-builder-state';
import type { 
  SynergyRule, 
  ConflictRule, 
  AtomicEconomicModifiers 
} from './atomic-builder-state';

export interface SmartRecommendation {
  id: string;
  type: 'synergy_complete' | 'effectiveness_boost' | 'conflict_avoid' | 'country_fit';
  component: ComponentType;
  reason: string;
  impactPreview: RecommendationImpact;
  confidence: number;
  priority: 'high' | 'medium' | 'low';
}

export interface RecommendationImpact {
  effectivenessChange: number;
  economicImpact: number;
  stabilityImpact: number;
  synergiesAdded: number;
  conflictsAdded: number;
}

export interface CountryProfile {
  size: 'small' | 'medium' | 'large';
  developmentLevel: 'developing' | 'emerging' | 'developed';
  politicalTradition: 'democratic' | 'authoritarian' | 'mixed' | 'traditional';
  economicSystem: 'market' | 'mixed' | 'planned';
  culturalContext: 'western' | 'eastern' | 'islamic' | 'african' | 'latin' | 'mixed';
  primaryChallenges: Challenge[];
  gdp: number;
  population: number;
}

export interface Challenge {
  type: 'economic_growth' | 'political_stability' | 'corruption' | 'inequality' | 'development';
  severity: 'low' | 'medium' | 'high';
}

// Component compatibility matrix based on country profiles
const COUNTRY_COMPONENT_COMPATIBILITY: Record<string, Record<ComponentType, number>> = {
  // Size-based compatibility
  small: {
    [ComponentType.CENTRALIZED_POWER]: 0.9,
    [ComponentType.FEDERAL_SYSTEM]: 0.3,
    [ComponentType.CONFEDERATE_SYSTEM]: 0.4,
    [ComponentType.UNITARY_SYSTEM]: 0.8,
    [ComponentType.PROFESSIONAL_BUREAUCRACY]: 0.6,
    [ComponentType.TECHNOCRATIC_PROCESS]: 0.8,
    [ComponentType.DEMOCRATIC_PROCESS]: 0.7,
    [ComponentType.CONSENSUS_PROCESS]: 0.8,
    [ComponentType.RULE_OF_LAW]: 0.9,
    [ComponentType.INDEPENDENT_JUDICIARY]: 0.8,
    [ComponentType.TECHNOCRATIC_AGENCIES]: 0.7,
    [ComponentType.PERFORMANCE_LEGITIMACY]: 0.8,
    [ComponentType.ELECTORAL_LEGITIMACY]: 0.7,
    [ComponentType.TRADITIONAL_LEGITIMACY]: 0.6,
    [ComponentType.CHARISMATIC_LEGITIMACY]: 0.5,
    [ComponentType.RELIGIOUS_LEGITIMACY]: 0.5,
    [ComponentType.AUTOCRATIC_PROCESS]: 0.6,
    [ComponentType.OLIGARCHIC_PROCESS]: 0.4,
    [ComponentType.MILITARY_ADMINISTRATION]: 0.4,
    [ComponentType.PARTISAN_INSTITUTIONS]: 0.5,
    [ComponentType.SURVEILLANCE_SYSTEM]: 0.3,
    [ComponentType.ECONOMIC_INCENTIVES]: 0.7,
    [ComponentType.SOCIAL_PRESSURE]: 0.8,
    [ComponentType.MILITARY_ENFORCEMENT]: 0.3
  },
  
  large: {
    [ComponentType.CENTRALIZED_POWER]: 0.6,
    [ComponentType.FEDERAL_SYSTEM]: 0.9,
    [ComponentType.CONFEDERATE_SYSTEM]: 0.7,
    [ComponentType.UNITARY_SYSTEM]: 0.5,
    [ComponentType.PROFESSIONAL_BUREAUCRACY]: 0.9,
    [ComponentType.TECHNOCRATIC_PROCESS]: 0.8,
    [ComponentType.DEMOCRATIC_PROCESS]: 0.8,
    [ComponentType.CONSENSUS_PROCESS]: 0.4,
    [ComponentType.RULE_OF_LAW]: 0.9,
    [ComponentType.INDEPENDENT_JUDICIARY]: 0.9,
    [ComponentType.TECHNOCRATIC_AGENCIES]: 0.9,
    [ComponentType.PERFORMANCE_LEGITIMACY]: 0.8,
    [ComponentType.ELECTORAL_LEGITIMACY]: 0.8,
    [ComponentType.TRADITIONAL_LEGITIMACY]: 0.5,
    [ComponentType.CHARISMATIC_LEGITIMACY]: 0.4,
    [ComponentType.RELIGIOUS_LEGITIMACY]: 0.4,
    [ComponentType.AUTOCRATIC_PROCESS]: 0.5,
    [ComponentType.OLIGARCHIC_PROCESS]: 0.6,
    [ComponentType.MILITARY_ADMINISTRATION]: 0.5,
    [ComponentType.PARTISAN_INSTITUTIONS]: 0.6,
    [ComponentType.SURVEILLANCE_SYSTEM]: 0.7,
    [ComponentType.ECONOMIC_INCENTIVES]: 0.8,
    [ComponentType.SOCIAL_PRESSURE]: 0.5,
    [ComponentType.MILITARY_ENFORCEMENT]: 0.6
  },

  // Development level compatibility
  developed: {
    [ComponentType.PROFESSIONAL_BUREAUCRACY]: 0.95,
    [ComponentType.TECHNOCRATIC_PROCESS]: 0.9,
    [ComponentType.RULE_OF_LAW]: 0.95,
    [ComponentType.INDEPENDENT_JUDICIARY]: 0.95,
    [ComponentType.TECHNOCRATIC_AGENCIES]: 0.9,
    [ComponentType.PERFORMANCE_LEGITIMACY]: 0.9,
    [ComponentType.DEMOCRATIC_PROCESS]: 0.85,
    [ComponentType.ELECTORAL_LEGITIMACY]: 0.85,
    [ComponentType.ECONOMIC_INCENTIVES]: 0.8,
    [ComponentType.FEDERAL_SYSTEM]: 0.8,
    [ComponentType.CENTRALIZED_POWER]: 0.6,
    [ComponentType.UNITARY_SYSTEM]: 0.7,
    [ComponentType.CONFEDERATE_SYSTEM]: 0.5,
    [ComponentType.TRADITIONAL_LEGITIMACY]: 0.4,
    [ComponentType.CHARISMATIC_LEGITIMACY]: 0.3,
    [ComponentType.RELIGIOUS_LEGITIMACY]: 0.3,
    [ComponentType.AUTOCRATIC_PROCESS]: 0.2,
    [ComponentType.OLIGARCHIC_PROCESS]: 0.4,
    [ComponentType.CONSENSUS_PROCESS]: 0.6,
    [ComponentType.MILITARY_ADMINISTRATION]: 0.3,
    [ComponentType.PARTISAN_INSTITUTIONS]: 0.5,
    [ComponentType.SURVEILLANCE_SYSTEM]: 0.6,
    [ComponentType.SOCIAL_PRESSURE]: 0.5,
    [ComponentType.MILITARY_ENFORCEMENT]: 0.2
  },

  developing: {
    [ComponentType.CENTRALIZED_POWER]: 0.8,
    [ComponentType.AUTOCRATIC_PROCESS]: 0.7,
    [ComponentType.MILITARY_ADMINISTRATION]: 0.8,
    [ComponentType.CHARISMATIC_LEGITIMACY]: 0.8,
    [ComponentType.TRADITIONAL_LEGITIMACY]: 0.8,
    [ComponentType.RELIGIOUS_LEGITIMACY]: 0.7,
    [ComponentType.SOCIAL_PRESSURE]: 0.8,
    [ComponentType.MILITARY_ENFORCEMENT]: 0.7,
    [ComponentType.PARTISAN_INSTITUTIONS]: 0.6,
    [ComponentType.SURVEILLANCE_SYSTEM]: 0.6,
    [ComponentType.PERFORMANCE_LEGITIMACY]: 0.6,
    [ComponentType.PROFESSIONAL_BUREAUCRACY]: 0.4,
    [ComponentType.TECHNOCRATIC_PROCESS]: 0.5,
    [ComponentType.RULE_OF_LAW]: 0.5,
    [ComponentType.INDEPENDENT_JUDICIARY]: 0.4,
    [ComponentType.TECHNOCRATIC_AGENCIES]: 0.4,
    [ComponentType.DEMOCRATIC_PROCESS]: 0.5,
    [ComponentType.ELECTORAL_LEGITIMACY]: 0.5,
    [ComponentType.ECONOMIC_INCENTIVES]: 0.6,
    [ComponentType.FEDERAL_SYSTEM]: 0.3,
    [ComponentType.CONFEDERATE_SYSTEM]: 0.4,
    [ComponentType.UNITARY_SYSTEM]: 0.7,
    [ComponentType.CONSENSUS_PROCESS]: 0.6,
    [ComponentType.OLIGARCHIC_PROCESS]: 0.6
  }
};

// Challenge-specific component recommendations
const CHALLENGE_SOLUTIONS: Record<string, ComponentType[]> = {
  economic_growth: [
    ComponentType.TECHNOCRATIC_PROCESS,
    ComponentType.PROFESSIONAL_BUREAUCRACY,
    ComponentType.TECHNOCRATIC_AGENCIES,
    ComponentType.PERFORMANCE_LEGITIMACY,
    ComponentType.RULE_OF_LAW
  ],
  political_stability: [
    ComponentType.RULE_OF_LAW,
    ComponentType.INDEPENDENT_JUDICIARY,
    ComponentType.ELECTORAL_LEGITIMACY,
    ComponentType.FEDERAL_SYSTEM,
    ComponentType.CONSENSUS_PROCESS
  ],
  corruption: [
    ComponentType.RULE_OF_LAW,
    ComponentType.INDEPENDENT_JUDICIARY,
    ComponentType.PROFESSIONAL_BUREAUCRACY,
    ComponentType.SURVEILLANCE_SYSTEM,
    ComponentType.PERFORMANCE_LEGITIMACY
  ],
  inequality: [
    ComponentType.DEMOCRATIC_PROCESS,
    ComponentType.FEDERAL_SYSTEM,
    ComponentType.SOCIAL_PRESSURE,
    ComponentType.ECONOMIC_INCENTIVES,
    ComponentType.ELECTORAL_LEGITIMACY
  ],
  development: [
    ComponentType.TECHNOCRATIC_AGENCIES,
    ComponentType.PROFESSIONAL_BUREAUCRACY,
    ComponentType.PERFORMANCE_LEGITIMACY,
    ComponentType.CENTRALIZED_POWER,
    ComponentType.RULE_OF_LAW
  ]
};

export class AtomicRecommendationEngine {
  /**
   * Generate smart recommendations based on current components and country profile
   */
  static getSmartRecommendations(
    currentComponents: ComponentType[],
    countryProfile: CountryProfile,
    maxRecommendations: number = 5
  ): SmartRecommendation[] {
    const recommendations: SmartRecommendation[] = [];

    // 1. Synergy completion recommendations
    const synergyRecommendations = this.getSynergyCompletionRecommendations(
      currentComponents, countryProfile
    );
    recommendations.push(...synergyRecommendations);

    // 2. Conflict avoidance recommendations  
    const conflictAvoidanceRecommendations = this.getConflictAvoidanceRecommendations(
      currentComponents, countryProfile
    );
    recommendations.push(...conflictAvoidanceRecommendations);

    // 3. Country-fit recommendations
    const countryFitRecommendations = this.getCountryFitRecommendations(
      currentComponents, countryProfile
    );
    recommendations.push(...countryFitRecommendations);

    // 4. Challenge-specific recommendations
    const challengeRecommendations = this.getChallengeSpecificRecommendations(
      currentComponents, countryProfile
    );
    recommendations.push(...challengeRecommendations);

    // 5. Effectiveness boost recommendations
    const effectivenessRecommendations = this.getEffectivenessBoostRecommendations(
      currentComponents, countryProfile
    );
    recommendations.push(...effectivenessRecommendations);

    // Sort by priority and confidence, then take top recommendations
    return recommendations
      .sort((a, b) => {
        const priorityScore = { high: 3, medium: 2, low: 1 };
        const aScore = priorityScore[a.priority] * a.confidence;
        const bScore = priorityScore[b.priority] * b.confidence;
        return bScore - aScore;
      })
      .slice(0, maxRecommendations);
  }

  /**
   * Find components that complete synergies
   */
  private static getSynergyCompletionRecommendations(
    currentComponents: ComponentType[],
    countryProfile: CountryProfile
  ): SmartRecommendation[] {
    const recommendations: SmartRecommendation[] = [];

    for (const synergy of SYNERGY_RULES) {
      // Check if we have some but not all components for this synergy
      const hasComponents = synergy.components.filter(comp => 
        currentComponents.includes(comp)
      );
      const missingComponents = synergy.components.filter(comp => 
        !currentComponents.includes(comp)
      );

      if (hasComponents.length > 0 && missingComponents.length > 0) {
        for (const missingComponent of missingComponents) {
          const compatibility = this.getComponentCompatibility(missingComponent, countryProfile);
          
          recommendations.push({
            id: `synergy_${synergy.id}_${missingComponent}`,
            type: 'synergy_complete',
            component: missingComponent,
            reason: `Complete the "${synergy.description}" synergy by adding this component`,
            impactPreview: this.calculateImpactPreview(missingComponent, currentComponents),
            confidence: compatibility * 0.9, // High confidence for synergy completion
            priority: 'high'
          });
        }
      }
    }

    return recommendations;
  }

  /**
   * Recommend alternatives to avoid conflicts
   */
  private static getConflictAvoidanceRecommendations(
    currentComponents: ComponentType[],
    countryProfile: CountryProfile
  ): SmartRecommendation[] {
    const recommendations: SmartRecommendation[] = [];

    // Check for potential conflicts with components not yet selected
    for (const conflict of CONFLICT_RULES) {
      const hasConflictingComponents = conflict.components.filter(comp =>
        currentComponents.includes(comp)
      );

      if (hasConflictingComponents.length > 0) {
        // Find alternative components that serve similar purpose without conflict
        const alternatives = this.findAlternativeComponents(
          hasConflictingComponents[0], 
          currentComponents,
          countryProfile
        );

        for (const alternative of alternatives) {
          recommendations.push({
            id: `avoid_conflict_${conflict.id}_${alternative}`,
            type: 'conflict_avoid',
            component: alternative,
            reason: `Consider this alternative to avoid the "${conflict.description}" conflict`,
            impactPreview: this.calculateImpactPreview(alternative, currentComponents),
            confidence: this.getComponentCompatibility(alternative, countryProfile) * 0.8,
            priority: conflict.severity === 'critical' ? 'high' : 'medium'
          });
        }
      }
    }

    return recommendations;
  }

  /**
   * Recommend components that fit the country profile well
   */
  private static getCountryFitRecommendations(
    currentComponents: ComponentType[],
    countryProfile: CountryProfile
  ): SmartRecommendation[] {
    const recommendations: SmartRecommendation[] = [];
    const availableComponents = Object.values(ComponentType).filter(comp =>
      !currentComponents.includes(comp)
    );

    for (const component of availableComponents) {
      const compatibility = this.getComponentCompatibility(component, countryProfile);
      
      if (compatibility > 0.8) {
        recommendations.push({
          id: `country_fit_${component}`,
          type: 'country_fit',
          component,
          reason: `Excellent fit for your ${countryProfile.size} ${countryProfile.developmentLevel} country`,
          impactPreview: this.calculateImpactPreview(component, currentComponents),
          confidence: compatibility,
          priority: compatibility > 0.9 ? 'high' : 'medium'
        });
      }
    }

    return recommendations;
  }

  /**
   * Recommend components to address specific challenges
   */
  private static getChallengeSpecificRecommendations(
    currentComponents: ComponentType[],
    countryProfile: CountryProfile
  ): SmartRecommendation[] {
    const recommendations: SmartRecommendation[] = [];

    for (const challenge of countryProfile.primaryChallenges) {
      const solutionComponents = CHALLENGE_SOLUTIONS[challenge.type] || [];
      
      for (const component of solutionComponents) {
        if (!currentComponents.includes(component)) {
          const compatibility = this.getComponentCompatibility(component, countryProfile);
          const severityMultiplier = challenge.severity === 'high' ? 1.0 : 
                                   challenge.severity === 'medium' ? 0.8 : 0.6;

          recommendations.push({
            id: `challenge_${challenge.type}_${component}`,
            type: 'effectiveness_boost',
            component,
            reason: `Addresses your ${challenge.severity} ${challenge.type.replace('_', ' ')} challenge`,
            impactPreview: this.calculateImpactPreview(component, currentComponents),
            confidence: compatibility * severityMultiplier,
            priority: challenge.severity === 'high' ? 'high' : 'medium'
          });
        }
      }
    }

    return recommendations;
  }

  /**
   * Recommend high-effectiveness components
   */
  private static getEffectivenessBoostRecommendations(
    currentComponents: ComponentType[],
    countryProfile: CountryProfile
  ): SmartRecommendation[] {
    const recommendations: SmartRecommendation[] = [];
    
    // High-effectiveness components
    const highEffectivenessComponents = [
      ComponentType.TECHNOCRATIC_AGENCIES,
      ComponentType.RULE_OF_LAW,
      ComponentType.PROFESSIONAL_BUREAUCRACY,
      ComponentType.INDEPENDENT_JUDICIARY,
      ComponentType.TECHNOCRATIC_PROCESS
    ];

    for (const component of highEffectivenessComponents) {
      if (!currentComponents.includes(component)) {
        const compatibility = this.getComponentCompatibility(component, countryProfile);
        
        if (compatibility > 0.6) {
          recommendations.push({
            id: `effectiveness_${component}`,
            type: 'effectiveness_boost',
            component,
            reason: 'High-effectiveness component that boosts overall system performance',
            impactPreview: this.calculateImpactPreview(component, currentComponents),
            confidence: compatibility,
            priority: compatibility > 0.8 ? 'high' : 'medium'
          });
        }
      }
    }

    return recommendations;
  }

  /**
   * Calculate component compatibility with country profile
   */
  private static getComponentCompatibility(
    component: ComponentType,
    countryProfile: CountryProfile
  ): number {
    let compatibility = 0.5; // Base compatibility

    // Size-based compatibility
    const sizeCompatibility = COUNTRY_COMPONENT_COMPATIBILITY[countryProfile.size]?.[component];
    if (sizeCompatibility) {
      compatibility = Math.max(compatibility, sizeCompatibility);
    }

    // Development level compatibility
    const devCompatibility = COUNTRY_COMPONENT_COMPATIBILITY[countryProfile.developmentLevel]?.[component];
    if (devCompatibility) {
      compatibility = (compatibility + devCompatibility) / 2;
    }

    // Political tradition adjustments
    if (countryProfile.politicalTradition === 'democratic') {
      if ([ComponentType.DEMOCRATIC_PROCESS, ComponentType.ELECTORAL_LEGITIMACY, 
           ComponentType.RULE_OF_LAW, ComponentType.INDEPENDENT_JUDICIARY].includes(component as any)) {
        compatibility += 0.2;
      }
      if ([ComponentType.AUTOCRATIC_PROCESS, ComponentType.MILITARY_ADMINISTRATION].includes(component as any)) {
        compatibility -= 0.3;
      }
    }

    if (countryProfile.politicalTradition === 'traditional') {
      if ([ComponentType.TRADITIONAL_LEGITIMACY, ComponentType.CONSENSUS_PROCESS].includes(component as any)) {
        compatibility += 0.2;
      }
      if ([ComponentType.TECHNOCRATIC_PROCESS, ComponentType.TECHNOCRATIC_AGENCIES].includes(component as any)) {
        compatibility -= 0.2;
      }
    }

    return Math.max(0, Math.min(1, compatibility));
  }

  /**
   * Find alternative components that serve similar purpose
   */
  private static findAlternativeComponents(
    component: ComponentType,
    currentComponents: ComponentType[],
    countryProfile: CountryProfile
  ): ComponentType[] {
    const alternatives: ComponentType[] = [];

    // Define component alternatives by category
    const alternativeGroups: Record<string, ComponentType[]> = {
      power: [ComponentType.CENTRALIZED_POWER, ComponentType.FEDERAL_SYSTEM, 
              ComponentType.CONFEDERATE_SYSTEM, ComponentType.UNITARY_SYSTEM],
      decision: [ComponentType.DEMOCRATIC_PROCESS, ComponentType.AUTOCRATIC_PROCESS,
                ComponentType.TECHNOCRATIC_PROCESS, ComponentType.CONSENSUS_PROCESS,
                ComponentType.OLIGARCHIC_PROCESS],
      legitimacy: [ComponentType.ELECTORAL_LEGITIMACY, ComponentType.TRADITIONAL_LEGITIMACY,
                  ComponentType.PERFORMANCE_LEGITIMACY, ComponentType.CHARISMATIC_LEGITIMACY,
                  ComponentType.RELIGIOUS_LEGITIMACY],
      institutions: [ComponentType.PROFESSIONAL_BUREAUCRACY, ComponentType.MILITARY_ADMINISTRATION,
                    ComponentType.INDEPENDENT_JUDICIARY, ComponentType.PARTISAN_INSTITUTIONS,
                    ComponentType.TECHNOCRATIC_AGENCIES],
      control: [ComponentType.RULE_OF_LAW, ComponentType.SURVEILLANCE_SYSTEM,
               ComponentType.ECONOMIC_INCENTIVES, ComponentType.SOCIAL_PRESSURE,
               ComponentType.MILITARY_ENFORCEMENT]
    };

    // Find which group the component belongs to
    for (const [groupName, components] of Object.entries(alternativeGroups)) {
      if (components.includes(component)) {
        // Return other components in the same group that aren't already selected
        alternatives.push(
          ...components.filter(alt => 
            alt !== component && 
            !currentComponents.includes(alt) &&
            this.getComponentCompatibility(alt, countryProfile) > 0.5
          )
        );
        break;
      }
    }

    return alternatives.slice(0, 2); // Return top 2 alternatives
  }

  /**
   * Calculate impact preview for adding a component
   */
  private static calculateImpactPreview(
    component: ComponentType,
    currentComponents: ComponentType[]
  ): RecommendationImpact {
    // Base effectiveness values (simplified)
    const componentEffectiveness: Record<ComponentType, number> = {
      [ComponentType.TECHNOCRATIC_AGENCIES]: 82,
      [ComponentType.RULE_OF_LAW]: 85,
      [ComponentType.PROFESSIONAL_BUREAUCRACY]: 85,
      [ComponentType.INDEPENDENT_JUDICIARY]: 80,
      [ComponentType.TECHNOCRATIC_PROCESS]: 85,
      [ComponentType.PERFORMANCE_LEGITIMACY]: 80,
      [ComponentType.DEMOCRATIC_PROCESS]: 68,
      [ComponentType.ELECTORAL_LEGITIMACY]: 65,
      [ComponentType.CENTRALIZED_POWER]: 75,
      [ComponentType.FEDERAL_SYSTEM]: 70,
      [ComponentType.CONFEDERATE_SYSTEM]: 60,
      [ComponentType.UNITARY_SYSTEM]: 72,
      [ComponentType.AUTOCRATIC_PROCESS]: 75,
      [ComponentType.CONSENSUS_PROCESS]: 60,
      [ComponentType.OLIGARCHIC_PROCESS]: 70,
      [ComponentType.TRADITIONAL_LEGITIMACY]: 70,
      [ComponentType.CHARISMATIC_LEGITIMACY]: 75,
      [ComponentType.RELIGIOUS_LEGITIMACY]: 72,
      [ComponentType.MILITARY_ADMINISTRATION]: 78,
      [ComponentType.PARTISAN_INSTITUTIONS]: 65,
      [ComponentType.SURVEILLANCE_SYSTEM]: 78,
      [ComponentType.ECONOMIC_INCENTIVES]: 73,
      [ComponentType.SOCIAL_PRESSURE]: 68,
      [ComponentType.MILITARY_ENFORCEMENT]: 80
    };

    const effectiveness = componentEffectiveness[component] || 60;
    
    // Calculate synergies that would be added
    let synergiesAdded = 0;
    let conflictsAdded = 0;

    for (const synergy of SYNERGY_RULES) {
      if (synergy.components.includes(component)) {
        const otherComponents = synergy.components.filter(c => c !== component);
        if (otherComponents.some(c => currentComponents.includes(c))) {
          synergiesAdded++;
        }
      }
    }

    for (const conflict of CONFLICT_RULES) {
      if (conflict.components.includes(component)) {
        const otherComponents = conflict.components.filter(c => c !== component);
        if (otherComponents.some(c => currentComponents.includes(c))) {
          conflictsAdded++;
        }
      }
    }

    return {
      effectivenessChange: effectiveness,
      economicImpact: effectiveness * 0.01, // 1% per effectiveness point
      stabilityImpact: effectiveness * 0.5,
      synergiesAdded,
      conflictsAdded
    };
  }
}