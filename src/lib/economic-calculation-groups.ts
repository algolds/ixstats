// src/lib/economic-calculation-groups.ts
// Grouped Economic Calculation Methodologies
// Organizing related calculations into logical groups for intuitive analysis

import type { 
  CountryStats, 
  EconomicConfig,
  HistoricalDataPoint 
} from '../types/ixstats';
import type { EconomyData } from '../types/economics';

// ===== CALCULATION GROUP INTERFACES =====

/**
 * Base interface for all calculation groups
 */
export interface CalculationGroup {
  name: string;
  description: string;
  weight: number; // Importance in overall analysis (0-1)
  components: string[];
}

/**
 * Growth Dynamics Group
 * Focuses on growth patterns, sustainability, and momentum
 */
export interface GrowthDynamicsMetrics {
  group: 'growth_dynamics';
  overallScore: number;
  components: {
    growthMomentum: number;      // Current vs historical growth trends
    growthSustainability: number; // Long-term growth viability
    growthQuality: number;       // Inclusive vs exclusive growth
    growthStability: number;     // Consistency and predictability
  };
  insights: {
    growthPhase: 'acceleration' | 'expansion' | 'maturation' | 'deceleration';
    trendDirection: 'improving' | 'stable' | 'deteriorating';
    volatilityLevel: 'low' | 'moderate' | 'high';
    sustainabilityRisk: 'low' | 'medium' | 'high';
  };
  projections: {
    nextQuarter: number;
    nextYear: number;
    fiveYear: number;
  };
}

/**
 * Financial Health Group
 * Comprehensive financial stability and fiscal management analysis
 */
export interface FinancialHealthMetrics {
  group: 'financial_health';
  overallScore: number;
  components: {
    fiscalPosition: number;      // Government finances and debt
    monetaryStability: number;   // Inflation, currency, monetary policy
    financialSector: number;     // Banking, capital markets health
    externalBalance: number;     // Trade, current account, reserves
  };
  ratingEquivalent: 'AAA' | 'AA' | 'A' | 'BBB' | 'BB' | 'B' | 'C' | 'D';
  keyRatios: {
    debtServiceRatio: number;
    fiscalBalanceRatio: number;
    currentAccountRatio: number;
    reservesCoverageRatio: number;
  };
  creditworthinessFactors: Array<{
    factor: string;
    impact: 'positive' | 'neutral' | 'negative';
    weight: number;
  }>;
}

/**
 * Human Development Group
 * Population wellbeing, skills, and human capital analysis
 */
export interface HumanDevelopmentMetrics {
  group: 'human_development';
  overallScore: number;
  components: {
    healthOutcomes: number;      // Life expectancy, healthcare access
    educationAchievement: number; // Literacy, skills, educational attainment
    livingStandards: number;     // Income, housing, basic needs
    socialCohesion: number;      // Inequality, mobility, participation
  };
  developmentStage: 'low' | 'medium' | 'high' | 'very_high';
  demographicDividend: {
    stage: 'early' | 'peak' | 'late' | 'post';
    yearsRemaining: number;
    potentialBenefit: 'high' | 'medium' | 'low';
  };
  humanCapitalIndex: number;
}

/**
 * Economic Structure Group
 * Analysis of economic composition, sophistication, and adaptability
 */
export interface EconomicStructureMetrics {
  group: 'economic_structure';
  overallScore: number;
  components: {
    sectoralBalance: number;     // Agriculture, industry, services mix
    economicComplexity: number;  // Product sophistication, capabilities
    marketDynamism: number;      // Competition, entrepreneurship, innovation
    infrastructureQuality: number; // Physical and digital infrastructure
  };
  structuralProfile: {
    primarySectorShare: number;
    secondarySectorShare: number;
    tertiarySectorShare: number;
    quaternarySectorShare: number;
  };
  competitivenessRanking: {
    globalRank: number;
    regionalRank: number;
    trendDirection: 'improving' | 'stable' | 'declining';
  };
  transformationPotential: 'high' | 'medium' | 'low';
}

/**
 * External Relations Group
 * Trade, investment, and international economic integration
 */
