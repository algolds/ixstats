// src/lib/intuitive-economic-analysis.ts
// Intuitive Economic Analysis System
// User-friendly interface for comprehensive economic analysis with actionable insights

import {
  EnhancedEconomicCalculator,
  type ComprehensiveEconomicAnalysis,
} from "./enhanced-economic-calculations";
import {
  EconomicCalculationGroups,
  type GroupedAnalysisResult,
} from "./economic-calculation-groups";
import { IxTime } from "./ixtime";
import type { CountryStats, EconomicConfig, HistoricalDataPoint } from "../types/ixstats";
import type { EconomyData } from "../types/economics";

// ===== INTUITIVE ANALYSIS INTERFACES =====

/**
 * Simplified Economic Health Summary
 * Easy-to-understand overview for users
 */
export interface EconomicHealthSummary {
  overallGrade: "A+" | "A" | "A-" | "B+" | "B" | "B-" | "C+" | "C" | "C-" | "D" | "F";
  score: number;
  status: "Excellent" | "Strong" | "Good" | "Fair" | "Weak" | "Critical";
  trend: "Improving" | "Stable" | "Declining";
  keyMessage: string;

  // Visual indicators
  healthIndicators: {
    growth: "strong" | "moderate" | "weak";
    stability: "high" | "medium" | "low";
    sustainability: "excellent" | "good" | "concerning";
  };

  // Quick metrics
  quickStats: {
    economicSize: string; // "Large economy" / "Medium economy"
    developmentLevel: string; // "Developed" / "Emerging"
    globalPosition: string; // "Top 20%" / "Above average"
    riskLevel: string; // "Low risk" / "Moderate risk"
  };
}

/**
 * Actionable Economic Insights
 * Clear recommendations and explanations
 */
export interface ActionableInsights {
  // Top priorities (max 3)
  immediateActions: Array<{
    title: string;
    description: string;
    impact: "High" | "Medium" | "Low";
    timeframe: "3 months" | "6 months" | "1 year";
    difficulty: "easy" | "moderate" | "complex";
    category: "Policy" | "Investment" | "Reform" | "Emergency";
  }>;

  // Opportunities to leverage
  strengths: Array<{
    area: string;
    advantage: string;
    howToLeverage: string;
    potentialGains: string;
  }>;

  // Risks to monitor
  watchAreas: Array<{
    area: string;
    risk: string;
    earlyWarningSignals: string[];
    preventativeActions: string;
  }>;

  // Long-term strategic directions
  strategicOpportunities: Array<{
    opportunity: string;
    description: string;
    requiredInvestment: "Low" | "Medium" | "High";
    timeToImpact: "Short" | "Medium" | "Long";
    successProbability: "High" | "Medium" | "Low";
  }>;
}

/**
 * Economic Story
 * Narrative explanation of the country's economic situation
 */
export interface EconomicStory {
  headline: string;
  currentSituation: string;
  recentProgress: string;
  majorChallenges: string[];
  futurePotential: string;
  comparativePerspective: string; // vs similar countries

  // Timeline context
  economicJourney: {
    past: string; // "Rapid industrialization phase"
    present: string; // "Mature economy with service focus"
    future: string; // "Digital transformation potential"
  };

  // Key economic themes
  dominantThemes: string[]; // ["Innovation-driven", "Export-oriented", "Resource-rich"]
}

/**
 * Economic Benchmarking
 * How the country compares to peers and targets
 */
export interface EconomicBenchmarking {
  peerComparisons: Array<{
    metric: string;
    userValue: number;
    peerAverage: number;
    topPerformer: number;
    ranking: string; // "Top 10%" / "Above average"
    gap: string; // "15% below peer average"
  }>;

  progressTracking: Array<{
    metric: string;
    current: number;
    target: number;
    progress: number; // 0-100%
    timeToTarget: string; // "2.5 years at current rate"
    onTrack: boolean;
  }>;

  globalContext: {
    economicRank: number; // Global rank by GDP
    developmentRank: number; // By development indicators
    competitivenessRank: number; // Business competitiveness
    trendDirection: "Rising" | "Stable" | "Falling";
  };
}

/**
 * Interactive Economic Simulation
 * What-if scenarios and policy impact modeling
 */
export interface EconomicSimulation {
  baselineProjection: {
    gdpGrowth5Year: number;
    gdpPerCapita5Year: number;
    unemploymentProjection: number;
    debtProjection: number;
  };

