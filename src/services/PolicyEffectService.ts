/**
 * Policy Effect Service
 * Handles the real economic effects of implemented policies
 */

import type { PrismaClient } from '@prisma/client';
import type { Country } from '@prisma/client';

export interface PolicyImpact {
  gdpGrowthProjection?: number;
  unemploymentImpact?: number;
  inflationImpact?: number;
  budgetImpact?: number;
}

export interface PolicyEffect {
  id: string;
  title: string;
  category: string;
  impact: PolicyImpact;
  implementedAt: Date;
  duration: number; // in months
}

export class PolicyEffectService {
  constructor(private db: PrismaClient) {}

  /**
   * Apply policy effects to country's economic calculations
   */
  async applyPolicyEffects(countryId: string): Promise<void> {
    // Get all implemented policies for the country
    const policies = await this.getActivePolicies(countryId);
    
    if (policies.length === 0) return;

    // Calculate cumulative effects
    const cumulativeEffects = this.calculateCumulativeEffects(policies);
    
    // Apply effects to country
    await this.updateCountryMetrics(countryId, cumulativeEffects);
    
    // Create historical record
    await this.createPolicyEffectRecord(countryId, cumulativeEffects);
  }

  /**
   * Get all active policies for a country
   */
  private async getActivePolicies(countryId: string): Promise<PolicyEffect[]> {
    const policies = await this.db.systemConfig.findMany({
      where: {
        key: { contains: `eci_economic_policy_${countryId}` }
      }
    });

    return policies
      .map(policy => {
        const data = JSON.parse(policy.value);
        return {
          id: policy.id,
          title: data.title,
          category: data.category,
          impact: data.impact || {},
          implementedAt: new Date(data.implementedAt || data.createdAt),
          duration: this.getPolicyDuration(data.category)
        };
      })
      .filter(policy => this.isPolicyActive(policy));
  }

  /**
   * Calculate cumulative effects of all active policies
   */
  private calculateCumulativeEffects(policies: PolicyEffect[]): PolicyImpact {
    const effects: PolicyImpact = {
      gdpGrowthProjection: 0,
      unemploymentImpact: 0,
      inflationImpact: 0,
      budgetImpact: 0
    };

    policies.forEach(policy => {
      const impact = policy.impact;
      const timeMultiplier = this.getTimeDecayMultiplier(policy);
      const categoryMultiplier = this.getCategoryEffectivenessMultiplier(policy.category);

      effects.gdpGrowthProjection! += (impact.gdpGrowthProjection || 0) * timeMultiplier * categoryMultiplier;
      effects.unemploymentImpact! += (impact.unemploymentImpact || 0) * timeMultiplier * categoryMultiplier;
      effects.inflationImpact! += (impact.inflationImpact || 0) * timeMultiplier * categoryMultiplier;
      effects.budgetImpact! += (impact.budgetImpact || 0) * timeMultiplier * categoryMultiplier;
    });

    return effects;
  }

  /**
   * Update country metrics with policy effects
   */
  private async updateCountryMetrics(countryId: string, effects: PolicyImpact): Promise<void> {
    const country = await this.db.country.findUnique({
      where: { id: countryId }
    });

    if (!country) return;

    // Calculate new growth rate with policy effects
    const baseGrowthRate = country.adjustedGdpGrowth;
    const policyBoost = (effects.gdpGrowthProjection || 0) / 100; // Convert percentage to decimal
    const newGrowthRate = Math.max(0, Math.min(0.15, baseGrowthRate + policyBoost)); // Cap at 15%

    // Update country with new metrics
    await this.db.country.update({
      where: { id: countryId },
      data: {
        adjustedGdpGrowth: newGrowthRate,
        lastCalculated: new Date()
      }
    });

    // Create DM input to track policy effects in calculations
    await this.db.dmInputs.create({
      data: {
        countryId,
        ixTimeTimestamp: new Date(),
        inputType: 'economic_policy',
        value: policyBoost * 100, // Store as percentage
        description: `Cumulative policy effects: ${effects.gdpGrowthProjection?.toFixed(2)}% GDP impact`,
        duration: 90, // 3 months duration
        isActive: true
      }
    });
  }

  /**
   * Create a record of policy effects applied
   */
  private async createPolicyEffectRecord(countryId: string, effects: PolicyImpact): Promise<void> {
    await this.db.systemConfig.create({
      data: {
        key: `policy_effect_record_${countryId}_${Date.now()}`,
        value: JSON.stringify({
          countryId,
          effects,
          appliedAt: new Date(),
          type: 'policy_effect_application'
        }),
        description: `Policy effects applied: ${effects.gdpGrowthProjection?.toFixed(2)}% GDP impact`
      }
    });
  }

