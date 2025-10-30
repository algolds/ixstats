/**
 * Archetype Recommendation System
 *
 * Provides intelligent recommendations for economic archetypes based on country characteristics,
 * including transition planning, cost estimation, complexity analysis, and risk assessment.
 */

/**
 * Archetype Recommendation System
 *
 * Provides intelligent recommendations for economic archetypes based on country characteristics,
 * including transition planning, cost estimation, complexity analysis, and risk assessment.
 */
import type { EconomicArchetype } from "../data/archetype-types";
import { EconomicArchetypeService } from "../services/EconomicArchetypeService";
import type { EconomyBuilderState } from "~/types/economy-builder";
import { EconomicComponentType } from "~/lib/atomic-economic-data";

/**
 * Country characteristics used for archetype recommendations
 */
export interface CountryCharacteristics {
  /** Current GDP per capita in USD */
  gdpPerCapita: number;
  /** Total population */
  population: number;
  /** Current GDP growth rate (%) */
  currentGrowthRate: number;
  /** Current unemployment rate (%) */
  unemploymentRate: number;
  /** Geographic region */
  region: string;
  /** Natural resource availability (0-100) */
  resourceAvailability: number;
  /** Human capital index (0-100) */
  humanCapitalIndex: number;
  /** Infrastructure quality (0-100) */
  infrastructureQuality: number;
  /** Innovation capacity (0-100) */
  innovationCapacity: number;
  /** Political stability (0-100) */
  politicalStability: number;
  /** Current economic components */
  currentComponents: EconomicComponentType[];
  /** Current sector distribution */
  sectorDistribution: Record<string, number>;
  /** Cultural factors */
  culturalFactors: string[];
}

/**
 * Archetype recommendation with scoring and rationale
 */
export interface ArchetypeRecommendation {
  /** The recommended archetype */
  archetype: EconomicArchetype;
  /** Overall match score (0-100) */
  matchScore: number;
  /** Compatibility breakdown */
  compatibility: {
    economic: number;
    cultural: number;
    institutional: number;
    geographic: number;
  };
  /** Key reasons for recommendation */
  reasons: string[];
  /** Potential benefits */
  benefits: string[];
  /** Implementation challenges */
  challenges: string[];
  /** Time horizon for implementation */
  timeHorizon: "short" | "medium" | "long";
  /** Overall recommendation level */
  recommendationLevel: "highly-recommended" | "recommended" | "consider" | "not-recommended";
}

/**
 * Implementation step for archetype transition
 */
export interface ImplementationStep {
  /** Step number in sequence */
  stepNumber: number;
  /** Step title */
  title: string;
  /** Detailed description */
  description: string;
  /** Time required in months */
  duration: number;
  /** Implementation priority */
  priority: "critical" | "high" | "medium" | "low";
  /** Required resources */
  resources: string[];
  /** Key stakeholders */
  stakeholders: string[];
  /** Success criteria */
  successCriteria: string[];
  /** Dependencies on other steps */
  dependencies: number[];
}

/**
 * Transition cost estimate
 */
export interface TransitionCost {
  /** Total estimated cost in USD */
  totalCost: number;
  /** Cost breakdown by category */
  breakdown: {
    infrastructure: number;
    education: number;
    technology: number;
    administrative: number;
    social: number;
  };
  /** Cost as percentage of current GDP */
  percentageOfGDP: number;
  /** Financing recommendations */
  financingOptions: string[];
  /** Return on investment timeline */
  roiTimeline: number;
}

/**
 * Complexity analysis for transition
 */
export interface ComplexityAnalysis {
  /** Overall complexity level */
  overallComplexity: "low" | "medium" | "high" | "very-high";
  /** Complexity score (0-100) */
  complexityScore: number;
  /** Complexity factors */
  factors: {
    institutional: number;
    economic: number;
    social: number;
    technical: number;
  };
  /** Risk assessment */
  riskLevel: "low" | "medium" | "high" | "critical";
  /** Mitigation strategies */
  mitigationStrategies: string[];
}