export interface ExternalRelationsMetrics {
  group: 'external_relations';
  overallScore: number;
  components: {
    tradeIntegration: number;    // Export/import patterns, diversification
    investmentAttraction: number; // FDI inflows, business environment
    globalConnectivity: number;  // Supply chain integration, logistics
    diplomaticEconomics: number; // Economic partnerships, agreements
  };
  tradeProfile: {
    exportConcentration: number;
    importDependence: number;
    tradingPartnerDiversification: number;
    valueChainPosition: 'upstream' | 'midstream' | 'downstream' | 'integrated';
  };
  integrationLevel: 'low' | 'medium' | 'high';
  vulnerabilityFactors: string[];
}

// ===== CALCULATION GROUP ENGINE =====

export class EconomicCalculationGroups {
  private config: EconomicConfig;
  private groupWeights = {
    growth_dynamics: 0.25,
    financial_health: 0.25,
    human_development: 0.25,
    economic_structure: 0.15,
    external_relations: 0.10
  };

  constructor(config: EconomicConfig) {
    this.config = config;
  }

  /**
   * Calculate Growth Dynamics Group
   */
  calculateGrowthDynamics(
    countryStats: CountryStats,
    economyData: EconomyData,
    historicalData: HistoricalDataPoint[] = []
  ): GrowthDynamicsMetrics {
    const growthMomentum = this.calculateGrowthMomentum(countryStats, historicalData);
    const growthSustainability = this.calculateGrowthSustainability(countryStats, economyData);
    const growthQuality = this.calculateGrowthQuality(countryStats, economyData);
    const growthStability = this.calculateGrowthStability(historicalData);

    const overallScore = (growthMomentum + growthSustainability + growthQuality + growthStability) / 4;

    const insights = this.analyzeGrowthInsights(countryStats, economyData, historicalData);
    const projections = this.projectGrowthTrends(countryStats, historicalData);

    return {
      group: 'growth_dynamics',
      overallScore: Math.round(overallScore),
      components: {
        growthMomentum: Math.round(growthMomentum),
        growthSustainability: Math.round(growthSustainability),
        growthQuality: Math.round(growthQuality),
        growthStability: Math.round(growthStability)
      },
      insights,
      projections
    };
  }

  /**
   * Calculate Financial Health Group
   */
  calculateFinancialHealth(
    countryStats: CountryStats,
    economyData: EconomyData,
    historicalData: HistoricalDataPoint[] = []
  ): FinancialHealthMetrics {
    const fiscalPosition = this.calculateFiscalPosition(economyData);
    const monetaryStability = this.calculateMonetaryStability(economyData, historicalData);
    const financialSector = this.calculateFinancialSector(economyData);
    const externalBalance = this.calculateExternalBalance(economyData);

    const overallScore = (fiscalPosition + monetaryStability + financialSector + externalBalance) / 4;

    const ratingEquivalent = this.determineRatingEquivalent(overallScore);
    const keyRatios = this.calculateKeyFinancialRatios(economyData);
    const creditworthinessFactors = this.assessCreditworthiness(countryStats, economyData);

    return {
      group: 'financial_health',
      overallScore: Math.round(overallScore),
      components: {
        fiscalPosition: Math.round(fiscalPosition),
        monetaryStability: Math.round(monetaryStability),
        financialSector: Math.round(financialSector),
        externalBalance: Math.round(externalBalance)
      },
      ratingEquivalent,
      keyRatios,
      creditworthinessFactors
    };
  }

  /**
   * Calculate Human Development Group
   */
  calculateHumanDevelopment(
    countryStats: CountryStats,
    economyData: EconomyData
  ): HumanDevelopmentMetrics {
    const healthOutcomes = this.calculateHealthOutcomes(economyData);
    const educationAchievement = this.calculateEducationAchievement(economyData);
    const livingStandards = this.calculateLivingStandards(countryStats, economyData);
    const socialCohesion = this.calculateSocialCohesion(economyData);

    const overallScore = (healthOutcomes + educationAchievement + livingStandards + socialCohesion) / 4;

    const developmentStage = this.determineDevelopmentStage(overallScore);
    const demographicDividend = this.analyzeDemographicDividend(countryStats, economyData);
    const humanCapitalIndex = this.calculateHumanCapitalIndex(economyData);

    return {
      group: 'human_development',
      overallScore: Math.round(overallScore),
      components: {
        healthOutcomes: Math.round(healthOutcomes),
        educationAchievement: Math.round(educationAchievement),
        livingStandards: Math.round(livingStandards),
        socialCohesion: Math.round(socialCohesion)
      },
      developmentStage,
      demographicDividend,
      humanCapitalIndex: Math.round(humanCapitalIndex)
    };
  }

