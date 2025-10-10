// src/lib/enhanced-economic-calculations.ts
// Enhanced Economic Calculation Framework
// Building on existing calculations with grouped methodologies and detailed analysis

import { IxTime } from './ixtime';
import { IxStatsCalculator, EconomicTier, PopulationTier } from './calculations';
import type { 
  CountryStats, 
  EconomicConfig, 
  HistoricalDataPoint,
  DmInputs 
} from '../types/ixstats';
import type { EconomyData, CoreEconomicIndicatorsData } from '../types/economics';

// ===== ENHANCED CALCULATION GROUPS =====

/**
 * Economic Resilience Index (ERI)
 * Measures a country's ability to withstand economic shocks
 */
export interface EconomicResilienceMetrics {
  overallScore: number;
  components: {
    fiscalStability: number;      // Debt, budget balance, tax efficiency
    monetaryStability: number;    // Inflation, currency stability, reserves
    structuralBalance: number;    // Economic diversity, export dependency
    socialCohesion: number;       // Income inequality, employment stability
  };
  riskFactors: Array<{
    factor: string;
    impact: 'low' | 'medium' | 'high';
    description: string;
  }>;
  projections: {
    '6_month': number;
    '1_year': number;
    '2_year': number;
  };
}

/**
 * Productivity & Innovation Index (PII)
 * Measures economic efficiency and technological advancement
 */
export interface ProductivityInnovationMetrics {
  overallScore: number;
  components: {
    laborProductivity: number;    // GDP per hour worked, skill level
    capitalEfficiency: number;    // Capital investment returns, infrastructure
    technologicalAdaptation: number; // R&D spend, patent activity, digital adoption
    entrepreneurshipIndex: number;   // Business creation, regulatory ease
  };
  growthDrivers: Array<{
    driver: string;
    strength: number;
    trendDirection: 'increasing' | 'stable' | 'decreasing';
  }>;
  competitiveAdvantages: string[];
}

/**
 * Social Economic Wellbeing Index (SEWI)
 * Measures how economic prosperity translates to social outcomes
 */
export interface SocialEconomicWellbeingMetrics {
  overallScore: number;
  components: {
    livingStandards: number;      // Cost of living adjusted income, housing
    healthcareAccess: number;     // Healthcare spending, coverage, outcomes
    educationOpportunity: number; // Education spending, literacy, skill development
    socialMobility: number;       // Income mobility, wealth concentration
  };
  inequalityFactors: {
    giniCoefficient: number;
    wealthConcentration: {
      top10Percent: number;
      bottom50Percent: number;
    };
    regionalDisparities: Array<{
      region: string;
      deviation: number;
    }>;
  };
  trendAnalysis: {
    improving: string[];
    stable: string[];
    concerning: string[];
  };
}

/**
 * Economic Complexity & Trade Integration Index (ECTI)
 * Measures economic sophistication and global integration
 */
export interface EconomicComplexityMetrics {
  overallScore: number;
  components: {
    exportDiversity: number;      // Product complexity, market diversification
    valueChainIntegration: number; // Supply chain participation, value addition
    financialSophistication: number; // Banking, capital markets, fintech
    regulatoryQuality: number;    // Business environment, rule of law
  };
  tradeMetrics: {
    exportComplexityIndex: number;
    importDependencyRatio: number;
    tradeBalanceTrend: 'improving' | 'stable' | 'deteriorating';
    majorTradingPartners: Array<{
      country: string;
      shareOfTrade: number;
      relationship: 'strategic' | 'transactional' | 'dependent';
    }>;
  };
  futureOpportunities: string[];
}

// ===== ENHANCED CALCULATION ENGINE =====

export class EnhancedEconomicCalculator extends IxStatsCalculator {
  private resilienceWeights = {
    fiscalStability: 0.3,
    monetaryStability: 0.25,
    structuralBalance: 0.25,
    socialCohesion: 0.2
  };