/**
 * Key success factors for archetype implementation
 */
export interface KeySuccessFactors {
  /** Critical success factors */
  criticalFactors: string[];
  /** Important success factors */
  importantFactors: string[];
  /** Supporting factors */
  supportingFactors: string[];
  /** Prerequisites */
  prerequisites: string[];
  /** Key performance indicators */
  kpis: string[];
}

/**
 * Warnings and risks for archetype transition
 */
export interface WarningsAndRisks {
  /** Critical warnings that could derail implementation */
  criticalWarnings: string[];
  /** Major risks to monitor */
  majorRisks: string[];
  /** Moderate risks */
  moderateRisks: string[];
  /** Early warning indicators */
  earlyWarningIndicators: string[];
  /** Contingency plans */
  contingencyPlans: string[];
}

/**
 * Get recommended archetypes based on country characteristics
 */
export function getRecommendedArchetype(
  characteristics: CountryCharacteristics,
  preferences?: {
    focusArea?: "growth" | "stability" | "innovation" | "equity";
    riskTolerance?: "low" | "medium" | "high";
    timeHorizon?: "short" | "medium" | "long";
  }
): ArchetypeRecommendation[] {
  const service = EconomicArchetypeService.getInstance();
  const allArchetypes = service.getAllArchetypes();

  const recommendations = Array.from(allArchetypes.values()).map((archetype: EconomicArchetype) => {
    const matchScore = calculateMatchScore(archetype, characteristics, preferences);
    const compatibility = calculateCompatibility(archetype, characteristics);
    const reasons = generateReasons(archetype, characteristics);
    const benefits = identifyBenefits(archetype, characteristics);
    const challenges = identifyChallenges(archetype, characteristics);
    const timeHorizon = estimateTimeHorizon(archetype, characteristics);
    const recommendationLevel = determineRecommendationLevel(matchScore, compatibility);

    return {
      archetype,
      matchScore,
      compatibility,
      reasons,
      benefits,
      challenges,
      timeHorizon,
      recommendationLevel,
    };
  });

  // Sort by match score descending
  return recommendations.sort(
    (a: ArchetypeRecommendation, b: ArchetypeRecommendation) => b.matchScore - a.matchScore
  );
}

/**
 * Generate implementation steps for transitioning to an archetype
 */