  policyScenarios: Array<{
    name: string;
    description: string;
    assumptions: string[];

    impacts: {
      gdpGrowthChange: number; // +0.5%
      unemploymentChange: number; // -1.2%
      inflationChange: number; // +0.1%
      debtChange: number; // +2% of GDP
    };

    tradeoffs: string[];
    implementation: "Easy" | "Moderate" | "Difficult";
    politicalFeasibility: "High" | "Medium" | "Low";
  }>;

  riskScenarios: Array<{
    name: string;
    probability: "Low" | "Medium" | "High";
    severity: "Minor" | "Moderate" | "Major";
    economicImpact: string;
    preparedness: "Well prepared" | "Somewhat prepared" | "Vulnerable";
  }>;
}

// ===== MAIN INTUITIVE ANALYSIS SYSTEM =====

export class IntuitiveEconomicAnalysis {
  private enhancedCalculator: EnhancedEconomicCalculator;
  private groupCalculator: EconomicCalculationGroups;
  private config: EconomicConfig;

  constructor(config: EconomicConfig) {
    this.config = config;
    this.enhancedCalculator = new EnhancedEconomicCalculator(config);
    this.groupCalculator = new EconomicCalculationGroups(config);
  }

  /**
   * Main analysis function - provides comprehensive, intuitive economic analysis
   */
  async analyzeEconomy(
    countryStats: CountryStats,
    economyData: EconomyData,
    historicalData: HistoricalDataPoint[] = []
  ): Promise<{
    summary: EconomicHealthSummary;
    insights: ActionableInsights;
    story: EconomicStory;
    benchmarking: EconomicBenchmarking;
    simulation: EconomicSimulation;
    detailedAnalysis: ComprehensiveEconomicAnalysis;
    groupedAnalysis: GroupedAnalysisResult;
  }> {
    // Run comprehensive calculations
    const detailedAnalysis = (this.enhancedCalculator as any).analyzeCountry(
      countryStats,
      economyData,
      historicalData
    );
    const groupedAnalysis = this.runGroupedAnalysis(countryStats, economyData, historicalData);

    // Generate intuitive summaries
    const summary = this.generateHealthSummary(
      countryStats,
      economyData,
      detailedAnalysis,
      groupedAnalysis
    );
    const insights = this.generateActionableInsights(
      countryStats,
      economyData,
      detailedAnalysis,
      groupedAnalysis
    );
    const story = this.generateEconomicStory(
      countryStats,
      economyData,
      historicalData,
      detailedAnalysis
    );
    const benchmarking = this.generateBenchmarking(countryStats, economyData, detailedAnalysis);
    const simulation = this.generateSimulation(countryStats, economyData, historicalData);

    return {
      summary,
      insights,
      story,
      benchmarking,
      simulation,
      detailedAnalysis,
      groupedAnalysis,
    };
  }

  /**
   * Quick Economic Health Check
   * Rapid assessment for dashboard display
   */
  quickHealthCheck(countryStats: CountryStats, economyData: EconomyData): EconomicHealthSummary {
    // Simplified scoring
    let score = 50;

    // GDP per capita factor (0-25 points)
    if (countryStats.currentGdpPerCapita >= 50000) score += 25;
    else if (countryStats.currentGdpPerCapita >= 30000) score += 20;
    else if (countryStats.currentGdpPerCapita >= 20000) score += 15;
    else if (countryStats.currentGdpPerCapita >= 10000) score += 10;
    else score += 5;

    // Growth factor (0-20 points)
    const growth = countryStats.adjustedGdpGrowth;
    if (growth >= 0.05) score += 20;
    else if (growth >= 0.03) score += 15;
    else if (growth >= 0.01) score += 10;
    else if (growth >= 0) score += 5;
    else score -= 10;

    // Unemployment factor (0-15 points)
    const unemployment = economyData.labor.unemploymentRate;
    if (unemployment <= 5) score += 15;
    else if (unemployment <= 8) score += 10;
    else if (unemployment <= 12) score += 5;
    else score -= 5;

    // Debt factor (0-15 points)
    const debt = economyData.fiscal.totalDebtGDPRatio;
    if (debt <= 60) score += 15;
    else if (debt <= 90) score += 10;
    else if (debt <= 120) score += 5;
    else score -= 10;

    // Inflation factor (0-10 points)
    const inflation = economyData.core.inflationRate;
    if (inflation >= 0.01 && inflation <= 0.04) score += 10;
    else if (inflation >= 0 && inflation <= 0.06) score += 5;
    else if (inflation > 0.1) score -= 10;

    const finalScore = Math.max(0, Math.min(100, Math.round(score)));

    return {
      overallGrade: this.scoreToGrade(finalScore),
      score: finalScore,
      status: this.scoreToStatus(finalScore),
      trend: this.determineTrend(countryStats, economyData),
      keyMessage: this.generateKeyMessage(finalScore, countryStats, economyData),
      healthIndicators: {
        growth: growth >= 0.03 ? "strong" : growth >= 0.01 ? "moderate" : "weak",
        stability:
          debt <= 60 && inflation <= 0.05
            ? "high"
            : debt <= 90 && inflation <= 0.08
              ? "medium"
              : "low",
        sustainability: this.assessSustainability(countryStats, economyData),
      },
      quickStats: {
        economicSize: this.categorizeEconomicSize(countryStats),
        developmentLevel: this.categorizeDevelopmentLevel(countryStats),
        globalPosition: this.estimateGlobalPosition(finalScore),
        riskLevel: this.assessRiskLevel(economyData),
      },
    };
  }

