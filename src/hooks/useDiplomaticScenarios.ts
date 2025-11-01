/**
 * useDiplomaticScenarios Hook (Phase 7D)
 *
 * Provides database-backed diplomatic scenarios with fallback to hardcoded data.
 * Integrates with tRPC API for scenario management, choice tracking, and analytics.
 *
 * Features:
 * - Database query with 10-minute cache
 * - Automatic fallback to diplomatic-scenario-generator.ts
 * - JSON parsing for responseOptions, tags, and outcomeNotes fields
 * - Relevance scoring and filtering
 * - Usage tracking for analytics
 * - Warning system when using fallback data
 * - Support for comprehensive filtering (type, relationship level, difficulty, timeFrame)
 *
 * @module useDiplomaticScenarios
 */

import { useMemo } from "react";
import { api, type RouterOutputs } from "~/trpc/react";
import {
  DiplomaticScenarioGenerator,
  type DiplomaticScenario,
  type ScenarioType,
  type DifficultyLevel,
  type TimeFrame,
  type CountryData,
  type WorldContext,
} from "~/lib/diplomatic-scenario-generator";

/**
 * Scenario filters interface
 */
export interface ScenarioFilters {
  type?: ScenarioType;
  relationshipLevel?: "hostile" | "tense" | "neutral" | "friendly" | "allied";
  difficulty?: DifficultyLevel;
  timeFrame?: TimeFrame;
  isActive?: boolean;
  country1Id?: string;
  country2Id?: string;
}

/**
 * Parsed diplomatic scenario interface (database schema)
 */
export interface ParsedDiplomaticScenario {
  id: string;
  type: string;
  title: string;
  narrative: string;
  country1Id: string;
  country2Id: string;
  country1Name: string;
  country2Name: string;
  relationshipState: string;
  relationshipStrength: number;
  responseOptions: any[]; // Parsed from JSON
  tags: string[]; // Parsed from JSON
  culturalImpact: number;
  diplomaticRisk: number;
  economicCost: number;
  status: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date | null;
  chosenOption?: string | null;
  actualCulturalImpact?: number | null;
  actualDiplomaticImpact?: number | null;
  actualEconomicCost?: number | null;
  outcomeNotes?: any; // Parsed from JSON
}

type ScenarioResponse = RouterOutputs["diplomaticScenarios"]["getScenarioById"];

/**
 * useDiplomaticScenarios - Fetch diplomatic scenarios data
 *
 * Queries the database for diplomatic scenarios and falls back to hardcoded
 * data from diplomatic-scenario-generator.ts if the database is empty or unavailable.
 * Supports comprehensive filtering and automatic caching with 10-minute staleTime.
 *
 * All JSON fields are parsed from the database response:
 * - responseOptions: ScenarioChoice[] (choices with effects and outcomes)
 * - tags: string[] (scenario tags including type, difficulty, timeFrame)
 * - outcomeNotes: object | null (resolution metadata)
 *
 * NOTE: Falls back to hardcoded scenarios when database is empty. When CulturalScenario
 * model is populated in production, this hook will automatically use database data.
 *
 * @param {ScenarioFilters} [filters] - Filter scenarios by type, relationship level, difficulty, etc. (optional)
 * @returns {Object} Scenario data and loading state
 * @property {ParsedDiplomaticScenario[]} scenarios - List of diplomatic scenarios with parsed JSON fields
 * @property {boolean} isLoading - Loading state indicator
 * @property {any} error - Error object if query failed
 * @property {boolean} isUsingFallback - True if using hardcoded fallback data
 * @property {'database' | 'fallback'} dataSource - Data source indicator
 * @property {number} total - Total count of scenarios
 * @property {boolean} hasMore - Whether there are more items to load (pagination)
 * @property {(scenarioId: string) => void} incrementUsage - Track scenario view/engagement
 *
 * @example
 * ```tsx
 * function ScenarioList() {
 *   const { scenarios, isLoading, isUsingFallback, incrementUsage } =
 *     useDiplomaticScenarios({
 *       type: 'trade_renegotiation',
 *       difficulty: 'challenging',
 *       isActive: true,
 *     });
 *
 *   if (isLoading) return <Spinner />;
 *
 *   return (
 *     <>
 *       {isUsingFallback && <FallbackWarning />}
 *       <ScenarioGrid
 *         scenarios={scenarios}
 *         onView={(id) => incrementUsage(id)}
 *       />
 *     </>
 *   );
 * }
 * ```
 */