export function generateImplementationSteps(
  targetArchetype: EconomicArchetype,
  currentState: CountryCharacteristics
): ImplementationStep[] {
  const steps: ImplementationStep[] = [];

  // Phase 1: Foundation and Planning (Months 0-6)
  steps.push({
    stepNumber: 1,
    title: "Comprehensive Assessment and Strategic Planning",
    description:
      "Conduct detailed analysis of current economic state, identify gaps, and develop comprehensive transition strategy",
    duration: 6,
    priority: "critical",
    resources: ["Economic experts", "Data analysts", "Strategic consultants"],
    stakeholders: ["Government leadership", "Business community", "Academic institutions"],
    successCriteria: [
      "Complete gap analysis report",
      "Stakeholder buy-in achieved",
      "Detailed transition roadmap approved",
    ],
    dependencies: [],
  });

  steps.push({
    stepNumber: 2,
    title: "Institutional Framework Development",
    description:
      "Establish necessary legal, regulatory, and institutional frameworks to support the new economic model",
    duration: 12,
    priority: "critical",
    resources: ["Legal experts", "Policy makers", "International advisors"],
    stakeholders: ["Legislature", "Regulatory agencies", "Judiciary"],
    successCriteria: [
      "Key legislation passed",
      "Regulatory frameworks established",
      "Enforcement mechanisms in place",
    ],
    dependencies: [1],
  });

  // Phase 2: Infrastructure and Human Capital (Months 6-24)
  if (needsInfrastructureInvestment(targetArchetype, currentState)) {
    steps.push({
      stepNumber: 3,
      title: "Infrastructure Modernization",
      description:
        "Invest in critical infrastructure including transportation, telecommunications, energy, and digital infrastructure",
      duration: 24,
      priority: "high",
      resources: ["Capital investment", "Engineering firms", "Technology providers"],
      stakeholders: ["Infrastructure ministries", "Private sector", "Local governments"],
      successCriteria: [
        "Infrastructure quality index improved by 25%",
        "Digital connectivity increased to 90%+",
        "Transportation efficiency improved",
      ],
      dependencies: [2],
    });
  }

  if (needsEducationReform(targetArchetype, currentState)) {
    steps.push({
      stepNumber: 4,
      title: "Education and Skills Development",
      description:
        "Reform education system and implement large-scale skills training programs aligned with target archetype requirements",
      duration: 18,
      priority: "high",
      resources: ["Education budget", "Training institutions", "International partnerships"],
      stakeholders: ["Education ministry", "Universities", "Training providers", "Industry"],
      successCriteria: [
        "Curriculum updated to match industry needs",
        "50%+ of workforce enrolled in skills training",
        "Human capital index improved by 20%",
      ],
      dependencies: [1],
    });
  }

  // Phase 3: Economic Restructuring (Months 12-36)
  if (needsSectorRebalancing(targetArchetype, currentState)) {
    steps.push({
      stepNumber: 5,
      title: "Economic Sector Restructuring",
      description:
        "Implement policies to shift economic activity toward target sector distribution, supporting emerging industries",
      duration: 36,
      priority: "high",
      resources: ["Economic incentives", "Investment funds", "Industry experts"],
      stakeholders: ["Economic ministries", "Business associations", "Investors"],
      successCriteria: [
        "Target sector distribution achieved within 10%",
        "New industries established and growing",
        "Productivity improvements visible",
      ],
      dependencies: [2, 3],
    });
  }

  // Phase 4: Innovation and Technology (Months 18-48)
  if (requiresInnovationEcosystem(targetArchetype, currentState)) {
    steps.push({
      stepNumber: 6,
      title: "Innovation Ecosystem Development",
      description:
        "Build innovation infrastructure including R&D centers, startup incubators, and technology transfer mechanisms",
      duration: 30,
      priority: "medium",
      resources: ["R&D funding", "Technology partnerships", "Venture capital"],
      stakeholders: ["Innovation agencies", "Universities", "Tech companies", "Investors"],
      successCriteria: [
        "Innovation index improved by 30%",
        "R&D spending increased to target level",
        "Patent filings increased significantly",
      ],
      dependencies: [4],
    });
  }

  // Phase 5: Social and Cultural Adaptation (Months 24-60)
  steps.push({
    stepNumber: 7,
    title: "Social Safety Net Enhancement",
    description:
      "Develop comprehensive social protection systems to support workers during transition and beyond",
    duration: 24,
    priority: "high",
    resources: ["Social welfare budget", "Administrative systems", "Community organizations"],
    stakeholders: ["Social ministries", "Labor unions", "NGOs", "Communities"],
    successCriteria: [
      "Social protection coverage expanded",
      "Unemployment support strengthened",
      "Inequality reduced by measurable amount",
    ],
    dependencies: [2, 5],
  });

  steps.push({
    stepNumber: 8,
    title: "Cultural Change and Public Engagement",
    description:
      "Implement public communication campaign and cultural programs to build support and align values with new model",
    duration: 36,
    priority: "medium",
    resources: ["Communication budget", "Media partnerships", "Cultural programs"],
    stakeholders: ["Media", "Civil society", "Educational institutions", "Public"],
    successCriteria: [
      "Public support for reforms above 60%",
      "Cultural alignment indicators positive",
      "Active citizen participation in transition",
    ],
    dependencies: [1],
  });

  // Phase 6: Integration and Optimization (Months 48-72)
  steps.push({
    stepNumber: 9,
    title: "System Integration and Performance Optimization",
    description:
      "Integrate all components, optimize performance, and adjust policies based on early results",
    duration: 24,
    priority: "medium",
    resources: ["Performance analysts", "Policy experts", "Technology systems"],
    stakeholders: ["All government agencies", "Private sector", "Civil society"],
    successCriteria: [
      "All systems integrated and functioning",
      "Performance metrics meeting targets",
      "Continuous improvement processes established",
    ],
    dependencies: [3, 4, 5, 6, 7],
  });

  steps.push({
    stepNumber: 10,
    title: "Evaluation and Long-term Sustainability",
    description:
      "Conduct comprehensive evaluation, institutionalize best practices, and establish long-term sustainability mechanisms",
    duration: 12,
    priority: "medium",
    resources: ["Evaluation experts", "Sustainability consultants", "Monitoring systems"],
    stakeholders: ["Government", "International organizations", "Oversight bodies"],
    successCriteria: [
      "Full evaluation report completed",
      "Best practices documented and shared",
      "Sustainability mechanisms operational",
    ],
    dependencies: [9],
  });

  return steps;
}