  // ===== PRIVATE HELPER METHODS =====

  private runGroupedAnalysis(
    countryStats: CountryStats,
    economyData: EconomyData,
    historicalData: HistoricalDataPoint[]
  ): GroupedAnalysisResult {
    const growthDynamics = this.groupCalculator.calculateGrowthDynamics(
      countryStats,
      economyData,
      historicalData
    );
    const financialHealth = this.groupCalculator.calculateFinancialHealth(
      countryStats,
      economyData,
      historicalData
    );
    const humanDevelopment = this.groupCalculator.calculateHumanDevelopment(
      countryStats,
      economyData
    );
    const economicStructure = this.groupCalculator.calculateEconomicStructure(
      countryStats,
      economyData
    );
    const externalRelations = this.groupCalculator.calculateExternalRelations(
      countryStats,
      economyData
    );

    const overallScore =
      growthDynamics.overallScore * 0.25 +
      financialHealth.overallScore * 0.25 +
      humanDevelopment.overallScore * 0.25 +
      economicStructure.overallScore * 0.15 +
      externalRelations.overallScore * 0.1;

    return {
      growthDynamics,
      financialHealth,
      humanDevelopment,
      economicStructure,
      externalRelations,
      overallScore: Math.round(overallScore),
      strengths: this.identifyGroupStrengths([
        growthDynamics,
        financialHealth,
        humanDevelopment,
        economicStructure,
        externalRelations,
      ]),
      challenges: this.identifyGroupChallenges([
        growthDynamics,
        financialHealth,
        humanDevelopment,
        economicStructure,
        externalRelations,
      ]),
      priorityActions: this.generateGroupPriorityActions([
        growthDynamics,
        financialHealth,
        humanDevelopment,
        economicStructure,
        externalRelations,
      ]),
    };
  }

  private generateHealthSummary(
    countryStats: CountryStats,
    economyData: EconomyData,
    detailedAnalysis: ComprehensiveEconomicAnalysis,
    groupedAnalysis: GroupedAnalysisResult
  ): EconomicHealthSummary {
    return this.quickHealthCheck(countryStats, economyData);
  }