export function useDiplomaticScenarios(filters?: ScenarioFilters) {
  // ==================== DATABASE QUERY ====================
  const {
    data: dbResponse,
    isLoading,
    error,
  } = api.diplomaticScenarios.getAllScenarios.useQuery(
    {
      type: filters?.type as any,
      relationshipLevel: filters?.relationshipLevel,
      difficulty: filters?.difficulty,
      timeFrame: filters?.timeFrame,
      isActive: filters?.isActive ?? true,
      country1Id: filters?.country1Id,
      country2Id: filters?.country2Id,
      limit: 50,
      offset: 0,
    },
    {
      staleTime: 10 * 60 * 1000, // 10-minute cache
      enabled: true,
    }
  );

  // Extract scenarios from response
  const dbScenarios = dbResponse?.scenarios;
  const dbTotal = dbResponse?.total ?? 0;
  const dbHasMore = dbResponse?.hasMore ?? false;

  // ==================== USAGE TRACKING MUTATION ====================
  // Track scenario view/engagement for analytics
  const { mutate: incrementUsage } = api.diplomaticScenarios.incrementScenarioUsage.useMutation({
    onError: (err) => {
      console.warn("[useDiplomaticScenarios] Failed to track scenario usage:", err);
    },
  });

  // ==================== PROCESS SCENARIOS WITH FALLBACK ====================
  const { scenarios, total, hasMore, isUsingFallback, dataSource } = useMemo(() => {
    // Use database if available and not empty
    if (dbScenarios && dbScenarios.length > 0) {
      // Database scenarios already have JSON fields parsed by the router
      return {
        scenarios: dbScenarios as ParsedDiplomaticScenario[],
        total: dbTotal,
        hasMore: dbHasMore,
        isUsingFallback: false,
        dataSource: "database" as const,
      };
    }

    // Fallback to hardcoded data
    if (!isLoading) {
      console.warn(
        "[useDiplomaticScenarios] Database empty or unavailable, falling back to hardcoded scenarios"
      );
    }

    const fallbackScenarios = getFallbackScenarios(filters);

    return {
      scenarios: fallbackScenarios,
      total: fallbackScenarios.length,
      hasMore: false,
      isUsingFallback: true,
      dataSource: "fallback" as const,
    };
  }, [dbScenarios, dbTotal, dbHasMore, filters, isLoading]);

  // ==================== RETURN HOOK INTERFACE ====================
  return {
    scenarios,
    isLoading,
    error,
    isUsingFallback,
    dataSource,
    total,
    hasMore,
    incrementUsage: (scenarioId: string) => {
      incrementUsage({ scenarioId });
    },
  };
}

/**
 * Get fallback scenarios from hardcoded data
 *
 * Generates scenarios from DiplomaticScenarioGenerator, applies filters, and transforms
 * to the ParsedDiplomaticScenario interface for database compatibility.
 *
 * This ensures backward compatibility when database is unavailable.
 */