/**
 * Calculate transition cost estimate
 */
export function calculateTransitionCost(
  targetArchetype: EconomicArchetype,
  currentState: CountryCharacteristics,
  currentGDP: number
): TransitionCost {
  // Base cost factors by archetype complexity
  const complexityMultipliers = {
    low: 0.05,
    medium: 0.15,
    high: 0.3,
  };

  const baseMultiplier = complexityMultipliers[targetArchetype.implementationComplexity];

  // Calculate component costs
  const infrastructureCost = calculateInfrastructureCost(targetArchetype, currentState, currentGDP);
  const educationCost = calculateEducationCost(targetArchetype, currentState, currentGDP);
  const technologyCost = calculateTechnologyCost(targetArchetype, currentState, currentGDP);
  const administrativeCost = calculateAdministrativeCost(targetArchetype, currentState, currentGDP);
  const socialCost = calculateSocialCost(targetArchetype, currentState, currentGDP);

  const totalCost =
    infrastructureCost + educationCost + technologyCost + administrativeCost + socialCost;
  const percentageOfGDP = (totalCost / currentGDP) * 100;

  return {
    totalCost,
    breakdown: {
      infrastructure: infrastructureCost,
      education: educationCost,
      technology: technologyCost,
      administrative: administrativeCost,
      social: socialCost,
    },
    percentageOfGDP,
    financingOptions: generateFinancingOptions(totalCost, currentGDP),
    roiTimeline: estimateROITimeline(targetArchetype, currentState),
  };
}

/**
 * Analyze implementation complexity
 */
export function calculateTransitionComplexity(
  targetArchetype: EconomicArchetype,
  currentState: CountryCharacteristics
): ComplexityAnalysis {
  const institutional = calculateInstitutionalComplexity(targetArchetype, currentState);
  const economic = calculateEconomicComplexity(targetArchetype, currentState);
  const social = calculateSocialComplexity(targetArchetype, currentState);
  const technical = calculateTechnicalComplexity(targetArchetype, currentState);

  const complexityScore = (institutional + economic + social + technical) / 4;

  let overallComplexity: "low" | "medium" | "high" | "very-high";
  if (complexityScore < 30) overallComplexity = "low";
  else if (complexityScore < 55) overallComplexity = "medium";
  else if (complexityScore < 75) overallComplexity = "high";
  else overallComplexity = "very-high";

  let riskLevel: "low" | "medium" | "high" | "critical";
  if (complexityScore < 40) riskLevel = "low";
  else if (complexityScore < 60) riskLevel = "medium";
  else if (complexityScore < 80) riskLevel = "high";
  else riskLevel = "critical";

  return {
    overallComplexity,
    complexityScore,
    factors: {
      institutional,
      economic,
      social,
      technical,
    },
    riskLevel,
    mitigationStrategies: generateMitigationStrategies(overallComplexity, {
      institutional,
      economic,
      social,
      technical,
    }),
  };
}

/**
 * Identify key success factors
 */
