/**
 * Types for the Demo Seed system.
 */

export interface SeedStats {
  meetings: number;
  policies: number;
  elections: number;
  diplomacy: number;
  intelligence: number;
  defense: number;
  nationalIssues: number;
  crisisEvents: number;
  social: number;
  economics: number;
  government: number;
  tax: number;
  geography: number;
  security: number;
  history: number;
  activityFeed: number;
  achievements: number;
  npcPersonality: number;
  total: number;
}

export function emptySeedStats(): SeedStats {
  return {
    meetings: 0,
    policies: 0,
    elections: 0,
    diplomacy: 0,
    intelligence: 0,
    defense: 0,
    nationalIssues: 0,
    crisisEvents: 0,
    social: 0,
    economics: 0,
    government: 0,
    tax: 0,
    geography: 0,
    security: 0,
    history: 0,
    activityFeed: 0,
    achievements: 0,
    npcPersonality: 0,
    total: 0,
  };
}

export function computeTotal(stats: SeedStats): number {
  const { total: _, ...rest } = stats;
  return Object.values(rest).reduce((a, b) => a + b, 0);
}