function getFallbackScenarios(filters?: ScenarioFilters): ParsedDiplomaticScenario[] {
  const generator = new DiplomaticScenarioGenerator();

  // Create mock world context for scenario generation
  const mockContext: WorldContext = {
    playerCountryId: filters?.country1Id || "mock-country-1",
    playerCountryName: "Player Country",
    embassies: [
      {
        id: "mock-embassy-1",
        hostCountryId: filters?.country2Id || "mock-country-2",
        guestCountryId: filters?.country1Id || "mock-country-1",
        level: 3,
        status: "active",
        influence: 50,
        reputation: 60,
        specialization: "trade",
      },
    ],
    relationships: [
      {
        country1: filters?.country1Id || "mock-country-1",
        country2: filters?.country2Id || "mock-country-2",
        relationship: filters?.relationshipLevel || "neutral",
        strength: 50,
        status: "active",
      },
    ],
    treaties: [],
    recentMissions: [],
    diplomaticHistory: [],
    economicData: {
      playerGDP: 500000000000,
      playerTier: "developed",
    },
  };

  // Create mock countries
  const mockCountries: CountryData[] = [
    {
      id: filters?.country2Id || "mock-country-2",
      name: "Target Country",
      economicTier: "developing",
      region: "Global",
      governmentType: "Democracy",
    },
  ];

  // Generate scenarios using the generator
  const generatedScenarios = generator.generateScenarios(mockContext, mockCountries, 10);

  // Transform to database schema format
  const transformedScenarios: ParsedDiplomaticScenario[] = generatedScenarios.map(
    (scenario, index) => {
      // Map difficulty from metadata
      const difficulty = scenario.difficulty;
      const timeFrame = scenario.timeFrame;

      return {
        id: scenario.id,
        type: scenario.type,
        title: scenario.title,
        narrative: scenario.narrative.introduction + " " + scenario.narrative.situation,
        country1Id: mockContext.playerCountryId,
        country2Id: scenario.involvedCountries.primary,
        country1Name: mockContext.playerCountryName,
        country2Name: mockCountries[0]?.name || "Target Country",
        relationshipState: filters?.relationshipLevel || "neutral",
        relationshipStrength: 50,
        responseOptions: scenario.choices.map((choice) => ({
          id: choice.id,
          label: choice.label,
          description: choice.description,
          skillRequired: choice.skillRequired,
          skillLevel: choice.skillLevel,
          riskLevel: choice.riskLevel,
          effects: choice.effects,
          predictedOutcomes: choice.predictedOutcomes,
        })),
        tags: [scenario.type, difficulty, timeFrame],
        culturalImpact: Math.floor(Math.random() * 50) + 30, // 30-80 range
        diplomaticRisk: Math.floor(Math.random() * 50) + 30, // 30-80 range
        economicCost: Math.floor(Math.random() * 40) + 20, // 20-60 range
        status: "active",
        expiresAt: scenario.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
  );

  // Apply filters
  let filtered = transformedScenarios;

  if (filters?.type) {
    filtered = filtered.filter((s) => s.type === filters.type);
  }

  if (filters?.difficulty) {
    filtered = filtered.filter((s) => s.tags.includes(filters.difficulty!));
  }

  if (filters?.timeFrame) {
    filtered = filtered.filter((s) => s.tags.includes(filters.timeFrame!));
  }

  if (filters?.relationshipLevel) {
    filtered = filtered.filter((s) => s.relationshipState === filters.relationshipLevel);
  }

  if (filters?.isActive === true) {
    filtered = filtered.filter((s) => s.status === "active" && s.expiresAt.getTime() > Date.now());
  }

  return filtered;
}

/**
 * Get single scenario by ID
 *
 * Retrieves a specific scenario with full details including parsed choices.
 * Falls back to fallback scenarios if database query returns null.
 *
 * @param {string} scenarioId - Scenario ID (CUID)
 * @returns {Object} Scenario data and loading state
 */
export function useScenarioById(scenarioId: string) {
  const {
    data: dbScenario,
    isLoading,
    error,
  } = api.diplomaticScenarios.getScenarioById.useQuery(
    { id: scenarioId },
    {
      staleTime: 10 * 60 * 1000, // 10-minute cache
      enabled: !!scenarioId,
    }
  );

  // Fallback if database returns null
  const scenario = useMemo(() => {
    if (dbScenario) {
      const scenario: ScenarioResponse = dbScenario;
      const country1Name =
        (scenario as Partial<ParsedDiplomaticScenario>).country1Name ?? "";
      const country2Name =
        (scenario as Partial<ParsedDiplomaticScenario>).country2Name ?? "";
      const updatedAt =
        (scenario as Partial<ParsedDiplomaticScenario>).updatedAt ?? scenario.createdAt;

      return {
        id: scenario.id,
        type: scenario.type,
        title: scenario.title,
        narrative: scenario.narrative,
        country1Id: scenario.country1Id,
        country2Id: scenario.country2Id,
        country1Name,
        country2Name,
        relationshipState: scenario.relationshipState,
        relationshipStrength: scenario.relationshipStrength,
        responseOptions: Array.isArray(scenario.responseOptions)
          ? scenario.responseOptions
          : [],
        tags: Array.isArray(scenario.tags) ? scenario.tags : [],
        culturalImpact: scenario.culturalImpact,
        diplomaticRisk: scenario.diplomaticRisk,
        economicCost: scenario.economicCost,
        status: scenario.status,
        expiresAt: scenario.expiresAt,
        createdAt: scenario.createdAt,
        updatedAt,
        resolvedAt: scenario.resolvedAt ?? null,
        chosenOption: scenario.chosenOption ?? null,
        actualCulturalImpact: scenario.actualCulturalImpact ?? null,
        actualDiplomaticImpact: scenario.actualDiplomaticImpact ?? null,
        actualEconomicCost: scenario.actualEconomicCost ?? null,
        outcomeNotes: scenario.outcomeNotes ?? null,
      } satisfies ParsedDiplomaticScenario;
    }

    // Check fallback scenarios
    if (!isLoading && scenarioId.startsWith("scenario_")) {
      console.warn("[useScenarioById] Scenario not found in database, checking fallback");
      const fallbackScenarios = getFallbackScenarios();
      return fallbackScenarios.find((s) => s.id === scenarioId) || null;
    }

    return null;
  }, [dbScenario, scenarioId, isLoading]);

  return {
    scenario,
    isLoading,
    error,
    isUsingFallback: !dbScenario && !!scenario,
  };
}

/**
 * Generate new scenario dynamically based on world context
 *
 * Creates a new scenario for the specified countries and saves it to the database.
 * Returns the generated scenario with full details.
 *
 * @param {string} countryId - Initiating country ID
 * @param {string} [targetCountryId] - Target country ID (optional, will select randomly if not provided)
 * @returns {Object} Mutation data and state
 */
export function useScenarioGeneration(countryId: string, targetCountryId?: string) {
  const {
    mutate: generateScenario,
    isPending,
    error,
    data,
  } = api.diplomaticScenarios.generateScenario.useMutation({
    onSuccess: (result) => {
      console.log("[useScenarioGeneration] Generated scenario:", result.scenario.title);
    },
    onError: (err) => {
      console.error("[useScenarioGeneration] Failed to generate scenario:", err);
    },
  });

  const generate = (options?: {
    scenarioType?: ScenarioType;
    difficulty?: DifficultyLevel;
    timeFrame?: TimeFrame;
  }) => {
    generateScenario({
      countryId,
      targetCountryId,
      scenarioType: options?.scenarioType,
      difficulty: options?.difficulty,
      timeFrame: options?.timeFrame,
    });
  };

  return {
    generate,
    isGenerating: isPending,
    error,
    generatedScenario: data?.scenario,
    success: data?.success,
  };
}

/**
 * Get player's scenario history
 *
 * Retrieves all completed scenarios for a specific country with pagination support.
 * Includes full outcome data and choice information.
 *
 * @param {string} countryId - Country ID
 * @param {Object} [options] - Pagination options
 * @returns {Object} History data and loading state
 */
export function useScenarioHistory(
  countryId: string,
  options?: {
    limit?: number;
    offset?: number;
  }
) {
  const { data, isLoading, error } = api.diplomaticScenarios.getPlayerScenarioHistory.useQuery(
    {
      countryId,
      limit: options?.limit ?? 20,
      offset: options?.offset ?? 0,
    },
    {
      staleTime: 5 * 60 * 1000, // 5-minute cache
      enabled: !!countryId,
    }
  );

  // Fallback to empty history if database unavailable
  const history = useMemo(() => {
    if (data?.scenarios) {
      return data.scenarios as ParsedDiplomaticScenario[];
    }

    if (!isLoading) {
      console.warn("[useScenarioHistory] No history found in database");
    }

    return [];
  }, [data, isLoading]);

  return {
    history,
    isLoading,
    error,
    total: data?.total ?? 0,
    hasMore: data?.hasMore ?? false,
  };
}

/**
 * Get active scenarios for country
 *
 * Retrieves all unexpired active scenarios involving a specific country.
 * Useful for displaying urgent diplomatic situations requiring decisions.
 *
 * @param {string} countryId - Country ID
 * @returns {Object} Active scenarios and loading state
 */
export function useActiveScenarios(countryId: string) {
  const { data, isLoading, error } = api.diplomaticScenarios.getActiveScenarios.useQuery(
    { countryId },
    {
      staleTime: 2 * 60 * 1000, // 2-minute cache (more frequent updates for active scenarios)
      enabled: !!countryId,
    }
  );

  const scenarios = useMemo(() => {
    if (data && data.length > 0) {
      return data as ParsedDiplomaticScenario[];
    }

    // Fallback: generate mock active scenarios
    if (!isLoading) {
      console.warn("[useActiveScenarios] No active scenarios in database, using fallback");
      return getFallbackScenarios({ isActive: true, country1Id: countryId }).slice(0, 3);
    }

    return [];
  }, [data, countryId, isLoading]);

  return {
    scenarios,
    isLoading,
    error,
    count: scenarios.length,
    isUsingFallback: !data && scenarios.length > 0,
  };
}

/**
 * Record player choice for scenario
 *
 * Submits a choice for a diplomatic scenario and updates the database.
 * Returns the outcome effects and updated scenario state.
 *
 * @returns {Object} Mutation data and state
 */
export function useRecordChoice() {
  const {
    mutate: recordChoice,
    isPending,
    error,
    data,
  } = api.diplomaticScenarios.recordChoice.useMutation({
    onSuccess: (result) => {
      console.log("[useRecordChoice] Recorded choice for scenario:", result.scenario.title);
    },
    onError: (err) => {
      console.error("[useRecordChoice] Failed to record choice:", err);
    },
  });

  return {
    recordChoice,
    isRecording: isPending,
    error,
    scenario: data?.scenario,
    effects: data?.effects,
    success: data?.success,
  };
}

/**
 * Get scenario choice outcomes preview
 *
 * Retrieves predicted outcomes for a specific choice without submitting it.
 * Useful for showing players the consequences before making decisions.
 *
 * @param {string} scenarioId - Scenario ID
 * @param {string} choiceId - Choice ID
 * @returns {Object} Choice outcomes and loading state
 */
export function useChoiceOutcomes(scenarioId: string, choiceId: string) {
  const { data, isLoading, error } = api.diplomaticScenarios.getChoiceOutcomes.useQuery(
    { scenarioId, choiceId },
    {
      staleTime: 10 * 60 * 1000, // 10-minute cache
      enabled: !!(scenarioId && choiceId),
    }
  );

  return {
    outcomes: data,
    isLoading,
    error,
  };
}

/**
 * Calculate relevance score for scenario
 *
 * Computes how relevant a scenario is for a specific country based on
 * relationship strength, embassy presence, urgency, and impact.
 *
 * @param {string} scenarioId - Scenario ID
 * @param {string} countryId - Country ID
 * @returns {Object} Relevance score and loading state
 */
export function useScenarioRelevance(scenarioId: string, countryId: string) {
  const { data, isLoading, error } = api.diplomaticScenarios.calculateRelevance.useQuery(
    { scenarioId, countryId },
    {
      staleTime: 5 * 60 * 1000, // 5-minute cache
      enabled: !!(scenarioId && countryId),
    }
  );

  return {
    relevanceScore: data?.relevanceScore ?? 0,
    factors: data?.factors,
    isLoading,
    error,
  };
}

/**
 * Get scenarios grouped by type
 *
 * Retrieves all scenarios organized by type (trade, cultural, military, etc.).
 * Useful for categorized displays and analytics.
 *
 * @param {Object} [options] - Query options
 * @returns {Object} Grouped scenarios and loading state
 */
export function useScenariosByType(options?: { isActive?: boolean; country1Id?: string }) {
  const { data, isLoading, error } = api.diplomaticScenarios.getScenariosByType.useQuery(
    {
      isActive: options?.isActive ?? true,
      country1Id: options?.country1Id,
    },
    {
      staleTime: 10 * 60 * 1000, // 10-minute cache
      enabled: true,
    }
  );

  return {
    scenariosByType: data || {},
    isLoading,
    error,
  };
}