  private productivityWeights = {
    laborProductivity: 0.35,
    capitalEfficiency: 0.25,
    technologicalAdaptation: 0.25,
    entrepreneurshipIndex: 0.15
  };

  private wellbeingWeights = {
    livingStandards: 0.3,
    healthcareAccess: 0.25,
    educationOpportunity: 0.25,
    socialMobility: 0.2
  };

  private complexityWeights = {
    exportDiversity: 0.3,
    valueChainIntegration: 0.25,
    financialSophistication: 0.25,
    regulatoryQuality: 0.2
  };

  /**
   * Calculate Economic Resilience Index
   */
  calculateEconomicResilience(
    countryStats: CountryStats,
    economyData: EconomyData,
    historicalData: HistoricalDataPoint[] = []
  ): EconomicResilienceMetrics {
    // Fiscal Stability (0-100)
    const fiscalStability = this.calculateFiscalStability(countryStats, economyData);
    
    // Monetary Stability (0-100)
    const monetaryStability = this.calculateMonetaryStability(economyData, historicalData);
    
    // Structural Balance (0-100)
    const structuralBalance = this.calculateStructuralBalance(countryStats, economyData);
    
    // Social Cohesion (0-100)
    const socialCohesion = this.calculateSocialCohesion(economyData);

    // Overall resilience score
    const overallScore = 
      fiscalStability * this.resilienceWeights.fiscalStability +
      monetaryStability * this.resilienceWeights.monetaryStability +
      structuralBalance * this.resilienceWeights.structuralBalance +
      socialCohesion * this.resilienceWeights.socialCohesion;

    // Risk factor assessment
    const riskFactors = this.assessRiskFactors(countryStats, economyData);

    // Future projections
    const projections = this.projectResilience(overallScore, historicalData, riskFactors);

    return {
      overallScore: Math.round(overallScore),
      components: {
        fiscalStability: Math.round(fiscalStability),
        monetaryStability: Math.round(monetaryStability),
        structuralBalance: Math.round(structuralBalance),
        socialCohesion: Math.round(socialCohesion)
      },
      riskFactors,
      projections
    };
  }

  /**
   * Calculate Productivity & Innovation Index
   */
  calculateProductivityInnovation(
    countryStats: CountryStats,
    economyData: EconomyData,
    historicalData: HistoricalDataPoint[] = []
  ): ProductivityInnovationMetrics {
    const laborProductivity = this.calculateLaborProductivity(countryStats, economyData);
    const capitalEfficiency = this.calculateCapitalEfficiency(countryStats, economyData);
    const technologicalAdaptation = this.calculateTechnologicalAdaptation(economyData);
    const entrepreneurshipIndex = this.calculateEntrepreneurshipIndex(economyData);

    const overallScore = 
      laborProductivity * this.productivityWeights.laborProductivity +
      capitalEfficiency * this.productivityWeights.capitalEfficiency +
      technologicalAdaptation * this.productivityWeights.technologicalAdaptation +
      entrepreneurshipIndex * this.productivityWeights.entrepreneurshipIndex;

    const growthDrivers = this.identifyGrowthDrivers(countryStats, economyData, historicalData);
    const competitiveAdvantages = this.identifyCompetitiveAdvantages(countryStats, economyData);

    return {
      overallScore: Math.round(overallScore),
      components: {
        laborProductivity: Math.round(laborProductivity),
        capitalEfficiency: Math.round(capitalEfficiency),
        technologicalAdaptation: Math.round(technologicalAdaptation),
        entrepreneurshipIndex: Math.round(entrepreneurshipIndex)
      },
      growthDrivers,
      competitiveAdvantages
    };
  }