export function identifyKeySuccessFactors(
  targetArchetype: EconomicArchetype,
  currentState: CountryCharacteristics
): KeySuccessFactors {
  const criticalFactors: string[] = [
    "Strong political leadership and sustained commitment",
    "Adequate financial resources and fiscal capacity",
    "Public support and social cohesion",
  ];

  const importantFactors: string[] = [
    "Effective institutional capacity and governance",
    "Skilled workforce and human capital",
    "Stable macroeconomic environment",
  ];

  const supportingFactors: string[] = [
    "International partnerships and knowledge transfer",
    "Private sector engagement and investment",
    "Technological infrastructure and capabilities",
  ];

  const prerequisites: string[] = [
    "Political stability and rule of law",
    "Minimum level of institutional capacity",
    "Basic infrastructure foundation",
  ];

  // Add archetype-specific factors
  if (targetArchetype.economicComponents.includes(EconomicComponentType.INNOVATION_ECONOMY)) {
    criticalFactors.push("World-class research institutions and R&D capacity");
    importantFactors.push("Strong intellectual property protection");
    supportingFactors.push("Venture capital ecosystem");
  }

  if (targetArchetype.economicComponents.includes(EconomicComponentType.EXPORT_ORIENTED)) {
    criticalFactors.push("Competitive manufacturing sector");
    importantFactors.push("Trade infrastructure and logistics");
    supportingFactors.push("International market access");
  }

  if (targetArchetype.economicComponents.includes(EconomicComponentType.SOCIAL_MARKET_ECONOMY)) {
    criticalFactors.push("Strong social safety net systems");
    importantFactors.push("Labor-management cooperation");
    supportingFactors.push("Progressive taxation system");
  }

  const kpis: string[] = [
    "GDP growth rate trajectory",
    "Unemployment rate trends",
    "Innovation index improvement",
    "Human capital index change",
    "Infrastructure quality metrics",
    "Public satisfaction indicators",
    "Income inequality measures",
    "Productivity growth rates",
  ];

  return {
    criticalFactors,
    importantFactors,
    supportingFactors,
    prerequisites,
    kpis,
  };
}

/**
 * Generate warnings and risks
 */
export function generateWarningsAndRisks(
  targetArchetype: EconomicArchetype,
  currentState: CountryCharacteristics,
  complexity: ComplexityAnalysis
): WarningsAndRisks {
  const criticalWarnings: string[] = [];
  const majorRisks: string[] = [];
  const moderateRisks: string[] = [];

  // Assess based on complexity and gaps
  if (complexity.complexityScore > 75) {
    criticalWarnings.push(
      "Extremely high implementation complexity may lead to failure or abandonment"
    );
    criticalWarnings.push("Risk of political resistance and social backlash");
  }

  if (currentState.politicalStability < 50) {
    criticalWarnings.push(
      "Low political stability threatens sustained commitment required for transition"
    );
  }

  if (
    currentState.infrastructureQuality < 40 &&
    targetArchetype.implementationComplexity === "high"
  ) {
    criticalWarnings.push(
      "Severe infrastructure gaps may make transition infeasible without massive investment"
    );
  }

  // Major risks
  majorRisks.push("Economic disruption during transition period leading to temporary GDP decline");
  majorRisks.push("Resistance from vested interests in current economic structure");
  majorRisks.push("Insufficient fiscal capacity to fund necessary investments");

  if (Math.abs(currentState.currentGrowthRate - targetArchetype.growthMetrics.gdpGrowth) > 3) {
    majorRisks.push("Large growth rate adjustment may cause economic instability");
  }

  if (
    targetArchetype.economicComponents.includes(EconomicComponentType.INNOVATION_ECONOMY) &&
    currentState.innovationCapacity < 50
  ) {
    majorRisks.push("Innovation ecosystem gap may delay benefits realization");
  }

  // Moderate risks
  moderateRisks.push("Timeline slippage due to unforeseen implementation challenges");
  moderateRisks.push("Cost overruns exceeding initial estimates");
  moderateRisks.push("Coordination difficulties across multiple government agencies");
  moderateRisks.push("External economic shocks disrupting transition process");
  moderateRisks.push("Skills mismatch requiring longer retraining periods");

  const earlyWarningIndicators: string[] = [
    "Declining public support below 50%",
    "Key reform legislation stalled or defeated",
    "Budget shortfalls exceeding 20%",
    "Major stakeholder groups withdrawing support",
    "Implementation timeline delays exceeding 6 months",
    "Economic indicators deteriorating beyond projections",
    "Social unrest or significant protests",
    "Loss of international support or funding",
  ];

  const contingencyPlans: string[] = [
    "Develop phased rollback procedures if critical milestones not met",
    "Establish emergency economic stabilization fund",
    "Create rapid response team for addressing emerging crises",
    "Prepare alternative implementation paths if primary route blocked",
    "Build coalition of reform champions to sustain momentum",
    "Maintain regular stakeholder engagement and communication",
    "Establish clear decision points for go/no-go assessments",
    "Develop interim success indicators to demonstrate progress",
  ];

  return {
    criticalWarnings,
    majorRisks,
    moderateRisks,
    earlyWarningIndicators,
    contingencyPlans,
  };
}

