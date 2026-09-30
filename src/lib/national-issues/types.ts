/**
 * National Issues shared types (country snapshot, consequences, evaluation result).
 */

export interface CountrySnapshot {
  // Identity
  id: string;
  name: string;
  leader: string | null;
  governmentType: string | null;
  economicTier: string;
  populationTier: string;
  continent: string | null;
  region: string | null;

  // Core economic
  currentPopulation: number;
  currentGdpPerCapita: number;
  currentTotalGdp: number;
  actualGdpGrowth: number;
  unemploymentRate: number;
  inflationRate: number;
  tradeBalance: number;

  // Fiscal
  taxRevenueGDPPercent: number;
  budgetDeficitSurplus: number;
  totalDebtGDPRatio: number;
  debtPerCapita: number;

  // Social
  publicApproval: number;
  povertyRate: number;
  incomeInequalityGini: number;
  lifeExpectancy: number;
  literacyRate: number;
  urbanPopulationPercent: number;
  infrastructureRating: number;

  // Government structure
  politicalStability: number;
  democracyIndex: number;
  governmentEffectiveness: number;
  ruleOfLaw: number;
  corruptionIndex: number;
  politicalPolarization: number;

  // Internal stability
  stabilityScore: number;
  crimeRate: number;
  protestFrequency: number;
  riotRisk: number;
  socialCohesion: number;
  ethnicTension: number;
  trustInGovernment: number;

  // Aggregate counts
  activeEmbassyCount: number;
  activeAllianceCount: number;
  activePolicyCount: number;
  pendingIssueCount: number;
  recentCrisisCount: number;
  activeTreatyCount: number;

  // Atomic components (gov/econ use enum names; tax uses frontend ids, e.g. "blockchain_ledger").
  // activeComponents = fully rolled out; implementingComponents = still in rollout phase.
  activeComponents: string[];
  implementingComponents: string[];
  // Civil service staffing — consumedStaff counts both active and implementing components.
  civilServiceCapacity: number;
  consumedStaff: number;

  // IxTime
  currentIxTime: number;
  currentIxYear: number;
  currentIxMonth: number;

  // Active policies & settings
  activePoliciesList: string[];
  policySettings: Record<string, Record<string, number>>;
  activeIntents: string[];
  activeIntentCategories: string[];

  // ── Grounded context (Phase 3, focused-first) — all optional; filled when the
  // ── country has the data. Absent → templates that reference them won't trigger.
  geo?: {
    isLandlocked: boolean;
    isIsland: boolean;
    dominantClimate: string | null;
    terrainRoughness: number | null;
    arableLandPercent: number;
    coastlineKm: number;
    neighborCount: number;
  };
  identity?: {
    capitalCity: string | null;
    largestCity: string | null;
    languages: string | null;
    religion: string | null;
  };
  party?: {
    name: string;
    ideology: string;
    support: number;
  };
  oppositionParty?: {
    name: string;
    ideology: string;
    support: number;
  };
  minister?: { name: string; title: string } | null;
  official?: { name: string; title: string } | null;
  labor?: {
    minimumWage: number | null;
    youthUnemploymentRate: number | null;
    informalEmploymentRate: number | null;
  };
  fiscal?: {
    salesTaxRate: number | null;
    corporateTaxRate: number | null;
  };
  economy?: {
    topSector: string | null;
    exportsGDPPercent: number | null;
    economicComplexity: number | null;
  };
  partners?: Array<{ name: string; band: string; strength: number }>;
  embassyPartners?: string[];
  worldEvents?: string[];
  crises?: string[];
  neighbors?: Array<{ name: string; countryId: string | null }>;
  activeIntentGoals?: string[];
}

export interface ConsequenceDefinition {
  targetModel: string;
  targetField: string;
  operation: "add" | "subtract" | "multiply" | "set";
  value: number;
  effectType?: "immediate" | "gradual";
  durationDays?: number;
}

export interface EvaluationResult {
  issuesGenerated: number;
  issuesSkippedCooldown: number;
  issuesSkippedMaxActive: number;
  templatesEvaluated: number;
  templatesPassed: number;
  executionTimeMs: number;
  errors: string[];
}
