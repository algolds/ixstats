/**
 * LEVEL 3: Arrays & Iteration (.filter())
 * 
 * Objective: Export an array of nation objects named 'allNations', and a function named
 * 'filterHighStabilityNations' that returns only nations with stability >= minStability.
 */

export interface NationData {
  name: string;
  gdp: number;
  stability: number;
}

export const allNations: NationData[] = [
  // TODO: Add 3 country objects (e.g. { name: "Faneria", gdp: 450, stability: 85 })
];

export function filterHighStabilityNations(nations: NationData[], minStability: number): NationData[] {
  // TODO: Use nations.filter() to return nations with stability >= minStability
  return [];
}