  /**
   * Check if a policy is still active based on implementation date and duration
   */
  private isPolicyActive(policy: PolicyEffect): boolean {
    const now = new Date();
    const implementedAt = policy.implementedAt;
    const expiryDate = new Date(implementedAt.getTime() + (policy.duration * 30 * 24 * 60 * 60 * 1000)); // Convert months to ms
    
    return now <= expiryDate;
  }

  /**
   * Get time decay multiplier (policies lose effectiveness over time)
   */
  private getTimeDecayMultiplier(policy: PolicyEffect): number {
    const now = new Date();
    const monthsActive = (now.getTime() - policy.implementedAt.getTime()) / (30 * 24 * 60 * 60 * 1000);
    
    // Policies are most effective in first 6 months, then decay
    if (monthsActive <= 6) return 1.0;
    if (monthsActive <= 12) return 0.8;
    if (monthsActive <= 24) return 0.6;
    return 0.4;
  }

  /**
   * Get category effectiveness multiplier
   */
  private getCategoryEffectivenessMultiplier(category: string): number {
    const multipliers: Record<string, number> = {
      'fiscal': 1.2,        // Most immediate impact
      'infrastructure': 1.1, // Strong long-term impact
      'investment': 1.0,     // Standard impact
      'trade': 0.9,         // Variable impact
      'labor': 0.8,         // Slower impact
      'monetary': 0.7       // Complex interactions
    };
    
    return multipliers[category] || 1.0;
  }

  /**
   * Get policy duration based on category
   */
  private getPolicyDuration(category: string): number {
    const durations: Record<string, number> = {
      'fiscal': 18,         // 18 months
      'infrastructure': 36, // 36 months
      'investment': 24,     // 24 months
      'trade': 12,         // 12 months
      'labor': 24,         // 24 months
      'monetary': 6        // 6 months
    };
    
    return durations[category] || 12;
  }

  /**
   * Calculate policy effectiveness score based on country context
   */
  async calculatePolicyEffectiveness(countryId: string, policyCategory: string): Promise<number> {
    const country = await this.db.country.findUnique({
      where: { id: countryId }
    });

    if (!country) return 0.5;

    let effectiveness = 0.7; // Base effectiveness

    // Economic tier affects policy effectiveness
    const tierMultipliers: Record<string, number> = {
      'Impoverished': 1.3,     // Policies have higher impact in developing countries
      'Developing': 1.2,
      'Developed': 1.0,
      'Healthy': 0.9,
      'Strong': 0.8,
      'Very Strong': 0.7,
      'Extravagant': 0.6       // Diminishing returns in advanced economies
    };

    effectiveness *= tierMultipliers[country.economicTier] || 1.0;

    // Category-specific adjustments based on economic tier
    if (policyCategory === 'infrastructure' && 
        ['Impoverished', 'Developing'].includes(country.economicTier)) {
      effectiveness *= 1.4; // Infrastructure has massive impact in developing countries
    }

    if (policyCategory === 'fiscal' && 
        ['Strong', 'Very Strong', 'Extravagant'].includes(country.economicTier)) {
      effectiveness *= 0.8; // Fiscal policy less effective in advanced economies
    }

    return Math.max(0.3, Math.min(1.5, effectiveness));
  }

  /**
   * Get policy recommendations based on country state
   */
  async getPolicyRecommendations(countryId: string): Promise<Array<{
    category: string;
    title: string;
    description: string;
    expectedImpact: number;
    priority: 'low' | 'medium' | 'high' | 'critical';
  }>> {
    const country = await this.db.country.findUnique({
      where: { id: countryId }
    });

    if (!country) return [];

    const recommendations = [];

    // Infrastructure recommendations for developing countries
    if (['Impoverished', 'Developing'].includes(country.economicTier)) {
      recommendations.push({
        category: 'infrastructure',
        title: 'Infrastructure Development Initiative',
        description: 'Large-scale infrastructure investment to boost economic growth',
        expectedImpact: 3.5,
        priority: 'high' as const
      });
    }

    // Fiscal policy for countries with high growth potential
    if (country.adjustedGdpGrowth > 0.04) {
      recommendations.push({
        category: 'fiscal',
        title: 'Strategic Tax Incentives',
        description: 'Targeted tax incentives to sustain high growth rates',
        expectedImpact: 1.8,
        priority: 'medium' as const
      });
    }

    // Trade policy for all countries
    recommendations.push({
      category: 'trade',
      title: 'Trade Facilitation Program',
      description: 'Streamline trade processes and expand market access',
      expectedImpact: 2.1,
      priority: 'medium' as const
    });

    return recommendations;
  }
}