  /**
   * Calculate Social Economic Wellbeing Index
   */
  calculateSocialEconomicWellbeing(
    countryStats: CountryStats,
    economyData: EconomyData
  ): SocialEconomicWellbeingMetrics {
    const livingStandards = this.calculateLivingStandards(countryStats, economyData);
    const healthcareAccess = this.calculateHealthcareAccess(economyData);
    const educationOpportunity = this.calculateEducationOpportunity(economyData);
    const socialMobility = this.calculateSocialMobility(economyData);

    const overallScore = 
      livingStandards * this.wellbeingWeights.livingStandards +
      healthcareAccess * this.wellbeingWeights.healthcareAccess +
      educationOpportunity * this.wellbeingWeights.educationOpportunity +
      socialMobility * this.wellbeingWeights.socialMobility;

    const inequalityFactors = this.analyzeInequalityFactors(economyData);
    const trendAnalysis = this.analyzeSocialTrends(economyData);

    return {
      overallScore: Math.round(overallScore),
      components: {
        livingStandards: Math.round(livingStandards),
        healthcareAccess: Math.round(healthcareAccess),
        educationOpportunity: Math.round(educationOpportunity),
        socialMobility: Math.round(socialMobility)
      },
      inequalityFactors,
      trendAnalysis
    };
  }

  /**
   * Calculate Economic Complexity & Trade Integration Index
   */
  calculateEconomicComplexity(
    countryStats: CountryStats,
    economyData: EconomyData
  ): EconomicComplexityMetrics {
    const exportDiversity = this.calculateExportDiversity(countryStats, economyData);
    const valueChainIntegration = this.calculateValueChainIntegration(economyData);
    const financialSophistication = this.calculateFinancialSophistication(economyData);
    const regulatoryQuality = this.calculateRegulatoryQuality(economyData);

    const overallScore = 
      exportDiversity * this.complexityWeights.exportDiversity +
      valueChainIntegration * this.complexityWeights.valueChainIntegration +
      financialSophistication * this.complexityWeights.financialSophistication +
      regulatoryQuality * this.complexityWeights.regulatoryQuality;

    const tradeMetrics = this.analyzeTradeMetrics(countryStats, economyData);
    const futureOpportunities = this.identifyFutureOpportunities(countryStats, economyData);

    return {
      overallScore: Math.round(overallScore),
      components: {
        exportDiversity: Math.round(exportDiversity),
        valueChainIntegration: Math.round(valueChainIntegration),
        financialSophistication: Math.round(financialSophistication),
        regulatoryQuality: Math.round(regulatoryQuality)
      },
      tradeMetrics,
      futureOpportunities
    };
  }

  // ===== COMPONENT CALCULATION METHODS =====

  private calculateFiscalStability(countryStats: CountryStats, economyData: EconomyData): number {
    let score = 50; // Base score

    // Debt-to-GDP ratio factor
    const debtRatio = economyData.fiscal.totalDebtGDPRatio;
    if (debtRatio <= 60) score += 25;
    else if (debtRatio <= 90) score += 15;
    else if (debtRatio <= 120) score += 5;
    else score -= 10;

    // Budget balance factor
    const budgetBalance = economyData.fiscal.budgetDeficitSurplus / economyData.core.nominalGDP;
    if (budgetBalance > 0.02) score += 15; // Surplus
    else if (budgetBalance > -0.03) score += 10; // Small deficit
    else if (budgetBalance > -0.06) score += 0; // Moderate deficit
    else score -= 15; // Large deficit

    // Tax efficiency factor
    const taxEfficiency = economyData.fiscal.taxRevenueGDPPercent;
    if (taxEfficiency >= 15 && taxEfficiency <= 35) score += 10;
    else if (taxEfficiency < 10 || taxEfficiency > 45) score -= 10;

    return Math.max(0, Math.min(100, score));
  }

