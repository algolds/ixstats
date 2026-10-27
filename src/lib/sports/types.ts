export interface TeamRatingVector {
  overall: number;
  offense: number;
  defense: number;
  form: number;
  depth: number;
  coaching: number;
}

interface MatchResult {
  homeScore: number;
  awayScore: number;
  winner: "home" | "away" | "draw";
  upset: boolean;
  upsetFactor: number;
  keyStats: Record<string, number>;
  homeRatingDelta: number;
  awayRatingDelta: number;
}

export interface EventTraceStep {
  t: number;
  type: "goal" | "card" | "injury" | "tactic_shift";
  description: string;
  actorId?: string;
  actorName?: string;
  team: "home" | "away";
}

export interface PlayerRatings {
  overall?: number;
  offense?: number;
  defense?: number;
  stamina?: number;
  speed?: number;
  pace?: number;
  consistency?: number;
  wetSkill?: number;
  overtaking?: number;
  tyreManagement?: number;
  starts?: number;
  power?: number;
  technique?: number;
  chin?: number;
  heart?: number;
  cuts?: number;
  shooting?: number;
  playmaking?: number;
  rebounding?: number;
  skating?: number;
  goaltending?: number;
  hitting?: number;
  passing?: number;
  rushing?: number;
  catching?: number;
  tackling?: number;
  coverage?: number;
  kicking?: number;
  batting?: number;
  pitching?: number;
  fielding?: number;
  running?: number;
  form?: number;
  injuredUntil?: number;
  wins?: number;
  losses?: number;
  draws?: number;
  [key: string]: number | undefined;
}

export interface TeamSponsor {
  type?: string;
  name?: string;
  baseFee?: number;
  winBonus?: number;
  description?: string;
  tier?: "local" | "national" | "global";
  contractExpiresSeason?: number;
  [key: string]: unknown;
}

interface EvaluationVector {
  winProbability: number;
  dominance: number;
  tempo: number;
  volatility: number;
}

export interface ExtendedMatchResult extends MatchResult {
  evaluation: EvaluationVector;
  trace: EventTraceStep[];
}