// ============================================================================
// Private Helper Functions
// ============================================================================

function calculateMatchScore(
  archetype: EconomicArchetype,
  characteristics: CountryCharacteristics,
  preferences?: { focusArea?: string; riskTolerance?: string; timeHorizon?: string }
): number {
  let score = 0;

  // Economic alignment (40% weight)
  const economicScore = calculateEconomicAlignment(archetype, characteristics);
  score += economicScore * 0.4;

  // Cultural fit (20% weight)
  const culturalScore = calculateCulturalFit(archetype, characteristics);
  score += culturalScore * 0.2;

  // Institutional readiness (25% weight)
  const institutionalScore = calculateInstitutionalReadiness(archetype, characteristics);
  score += institutionalScore * 0.25;

  // Geographic suitability (15% weight)
  const geographicScore = calculateGeographicSuitability(archetype, characteristics);
  score += geographicScore * 0.15;

  // Apply preference adjustments
  if (preferences?.focusArea) {
    score = applyFocusAreaAdjustment(score, archetype, preferences.focusArea);
  }

  return Math.min(100, Math.max(0, score));
}

function calculateEconomicAlignment(
  archetype: EconomicArchetype,
  characteristics: CountryCharacteristics
): number {
  let score = 50; // Base score

  // GDP per capita alignment
  const gdpDiff = Math.abs(characteristics.gdpPerCapita - 40000); // Assuming 40k as reference
  score += Math.max(-15, 15 - gdpDiff / 2000);

  // Growth rate alignment
  const growthDiff = Math.abs(
    characteristics.currentGrowthRate - archetype.growthMetrics.gdpGrowth
  );
  score += Math.max(-10, 10 - growthDiff * 2);

  // Component overlap
  const componentOverlap = characteristics.currentComponents.filter((c) =>
    archetype.economicComponents.includes(c)
  ).length;
  score += (componentOverlap / archetype.economicComponents.length) * 20;

  return Math.min(100, Math.max(0, score));
}

function calculateCulturalFit(
  archetype: EconomicArchetype,
  characteristics: CountryCharacteristics
): number {
  let score = 50;

  const culturalOverlap = characteristics.culturalFactors.filter((f) =>
    archetype.culturalFactors.some((af) => af.toLowerCase().includes(f.toLowerCase()))
  ).length;

  if (characteristics.culturalFactors.length > 0) {
    score += (culturalOverlap / characteristics.culturalFactors.length) * 50;
  }

  return Math.min(100, Math.max(0, score));
}

function calculateInstitutionalReadiness(
  archetype: EconomicArchetype,
  characteristics: CountryCharacteristics
): number {
  let score = 0;

  // Political stability
  score += characteristics.politicalStability * 0.3;

  // Infrastructure quality
  score += characteristics.infrastructureQuality * 0.3;

  // Human capital
  score += characteristics.humanCapitalIndex * 0.2;

  // Innovation capacity
  score += characteristics.innovationCapacity * 0.2;

  return score;
}