  private calculateMonetaryStability(economyData: EconomyData, historicalData: HistoricalDataPoint[]): number {
    let score = 50; // Base score

    // Inflation stability
    const inflation = economyData.core.inflationRate;
    if (inflation >= 0.01 && inflation <= 0.04) score += 25; // Ideal range
    else if (inflation >= 0 && inflation <= 0.06) score += 15; // Acceptable range
    else if (inflation > 0.1) score -= 20; // High inflation penalty
    else if (inflation < -0.02) score -= 15; // Deflation penalty

    // Growth volatility (if historical data available)
    if (historicalData.length >= 10) {
      const growthRates = historicalData.slice(-10).map(d => d.gdpGrowthRate);
      const avgGrowth = growthRates.reduce((sum, rate) => sum + rate, 0) / growthRates.length;
      const volatility = this.calculateStandardDeviation(growthRates);
      
      if (volatility <= 0.02) score += 15; // Low volatility
      else if (volatility <= 0.04) score += 10; // Moderate volatility
      else if (volatility > 0.08) score -= 15; // High volatility
    }

    // Currency stability (simplified - would need external data in real implementation)
    score += 10; // Placeholder for currency stability metrics

    return Math.max(0, Math.min(100, score));
  }

  private calculateStructuralBalance(countryStats: CountryStats, economyData: EconomyData): number {
    let score = 50; // Base score

    // Economic tier factor
    const tier = countryStats.economicTier;
    switch (tier) {
      case EconomicTier.EXTRAVAGANT:
      case EconomicTier.VERY_STRONG:
        score += 20;
        break;
      case EconomicTier.STRONG:
      case EconomicTier.HEALTHY:
        score += 15;
        break;
      case EconomicTier.DEVELOPED:
        score += 10;
        break;
      case EconomicTier.DEVELOPING:
        score += 5;
        break;
      default:
        score -= 5;
    }

    // Population size advantages/disadvantages
    const populationTier = countryStats.populationTier;
    switch (populationTier) {
      case PopulationTier.TIER_3:
      case PopulationTier.TIER_4:
      case PopulationTier.TIER_5:
        score += 10; // Optimal size
        break;
      case PopulationTier.TIER_1:
      case PopulationTier.TIER_2:
        score += 5; // Smaller but manageable
        break;
      case PopulationTier.TIER_X:
        score -= 5; // Very large coordination challenges
        break;
    }

    // Employment structure health
    const unemployment = economyData.labor.unemploymentRate;
    if (unemployment <= 5) score += 15;
    else if (unemployment <= 8) score += 10;
    else if (unemployment <= 12) score += 0;
    else score -= 15;

    return Math.max(0, Math.min(100, score));
  }

  private calculateSocialCohesion(economyData: EconomyData): number {
    let score = 50; // Base score

    // Income inequality factor
    const gini = economyData.income.incomeInequalityGini;
    if (gini <= 0.3) score += 25; // Very low inequality
    else if (gini <= 0.4) score += 15; // Low inequality
    else if (gini <= 0.5) score += 5; // Moderate inequality
    else score -= 15; // High inequality

    // Social mobility factor
    const mobility = economyData.income.socialMobilityIndex;
    if (mobility >= 70) score += 15;
    else if (mobility >= 50) score += 10;
    else if (mobility <= 30) score -= 10;

    // Education and healthcare access
    const education = economyData.demographics.literacyRate;
    if (education >= 95) score += 10;
    else if (education >= 85) score += 5;
    else if (education <= 70) score -= 10;

    return Math.max(0, Math.min(100, score));
  }

  // Additional calculation methods for other components...
  private calculateLaborProductivity(countryStats: CountryStats, economyData: EconomyData): number {
    let score = 50;

    // GDP per capita as proxy for productivity
    const gdpPerCapita = countryStats.currentGdpPerCapita;
    if (gdpPerCapita >= 60000) score += 30;
    else if (gdpPerCapita >= 40000) score += 20;
    else if (gdpPerCapita >= 25000) score += 15;
    else if (gdpPerCapita >= 15000) score += 10;
    else score += 5;

    // Workforce efficiency
    const laborForceParticipation = economyData.labor.laborForceParticipationRate;
    if (laborForceParticipation >= 70) score += 15;
    else if (laborForceParticipation >= 60) score += 10;
    else score += 5;

    // Education level impact
    const literacyRate = economyData.demographics.literacyRate;
    if (literacyRate >= 95) score += 5;
    else if (literacyRate >= 85) score += 3;
    else score -= 5;

    return Math.max(0, Math.min(100, score));
  }

