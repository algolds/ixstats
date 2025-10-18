/**
 * EconomicArchetypeService
 * 
 * Provides pre-configured economic models for different economic archetypes
 * including Silicon Valley, Nordic, Asian Tiger, and other well-known models.
 */

import { EconomicComponentType, ATOMIC_ECONOMIC_COMPONENTS } from '~/components/economy/atoms/AtomicEconomicComponents';
import type { EconomyBuilderState } from '~/types/economy-builder';
import { ComponentType } from '~/components/government/atoms/AtomicGovernmentComponents';

export interface EconomicArchetype {
  id: string;
  name: string;
  description: string;
  region: string;
  characteristics: string[];
  economicComponents: EconomicComponentType[];
  governmentComponents: ComponentType[];
  taxProfile: {
    corporateRate: number;
    incomeRate: number;
    consumptionRate: number;
    revenueEfficiency: number;
  };
  sectorFocus: Record<string, number>; // Sector GDP percentages
  employmentProfile: {
    unemploymentRate: number;
    laborParticipation: number;
    wageGrowth: number;
  };
  growthMetrics: {
    gdpGrowth: number;
    innovationIndex: number;
    competitiveness: number;
    stability: number;
  };
  strengths: string[];
  challenges: string[];
  implementationComplexity: 'low' | 'medium' | 'high';
  culturalFactors: string[];
  historicalContext: string;
  modernExamples: string[];
  recommendations: string[];
}

export interface ArchetypeComparison {
  archetypes: EconomicArchetype[];
  comparisonMetrics: {
    gdpGrowth: Record<string, number>;
    innovationIndex: Record<string, number>;
    competitiveness: Record<string, number>;
    stability: Record<string, number>;
    taxEfficiency: Record<string, number>;
  };
  recommendations: string[];
}

export class EconomicArchetypeService {
  private archetypes: Map<string, EconomicArchetype> = new Map();

  constructor() {
    this.initializeArchetypes();
  }

  /**
   * Get all available economic archetypes
   */
  public getAllArchetypes(): EconomicArchetype[] {
    return Array.from(this.archetypes.values());
  }

  /**
   * Get a specific archetype by ID
   */
  public getArchetype(id: string): EconomicArchetype | null {
    return this.archetypes.get(id) || null;
  }

  /**
   * Apply an archetype to the economy builder state
   */
  public applyArchetype(archetypeId: string, currentState: EconomyBuilderState): EconomyBuilderState {
    const archetype = this.getArchetype(archetypeId);
    if (!archetype) {
      throw new Error(`Archetype ${archetypeId} not found`);
    }

    return {
      ...currentState,
      selectedAtomicComponents: archetype.economicComponents,
      structure: {
        ...currentState.structure,
        totalGDP: currentState.structure.totalGDP,
        sectors: this.generateSectorsFromArchetype(archetype)
      },
      // Note: demographics is on EconomyBuilderState root, not on structure
      demographics: this.generateDemographicsFromArchetype(archetype)
    };
  }

  /**
   * Compare multiple archetypes
   */
  public compareArchetypes(archetypeIds: string[]): ArchetypeComparison {
    const archetypes = archetypeIds.map(id => this.getArchetype(id)).filter(Boolean) as EconomicArchetype[];
    
    const comparisonMetrics = {
      gdpGrowth: this.extractMetric(archetypes, 'gdpGrowth'),
      innovationIndex: this.extractMetric(archetypes, 'innovationIndex'),
      competitiveness: this.extractMetric(archetypes, 'competitiveness'),
      stability: this.extractMetric(archetypes, 'stability'),
      taxEfficiency: this.extractMetric(archetypes, 'taxProfile.revenueEfficiency')
    };

    return {
      archetypes,
      comparisonMetrics,
      recommendations: this.generateComparisonRecommendations(archetypes)
    };
  }

