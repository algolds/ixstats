/**
 * AtomicBuilderStateManager - Centralized state management for atomic component selection
 * Phase 2: Atomic Components Native Builder Experience
 */

import { ComponentType } from "~/lib/enums";

interface SynergyRule {
  id: string;
  components: ComponentType[];
  type: "effectiveness_boost" | "cost_reduction" | "special_ability";
  modifier: number;
  description: string;
}

interface ConflictRule {
  id: string;
  components: ComponentType[];
  penalty: number;
  description: string;
  severity: "minor" | "major" | "critical";
}

// Synergy definitions based on component combinations
export const SYNERGY_RULES: SynergyRule[] = [
  {
    id: "tech_professional",
    components: [ComponentType.TECHNOCRATIC_PROCESS, ComponentType.PROFESSIONAL_BUREAUCRACY],
    type: "effectiveness_boost",
    modifier: 1.25,
    description:
      "Technocratic decisions combined with professional implementation create superior policy outcomes",
  },
  {
    id: "rule_judiciary",
    components: [ComponentType.RULE_OF_LAW, ComponentType.INDEPENDENT_JUDICIARY],
    type: "effectiveness_boost",
    modifier: 1.2,
    description:
      "Strong legal framework with independent courts maximizes institutional credibility",
  },
  {
    id: "democratic_electoral",
    components: [ComponentType.DEMOCRATIC_PROCESS, ComponentType.ELECTORAL_LEGITIMACY],
    type: "effectiveness_boost",
    modifier: 1.15,
    description: "Democratic processes backed by electoral mandate enhance legitimacy",
  },
  {
    id: "federal_democratic",
    components: [ComponentType.FEDERAL_SYSTEM, ComponentType.DEMOCRATIC_PROCESS],
    type: "effectiveness_boost",
    modifier: 1.18,
    description: "Federal structure enables better democratic representation and local autonomy",
  },
  {
    id: "performance_tech",
    components: [ComponentType.PERFORMANCE_LEGITIMACY, ComponentType.TECHNOCRATIC_AGENCIES],
    type: "effectiveness_boost",
    modifier: 1.22,
    description:
      "Performance-based legitimacy with technical expertise delivers exceptional results",
  },
];

// Conflict definitions - components that work poorly together
export const CONFLICT_RULES: ConflictRule[] = [
  {
    id: "surveillance_democratic",
    components: [ComponentType.SURVEILLANCE_SYSTEM, ComponentType.DEMOCRATIC_PROCESS],
    penalty: 0.15,
    description: "Extensive surveillance undermines democratic participation and civil liberties",
    severity: "major",
  },
  {
    id: "autocratic_electoral",
    components: [ComponentType.AUTOCRATIC_PROCESS, ComponentType.ELECTORAL_LEGITIMACY],
    penalty: 0.2,
    description: "Autocratic decision-making contradicts electoral mandate principles",
    severity: "critical",
  },
  {
    id: "military_civilian",
    components: [ComponentType.MILITARY_ADMINISTRATION, ComponentType.INDEPENDENT_JUDICIARY],
    penalty: 0.12,
    description: "Military control of administration can undermine judicial independence",
    severity: "major",
  },
  {
    id: "centralized_federal",
    components: [ComponentType.CENTRALIZED_POWER, ComponentType.FEDERAL_SYSTEM],
    penalty: 0.1,
    description: "Centralized power structure conflicts with federal power-sharing principles",
    severity: "minor",
  },
];