  private calculateCapitalEfficiency(countryStats: CountryStats, economyData: EconomyData): number {
    let score = 50;

    // Government spending efficiency
    const spendingGDP = economyData.spending.spendingGDPPercent;
    if (spendingGDP >= 20 && spendingGDP <= 40) score += 15; // Optimal range
    else if (spendingGDP < 15 || spendingGDP > 50) score -= 10; // Inefficient range

    // Investment in productive sectors
    const infrastructureSpending = economyData.spending.spendingCategories
      .find(cat => cat.category.toLowerCase().includes('infrastructure'))?.percent || 0;
    const educationSpending = economyData.spending.spendingCategories
      .find(cat => cat.category.toLowerCase().includes('education'))?.percent || 0;

    score += (infrastructureSpending + educationSpending) * 0.5; // Productive investment bonus

    // Economic tier bonus (higher tiers typically have better capital efficiency)
    switch (countryStats.economicTier) {
      case EconomicTier.EXTRAVAGANT:
      case EconomicTier.VERY_STRONG:
        score += 20;
        break;
      case EconomicTier.STRONG:
        score += 15;
        break;
      case EconomicTier.HEALTHY:
        score += 10;
        break;
    }

    return Math.max(0, Math.min(100, score));
  }

  // Placeholder methods for remaining calculations
  private calculateTechnologicalAdaptation(economyData: EconomyData): number {
    // Placeholder implementation
    return 50 + (economyData.core.gdpPerCapita > 30000 ? 25 : 10);
  }

  private calculateEntrepreneurshipIndex(economyData: EconomyData): number {
    // Placeholder implementation
    return 45 + (economyData.labor.employmentRate > 90 ? 20 : 10);
  }

  // Risk Assessment Methods
  private assessRiskFactors(countryStats: CountryStats, economyData: EconomyData) {
    const risks = [];

    // High debt risk
    if (economyData.fiscal.totalDebtGDPRatio > 100) {
      risks.push({
        factor: 'High Government Debt',
        impact: 'high' as const,
        description: `Debt-to-GDP ratio of ${economyData.fiscal.totalDebtGDPRatio.toFixed(1)}% may limit fiscal flexibility`
      });
    }

    // High unemployment risk
    if (economyData.labor.unemploymentRate > 12) {
      risks.push({
        factor: 'High Unemployment',
        impact: 'medium' as const,
        description: `Unemployment rate of ${economyData.labor.unemploymentRate.toFixed(1)}% indicates structural issues`
      });
    }

    // Inflation risk
    if (economyData.core.inflationRate > 0.08) {
      risks.push({
        factor: 'High Inflation',
        impact: 'high' as const,
        description: `Inflation rate of ${(economyData.core.inflationRate * 100).toFixed(1)}% erodes purchasing power`
      });
    }

    return risks;
  }

  private projectResilience(currentScore: number, historicalData: HistoricalDataPoint[], riskFactors: any[]) {
    // Simple projection model - in reality would use more sophisticated forecasting
    const riskPenalty = riskFactors.reduce((sum, risk) => {
      return sum + (risk.impact === 'high' ? -3 : risk.impact === 'medium' ? -2 : -1);
    }, 0);

    return {
      '6_month': Math.max(0, Math.min(100, currentScore + (riskPenalty * 0.5))),
      '1_year': Math.max(0, Math.min(100, currentScore + riskPenalty)),
      '2_year': Math.max(0, Math.min(100, currentScore + (riskPenalty * 1.5)))
    };
  }