  /**
   * Get recommended archetypes based on current conditions
   */
  public getRecommendedArchetypes(
    currentState: EconomyBuilderState,
    preferences: {
      growthFocus?: boolean;
      stabilityFocus?: boolean;
      innovationFocus?: boolean;
      equityFocus?: boolean;
      complexity?: 'low' | 'medium' | 'high';
    }
  ): EconomicArchetype[] {
    const allArchetypes = this.getAllArchetypes();
    
    return allArchetypes
      .filter(archetype => {
        if (preferences.complexity && archetype.implementationComplexity !== preferences.complexity) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        let scoreA = 0;
        let scoreB = 0;

        if (preferences.growthFocus) {
          scoreA += a.growthMetrics.gdpGrowth;
          scoreB += b.growthMetrics.gdpGrowth;
        }

        if (preferences.stabilityFocus) {
          scoreA += a.growthMetrics.stability;
          scoreB += b.growthMetrics.stability;
        }

        if (preferences.innovationFocus) {
          scoreA += a.growthMetrics.innovationIndex;
          scoreB += b.growthMetrics.innovationIndex;
        }

        if (preferences.equityFocus) {
          scoreA += a.taxProfile.revenueEfficiency;
          scoreB += b.taxProfile.revenueEfficiency;
        }

        return scoreB - scoreA;
      })
      .slice(0, 5); // Top 5 recommendations
  }