  private generateActionableInsights(
    countryStats: CountryStats,
    economyData: EconomyData,
    detailedAnalysis: ComprehensiveEconomicAnalysis,
    groupedAnalysis: GroupedAnalysisResult
  ): ActionableInsights {
    const immediateActions = [];
    const strengths = [];
    const watchAreas = [];
    const strategicOpportunities = [];

    // Immediate actions based on critical issues
    if (economyData.labor.unemploymentRate > 12) {
      immediateActions.push({
        title: "Address High Unemployment",
        description: `Unemployment at ${economyData.labor.unemploymentRate.toFixed(1)}% requires urgent job creation programs`,
        impact: "High" as const,
        timeframe: "6 months" as const,
        difficulty: "moderate" as const,
        category: "Policy" as const,
      });
    }

    if (economyData.fiscal.totalDebtGDPRatio > 100) {
      immediateActions.push({
        title: "Fiscal Consolidation",
        description: "High debt levels require immediate budget balancing measures",
        impact: "High" as const,
        timeframe: "1 year" as const,
        difficulty: "complex" as const,
        category: "Policy" as const,
      });
    }

    if (economyData.core.inflationRate > 0.08) {
      immediateActions.push({
        title: "Inflation Control",
        description: "High inflation eroding purchasing power - monetary tightening needed",
        impact: "High" as const,
        timeframe: "3 months" as const,
        difficulty: "moderate" as const,
        category: "Policy" as const,
      });
    }

    // Strengths to leverage
    if (countryStats.currentGdpPerCapita > 40000) {
      strengths.push({
        area: "High-Income Status",
        advantage: "Strong economic foundation with high productivity",
        howToLeverage: "Focus on innovation and high-value services",
        potentialGains: "Maintain competitive advantage in global markets",
      });
    }

    if (economyData.labor.unemploymentRate < 5) {
      strengths.push({
        area: "Full Employment",
        advantage: "Tight labor market indicates economic dynamism",
        howToLeverage: "Invest in skills upgrade and productivity enhancement",
        potentialGains: "Sustained economic growth through human capital",
      });
    }

    // Watch areas
    if (economyData.fiscal.totalDebtGDPRatio > 80) {
      watchAreas.push({
        area: "Public Debt",
        risk: "Rising debt levels may constrain fiscal flexibility",
        earlyWarningSignals: [
          "Rising interest payments",
          "Credit rating concerns",
          "Market volatility",
        ],
        preventativeActions: "Implement medium-term fiscal consolidation plan",
      });
    }

    // Strategic opportunities
    if (countryStats.populationTier === "2" || countryStats.populationTier === "3") {
      strategicOpportunities.push({
        opportunity: "Demographic Dividend",
        description: "Young population provides growth potential through human capital",
        requiredInvestment: "Medium" as const,
        timeToImpact: "Long" as const,
        successProbability: "High" as const,
      });
    }

    strategicOpportunities.push({
      opportunity: "Digital Economy Development",
      description: "Leverage technology for economic transformation",
      requiredInvestment: "High" as const,
      timeToImpact: "Medium" as const,
      successProbability: "Medium" as const,
    });

    return {
      immediateActions: immediateActions.slice(0, 3),
      strengths: strengths.slice(0, 3),
      watchAreas: watchAreas.slice(0, 3),
      strategicOpportunities: strategicOpportunities.slice(0, 3),
    };
  }

  private generateEconomicStory(
    countryStats: CountryStats,
    economyData: EconomyData,
    historicalData: HistoricalDataPoint[],
    detailedAnalysis: ComprehensiveEconomicAnalysis
  ): EconomicStory {
    const gdpPerCapita = countryStats.currentGdpPerCapita;
    const economicTier = countryStats.economicTier;
    const growth = countryStats.adjustedGdpGrowth;

    // Generate headline
    let headline = "";
    if (gdpPerCapita > 50000) {
      headline = `${countryStats.name}: Advanced Economy with ${growth > 0.02 ? "Steady" : "Modest"} Growth`;
    } else if (gdpPerCapita > 25000) {
      headline = `${countryStats.name}: Developed Economy ${growth > 0.03 ? "Expanding Rapidly" : "in Transition"}`;
    } else if (gdpPerCapita > 10000) {
      headline = `${countryStats.name}: Emerging Market ${growth > 0.05 ? "on Fast Track" : "Seeking Growth"}`;
    } else {
      headline = `${countryStats.name}: Developing Economy with ${growth > 0.06 ? "High" : "Moderate"} Growth Potential`;
    }

    // Current situation
    const unemployment = economyData.labor.unemploymentRate;
    const inflation = economyData.core.inflationRate * 100;
    let currentSituation = `The economy shows a GDP per capita of $${gdpPerCapita.toLocaleString()}, placing it in the ${economicTier} category. `;
    currentSituation += `With ${unemployment.toFixed(1)}% unemployment and ${inflation.toFixed(1)}% inflation, `;
    currentSituation +=
      unemployment < 6
        ? "labor markets are tight"
        : unemployment > 10
          ? "job creation remains a challenge"
          : "employment levels are moderate";
    currentSituation +=
      inflation < 4
        ? " while price stability is maintained."
        : inflation > 8
          ? " amid concerning price pressures."
          : " with manageable price dynamics.";

    // Recent progress
    let recentProgress = "Recent economic performance ";
    if (growth > 0.04) {
      recentProgress += `has been strong, with ${(growth * 100).toFixed(1)}% annual growth reflecting robust economic momentum.`;
    } else if (growth > 0.02) {
      recentProgress += `has been steady, with ${(growth * 100).toFixed(1)}% annual growth indicating stable expansion.`;
    } else if (growth > 0) {
      recentProgress += `has been modest, with ${(growth * 100).toFixed(1)}% annual growth suggesting gradual improvement.`;
    } else {
      recentProgress +=
        "has been challenging, with economic contraction requiring policy intervention.";
    }

    // Major challenges
    const challenges = [];
    if (economyData.fiscal.totalDebtGDPRatio > 90) challenges.push("High public debt levels");
    if (unemployment > 10) challenges.push("Persistent unemployment");
    if (inflation > 0.06) challenges.push("Elevated inflation");
    if (economyData.income.incomeInequalityGini > 0.5) challenges.push("Income inequality");

    // Future potential
    let futurePotential = "";
    if (economicTier === "Impoverished" || economicTier === "Developing") {
      futurePotential =
        "The economy has significant catch-up potential through infrastructure development, human capital investment, and institutional strengthening.";
    } else if (economicTier === "Developed" || economicTier === "Healthy") {
      futurePotential =
        "Future growth depends on productivity gains, innovation capacity, and successful adaptation to global economic shifts.";
    } else {
      futurePotential =
        "As an advanced economy, future prosperity relies on maintaining competitiveness through innovation, sustainable development, and quality institutions.";
    }

    // Comparative perspective
    const comparativePerspective = `Compared to similar economies, ${countryStats.name} ${
      detailedAnalysis.overallRating.score > 80
        ? "performs strongly across key metrics"
        : detailedAnalysis.overallRating.score > 60
          ? "shows mixed performance with areas for improvement"
          : "faces significant challenges requiring comprehensive reform"
    }.`;

    return {
      headline,
      currentSituation,
      recentProgress,
      majorChallenges: challenges,
      futurePotential,
      comparativePerspective,
      economicJourney: {
        past: this.characterizePast(economicTier, historicalData),
        present: this.characterizePresent(economicTier, economyData),
        future: this.characterizeFuture(economicTier, growth),
      },
      dominantThemes: this.identifyDominantThemes(countryStats, economyData),
    };
  }

