// Enhanced Economic Service
// Central service for integrating advanced economic calculations across the platform

import { IntegratedEconomicAnalysis } from './enhanced-economic-calculations';
import { IntuitiveEconomicAnalysis } from './intuitive-economic-analysis';
import { runGroupedAnalysis, EconomicCalculationGroups } from './economic-calculation-groups';
import { getDefaultEconomicConfig } from './config-service';
import { IxTime } from './ixtime';
import type {
  CountryStats,
  HistoricalDataPoint,
  EconomicConfig
} from '../types/ixstats';
import type { EconomyData } from '../types/economics';
import type { ComprehensiveEconomicAnalysis } from './enhanced-economic-calculations';
import type {
  EconomicHealthSummary,
  ActionableInsights,
  EconomicStory,
  EconomicBenchmarking,
  EconomicSimulation
} from './intuitive-economic-analysis';
import type { GroupedAnalysisResult } from './economic-calculation-groups';

// ===== SERVICE INTERFACES =====

export interface EconomicAnalysisResult {
  comprehensive: ComprehensiveEconomicAnalysis;
  intuitive: {
    summary: EconomicHealthSummary;
    insights: ActionableInsights;
    story: EconomicStory;
    benchmarking: EconomicBenchmarking;
    simulation: EconomicSimulation;
  };
  grouped: GroupedAnalysisResult;
  metadata: {
    analysisTimestamp: string;
    ixTimeEpoch: number;
    version: string;
    processingTimeMs: number;
  };
}

export interface EconomicCacheOptions {
  ttl?: number; // Time to live in milliseconds
  useCache?: boolean;
  forceRefresh?: boolean;
}

export interface EconomicAnalysisOptions {
  includeIntuitiveAnalysis?: boolean;
  includeGroupedAnalysis?: boolean;
  includeProjections?: boolean;
  includeSimulations?: boolean;
  cache?: EconomicCacheOptions;
}

// ===== MAIN SERVICE CLASS =====

export class EnhancedEconomicService {
  private integratedAnalyzer: IntegratedEconomicAnalysis;
  private intuitiveAnalyzer: IntuitiveEconomicAnalysis;
  private groupCalculator: EconomicCalculationGroups;
  private config: EconomicConfig;
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  
  constructor(config?: EconomicConfig) {
    this.config = config || getDefaultEconomicConfig();
    this.integratedAnalyzer = new IntegratedEconomicAnalysis(this.config);
    this.intuitiveAnalyzer = new IntuitiveEconomicAnalysis(this.config);
    this.groupCalculator = new EconomicCalculationGroups(this.config);
    
    // Start cache cleanup interval
    this.startCacheCleanup();
  }

  /**
   * Main analysis method - provides complete economic analysis
   */
  async analyzeCountryEconomy(
    countryStats: CountryStats,
    economyData: EconomyData,
    historicalData: HistoricalDataPoint[] = [],
    options: EconomicAnalysisOptions = {}
  ): Promise<EconomicAnalysisResult> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(countryStats.country, options);
    