  /**
   * Initialize all economic archetypes
   */
  private initializeArchetypes(): void {
    // Silicon Valley Model
    this.archetypes.set('silicon-valley', {
      id: 'silicon-valley',
      name: 'Silicon Valley Model',
      description: 'Innovation-driven economy with strong tech sector, venture capital, and entrepreneurial culture',
      region: 'United States (California)',
      characteristics: [
        'High innovation and R&D investment',
        'Strong venture capital ecosystem',
        'Flexible labor markets',
        'Minimal government intervention',
        'High income inequality',
        'Expensive cost of living'
      ],
      economicComponents: [
        EconomicComponentType.INNOVATION_ECONOMY,
        EconomicComponentType.KNOWLEDGE_ECONOMY,
        EconomicComponentType.TECHNOLOGY_FOCUSED,
        EconomicComponentType.FLEXIBLE_LABOR,
        EconomicComponentType.STARTUP_ECOSYSTEM,
        EconomicComponentType.FREE_TRADE,
        EconomicComponentType.FREE_MARKET_SYSTEM,
        EconomicComponentType.HIGH_SKILLED_WORKERS,
        EconomicComponentType.INTELLECTUAL_PROPERTY,
        EconomicComponentType.VENTURE_CAPITAL
      ],
      governmentComponents: [
        ComponentType.MINIMAL_GOVERNMENT, // Now available in enum
        ComponentType.PRIVATE_SECTOR_LEADERSHIP, // Now available in enum
        ComponentType.DEMOCRATIC_PROCESS,
        ComponentType.FEDERAL_SYSTEM
      ],
      taxProfile: {
        corporateRate: 21,
        incomeRate: 37,
        consumptionRate: 7.25,
        revenueEfficiency: 0.78
      },
      sectorFocus: {
        'technology': 35,
        'finance': 20,
        'services': 25,
        'manufacturing': 10,
        'agriculture': 2,
        'government': 8
      },
      employmentProfile: {
        unemploymentRate: 3.5,
        laborParticipation: 68,
        wageGrowth: 4.2
      },
      growthMetrics: {
        gdpGrowth: 3.8,
        innovationIndex: 95,
        competitiveness: 92,
        stability: 75
      },
      strengths: [
        'World-leading innovation ecosystem',
        'Attracts top global talent',
        'High productivity and wages',
        'Strong intellectual property protection',
        'Dynamic entrepreneurial environment'
      ],
      challenges: [
        'High cost of living and housing',
        'Income inequality',
        'Traffic and infrastructure strain',
        'Dependency on tech sector',
        'Regulatory complexity'
      ],
      implementationComplexity: 'high',
      culturalFactors: [
        'Risk-taking culture',
        'Merit-based advancement',
        'Diverse international workforce',
        'Work-life balance challenges',
        'High stress environment'
      ],
      historicalContext: 'Emerged from defense industry in 1950s-60s, accelerated by semiconductor revolution and internet boom',
      modernExamples: ['San Francisco Bay Area', 'Austin, Texas', 'Seattle, Washington', 'Boston, Massachusetts'],
      recommendations: [
        'Invest heavily in R&D and education',
        'Create flexible regulatory environment',
        'Develop strong IP protection laws',
        'Foster venture capital ecosystem',
        'Address housing affordability',
        'Improve public transportation'
      ]
    });

    // Nordic Model
    this.archetypes.set('nordic', {
      id: 'nordic',
      name: 'Nordic Model',
      description: 'Social market economy with high taxes, extensive welfare, and strong social cohesion',
      region: 'Scandinavia (Denmark, Sweden, Norway, Finland)',
      characteristics: [
        'High tax rates with extensive social services',
        'Strong labor unions and worker protection',
        'Gender equality and social mobility',
        'High trust in government institutions',
        'Strong environmental policies',
        'Innovation in public sector'
      ],
      economicComponents: [
        EconomicComponentType.SOCIAL_MARKET_ECONOMY,
        EconomicComponentType.MIXED_ECONOMY,
        EconomicComponentType.PROTECTED_WORKERS,
        EconomicComponentType.KNOWLEDGE_ECONOMY,
        EconomicComponentType.INNOVATION_ECONOMY,
        EconomicComponentType.BALANCED_TRADE,
        EconomicComponentType.GREEN_ECONOMY,
        EconomicComponentType.HIGH_SKILLED_WORKERS,
        EconomicComponentType.EDUCATION_FOCUSED,
        EconomicComponentType.HEALTHCARE_FOCUSED
      ],
      governmentComponents: [
        ComponentType.SOCIAL_DEMOCRACY, // Now available in enum
        ComponentType.COMPREHENSIVE_WELFARE, // Now available in enum
        ComponentType.PUBLIC_SECTOR_LEADERSHIP, // Now available in enum
        ComponentType.DEMOCRATIC_PROCESS,
        ComponentType.ENVIRONMENTAL_FOCUS // Now available in enum
      ],
      taxProfile: {
        corporateRate: 22,
        incomeRate: 55,
        consumptionRate: 25,
        revenueEfficiency: 0.92
      },
      sectorFocus: {
        'services': 30,
        'manufacturing': 20,
        'technology': 15,
        'government': 25,
        'agriculture': 3,
        'finance': 7
      },
      employmentProfile: {
        unemploymentRate: 6.5,
        laborParticipation: 72,
        wageGrowth: 2.8
      },
      growthMetrics: {
        gdpGrowth: 2.5,
        innovationIndex: 88,
        competitiveness: 85,
        stability: 95
      },
      strengths: [
        'High social equality and mobility',
        'Strong education and healthcare systems',
        'High trust and social cohesion',
        'Environmental leadership',
        'Innovation in public services',
        'Gender equality'
      ],
      challenges: [
        'High tax burden',
        'Limited entrepreneurship incentives',
        'Bureaucratic complexity',
        'Dependency on public sector',
        'Demographic aging',
        'Integration challenges'
      ],
      implementationComplexity: 'high',
      culturalFactors: [
        'High trust in institutions',
        'Collectivist mindset',
        'Work-life balance emphasis',
        'Environmental consciousness',
        'Gender equality values'
      ],
      historicalContext: 'Developed post-WWII with strong labor movements and social democratic governance',
      modernExamples: ['Copenhagen, Denmark', 'Stockholm, Sweden', 'Oslo, Norway', 'Helsinki, Finland'],
      recommendations: [
        'Build strong social safety nets',
        'Invest in education and healthcare',
        'Implement progressive taxation',
        'Foster social trust and cohesion',
        'Develop green technologies',
        'Maintain work-life balance'
      ]
    });

    // Asian Tiger Model
    this.archetypes.set('asian-tiger', {
      id: 'asian-tiger',
      name: 'Asian Tiger Model',
      description: 'Export-oriented development with strong state guidance and rapid industrialization',
      region: 'East Asia (South Korea, Taiwan, Singapore, Hong Kong)',
      characteristics: [
        'Export-oriented industrialization',
        'Strong state guidance and planning',
        'High savings and investment rates',
        'Focus on manufacturing and technology',
        'Rapid economic transformation',
        'Strong work ethic and education'
      ],
      economicComponents: [
        EconomicComponentType.EXPORT_ORIENTED,
        EconomicComponentType.MANUFACTURING_LED,
        EconomicComponentType.TECHNOLOGY_FOCUSED,
        EconomicComponentType.STATE_CAPITALISM,
        EconomicComponentType.HIGH_SKILLED_WORKERS,
        EconomicComponentType.EDUCATION_FOCUSED,
        EconomicComponentType.RESEARCH_AND_DEVELOPMENT,
        EconomicComponentType.FREE_TRADE,
        EconomicComponentType.INNOVATION_ECONOMY,
        EconomicComponentType.COMPETITIVE_MARKETS
      ],
      governmentComponents: [
        ComponentType.CENTRALIZED_POWER,
        ComponentType.ECONOMIC_PLANNING, // Now available in enum
        ComponentType.PUBLIC_SECTOR_LEADERSHIP, // Now available in enum
        ComponentType.DEVELOPMENTAL_STATE, // Now available in enum
        ComponentType.TECHNOCRATIC_PROCESS // Changed from TECHNOCRATIC_GOVERNANCE (not in enum)
      ],
      taxProfile: {
        corporateRate: 25,
        incomeRate: 40,
        consumptionRate: 10,
        revenueEfficiency: 0.85
      },
      sectorFocus: {
        'manufacturing': 35,
        'technology': 25,
        'services': 20,
        'finance': 10,
        'agriculture': 2,
        'government': 8
      },
      employmentProfile: {
        unemploymentRate: 3.8,
        laborParticipation: 65,
        wageGrowth: 5.2
      },
      growthMetrics: {
        gdpGrowth: 4.5,
        innovationIndex: 90,
        competitiveness: 95,
        stability: 80
      },
      strengths: [
        'Rapid economic transformation',
        'Strong manufacturing base',
        'High education and skills',
        'Export competitiveness',
        'Innovation in technology',
        'Strong work ethic'
      ],
      challenges: [
        'High pressure and stress',
        'Limited work-life balance',
        'Dependency on exports',
        'Environmental concerns',
        'Aging population',
        'Geopolitical tensions'
      ],
      implementationComplexity: 'medium',
      culturalFactors: [
        'Strong work ethic',
        'Education emphasis',
        'Collective achievement',
        'Respect for authority',
        'Innovation focus'
      ],
      historicalContext: 'Developed rapidly from 1960s-90s through export-oriented industrialization and state guidance',
      modernExamples: ['Seoul, South Korea', 'Taipei, Taiwan', 'Singapore', 'Hong Kong'],
      recommendations: [
        'Focus on export-oriented development',
        'Invest heavily in education and R&D',
        'Develop strong manufacturing base',
        'Implement state-guided planning',
        'Foster innovation ecosystem',
        'Balance work-life demands'
      ]
    });

    // German Social Market Economy
    this.archetypes.set('german-social-market', {
      id: 'german-social-market',
      name: 'German Social Market Economy',
      description: 'Balanced approach combining market efficiency with social responsibility and worker participation',
      region: 'Germany',
      characteristics: [
        'Social partnership between labor and capital',
        'Strong manufacturing and export focus',
        'Worker participation in management',
        'Balanced regional development',
        'Environmental consciousness',
        'Strong vocational training'
      ],
      economicComponents: [
        EconomicComponentType.SOCIAL_MARKET_ECONOMY,
        EconomicComponentType.MIXED_ECONOMY,
        EconomicComponentType.MANUFACTURING_LED,
        EconomicComponentType.EXPORT_ORIENTED,
        EconomicComponentType.PROTECTED_WORKERS,
        EconomicComponentType.GREEN_ECONOMY,
        EconomicComponentType.HIGH_SKILLED_WORKERS,
        EconomicComponentType.VOCATIONAL_TRAINING,
        EconomicComponentType.BALANCED_TRADE,
        EconomicComponentType.INNOVATION_ECONOMY
      ],
      governmentComponents: [
        ComponentType.FEDERAL_SYSTEM,
        ComponentType.SOCIAL_DEMOCRACY, // Now available in enum
        ComponentType.WORKER_PROTECTION, // Changed from WORKER_PARTICIPATION (not in enum)
        ComponentType.ENVIRONMENTAL_FOCUS, // Now available in enum
        ComponentType.REGIONAL_DEVELOPMENT // Now available in enum
      ],
      taxProfile: {
        corporateRate: 30,
        incomeRate: 45,
        consumptionRate: 19,
        revenueEfficiency: 0.88
      },
      sectorFocus: {
        'manufacturing': 28,
        'services': 35,
        'technology': 12,
        'government': 15,
        'agriculture': 3,
        'finance': 7
      },
      employmentProfile: {
        unemploymentRate: 5.2,
        laborParticipation: 70,
        wageGrowth: 3.1
      },
      growthMetrics: {
        gdpGrowth: 2.8,
        innovationIndex: 85,
        competitiveness: 88,
        stability: 92
      },
      strengths: [
        'Strong manufacturing excellence',
        'Worker participation and social partnership',
        'Excellent vocational training',
        'Environmental leadership',
        'Balanced regional development',
        'Export competitiveness'
      ],
      challenges: [
        'High labor costs',
        'Complex regulations',
        'Slow digital transformation',
        'Dependency on exports',
        'Energy transition costs',
        'Demographic aging'
      ],
      implementationComplexity: 'high',
      culturalFactors: [
        'Work quality emphasis',
        'Social partnership values',
        'Environmental consciousness',
        'Regional identity',
        'Technical precision'
      ],
      historicalContext: 'Developed post-WWII combining free market principles with social responsibility and worker rights',
      modernExamples: ['Munich, Germany', 'Stuttgart, Germany', 'Frankfurt, Germany', 'Hamburg, Germany'],
      recommendations: [
        'Develop strong manufacturing base',
        'Implement worker participation',
        'Invest in vocational training',
        'Balance market efficiency with social goals',
        'Focus on environmental sustainability',
        'Maintain export competitiveness'
      ]
    });

    // Singapore Model
    this.archetypes.set('singapore', {
      id: 'singapore',
      name: 'Singapore Model',
      description: 'Highly efficient city-state with strategic state planning, open markets, and strict governance',
      region: 'Singapore',
      characteristics: [
        'Strategic state planning and intervention',
        'Open and competitive markets',
        'Strong rule of law and governance',
        'Multicultural and international focus',
        'High efficiency and productivity',
        'Limited natural resources'
      ],
      economicComponents: [
        EconomicComponentType.FREE_MARKET_SYSTEM,
        EconomicComponentType.SERVICE_BASED,
        EconomicComponentType.FINANCE_CENTERED,
        EconomicComponentType.TECHNOLOGY_FOCUSED,
        EconomicComponentType.EXPORT_ORIENTED,
        EconomicComponentType.STATE_CAPITALISM,
        EconomicComponentType.FLEXIBLE_LABOR,
        EconomicComponentType.FREE_TRADE,
        EconomicComponentType.HIGH_SKILLED_WORKERS,
        EconomicComponentType.INNOVATION_ECONOMY
      ],
      governmentComponents: [
        ComponentType.CENTRALIZED_POWER,
        ComponentType.RULE_OF_LAW,
        ComponentType.TECHNOCRATIC_PROCESS, // Changed from TECHNOCRATIC_GOVERNANCE (not in enum)
        ComponentType.ECONOMIC_PLANNING, // Now available in enum
        ComponentType.MERITOCRATIC_SYSTEM // Now available in enum
      ],
      taxProfile: {
        corporateRate: 17,
        incomeRate: 22,
        consumptionRate: 7,
        revenueEfficiency: 0.95
      },
      sectorFocus: {
        'finance': 25,
        'services': 35,
        'technology': 20,
        'manufacturing': 15,
        'government': 3,
        'agriculture': 0.1
      },
      employmentProfile: {
        unemploymentRate: 2.9,
        laborParticipation: 68,
        wageGrowth: 3.8
      },
      growthMetrics: {
        gdpGrowth: 4.2,
        innovationIndex: 92,
        competitiveness: 98,
        stability: 96
      },
      strengths: [
        'Exceptional governance and efficiency',
        'Strategic location and connectivity',
        'Strong rule of law',
        'Open and competitive markets',
        'High productivity and innovation',
        'Multicultural advantage'
      ],
      challenges: [
        'Limited domestic market',
        'High cost of living',
        'Dependency on external factors',
        'Limited political freedoms',
        'Resource constraints',
        'Demographic challenges'
      ],
      implementationComplexity: 'medium',
      culturalFactors: [
        'Multicultural integration',
        'Meritocratic values',
        'Efficiency focus',
        'International orientation',
        'Discipline and order'
      ],
      historicalContext: 'Developed from 1960s through strategic planning, foreign investment, and efficient governance',
      modernExamples: ['Singapore', 'Dubai, UAE', 'Hong Kong', 'Luxembourg'],
      recommendations: [
        'Develop efficient governance systems',
        'Create strategic economic planning',
        'Maintain open and competitive markets',
        'Invest in human capital',
        'Build strong international connections',
        'Ensure rule of law and stability'
      ]
    });
  }