  private generateBenchmarking(
    countryStats: CountryStats,
    economyData: EconomyData,
    detailedAnalysis: ComprehensiveEconomicAnalysis
  ): EconomicBenchmarking {
    // Simplified benchmarking - in practice would use real comparative data
    const peerComparisons = [
      {
        metric: "GDP per Capita",
        userValue: countryStats.currentGdpPerCapita,
        peerAverage: this.getPeerAverage(countryStats.economicTier, "gdpPerCapita"),
        topPerformer: this.getTopPerformer("gdpPerCapita"),
        ranking: this.getRanking(countryStats.currentGdpPerCapita, "gdpPerCapita"),
        gap: this.calculateGap(
          countryStats.currentGdpPerCapita,
          this.getPeerAverage(countryStats.economicTier, "gdpPerCapita")
        ),
      },
      {
        metric: "Unemployment Rate",
        userValue: economyData.labor.unemploymentRate,
        peerAverage: this.getPeerAverage(countryStats.economicTier, "unemployment"),
        topPerformer: 3.5,
        ranking: this.getRanking(economyData.labor.unemploymentRate, "unemployment"),
        gap: this.calculateGap(
          economyData.labor.unemploymentRate,
          this.getPeerAverage(countryStats.economicTier, "unemployment")
        ),
      },
    ];

    const progressTracking = [
      {
        metric: "GDP Growth Target",
        current: countryStats.adjustedGdpGrowth * 100,
        target: 3.5,
        progress: Math.min(100, ((countryStats.adjustedGdpGrowth * 100) / 3.5) * 100),
        timeToTarget: this.calculateTimeToTarget(countryStats.adjustedGdpGrowth * 100, 3.5),
        onTrack: countryStats.adjustedGdpGrowth * 100 >= 3.0,
      },
    ];

    const globalContext = {
      economicRank: this.estimateGlobalRank(countryStats.currentTotalGdp),
      developmentRank: this.estimateDevelopmentRank(detailedAnalysis.overallRating.score),
      competitivenessRank: this.estimateCompetitivenessRank(countryStats, economyData),
      trendDirection: this.determineTrendDirection(countryStats) as "Rising" | "Stable" | "Falling",
    };

    return {
      peerComparisons,
      progressTracking,
      globalContext,
    };
  }

