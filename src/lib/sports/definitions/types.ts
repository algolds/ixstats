/**
 * SportDefinition Protocol (PRD §8, §9, §46, §49, Plan 322)
 * Pure, decoupled specification protocol governing terminology, period structure,
 * scoring semantics, and match surfaces across all supported sports.
 */

export interface SportTerminology {
  athlete: string; // "Player" | "Driver" | "Boxer"
  athletes: string; // "Players" | "Drivers"
  organization: string; // "Club" | "Constructor" | "Team"
  organizations: string; // "Clubs" | "Constructors" | "Teams"
  match: string; // "Match" | "Game" | "Grand Prix" | "Bout"
  matches: string; // "Matches" | "Games" | "Races" | "Bouts"
  scoringUnit: string; // "Goal" | "Point" | "Round"
  scoringUnitPlural: string; // "Goals" | "Points" | "Rounds"
  surfaceName: string; // "Pitch" | "Rink" | "Circuit" | "Court" | "Ring"
  headCoach: string; // "Manager" | "Head Coach" | "Team Principal" | "Trainer"
}

export interface SportPeriodConfig {
  count: number;
  periodName: string; // "Half" | "Period" | "Lap" | "Quarter" | "Inning" | "Round"
  periodNamePlural: string;
  periodLengthMinutes?: number;
  hasOvertime: boolean;
  overtimeName?: string;
  hasShootout?: boolean;
}

export interface SportScoringRules {
  winPoints: number;
  drawPoints: number;
  otLossPoints?: number; // e.g. 1 point for hockey OTL
  lossPoints: number;
  pointSystemDescription: string;
}

export interface SportRosterSlot {
  code: string;
  label: string;
  group: "offense" | "defense" | "goalkeeper" | "special" | "driver";
  isStarter: boolean;
}

export interface SportDefinition {
  id: string; // "soccer" | "hockey" | "f1" | "basketball" | "baseball" | "football" | "boxing"
  name: string;
  emoji: string;
  surfaceType: "pitch" | "rink" | "circuit" | "court" | "diamond" | "gridiron" | "ring";
  terminology: SportTerminology;
  periods: SportPeriodConfig;
  scoringRules: SportScoringRules;
  rosterSlots: SportRosterSlot[];
}