  // Helper methods
  private calculateStandardDeviation(values: number[]): number {
    if (values.length < 2) return 0;
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  // Placeholder methods for remaining functionality
  private identifyGrowthDrivers(countryStats: CountryStats, economyData: EconomyData, historicalData: HistoricalDataPoint[]) {
    return [
      { driver: 'High-skilled workforce', strength: 75, trendDirection: 'increasing' as const },
      { driver: 'Infrastructure investment', strength: 60, trendDirection: 'stable' as const },
      { driver: 'Technology adoption', strength: 55, trendDirection: 'increasing' as const }
    ];
  }

  private identifyCompetitiveAdvantages(countryStats: CountryStats, economyData: EconomyData): string[] {
    const advantages = [];
    
    if (countryStats.currentGdpPerCapita > 50000) advantages.push('High income economy');
    if (economyData.labor.unemploymentRate < 5) advantages.push('Full employment');
    if (economyData.fiscal.totalDebtGDPRatio < 60) advantages.push('Fiscal sustainability');
    if (economyData.core.inflationRate < 0.04) advantages.push('Price stability');
    
    return advantages;
  }

  private calculateLivingStandards(countryStats: CountryStats, economyData: EconomyData): number {
    return Math.min(100, (countryStats.currentGdpPerCapita / 1000) + 30);
  }

  private calculateHealthcareAccess(economyData: EconomyData): number {
    const healthcareSpending = economyData.spending.spendingCategories
      .find(cat => cat.category.toLowerCase().includes('healthcare'))?.percent || 0;
    return Math.min(100, 40 + (healthcareSpending * 2));
  }

  private calculateEducationOpportunity(economyData: EconomyData): number {
    const educationSpending = economyData.spending.spendingCategories
      .find(cat => cat.category.toLowerCase().includes('education'))?.percent || 0;
    const literacy = economyData.demographics.literacyRate;
    return Math.min(100, (literacy * 0.6) + (educationSpending * 2));
  }

  private calculateSocialMobility(economyData: EconomyData): number {
    return economyData.income.socialMobilityIndex;
  }

  private analyzeInequalityFactors(economyData: EconomyData) {
    return {
      giniCoefficient: economyData.income.incomeInequalityGini,
      wealthConcentration: {
        top10Percent: economyData.income.economicClasses[0]?.wealthPercent || 40,
        bottom50Percent: economyData.income.economicClasses.slice(-2)
          .reduce((sum, c) => sum + c.wealthPercent, 0)
      },
      regionalDisparities: economyData.demographics.regions.map(region => {
        const totalPop = economyData.demographics.regions.reduce((sum, r) => sum + r.population, 0) || 10000000;
        const expectedShare = 100 / (economyData.demographics.regions?.length || 1);
        const actualShare = (region.population / totalPop) * 100;
        const deviation = actualShare - expectedShare;
        return {
          region: region.name,
          deviation: Math.max(-20, Math.min(20, deviation))
        };
      })
    };
  }

  private analyzeSocialTrends(economyData: EconomyData) {
    return {
      improving: ['Education access', 'Healthcare coverage'],
      stable: ['Employment levels', 'Social mobility'],
      concerning: ['Income inequality', 'Regional disparities']
    };
  }

  private calculateExportDiversity(countryStats: CountryStats, economyData: EconomyData): number {
    // Placeholder - would need trade data
    return Math.min(100, 40 + (countryStats.currentGdpPerCapita / 2000));
  }

  private calculateValueChainIntegration(economyData: EconomyData): number {
    // Placeholder
    return 60;
  }

  private calculateFinancialSophistication(economyData: EconomyData): number {
    // Placeholder
    return Math.min(100, 30 + (economyData.core.gdpPerCapita / 1500));
  }

  private calculateRegulatoryQuality(economyData: EconomyData): number {
    // Placeholder - based on economic tier
    return 70;
  }

  private analyzeTradeMetrics(countryStats: CountryStats, economyData: EconomyData) {
    return {
      exportComplexityIndex: 0.5,
      importDependencyRatio: 0.3,
      tradeBalanceTrend: 'stable' as const,
      majorTradingPartners: [
        { country: 'Major Economy A', shareOfTrade: 25, relationship: 'strategic' as const },
        { country: 'Major Economy B', shareOfTrade: 18, relationship: 'transactional' as const }
      ]
    };
  }

  private identifyFutureOpportunities(countryStats: CountryStats, economyData: EconomyData): string[] {
    const opportunities = [];
    
    if (countryStats.populationTier === PopulationTier.TIER_2 || countryStats.populationTier === PopulationTier.TIER_3) {
      opportunities.push('Demographic dividend from young population');
    }
    
    if (economyData.core.gdpPerCapita < 30000) {
      opportunities.push('Catch-up growth potential');
    }
    
    opportunities.push('Digital economy development', 'Green energy transition');
    
    return opportunities;
  }
}

// ===== INTEGRATED ANALYSIS SYSTEM =====

export interface ComprehensiveEconomicAnalysis {
  resilience: EconomicResilienceMetrics;
  productivity: ProductivityInnovationMetrics;
  wellbeing: SocialEconomicWellbeingMetrics;
  complexity: EconomicComplexityMetrics;
  overallRating: {
    score: number;
    grade: 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D' | 'F';
    description: string;
  };
  keyInsights: string[];
  priorityRecommendations: Array<{
    area: string;
    action: string;
    impact: 'high' | 'medium' | 'low';
    timeframe: 'immediate' | 'short_term' | 'medium_term' | 'long_term';
  }>;
}

export class IntegratedEconomicAnalysis {
  private calculator: EnhancedEconomicCalculator;