  private generateSimulation(
    countryStats: CountryStats,
    economyData: EconomyData,
    historicalData: HistoricalDataPoint[]
  ): EconomicSimulation {
    const currentGrowth = countryStats.adjustedGdpGrowth;
    const currentGdpPerCapita = countryStats.currentGdpPerCapita;
    const currentUnemployment = economyData.labor.unemploymentRate;
    const currentDebt = economyData.fiscal.totalDebtGDPRatio;

    // Baseline projection (5 years)
    const baselineProjection = {
      gdpGrowth5Year: currentGrowth,
      gdpPerCapita5Year: currentGdpPerCapita * Math.pow(1 + currentGrowth, 5),
      unemploymentProjection: currentUnemployment,
      debtProjection: currentDebt * (1 + 0.02) ** 5, // Assume 2% annual debt growth
    };

    // Policy scenarios
    const policyScenarios = [
      {
        name: "Infrastructure Investment Program",
        description: "Major public investment in infrastructure over 3 years",
        assumptions: [
          "2% of GDP annual investment",
          "Productivity gains from better infrastructure",
          "Short-term fiscal expansion",
        ],
        impacts: {
          gdpGrowthChange: 0.8,
          unemploymentChange: -1.5,
          inflationChange: 0.3,
          debtChange: 8,
        },
        tradeoffs: ["Higher public debt", "Short-term inflation pressure"],
        implementation: "Moderate" as const,
        politicalFeasibility: "High" as const,
      },
      {
        name: "Digital Transformation Initiative",
        description: "Comprehensive digitalization of economy and government",
        assumptions: [
          "Technology adoption",
          "Skills retraining programs",
          "Regulatory modernization",
        ],
        impacts: {
          gdpGrowthChange: 1.2,
          unemploymentChange: -0.8,
          inflationChange: -0.1,
          debtChange: 3,
        },
        tradeoffs: ["Initial job displacement", "High upfront costs"],
        implementation: "Difficult" as const,
        politicalFeasibility: "Medium" as const,
      },
      {
        name: "Education & Skills Enhancement",
        description: "Massive investment in education and workforce development",
        assumptions: [
          "Higher education spending",
          "Vocational training expansion",
          "University partnerships",
        ],
        impacts: {
          gdpGrowthChange: 0.6,
          unemploymentChange: -2.0,
          inflationChange: 0,
          debtChange: 5,
        },
        tradeoffs: ["Long-term payoff only", "Requires sustained commitment"],
        implementation: "Moderate" as const,
        politicalFeasibility: "High" as const,
      },
    ];

    // Risk scenarios
    const riskScenarios = [
      {
        name: "Global Economic Recession",
        probability: "Medium" as const,
        severity: "Major" as const,
        economicImpact: "2-3% GDP contraction, unemployment spike",
        preparedness:
          currentDebt < 80 ? ("Well prepared" as const) : ("Somewhat prepared" as const),
      },
      {
        name: "Debt Crisis",
        probability: currentDebt > 100 ? ("Medium" as const) : ("Low" as const),
        severity: "Major" as const,
        economicImpact: "Severe fiscal constraints, austerity measures",
        preparedness: "Vulnerable" as const,
      },
      {
        name: "Inflation Spike",
        probability: economyData.core.inflationRate > 0.05 ? ("Medium" as const) : ("Low" as const),
        severity: "Moderate" as const,
        economicImpact: "Reduced purchasing power, monetary tightening needed",
        preparedness: "Somewhat prepared" as const,
      },
    ];

    return {
      baselineProjection,
      policyScenarios,
      riskScenarios,
    };
  }

  // ===== UTILITY METHODS =====

  private scoreToGrade(score: number): EconomicHealthSummary["overallGrade"] {
    if (score >= 97) return "A+";
    if (score >= 93) return "A";
    if (score >= 90) return "A-";
    if (score >= 87) return "B+";
    if (score >= 83) return "B";
    if (score >= 80) return "B-";
    if (score >= 77) return "C+";
    if (score >= 73) return "C";
    if (score >= 70) return "C-";
    if (score >= 60) return "D";
    return "F";
  }

  private scoreToStatus(score: number): EconomicHealthSummary["status"] {
    if (score >= 90) return "Excellent";
    if (score >= 80) return "Strong";
    if (score >= 70) return "Good";
    if (score >= 60) return "Fair";
    if (score >= 50) return "Weak";
    return "Critical";
  }

  private determineTrend(
    countryStats: CountryStats,
    economyData: EconomyData
  ): EconomicHealthSummary["trend"] {
    // Simplified trend analysis
    const growth = countryStats.adjustedGdpGrowth;
    if (growth > 0.03) return "Improving";
    if (growth > 0) return "Stable";
    return "Declining";
  }

  private generateKeyMessage(
    score: number,
    countryStats: CountryStats,
    economyData: EconomyData
  ): string {
    if (score >= 85) {
      return `Strong economic fundamentals with GDP per capita of $${countryStats.currentGdpPerCapita.toLocaleString()} and ${countryStats.adjustedGdpGrowth > 0.02 ? "healthy" : "stable"} growth.`;
    } else if (score >= 70) {
      return `Solid economic foundation with room for improvement in ${economyData.labor.unemploymentRate > 8 ? "employment" : economyData.fiscal.totalDebtGDPRatio > 80 ? "fiscal management" : "key areas"}.`;
    } else if (score >= 55) {
      return `Mixed economic performance requiring focused reforms to strengthen ${economyData.labor.unemploymentRate > 12 ? "job creation" : "economic stability"}.`;
    } else {
      return `Significant economic challenges requiring comprehensive policy intervention and structural reforms.`;
    }
  }

