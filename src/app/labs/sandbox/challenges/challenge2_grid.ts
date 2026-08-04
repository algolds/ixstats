/**
 * CHALLENGE 2: Object Array Grid Renderer
 * 
 * Objective: Export an array named 'nations' containing 3 country objects (name, gdp, stability),
 * and a function named 'formatNationCard' that formats a country object into a display string.
 */

export interface NationObject {
  name: string;
  gdp: number;
  stability: number;
}

export const nations: NationObject[] = [
  // TODO: Add 3 country objects here (e.g. { name: "Faneria", gdp: 450, stability: 85 })
];

export function formatNationCard(nation: NationObject): string {
  // TODO: Return a formatted string: `${nation.name} - GDP: $${nation.gdp}B (Stability: ${nation.stability}%)`
  return "";
}