  constructor(config: EconomicConfig) {
    this.calculator = new EnhancedEconomicCalculator(config);
  }

  analyzeCountry(
    countryStats: CountryStats,
    economyData: EconomyData,
    historicalData: HistoricalDataPoint[] = []
  ): ComprehensiveEconomicAnalysis {
    // Calculate all four major indices
    const resilience = this.calculator.calculateEconomicResilience(countryStats, economyData, historicalData);
    const productivity = this.calculator.calculateProductivityInnovation(countryStats, economyData, historicalData);
    const wellbeing = this.calculator.calculateSocialEconomicWellbeing(countryStats, economyData);
    const complexity = this.calculator.calculateEconomicComplexity(countryStats, economyData);

    // Calculate overall rating
    const overallScore = (resilience.overallScore + productivity.overallScore + 
                         wellbeing.overallScore + complexity.overallScore) / 4;
    
    const overallRating = this.calculateOverallRating(overallScore);
    
    // Generate insights and recommendations
    const keyInsights = this.generateKeyInsights(resilience, productivity, wellbeing, complexity);
    const priorityRecommendations = this.generateRecommendations(resilience, productivity, wellbeing, complexity);

    return {
      resilience,
      productivity,
      wellbeing,
      complexity,
      overallRating,
      keyInsights,
      priorityRecommendations
    };
  }

  private calculateOverallRating(score: number) {
    let grade: ComprehensiveEconomicAnalysis['overallRating']['grade'];
    let description: string;

    if (score >= 95) {
      grade = 'A+';
      description = 'Exceptional economic performance across all dimensions';
    } else if (score >= 90) {
      grade = 'A';
      description = 'Outstanding economic health with minor areas for improvement';
    } else if (score >= 85) {
      grade = 'A-';
      description = 'Strong economic fundamentals with good growth prospects';
    } else if (score >= 80) {
      grade = 'B+';
      description = 'Above-average economic performance with solid foundations';
    } else if (score >= 75) {
      grade = 'B';
      description = 'Good economic health with balanced strengths and challenges';
    } else if (score >= 70) {
      grade = 'B-';
      description = 'Adequate economic performance with room for improvement';
    } else if (score >= 65) {
      grade = 'C+';
      description = 'Mixed economic indicators with notable challenges';
    } else if (score >= 60) {
      grade = 'C';
      description = 'Moderate economic health requiring strategic improvements';
    } else if (score >= 55) {
      grade = 'C-';
      description = 'Below-average performance with significant challenges';
    } else if (score >= 50) {
      grade = 'D';
      description = 'Weak economic fundamentals requiring urgent attention';
    } else {
      grade = 'F';
      description = 'Critical economic challenges requiring comprehensive reform';
    }

    return {
      score: Math.round(score),
      grade,
      description
    };
  }