  private assessSustainability(
    countryStats: CountryStats,
    economyData: EconomyData
  ): "excellent" | "good" | "concerning" {
    const debt = economyData.fiscal.totalDebtGDPRatio;
    const inflation = economyData.core.inflationRate;
    const growth = countryStats.adjustedGdpGrowth;

    if (debt <= 60 && inflation <= 0.04 && growth >= 0.02) return "excellent";
    if (debt <= 90 && inflation <= 0.06 && growth >= 0) return "good";
    return "concerning";
  }

  private categorizeEconomicSize(countryStats: CountryStats): string {
    const gdp = countryStats.currentTotalGdp;
    if (gdp > 2000000000000) return "Very large economy"; // > $2T
    if (gdp > 500000000000) return "Large economy"; // > $500B
    if (gdp > 100000000000) return "Medium economy"; // > $100B
    if (gdp > 20000000000) return "Small economy"; // > $20B
    return "Very small economy";
  }

  private categorizeDevelopmentLevel(countryStats: CountryStats): string {
    switch (countryStats.economicTier) {
      case "Extravagant":
      case "Very Strong":
        return "Highly developed";
      case "Strong":
      case "Healthy":
        return "Developed";
      case "Developed":
        return "Upper middle income";
      case "Developing":
        return "Lower middle income";
      default:
        return "Developing";
    }
  }

  private estimateGlobalPosition(score: number): string {
    if (score >= 85) return "Top 20%";
    if (score >= 70) return "Above average";
    if (score >= 55) return "Average";
    if (score >= 40) return "Below average";
    return "Bottom quartile";
  }

  private assessRiskLevel(economyData: EconomyData): string {
    const debt = economyData.fiscal.totalDebtGDPRatio;
    const unemployment = economyData.labor.unemploymentRate;
    const inflation = economyData.core.inflationRate;

    let riskFactors = 0;
    if (debt > 100) riskFactors++;
    if (unemployment > 12) riskFactors++;
    if (inflation > 0.08) riskFactors++;

    if (riskFactors === 0) return "Low risk";
    if (riskFactors === 1) return "Moderate risk";
    return "High risk";
  }

  // Placeholder methods for benchmarking calculations
  private getPeerAverage(tier: string, metric: string): number {
    const averages: Record<string, Record<string, number>> = {
      Strong: { gdpPerCapita: 48000, unemployment: 6.5 },
      Healthy: { gdpPerCapita: 38000, unemployment: 7.2 },
      Developed: { gdpPerCapita: 28000, unemployment: 8.1 },
    };
    return averages[tier]?.[metric] || 25000;
  }

  private getTopPerformer(metric: string): number {
    const topPerformers: Record<string, number> = {
      gdpPerCapita: 85000,
      unemployment: 2.8,
    };
    return topPerformers[metric] || 0;
  }

  private getRanking(value: number, metric: string): string {
    // Simplified ranking logic
    if (metric === "gdpPerCapita") {
      if (value >= 50000) return "Top 10%";
      if (value >= 30000) return "Top 25%";
      if (value >= 20000) return "Above average";
      return "Below average";
    }
    if (metric === "unemployment") {
      if (value <= 4) return "Top 10%";
      if (value <= 6) return "Top 25%";
      if (value <= 9) return "Above average";
      return "Below average";
    }
    return "Average";
  }

  private calculateGap(userValue: number, peerAverage: number): string {
    const gap = ((userValue - peerAverage) / peerAverage) * 100;
    if (Math.abs(gap) < 2) return "Similar to peers";
    return gap > 0
      ? `${gap.toFixed(0)}% above peer average`
      : `${Math.abs(gap).toFixed(0)}% below peer average`;
  }

  private calculateTimeToTarget(current: number, target: number): string {
    if (current >= target) return "Target achieved";
    const yearsNeeded = Math.log(target / current) / Math.log(1.02); // Assume 2% annual improvement
    return `${yearsNeeded.toFixed(1)} years at current rate`;
  }