function calculateGeographicSuitability(
  archetype: EconomicArchetype,
  characteristics: CountryCharacteristics
): number {
  let score = 70; // Base score

  if (archetype.region.toLowerCase().includes(characteristics.region.toLowerCase())) {
    score += 30;
  }

  return Math.min(100, Math.max(0, score));
}

function calculateCompatibility(
  archetype: EconomicArchetype,
  characteristics: CountryCharacteristics
) {
  return {
    economic: calculateEconomicAlignment(archetype, characteristics),
    cultural: calculateCulturalFit(archetype, characteristics),
    institutional: calculateInstitutionalReadiness(archetype, characteristics),
    geographic: calculateGeographicSuitability(archetype, characteristics),
  };
}

function generateReasons(
  archetype: EconomicArchetype,
  characteristics: CountryCharacteristics
): string[] {
  const reasons: string[] = [];

  const compatibility = calculateCompatibility(archetype, characteristics);

  if (compatibility.economic > 70) {
    reasons.push("Strong economic alignment with current structure");
  }

  if (compatibility.institutional > 70) {
    reasons.push("High institutional readiness for implementation");
  }

  if (archetype.growthMetrics.stability > 85) {
    reasons.push("Provides high economic stability");
  }

  if (archetype.growthMetrics.innovationIndex > 85) {
    reasons.push("Fosters innovation and technological advancement");
  }

  return reasons.length > 0 ? reasons : ["General compatibility with country profile"];
}

function identifyBenefits(
  archetype: EconomicArchetype,
  characteristics: CountryCharacteristics
): string[] {
  return archetype.strengths.slice(0, 5);
}

function identifyChallenges(
  archetype: EconomicArchetype,
  characteristics: CountryCharacteristics
): string[] {
  return archetype.challenges.slice(0, 5);
}

function estimateTimeHorizon(
  archetype: EconomicArchetype,
  characteristics: CountryCharacteristics
): "short" | "medium" | "long" {
  const complexity = archetype.implementationComplexity;
  const readiness = calculateInstitutionalReadiness(archetype, characteristics);

  if (complexity === "low" && readiness > 70) return "short";
  if (complexity === "high" || readiness < 50) return "long";
  return "medium";
}

function determineRecommendationLevel(
  matchScore: number,
  compatibility: any
): "highly-recommended" | "recommended" | "consider" | "not-recommended" {
  if (matchScore >= 80) return "highly-recommended";
  if (matchScore >= 65) return "recommended";
  if (matchScore >= 50) return "consider";
  return "not-recommended";
}

function applyFocusAreaAdjustment(
  score: number,
  archetype: EconomicArchetype,
  focusArea: string
): number {
  const adjustments: Record<string, keyof typeof archetype.growthMetrics> = {
    growth: "gdpGrowth",
    stability: "stability",
    innovation: "innovationIndex",
    equity: "competitiveness",
  };

  const metric = adjustments[focusArea];
  if (metric) {
    const metricValue = archetype.growthMetrics[metric];
    score += (metricValue - 50) * 0.2;
  }

  return score;
}

function needsInfrastructureInvestment(
  archetype: EconomicArchetype,
  state: CountryCharacteristics
): boolean {
  return state.infrastructureQuality < 60 && archetype.implementationComplexity !== "low";
}

function needsEducationReform(
  archetype: EconomicArchetype,
  state: CountryCharacteristics
): boolean {
  return (
    state.humanCapitalIndex < 70 &&
    archetype.economicComponents.includes(EconomicComponentType.HIGH_SKILLED_WORKERS)
  );
}

function needsSectorRebalancing(
  archetype: EconomicArchetype,
  state: CountryCharacteristics
): boolean {
  const sectorDifference = Object.keys(archetype.sectorFocus).reduce((sum, sector) => {
    const current = state.sectorDistribution[sector] || 0;
    const target = archetype.sectorFocus[sector] || 0;
    return sum + Math.abs(current - target);
  }, 0);

  return sectorDifference > 30;
}