  /**
   * Calculate Economic Structure Group
   */
  calculateEconomicStructure(
    countryStats: CountryStats,
    economyData: EconomyData
  ): EconomicStructureMetrics {
    const sectoralBalance = this.calculateSectoralBalance(economyData);
    const economicComplexity = this.calculateEconomicComplexity(countryStats);
    const marketDynamism = this.calculateMarketDynamism(economyData);
    const infrastructureQuality = this.calculateInfrastructureQuality(economyData);

    const overallScore = (sectoralBalance + economicComplexity + marketDynamism + infrastructureQuality) / 4;

    const structuralProfile = this.analyzeStructuralProfile(economyData);
    const competitivenessRanking = this.estimateCompetitivenessRanking(countryStats, economyData);
    const transformationPotential = this.assessTransformationPotential(countryStats, economyData);

    return {
      group: 'economic_structure',
      overallScore: Math.round(overallScore),
      components: {
        sectoralBalance: Math.round(sectoralBalance),
        economicComplexity: Math.round(economicComplexity),
        marketDynamism: Math.round(marketDynamism),
        infrastructureQuality: Math.round(infrastructureQuality)
      },
      structuralProfile,
      competitivenessRanking,
      transformationPotential
    };
  }

  /**
   * Calculate External Relations Group
   */
  calculateExternalRelations(
    countryStats: CountryStats,
    economyData: EconomyData
  ): ExternalRelationsMetrics {
    const tradeIntegration = this.calculateTradeIntegration(countryStats, economyData);
    const investmentAttraction = this.calculateInvestmentAttraction(economyData);
    const globalConnectivity = this.calculateGlobalConnectivity(countryStats);
    const diplomaticEconomics = this.calculateDiplomaticEconomics(countryStats);

    const overallScore = (tradeIntegration + investmentAttraction + globalConnectivity + diplomaticEconomics) / 4;

    const tradeProfile = this.analyzeTradeProfile(countryStats, economyData);
    const integrationLevel = this.assessIntegrationLevel(overallScore);
    const vulnerabilityFactors = this.identifyVulnerabilityFactors(countryStats, economyData);

    return {
      group: 'external_relations',
      overallScore: Math.round(overallScore),
      components: {
        tradeIntegration: Math.round(tradeIntegration),
        investmentAttraction: Math.round(investmentAttraction),
        globalConnectivity: Math.round(globalConnectivity),
        diplomaticEconomics: Math.round(diplomaticEconomics)
      },
      tradeProfile,
      integrationLevel,
      vulnerabilityFactors
    };
  }

  // ===== COMPONENT CALCULATION METHODS =====

  private calculateGrowthMomentum(countryStats: CountryStats, historicalData: HistoricalDataPoint[]): number {
    let score = 50;

    // Current growth rate relative to historical average
    const currentGrowth = countryStats.adjustedGdpGrowth;
    if (historicalData.length >= 5) {
      const avgHistoricalGrowth = historicalData.slice(-5)
        .reduce((sum, point) => sum + point.gdpGrowthRate, 0) / 5;
      
      if (currentGrowth > avgHistoricalGrowth * 1.1) score += 25; // Above trend
      else if (currentGrowth > avgHistoricalGrowth * 0.9) score += 10; // Near trend
      else score -= 15; // Below trend
    } else {
      // Use economic tier as proxy
      if (currentGrowth > 0.05) score += 20;
      else if (currentGrowth > 0.03) score += 15;
      else if (currentGrowth > 0.01) score += 5;
      else score -= 10;
    }

    // Population growth contribution
    const populationGrowth = countryStats.populationGrowthRate;
    if (populationGrowth > 0 && populationGrowth < 0.03) score += 10; // Optimal range
    else if (populationGrowth > 0.05) score -= 5; // Too high

    return Math.max(0, Math.min(100, score));
  }