    // Check cache first
    if (options.cache?.useCache && !options.cache?.forceRefresh) {
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }
    }

    try {
      // Run comprehensive analysis
      const comprehensive = this.integratedAnalyzer.analyzeCountry(
        countryStats, 
        economyData, 
        historicalData
      );

      let intuitive = null;
      let grouped = null;

      // Run intuitive analysis if requested
      if (options.includeIntuitiveAnalysis !== false) {
        const analysis = await this.intuitiveAnalyzer.analyzeEconomy(
          countryStats,
          economyData,
          historicalData
        );
        
        intuitive = {
          summary: analysis.summary,
          insights: analysis.insights,
          story: analysis.story,
          benchmarking: analysis.benchmarking,
          simulation: analysis.simulation
        };
      }

      // Run grouped analysis if requested  
      if (options.includeGroupedAnalysis !== false) {
        grouped = runGroupedAnalysis(
          countryStats,
          economyData,
          historicalData,
          this.config
        );
      }

      const result: EconomicAnalysisResult = {
        comprehensive,
        intuitive: intuitive || this.createEmptyIntuitiveAnalysis(),
        grouped: grouped || this.createEmptyGroupedAnalysis(),
        metadata: {
          analysisTimestamp: new Date().toISOString(),
          ixTimeEpoch: IxTime.getCurrentIxTime(),
          version: '1.0.0',
          processingTimeMs: Date.now() - startTime
        }
      };

      // Cache result if caching enabled
      if (options.cache?.useCache) {
        this.setCache(cacheKey, result, options.cache.ttl || 300000); // 5 minutes default
      }

      return result;
    } catch (error) {
      console.error('Enhanced economic analysis failed:', error);
      throw new Error(`Economic analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Quick health check for dashboard use
   */
  quickHealthCheck(countryStats: CountryStats, economyData: EconomyData): EconomicHealthSummary {
    return this.intuitiveAnalyzer.quickHealthCheck(countryStats, economyData);
  }

  /**
   * Get specific economic metrics for components
   */
  getEconomicMetrics(countryStats: CountryStats, economyData: EconomyData) {
    const comprehensive = this.integratedAnalyzer.analyzeCountry(countryStats, economyData, []);
    const health = this.quickHealthCheck(countryStats, economyData);
    
    return {
      overallScore: comprehensive.overallRating.score,
      overallGrade: comprehensive.overallRating.grade,
      healthStatus: health.status,
      resilience: comprehensive.resilience.overallScore,
      productivity: comprehensive.productivity.overallScore,
      wellbeing: comprehensive.wellbeing.overallScore,
      complexity: comprehensive.complexity.overallScore,
      keyInsights: comprehensive.keyInsights.slice(0, 3),
      topRecommendations: comprehensive.priorityRecommendations.slice(0, 3)
    };
  }

  /**
   * Get economic indicators for builder components
   */
  getBuilderMetrics(countryStats: CountryStats, economyData: EconomyData) {
    const health = this.quickHealthCheck(countryStats, economyData);
    const comprehensive = this.integratedAnalyzer.analyzeCountry(countryStats, economyData, []);
    
    return {
      // Traditional metrics for compatibility
      traditional: [
        { label: 'GDP per Capita', value: `$${countryStats.currentGdpPerCapita.toLocaleString()}` },
        { label: 'Economic Tier', value: countryStats.economicTier },
        { label: 'Population', value: countryStats.currentPopulation.toLocaleString() },
        { label: 'Unemployment', value: `${Number(economyData.labor.unemploymentRate ?? 0).toFixed(1)}%` },
        { label: 'Inflation', value: `${Number((economyData.core.inflationRate ?? 0) * 100).toFixed(1)}%` }
      ],
      
      // Enhanced metrics
      enhanced: {
        overallGrade: health.overallGrade,
        overallScore: health.score,
        healthStatus: health.status,
        keyMessage: health.keyMessage,
        resilience: comprehensive.resilience.overallScore,
        productivity: comprehensive.productivity.overallScore,
        wellbeing: comprehensive.wellbeing.overallScore,
        complexity: comprehensive.complexity.overallScore
      }
    };
  }

  /**
   * Get intelligence briefing data for MyCountry
   */
  getIntelligenceBriefing(countryStats: CountryStats, economyData: EconomyData) {
    const comprehensive = this.integratedAnalyzer.analyzeCountry(countryStats, economyData, []);
    const health = this.quickHealthCheck(countryStats, economyData);
    
    return {
      executiveIntelligence: {
        overallRating: comprehensive.overallRating,
        criticalAlerts: comprehensive.resilience.riskFactors.map(risk => ({
          id: `risk_${Date.now()}_${Math.random()}`,
          severity: risk.impact as 'critical' | 'warning' | 'info',
          title: risk.factor,
          description: risk.description,
          timestamp: new Date(),
          category: 'economic'
        })),
        trendingInsights: comprehensive.keyInsights.map(insight => ({
          id: `insight_${Date.now()}_${Math.random()}`,
          title: 'Economic Trend Analysis',
          insight: insight,
          trend: 'stable' as const,
          impact: 'medium' as const,
          confidence: 0.85
        })),
        actionableRecommendations: comprehensive.priorityRecommendations
      },
      
      vitalityIntelligence: [
        {
          area: 'economic',
          overallScore: comprehensive.resilience.overallScore,
          status: health.status.toLowerCase() as 'excellent' | 'good' | 'fair' | 'concerning' | 'critical',
          trend: health.trend.toLowerCase() as 'improving' | 'stable' | 'declining',
          metrics: [
            {
              id: 'resilience',
              name: 'Economic Resilience',
              value: comprehensive.resilience.overallScore,
              unit: '%',
              trend: 'stable' as const,
              status: comprehensive.resilience.overallScore >= 70 ? 'good' as const : 'concerning' as const
            }
          ]
        }
      ]
    };
  }

  // ===== PRIVATE METHODS =====

  private generateCacheKey(countryId: string, options: EconomicAnalysisOptions): string {
    return `economic_analysis_${countryId}_${JSON.stringify(options)}`;
  }

  private getFromCache(key: string): EconomicAnalysisResult | undefined {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data;
    }
    return undefined;
  }

  private setCache(key: string, data: any, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  private startCacheCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [key, value] of this.cache.entries()) {
        if (now - value.timestamp > value.ttl) {
          this.cache.delete(key);
        }
      }
    }, 60000); // Clean every minute
  }

  private createEmptyIntuitiveAnalysis(): {
    summary: EconomicHealthSummary;
    insights: ActionableInsights;
    story: EconomicStory;
    benchmarking: EconomicBenchmarking;
    simulation: EconomicSimulation;
  } {
    // Return minimal valid objects instead of null
    return {
      summary: {
        overallGrade: 'C',
        score: 0,
        status: 'Fair',
        trend: 'Stable',
        keyMessage: 'Analysis not available',
        healthIndicators: { growth: 'weak', stability: 'medium', sustainability: 'concerning' },
        quickStats: { economicSize: 'Unknown', developmentLevel: 'Unknown', globalPosition: 'Unknown', riskLevel: 'Unknown' }
      } as EconomicHealthSummary,
      insights: {
        immediateActions: [],
        strengths: [],
        watchAreas: [],
        strategicOpportunities: []
      } as ActionableInsights,
      story: {
        headline: 'Analysis unavailable',
        currentSituation: '',
        recentProgress: '',
        majorChallenges: [],
        futurePotential: '',
        comparativePerspective: '',
        economicJourney: { past: '', present: '', future: '' },
        dominantThemes: []
      } as EconomicStory,
      benchmarking: {
        peerComparisons: [],
        progressTracking: [],
        globalContext: {
          economicRank: 0,
          developmentRank: 0,
          competitivenessRank: 0,
          trendDirection: 'Stable' as const
        }
      } as EconomicBenchmarking,
      simulation: {
        baselineProjection: {
          gdpGrowth5Year: 0,
          gdpPerCapita5Year: 0,
          unemploymentProjection: 0,
          debtProjection: 0
        },
        policyScenarios: [],
        riskScenarios: []
      } as EconomicSimulation
    };
  }

  private createEmptyGroupedAnalysis(): GroupedAnalysisResult {
    return {
      growthDynamics: {
        group: 'growth_dynamics',
        overallScore: 0,
        components: { growthMomentum: 0, growthSustainability: 0, growthQuality: 0, growthStability: 0 },
        insights: { growthPhase: 'maturation', trendDirection: 'stable', volatilityLevel: 'moderate', sustainabilityRisk: 'medium' },
        projections: { nextQuarter: 0, nextYear: 0, fiveYear: 0 }
      },
      financialHealth: {
        group: 'financial_health',
        overallScore: 0,
        components: { fiscalPosition: 0, monetaryStability: 0, financialSector: 0, externalBalance: 0 },
        ratingEquivalent: 'BBB',
        keyRatios: { debtServiceRatio: 0, fiscalBalanceRatio: 0, currentAccountRatio: 0, reservesCoverageRatio: 0 },
        creditworthinessFactors: []
      },
      humanDevelopment: {
        group: 'human_development',
        overallScore: 0,
        components: { healthOutcomes: 0, educationAchievement: 0, livingStandards: 0, socialCohesion: 0 },
        developmentStage: 'medium',
        demographicDividend: { stage: 'peak', yearsRemaining: 0, potentialBenefit: 'medium' },
        humanCapitalIndex: 0
      },
      economicStructure: {
        group: 'economic_structure',
        overallScore: 0,
        components: { sectoralBalance: 0, economicComplexity: 0, marketDynamism: 0, infrastructureQuality: 0 },
        structuralProfile: { primarySectorShare: 0, secondarySectorShare: 0, tertiarySectorShare: 0, quaternarySectorShare: 0 },
        competitivenessRanking: { globalRank: 0, regionalRank: 0, trendDirection: 'stable' as const },
        transformationPotential: 'medium' as const
      },
      externalRelations: {
        group: 'external_relations',
        overallScore: 0,
        components: { tradeIntegration: 0, investmentAttraction: 0, globalConnectivity: 0, diplomaticEconomics: 0 },
        tradeProfile: { exportConcentration: 0, importDependence: 0, tradingPartnerDiversification: 0, valueChainPosition: 'integrated' as const },
        integrationLevel: 'medium' as const,
        vulnerabilityFactors: []
      },
      overallScore: 0,
      strengths: [],
      challenges: [],
      priorityActions: []
    };
  }
}

// ===== GLOBAL SERVICE INSTANCE =====

let globalEconomicService: EnhancedEconomicService | null = null;

export function getEconomicService(): EnhancedEconomicService {
  if (!globalEconomicService) {
    globalEconomicService = new EnhancedEconomicService();
  }
  return globalEconomicService;
}

export function resetEconomicService(): void {
  globalEconomicService = null;
}

// ===== UTILITY FUNCTIONS =====

export async function analyzeCountryEconomics(
  countryStats: CountryStats,
  economyData: EconomyData,
  historicalData?: HistoricalDataPoint[],
  options?: EconomicAnalysisOptions
): Promise<EconomicAnalysisResult> {
  const service = getEconomicService();
  return service.analyzeCountryEconomy(countryStats, economyData, historicalData || [], options);
}

export function getQuickEconomicHealth(
  countryStats: CountryStats,
  economyData: EconomyData
): EconomicHealthSummary {
  const service = getEconomicService();
  return service.quickHealthCheck(countryStats, economyData);
}

export function getBuilderEconomicMetrics(
  countryStats: CountryStats,
  economyData: EconomyData
) {
  const service = getEconomicService();
  return service.getBuilderMetrics(countryStats, economyData);
}

export function getIntelligenceEconomicData(
  countryStats: CountryStats,
  economyData: EconomyData
) {
  const service = getEconomicService();
  return service.getIntelligenceBriefing(countryStats, economyData);
}

export default EnhancedEconomicService;