function requiresInnovationEcosystem(
  archetype: EconomicArchetype,
  state: CountryCharacteristics
): boolean {
  return (
    archetype.economicComponents.includes(EconomicComponentType.INNOVATION_ECONOMY) &&
    state.innovationCapacity < 60
  );
}

function calculateInfrastructureCost(
  archetype: EconomicArchetype,
  state: CountryCharacteristics,
  gdp: number
): number {
  const gap = Math.max(0, 80 - state.infrastructureQuality);
  return (gap / 100) * gdp * 0.15;
}

function calculateEducationCost(
  archetype: EconomicArchetype,
  state: CountryCharacteristics,
  gdp: number
): number {
  const gap = Math.max(0, 75 - state.humanCapitalIndex);
  return (gap / 100) * gdp * 0.08;
}

function calculateTechnologyCost(
  archetype: EconomicArchetype,
  state: CountryCharacteristics,
  gdp: number
): number {
  const gap = Math.max(0, 70 - state.innovationCapacity);
  return (gap / 100) * gdp * 0.1;
}

function calculateAdministrativeCost(
  archetype: EconomicArchetype,
  state: CountryCharacteristics,
  gdp: number
): number {
  return gdp * 0.03; // Fixed 3% for administrative costs
}

function calculateSocialCost(
  archetype: EconomicArchetype,
  state: CountryCharacteristics,
  gdp: number
): number {
  return gdp * 0.05; // Fixed 5% for social transition support
}

function generateFinancingOptions(totalCost: number, gdp: number): string[] {
  return [
    "Phased domestic budget allocation over 5-10 years",
    "International development bank loans with favorable terms",
    "Public-private partnerships for infrastructure projects",
    "Foreign direct investment incentives",
    "Green bonds and sustainable financing instruments",
    "Diaspora bonds and remittance-linked financing",
    "Technical assistance grants from development partners",
  ];
}

function estimateROITimeline(archetype: EconomicArchetype, state: CountryCharacteristics): number {
  const complexity =
    archetype.implementationComplexity === "high"
      ? 3
      : archetype.implementationComplexity === "medium"
        ? 2
        : 1;
  const readiness = state.politicalStability / 100;

  return Math.round(10 * complexity * (2 - readiness)); // Years to positive ROI
}

function calculateInstitutionalComplexity(
  archetype: EconomicArchetype,
  state: CountryCharacteristics
): number {
  return 100 - state.politicalStability;
}

function calculateEconomicComplexity(
  archetype: EconomicArchetype,
  state: CountryCharacteristics
): number {
  const componentGap = archetype.economicComponents.length - state.currentComponents.length;
  return Math.min(100, Math.max(0, 50 + componentGap * 5));
}

function calculateSocialComplexity(
  archetype: EconomicArchetype,
  state: CountryCharacteristics
): number {
  const culturalGap = archetype.culturalFactors.filter(
    (f) => !state.culturalFactors.some((sf) => sf.toLowerCase().includes(f.toLowerCase()))
  ).length;
  return Math.min(100, culturalGap * 10);
}

function calculateTechnicalComplexity(
  archetype: EconomicArchetype,
  state: CountryCharacteristics
): number {
  const innovationGap = 100 - state.innovationCapacity;
  const infrastructureGap = 100 - state.infrastructureQuality;
  return (innovationGap + infrastructureGap) / 2;
}

function generateMitigationStrategies(complexity: string, factors: any): string[] {
  const strategies: string[] = [
    "Establish strong project management office with clear accountability",
    "Secure early wins to build momentum and demonstrate success",
    "Maintain transparent communication with all stakeholders",
    "Build contingency buffers into timeline and budget",
  ];

  if (factors.institutional > 60) {
    strategies.push("Invest heavily in institutional capacity building");
    strategies.push("Engage international technical assistance");
  }

  if (factors.social > 60) {
    strategies.push("Implement comprehensive public engagement program");
    strategies.push("Provide generous transition support for affected workers");
  }

  if (factors.technical > 60) {
    strategies.push("Partner with leading technology providers");
    strategies.push("Accelerate skills development programs");
  }

  return strategies;
}