  private calculateGrowthSustainability(countryStats: CountryStats, economyData: EconomyData): number {
    let score = 50;

    // Economic tier sustainability
    switch (countryStats.economicTier) {
      case 'Impoverished':
        score += (countryStats.adjustedGdpGrowth > 0.08 ? 20 : 10); // High growth potential
        break;
      case 'Developing':
        score += (countryStats.adjustedGdpGrowth > 0.06 ? 15 : 5);
        break;
      case 'Developed':
        score += (countryStats.adjustedGdpGrowth > 0.03 ? 10 : 5);
        break;
      case 'Healthy':
      case 'Strong':
        score += (countryStats.adjustedGdpGrowth > 0.02 ? 10 : 0);
        break;
      default:
        score += (countryStats.adjustedGdpGrowth > 0.01 ? 5 : -5); // Mature economies
    }

    // Investment in future growth
    const educationSpending = economyData.spending.spendingCategories
      .find(cat => cat.category.toLowerCase().includes('education'))?.percent || 0;
    const infrastructureSpending = economyData.spending.spendingCategories
      .find(cat => cat.category.toLowerCase().includes('infrastructure'))?.percent || 0;

    score += (educationSpending + infrastructureSpending) * 0.8; // Productive investment bonus

    // Debt sustainability impact
    if (economyData.fiscal.totalDebtGDPRatio > 100) score -= 15;
    else if (economyData.fiscal.totalDebtGDPRatio > 60) score -= 5;

    return Math.max(0, Math.min(100, score));
  }

  private calculateGrowthQuality(countryStats: CountryStats, economyData: EconomyData): number {
    let score = 50;

    // Employment-intensive growth
    const unemployment = economyData.labor.unemploymentRate;
    if (unemployment <= 5) score += 20;
    else if (unemployment <= 8) score += 10;
    else if (unemployment >= 15) score -= 20;

    // Inclusive growth (inequality consideration)
    const gini = economyData.income.incomeInequalityGini;
    if (gini <= 0.3) score += 20; // Very equal
    else if (gini <= 0.4) score += 10; // Moderately equal
    else if (gini >= 0.6) score -= 20; // Very unequal

    // Environmental sustainability (proxy via spending)
    // Placeholder - would need environmental data in practice
    score += 5;

    return Math.max(0, Math.min(100, score));
  }

  private calculateGrowthStability(historicalData: HistoricalDataPoint[]): number {
    if (historicalData.length < 3) return 60; // Default for insufficient data

    const growthRates = historicalData.slice(-10).map(point => point.gdpGrowthRate);
    const volatility = this.calculateStandardDeviation(growthRates);

    let score = 50;
    if (volatility <= 0.01) score += 30; // Very stable
    else if (volatility <= 0.02) score += 20; // Stable
    else if (volatility <= 0.03) score += 10; // Moderately stable
    else if (volatility >= 0.06) score -= 20; // Highly volatile

    // Consistency bonus (no negative growth in recent periods)
    const negativeGrowthPeriods = growthRates.filter(rate => rate < 0).length;
    if (negativeGrowthPeriods === 0) score += 15;
    else if (negativeGrowthPeriods <= 1) score += 5;
    else score -= 10;

    return Math.max(0, Math.min(100, score));
  }

  // Financial Health Methods
  private calculateFiscalPosition(economyData: EconomyData): number {
    let score = 50;

    // Debt sustainability
    const debtRatio = economyData.fiscal.totalDebtGDPRatio;
    if (debtRatio <= 60) score += 25;
    else if (debtRatio <= 90) score += 10;
    else if (debtRatio >= 120) score -= 25;

    // Budget balance
    const budgetBalance = economyData.fiscal.budgetDeficitSurplus / economyData.core.nominalGDP;
    if (budgetBalance > 0) score += 15; // Surplus
    else if (budgetBalance > -0.03) score += 5; // Small deficit
    else if (budgetBalance < -0.06) score -= 15; // Large deficit

    // Tax efficiency
    const taxRevenue = economyData.fiscal.taxRevenueGDPPercent;
    if (taxRevenue >= 15 && taxRevenue <= 30) score += 10; // Optimal range

    return Math.max(0, Math.min(100, score));
  }

