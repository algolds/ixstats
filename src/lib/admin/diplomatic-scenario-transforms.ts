/**
 * Pure transforms, constants, and utilities for Diplomatic Scenarios admin
 */

import {
  AlertTriangle,
  TrendingUp,
  Globe,
  Shield,
  Target,
  DollarSign,
  Zap,
  FileText,
} from "lucide-react";

export const SCENARIO_TYPES = [
  { value: "border_dispute", label: "Border Dispute", icon: AlertTriangle },
  { value: "trade_renegotiation", label: "Trade Renegotiation", icon: TrendingUp },
  { value: "cultural_misunderstanding", label: "Cultural Misunderstanding", icon: Globe },
  { value: "intelligence_breach", label: "Intelligence Breach", icon: Shield },
  { value: "humanitarian_crisis", label: "Humanitarian Crisis", icon: AlertTriangle },
  { value: "alliance_pressure", label: "Alliance Pressure", icon: Target },
  { value: "economic_sanctions_debate", label: "Economic Sanctions Debate", icon: DollarSign },
  { value: "technology_transfer_request", label: "Technology Transfer Request", icon: Zap },
  { value: "diplomatic_incident", label: "Diplomatic Incident", icon: AlertTriangle },
  { value: "mediation_opportunity", label: "Mediation Opportunity", icon: Globe },
  { value: "embassy_security_threat", label: "Embassy Security Threat", icon: Shield },
  { value: "treaty_renewal", label: "Treaty Renewal", icon: FileText },
];

export const RELATIONSHIP_LEVELS = [
  { value: "hostile", label: "Hostile", color: "text-red-400" },
  { value: "tense", label: "Tense", color: "text-orange-400" },
  { value: "neutral", label: "Neutral", color: "text-gray-400" },
  { value: "friendly", label: "Friendly", color: "text-green-400" },
  { value: "allied", label: "Allied", color: "text-blue-400" },
];

export const DIFFICULTY_LEVELS = [
  { value: "trivial", label: "Trivial", color: "text-gray-400" },
  { value: "moderate", label: "Moderate", color: "text-blue-400" },
  { value: "challenging", label: "Challenging", color: "text-yellow-400" },
  { value: "critical", label: "Critical", color: "text-orange-400" },
  { value: "legendary", label: "Legendary", color: "text-purple-400" },
];

export const TIME_FRAMES = [
  { value: "urgent", label: "Urgent (3 days)", duration: 3 },
  { value: "time_sensitive", label: "Time Sensitive (1 week)", duration: 7 },
  { value: "strategic", label: "Strategic (2 weeks)", duration: 14 },
  { value: "long_term", label: "Long Term (1 month)", duration: 30 },
];

export const RISK_LEVELS = [
  { value: "low", label: "Low Risk", color: "text-green-400" },
  { value: "medium", label: "Medium Risk", color: "text-yellow-400" },
  { value: "high", label: "High Risk", color: "text-orange-400" },
  { value: "extreme", label: "Extreme Risk", color: "text-red-400" },
];

export interface ScenarioFormData {
  type: string;
  title: string;
  narrative: string;
  relationshipState: string;
  relationshipStrength: number;
  culturalImpact: number;
  diplomaticRisk: number;
  economicCost: number;
  timeFrame: string;
  difficulty: string;
  status: string;
  country1Id: string;
  country2Id: string;
}

export interface ChoiceFormData {
  id: string;
  label: string;
  description: string;
  skillRequired: string;
  skillLevel: number;
  riskLevel: string;
  effects: Record<string, any>;
  predictedOutcomes: Record<string, any>;
}

export function defaultScenarioFormData(): ScenarioFormData {
  return {
    type: "diplomatic_incident",
    title: "",
    narrative: "",
    relationshipState: "neutral",
    relationshipStrength: 50,
    culturalImpact: 50,
    diplomaticRisk: 50,
    economicCost: 30,
    timeFrame: "strategic",
    difficulty: "moderate",
    status: "active",
    country1Id: "",
    country2Id: "",
  };
}

export function defaultChoiceFormData(): ChoiceFormData {
  return {
    id: "",
    label: "",
    description: "",
    skillRequired: "diplomacy",
    skillLevel: 50,
    riskLevel: "medium",
    effects: {},
    predictedOutcomes: {},
  };
}

export function calculateScenarioExpiry(timeFrame: string, now: Date = new Date()): Date {
  const timeFrameData = TIME_FRAMES.find((t) => t.value === timeFrame);
  const expiresAt = new Date(now.getTime());
  expiresAt.setDate(expiresAt.getDate() + (timeFrameData?.duration || 14));
  return expiresAt;
}

export function extractTagsFromScenario(scenario: any): { difficulty: string; timeFrame: string } {
  const tags = Array.isArray(scenario?.tags) ? scenario.tags : [];
  const difficulty =
    tags.find((t: string) =>
      ["trivial", "moderate", "challenging", "critical", "legendary"].includes(t)
    ) || "moderate";
  const timeFrame =
    tags.find((t: string) =>
      ["urgent", "time_sensitive", "strategic", "long_term"].includes(t)
    ) || "strategic";

  return { difficulty, timeFrame };
}

export function scenarioToFormData(scenario: any): {
  formData: ScenarioFormData;
  responseOptions: ChoiceFormData[];
} {
  const { difficulty, timeFrame } = extractTagsFromScenario(scenario);

  return {
    formData: {
      type: scenario.type || "diplomatic_incident",
      title: scenario.title || "",
      narrative: scenario.narrative || "",
      relationshipState: scenario.relationshipState || "neutral",
      relationshipStrength: scenario.relationshipStrength ?? 50,
      culturalImpact: scenario.culturalImpact ?? 50,
      diplomaticRisk: scenario.diplomaticRisk ?? 50,
      economicCost: scenario.economicCost ?? 30,
      timeFrame,
      difficulty,
      status: scenario.status || "active",
      country1Id: scenario.country1Id || "",
      country2Id: scenario.country2Id || "",
    },
    responseOptions: Array.isArray(scenario.responseOptions) ? [...scenario.responseOptions] : [],
  };
}

export function scenarioToCloneFormData(
  scenario: any,
  idFactory: (baseId: string) => string = (baseId) => `${baseId}_copy_${Date.now()}`
): {
  formData: ScenarioFormData;
  responseOptions: ChoiceFormData[];
} {
  const { formData, responseOptions } = scenarioToFormData(scenario);

  return {
    formData: {
      ...formData,
      title: `${formData.title} (Copy)`,
      status: "active",
    },
    responseOptions: responseOptions.map((opt) => ({
      ...opt,
      id: idFactory(opt.id || "choice"),
    })),
  };
}

export function filterDiplomaticScenarios(
  scenarios: any[] | undefined,
  relationshipFilter: string[],
  difficultyFilter: string[],
  timeFrameFilter: string[]
): any[] {
  if (!scenarios) return [];

  return scenarios.filter((scenario) => {
    // Relationship filter
    if (
      relationshipFilter.length > 0 &&
      !relationshipFilter.includes(scenario.relationshipState)
    ) {
      return false;
    }

    // Difficulty filter (stored in tags)
    if (difficultyFilter.length > 0) {
      const tags = Array.isArray(scenario.tags) ? scenario.tags : [];
      if (!difficultyFilter.some((d) => tags.includes(d))) {
        return false;
      }
    }

    // Time frame filter (stored in tags)
    if (timeFrameFilter.length > 0) {
      const tags = Array.isArray(scenario.tags) ? scenario.tags : [];
      if (!timeFrameFilter.some((t) => tags.includes(t))) {
        return false;
      }
    }

    return true;
  });
}
