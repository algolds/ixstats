/**
 * LEVEL 3: Array Masterclass (.filter(), .map(), .find(), and Aggregation)
 * 
 * Objective: Complete 4 core array operations used daily in IxStates full-stack development!
 */

export interface NationData {
  slug: string;
  name: string;
  gdp: number;       // in billions
  stability: number; // 0 - 100
  alliance: string;  // e.g. "Concord", "Neutral"
}

export const allNations: NationData[] = [
  { slug: "faneria", name: "Faneria", gdp: 400, stability: 85, alliance: "Concord" },
  { slug: "caphiria", name: "Caphiria", gdp: 900, stability: 90, alliance: "Concord" },
  { slug: "caracua", name: "Caracua", gdp: 80, stability: 58, alliance: "Neutral" },
  { slug: "kistan", name: "Kistan", gdp: 320, stability: 92, alliance: "Concord" },
];

/**
 * PART 3A: Array Filtering (.filter())
 * Return only nations belonging to 'targetAlliance' with stability >= minStability.
 * 
 * Hint: return nations.filter((n) => n.alliance === targetAlliance && n.stability >= minStability);
 */
export function filterAllianceNations(
  nations: NationData[],
  targetAlliance: string,
  minStability: number
): NationData[] {
  // TODO: Use nations.filter() checking alliance and minStability
  return [];
}

/**
 * PART 3B: Array Transformation (.map())
 * Return an array of formatted summary strings: "NationName ($GDPB GDP)"
 * Example output: ["Faneria ($400B GDP)", "Caphiria ($900B GDP)", ...]
 * 
 * Hint: return nations.map((n) => `${n.name} ($${n.gdp}B GDP)`);
 */
export function formatNationSummaries(nations: NationData[]): string[] {
  // TODO: Use nations.map() to transform each nation object into a string
  return [];
}

/**
 * PART 3C: Array Search (.find())
 * Return the single nation object matching 'targetSlug', or null if not found.
 * 
 * Hint: const found = nations.find((n) => n.slug === targetSlug);
 *       return found || null;
 */
export function findNationBySlug(nations: NationData[], targetSlug: string): NationData | null {
  // TODO: Use nations.find() matching nation.slug === targetSlug
  return null;
}

/**
 * PART 3D: Array Aggregation (Total Sum)
 * Return the total combined GDP of all nations in the array.
 * 
 * Hint: let total = 0; nations.forEach(n => total += n.gdp); return total;
 *   OR: return nations.reduce((sum, n) => sum + n.gdp, 0);
 */
export function calculateTotalGdp(nations: NationData[]): number {
  // TODO: Return total sum of nation.gdp across all nations
  return 0;
}