  /**
   * Generate sectors from archetype configuration
   */
  private generateSectorsFromArchetype(archetype: EconomicArchetype): any {
    return Object.entries(archetype.sectorFocus).map(([name, percentage]) => ({
      name,
      percentage,
      growth: archetype.growthMetrics.gdpGrowth * (percentage / 100),
      employment: archetype.employmentProfile.laborParticipation * (percentage / 100),
      productivity: archetype.growthMetrics.competitiveness * (percentage / 100)
    }));
  }

  /**
   * Generate labor market from archetype configuration
   */
  private generateLaborMarketFromArchetype(archetype: EconomicArchetype): any {
    return {
      unemploymentRate: archetype.employmentProfile.unemploymentRate,
      participationRate: archetype.employmentProfile.laborParticipation,
      wageGrowth: archetype.employmentProfile.wageGrowth,
      skillLevel: archetype.economicComponents.includes(EconomicComponentType.HIGH_SKILLED_WORKERS) ? 'high' : 'medium'
    };
  }

  /**
   * Generate demographics from archetype configuration
   */
  private generateDemographicsFromArchetype(archetype: EconomicArchetype): any {
    return {
      populationGrowth: archetype.growthMetrics.gdpGrowth * 0.5,
      ageDistribution: {
        youth: 25,
        working: 60,
        elderly: 15
      },
      urbanization: 85,
      education: archetype.economicComponents.includes(EconomicComponentType.EDUCATION_FOCUSED) ? 'high' : 'medium'
    };
  }