  private estimateGlobalRank(gdp: number): number {
    // Simplified ranking based on GDP size
    if (gdp > 10000000000000) return 5; // > $10T
    if (gdp > 5000000000000) return 10; // > $5T
    if (gdp > 2000000000000) return 20; // > $2T
    if (gdp > 500000000000) return 50; // > $500B
    if (gdp > 100000000000) return 80; // > $100B
    return 120;
  }

  private estimateDevelopmentRank(score: number): number {
    return Math.max(1, Math.round((100 - score) * 1.95)); // Convert score to rank out of ~195
  }

  private estimateCompetitivenessRank(
    countryStats: CountryStats,
    economyData: EconomyData
  ): number {
    // Based on multiple factors
    let baseRank = 100;
    if (countryStats.economicTier === "Very Strong") baseRank = 15;
    else if (countryStats.economicTier === "Strong") baseRank = 30;
    else if (countryStats.economicTier === "Healthy") baseRank = 50;

    // Adjust for unemployment
    if (economyData.labor.unemploymentRate < 5) baseRank -= 10;
    else if (economyData.labor.unemploymentRate > 10) baseRank += 15;

    return Math.max(1, baseRank);
  }

  private determineTrendDirection(countryStats: CountryStats): string {
    const growth = countryStats.adjustedGdpGrowth;
    if (growth > 0.03) return "Rising";
    if (growth > 0) return "Stable";
    return "Falling";
  }

  // Story generation helpers
  private characterizePast(tier: string, historicalData: HistoricalDataPoint[]): string {
    if (tier === "Impoverished" || tier === "Developing") {
      return "Agricultural foundation with gradual modernization";
    } else if (tier === "Developed" || tier === "Healthy") {
      return "Industrial development and service sector growth";
    } else {
      return "Advanced economy with technology and innovation focus";
    }
  }

  private characterizePresent(tier: string, economyData: EconomyData): string {
    const unemployment = economyData.labor.unemploymentRate;
    if (unemployment < 5) {
      return "Dynamic economy with full employment and growth momentum";
    } else if (unemployment > 10) {
      return "Economy in transition facing employment challenges";
    } else {
      return "Stable economy with balanced employment dynamics";
    }
  }

  private characterizeFuture(tier: string, growth: number): string {
    if (growth > 0.05) {
      return "High growth trajectory with expansion potential";
    } else if (growth > 0.02) {
      return "Steady development with sustainable growth path";
    } else {
      return "Maturation phase requiring innovation for continued progress";
    }
  }

  private identifyDominantThemes(countryStats: CountryStats, economyData: EconomyData): string[] {
    const themes = [];

    if (countryStats.currentGdpPerCapita > 40000) themes.push("High-income economy");
    if (countryStats.adjustedGdpGrowth > 0.04) themes.push("Growth-oriented");
    if (economyData.labor.unemploymentRate < 5) themes.push("Full employment");
    if (economyData.fiscal.totalDebtGDPRatio < 60) themes.push("Fiscally sound");
    if (economyData.core.inflationRate < 0.03) themes.push("Price stable");

    return themes.length > 0 ? themes : ["Developing economy"];
  }

  // Group analysis helpers
  private identifyGroupStrengths(groups: Array<{ overallScore: number }>): string[] {
    return groups
      .map((group, index) => ({
        name: [
          "Growth Dynamics",
          "Financial Health",
          "Human Development",
          "Economic Structure",
          "External Relations",
        ][index],
        score: group.overallScore,
      }))
      .filter((g) => g.score >= 75)
      .map((g) => g.name);
  }

  private identifyGroupChallenges(groups: Array<{ overallScore: number }>): string[] {
    return groups
      .map((group, index) => ({
        name: [
          "Growth Dynamics",
          "Financial Health",
          "Human Development",
          "Economic Structure",
          "External Relations",
        ][index],
        score: group.overallScore,
      }))
      .filter((g) => g.score <= 50)
      .map((g) => g.name);
  }

  private generateGroupPriorityActions(
    groups: Array<{ overallScore: number }>
  ): Array<{ group: string; action: string; urgency: "high" | "medium" | "low" }> {
    const actions: Array<{ group: string; action: string; urgency: "high" | "medium" | "low" }> =
      [];

    groups.forEach((group, index) => {
      const groupName = [
        "Growth Dynamics",
        "Financial Health",
        "Human Development",
        "Economic Structure",
        "External Relations",
      ][index];
      if (group.overallScore < 60) {
        actions.push({
          group: groupName,
          action: `Strengthen ${groupName.toLowerCase()} through targeted reforms`,
          urgency: group.overallScore < 40 ? ("high" as const) : ("medium" as const),
        });
      }
    });

    return actions;
  }
}

export default IntuitiveEconomicAnalysis;