  private calculateMonetaryStability(economyData: EconomyData, historicalData: HistoricalDataPoint[]): number {
    let score = 50;

    // Price stability
    const inflation = economyData.core.inflationRate;
    if (inflation >= 0.01 && inflation <= 0.03) score += 25; // Target range
    else if (inflation >= 0 && inflation <= 0.05) score += 15; // Acceptable
    else if (inflation > 0.08) score -= 25; // High inflation
    else if (inflation < -0.02) score -= 15; // Deflation

    // Exchange rate stability (placeholder)
    score += 10; // Would need FX data

    // Interest rate environment (placeholder)
    if (economyData.fiscal.interestRates >= 0.02 && economyData.fiscal.interestRates <= 0.05) {
      score += 10; // Reasonable real rates
    }

    return Math.max(0, Math.min(100, score));
  }

  private calculateFinancialSector(economyData: EconomyData): number {
    // Simplified assessment based on available data
    let score = 50;

    // Financial depth (proxy via GDP per capita)
    if (economyData.core.gdpPerCapita > 40000) score += 20;
    else if (economyData.core.gdpPerCapita > 20000) score += 15;
    else if (economyData.core.gdpPerCapita > 10000) score += 10;

    // Financial stability (low debt service costs indicate healthy sector)
    const debtServiceRatio = economyData.fiscal.debtServiceCosts / economyData.core.nominalGDP;
    if (debtServiceRatio < 0.05) score += 15;
    else if (debtServiceRatio > 0.15) score -= 15;

    return Math.max(0, Math.min(100, score));
  }

  private calculateExternalBalance(economyData: EconomyData): number {
    // Placeholder implementation - would need trade data
    let score = 60;

    // Current account proxy (simplified)
    // Assume balanced for developed economies
    if (economyData.core.gdpPerCapita > 30000) score += 15;
    else if (economyData.core.gdpPerCapita < 10000) score -= 10;

    return Math.max(0, Math.min(100, score));
  }