  /**
   * Generate economic health from archetype configuration
   */
  private generateEconomicHealthFromArchetype(archetype: EconomicArchetype): any {
    return {
      gdpGrowth: archetype.growthMetrics.gdpGrowth,
      inflation: 2.5,
      innovationIndex: archetype.growthMetrics.innovationIndex,
      competitiveness: archetype.growthMetrics.competitiveness,
      stability: archetype.growthMetrics.stability,
      sustainability: 80
    };
  }

  /**
   * Extract metric for comparison
   */
  private extractMetric(archetypes: EconomicArchetype[], metricPath: string): Record<string, number> {
    const result: Record<string, number> = {};
    
    archetypes.forEach(archetype => {
      const keys = metricPath.split('.');
      let value: any = archetype;
      
      for (const key of keys) {
        value = value[key];
      }
      
      result[archetype.id] = typeof value === 'number' ? value : 0;
    });
    
    return result;
  }

  /**
   * Generate comparison recommendations
   */
  private generateComparisonRecommendations(archetypes: EconomicArchetype[]): string[] {
    const recommendations: string[] = [];
    
    const avgGrowth = archetypes.reduce((sum, a) => sum + a.growthMetrics.gdpGrowth, 0) / archetypes.length;
    const avgInnovation = archetypes.reduce((sum, a) => sum + a.growthMetrics.innovationIndex, 0) / archetypes.length;
    const avgStability = archetypes.reduce((sum, a) => sum + a.growthMetrics.stability, 0) / archetypes.length;
    
    if (avgGrowth > 4) {
      recommendations.push('Focus on high-growth archetypes for rapid economic development');
    }
    
    if (avgInnovation > 90) {
      recommendations.push('Prioritize innovation-driven models for technological advancement');
    }
    
    if (avgStability > 90) {
      recommendations.push('Emphasize stability-focused approaches for sustainable development');
    }
    
    recommendations.push('Consider hybrid approaches combining strengths from multiple archetypes');
    recommendations.push('Adapt archetype elements to local cultural and institutional context');
    
    return recommendations;
  }
}