  private generateKeyInsights(
    resilience: EconomicResilienceMetrics,
    productivity: ProductivityInnovationMetrics,
    wellbeing: SocialEconomicWellbeingMetrics,
    complexity: EconomicComplexityMetrics
  ): string[] {
    const insights = [];

    // Resilience insights
    if (resilience.overallScore >= 80) {
      insights.push(`Strong economic resilience (${resilience.overallScore}/100) indicates good shock absorption capacity`);
    } else if (resilience.overallScore <= 50) {
      insights.push(`Low economic resilience (${resilience.overallScore}/100) suggests vulnerability to economic shocks`);
    }

    // Productivity insights
    const topProductivityComponent = Object.entries(productivity.components)
      .sort(([,a], [,b]) => b - a)[0];
    insights.push(`${topProductivityComponent[0].replace(/([A-Z])/g, ' $1').toLowerCase()} is the strongest productivity factor (${topProductivityComponent[1]}/100)`);

    // Wellbeing insights
    if (wellbeing.inequalityFactors.giniCoefficient > 0.5) {
      insights.push(`High income inequality (Gini: ${wellbeing.inequalityFactors.giniCoefficient.toFixed(2)}) may limit inclusive growth`);
    }

    // Complexity insights
    if (complexity.overallScore >= 75) {
      insights.push(`High economic complexity (${complexity.overallScore}/100) supports sustainable development`);
    }

    return insights;
  }

  private generateRecommendations(
    resilience: EconomicResilienceMetrics,
    productivity: ProductivityInnovationMetrics,
    wellbeing: SocialEconomicWellbeingMetrics,
    complexity: EconomicComplexityMetrics
  ) {
    const recommendations = [];

    // Resilience-based recommendations
    if (resilience.components.fiscalStability < 60) {
      recommendations.push({
        area: 'Fiscal Policy',
        action: 'Implement debt reduction strategy and improve budget balance',
        impact: 'high' as const,
        timeframe: 'medium_term' as const
      });
    }

    // Productivity-based recommendations
    if (productivity.components.laborProductivity < 60) {
      recommendations.push({
        area: 'Human Capital',
        action: 'Invest in education and skills training programs',
        impact: 'high' as const,
        timeframe: 'long_term' as const
      });
    }

    // Wellbeing-based recommendations
    if (wellbeing.components.socialMobility < 50) {
      recommendations.push({
        area: 'Social Policy',
        action: 'Develop programs to improve income mobility and reduce inequality',
        impact: 'medium' as const,
        timeframe: 'long_term' as const
      });
    }

    // Complexity-based recommendations
    if (complexity.components.exportDiversity < 50) {
      recommendations.push({
        area: 'Trade Policy',
        action: 'Diversify export portfolio and develop new industries',
        impact: 'high' as const,
        timeframe: 'medium_term' as const
      });
    }

    return recommendations.slice(0, 5); // Top 5 priorities
  }

  /**
   * Calculate regional economic deviation from national average
   */
  private calculateRegionalDeviation(region: any, economyData: EconomyData): number {
    // Placeholder calculation since the exact data structure varies
    // Use region population as a proxy for economic weight
    const regionPopulation = region.population || 1000000;
    const totalPopulation = economyData.demographics.regions.reduce((sum, r) => sum + r.population, 0) || 10000000;

    // Simple deviation based on population distribution
    const expectedShare = 100 / (economyData.demographics.regions?.length || 1);
    const actualShare = (regionPopulation / totalPopulation) * 100;
    const deviation = actualShare - expectedShare;

    // Cap deviation to reasonable range (-20% to +20%)
    return Math.max(-20, Math.min(20, deviation));
  }
}

export default IntegratedEconomicAnalysis;