  // Helper Methods
  private calculateStandardDeviation(values: number[]): number {
    if (values.length < 2) return 0;
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  private analyzeGrowthInsights(
    countryStats: CountryStats,
    economyData: EconomyData,
    historicalData: HistoricalDataPoint[]
  ) {
    // Simplified insights generation
    const currentGrowth = countryStats.adjustedGdpGrowth;
    let growthPhase: GrowthDynamicsMetrics['insights']['growthPhase'];

    if (currentGrowth > 0.06) growthPhase = 'acceleration';
    else if (currentGrowth > 0.03) growthPhase = 'expansion';
    else if (currentGrowth > 0.01) growthPhase = 'maturation';
    else growthPhase = 'deceleration';

    return {
      growthPhase,
      trendDirection: 'stable' as const, // Simplified
      volatilityLevel: 'moderate' as const, // Would calculate from historical data
      sustainabilityRisk: economyData.fiscal.totalDebtGDPRatio > 100 ? 'high' as const : 'medium' as const
    };
  }

  private projectGrowthTrends(countryStats: CountryStats, historicalData: HistoricalDataPoint[]) {
    // Simplified projection
    const baseGrowth = countryStats.adjustedGdpGrowth;
    
    return {
      nextQuarter: baseGrowth * 0.25,
      nextYear: baseGrowth,
      fiveYear: baseGrowth * 0.8 // Assume some deceleration
    };
  }

  // Additional placeholder methods for completeness
  private determineRatingEquivalent(score: number): FinancialHealthMetrics['ratingEquivalent'] {
    if (score >= 90) return 'AAA';
    if (score >= 80) return 'AA';
    if (score >= 70) return 'A';
    if (score >= 60) return 'BBB';
    if (score >= 50) return 'BB';
    if (score >= 40) return 'B';
    if (score >= 30) return 'C';
    return 'D';
  }

  private calculateKeyFinancialRatios(economyData: EconomyData) {
    return {
      debtServiceRatio: economyData.fiscal.debtServiceCosts / economyData.core.nominalGDP,
      fiscalBalanceRatio: economyData.fiscal.budgetDeficitSurplus / economyData.core.nominalGDP,
      currentAccountRatio: 0.02, // Placeholder
      reservesCoverageRatio: 3.5 // Placeholder (months of imports)
    };
  }

  private assessCreditworthiness(countryStats: CountryStats, economyData: EconomyData) {
    const factors = [];

    if (economyData.fiscal.totalDebtGDPRatio < 60) {
      factors.push({ factor: 'Low debt burden', impact: 'positive' as const, weight: 0.3 });
    }

    if (economyData.core.inflationRate < 0.05) {
      factors.push({ factor: 'Price stability', impact: 'positive' as const, weight: 0.2 });
    }

    if (countryStats.economicTier === 'Strong' || countryStats.economicTier === 'Very Strong') {
      factors.push({ factor: 'High income status', impact: 'positive' as const, weight: 0.25 });
    }

    return factors;
  }

  // Placeholder implementations for other methods
  private calculateHealthOutcomes(economyData: EconomyData): number {
    return Math.min(100, 40 + economyData.demographics.lifeExpectancy);
  }

  private calculateEducationAchievement(economyData: EconomyData): number {
    return economyData.demographics.literacyRate;
  }

  private calculateLivingStandards(countryStats: CountryStats, economyData: EconomyData): number {
    return Math.min(100, (countryStats.currentGdpPerCapita / 1000) + 20);
  }

  private calculateSocialCohesion(economyData: EconomyData): number {
    return Math.max(0, 100 - (economyData.income.incomeInequalityGini * 100));
  }

  private determineDevelopmentStage(score: number): HumanDevelopmentMetrics['developmentStage'] {
    if (score >= 80) return 'very_high';
    if (score >= 70) return 'high';
    if (score >= 55) return 'medium';
    return 'low';
  }

  private analyzeDemographicDividend(countryStats: CountryStats, economyData: EconomyData) {
    // Simplified analysis based on population growth
    const popGrowth = countryStats.populationGrowthRate;
    
    return {
      stage: popGrowth > 0.02 ? 'early' as const : popGrowth > 0.01 ? 'peak' as const : 'late' as const,
      yearsRemaining: popGrowth > 0.01 ? 20 : 10,
      potentialBenefit: popGrowth > 0.02 ? 'high' as const : 'medium' as const
    };
  }

  private calculateHumanCapitalIndex(economyData: EconomyData): number {
    return (economyData.demographics.literacyRate * 0.6) + 
           (economyData.demographics.lifeExpectancy * 0.4);
  }

  // Economic Structure methods (simplified implementations)
  private calculateSectoralBalance(economyData: EconomyData): number {
    // Placeholder - would need sectoral GDP data
    return 65;
  }

  private calculateEconomicComplexity(countryStats: CountryStats): number {
    // Based on GDP per capita as complexity proxy
    return Math.min(100, (countryStats.currentGdpPerCapita / 1000) + 20);
  }

  private calculateMarketDynamism(economyData: EconomyData): number {
    // Based on employment rate and business environment proxies
    return Math.min(100, economyData.labor.employmentRate + 10);
  }

  private calculateInfrastructureQuality(economyData: EconomyData): number {
    // Based on infrastructure spending
    const infraSpending = economyData.spending.spendingCategories
      .find(cat => cat.category.toLowerCase().includes('infrastructure'))?.percent || 0;
    return Math.min(100, 40 + (infraSpending * 3));
  }

  private analyzeStructuralProfile(economyData: EconomyData) {
    // Simplified sectoral breakdown
    return {
      primarySectorShare: 10,
      secondarySectorShare: 25,
      tertiarySectorShare: 60,
      quaternarySectorShare: 5
    };
  }

  private estimateCompetitivenessRanking(countryStats: CountryStats, economyData: EconomyData) {
    // Simplified ranking estimation
    const baseRank = countryStats.economicTier === 'Very Strong' ? 20 : 
                    countryStats.economicTier === 'Strong' ? 40 : 80;
    
    return {
      globalRank: baseRank,
      regionalRank: Math.floor(baseRank / 3),
      trendDirection: 'stable' as const
    };
  }

  private assessTransformationPotential(countryStats: CountryStats, economyData: EconomyData): ExternalRelationsMetrics['integrationLevel'] {
    if (countryStats.adjustedGdpGrowth > 0.05) return 'high';
    if (countryStats.adjustedGdpGrowth > 0.02) return 'medium';
    return 'low';
  }

  // External Relations methods (simplified)
  private calculateTradeIntegration(countryStats: CountryStats, economyData: EconomyData): number {
    return Math.min(100, 40 + (countryStats.currentGdpPerCapita / 2000));
  }

  private calculateInvestmentAttraction(economyData: EconomyData): number {
    return Math.min(100, 30 + (economyData.core.gdpPerCapita / 1500));
  }

  private calculateGlobalConnectivity(countryStats: CountryStats): number {
    return countryStats.populationTier === 'X' ? 90 : 
           countryStats.populationTier === '7' ? 80 : 60;
  }

  private calculateDiplomaticEconomics(countryStats: CountryStats): number {
    return countryStats.economicTier === 'Very Strong' ? 85 :
           countryStats.economicTier === 'Strong' ? 75 : 60;
  }

  private analyzeTradeProfile(countryStats: CountryStats, economyData: EconomyData) {
    return {
      exportConcentration: 0.4,
      importDependence: 0.3,
      tradingPartnerDiversification: 0.7,
      valueChainPosition: 'integrated' as const
    };
  }

  private assessIntegrationLevel(score: number): ExternalRelationsMetrics['integrationLevel'] {
    if (score >= 75) return 'high';
    if (score >= 55) return 'medium';
    return 'low';
  }

  private identifyVulnerabilityFactors(countryStats: CountryStats, economyData: EconomyData): string[] {
    const factors = [];
    
    if (economyData.fiscal.totalDebtGDPRatio > 80) {
      factors.push('High external debt exposure');
    }
    
    if (countryStats.populationTier === '1' || countryStats.populationTier === '2') {
      factors.push('Small market size limits resilience');
    }
    
    return factors;
  }
}

// ===== UTILITY INTERFACES =====

export interface GroupedAnalysisResult {
  growthDynamics: GrowthDynamicsMetrics;
  financialHealth: FinancialHealthMetrics;
  humanDevelopment: HumanDevelopmentMetrics;
  economicStructure: EconomicStructureMetrics;
  externalRelations: ExternalRelationsMetrics;
  overallScore: number;
  strengths: string[];
  challenges: string[];
  priorityActions: Array<{
    group: string;
    action: string;
    urgency: 'high' | 'medium' | 'low';
  }>;
}

/**
 * Master function to run all calculation groups
 */
export function runGroupedAnalysis(
  countryStats: CountryStats,
  economyData: EconomyData,
  historicalData: HistoricalDataPoint[] = [],
  config: EconomicConfig
): GroupedAnalysisResult {
  const calculator = new EconomicCalculationGroups(config);

  const growthDynamics = calculator.calculateGrowthDynamics(countryStats, economyData, historicalData);
  const financialHealth = calculator.calculateFinancialHealth(countryStats, economyData, historicalData);
  const humanDevelopment = calculator.calculateHumanDevelopment(countryStats, economyData);
  const economicStructure = calculator.calculateEconomicStructure(countryStats, economyData);
  const externalRelations = calculator.calculateExternalRelations(countryStats, economyData);

  // Calculate weighted overall score
  const overallScore = (
    growthDynamics.overallScore * calculator.groupWeights.growth_dynamics +
    financialHealth.overallScore * calculator.groupWeights.financial_health +
    humanDevelopment.overallScore * calculator.groupWeights.human_development +
    economicStructure.overallScore * calculator.groupWeights.economic_structure +
    externalRelations.overallScore * calculator.groupWeights.external_relations
  );

  // Identify strengths and challenges
  const scores = [
    { name: 'Growth Dynamics', score: growthDynamics.overallScore },
    { name: 'Financial Health', score: financialHealth.overallScore },
    { name: 'Human Development', score: humanDevelopment.overallScore },
    { name: 'Economic Structure', score: economicStructure.overallScore },
    { name: 'External Relations', score: externalRelations.overallScore }
  ];

  const strengths = scores.filter(s => s.score >= 75).map(s => s.name);
  const challenges = scores.filter(s => s.score <= 50).map(s => s.name);

  // Priority actions
  const priorityActions = [];
  if (financialHealth.overallScore < 60) {
    priorityActions.push({
      group: 'Financial Health',
      action: 'Address fiscal imbalances and strengthen monetary stability',
      urgency: 'high' as const
    });
  }
  if (growthDynamics.overallScore < 60) {
    priorityActions.push({
      group: 'Growth Dynamics',
      action: 'Implement growth-enhancing structural reforms',
      urgency: 'high' as const
    });
  }

  return {
    growthDynamics,
    financialHealth,
    humanDevelopment,
    economicStructure,
    externalRelations,
    overallScore: Math.round(overallScore),
    strengths,
    challenges,
    priorityActions
  };
}