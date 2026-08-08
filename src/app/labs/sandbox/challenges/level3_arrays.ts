/**
 * LEVEL 3: 7-Part Array Suite
 * 
 * Objective: Complete 7 core array operations used daily in IxStates full-stack development
 * 
 * 💡 CORE ARRAY CHEAT NOTES:
 * 1. Blueprint vs Data:
 *    - 'NationData' (PascalCase) = The TypeScript Interface Blueprint (0 bytes compiled).
 *    - 'allNations' (camelCase)  = The actual Array holding real objects in RAM
 * 2. No Extra Brackets:
 *    - '.filter()' and '.map()' ALREADY return fresh arrays by themselves
 *    - Never wrap them in extra brackets: write `return nations.filter(...)`, NOT `return [nations.filter(...)]`
 * 3. Implicit Booleans:
 *    - Comparisons like `nation.stability >= minStability` evaluate to `true` or `false` automatically
 *    - No `if/else` needed inside `.filter()`
 * 4. Destructuring is Optional:
 *    - Standard dot notation `(nation) => nation.stability` is 100% fine and standard
 *    - Destructuring `({ stability }) => stability` is just optional shorthand
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
 * Hint: return nations.find((n) => n.slug === targetSlug) || null;
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

/**
 * PART 3E: Array Sorting (.sort())
 * Return a NEW array sorted by GDP either "asc" (low-to-high) or "desc" (high-to-low).
 * 
 * Hint: Do NOT mutate original array! Use [...nations].sort((a, b) => direction === "asc" ? a.gdp - b.gdp : b.gdp - a.gdp);
 */
export function sortNationsByGdp(nations: NationData[], direction: "asc" | "desc"): NationData[] {
  // TODO: Immutably sort nations by GDP based on direction parameter
  return [];
}

/**
 * PART 3F: Array Validation (.some() & .every())
 * Return an object { allStable: boolean, anyCritical: boolean } where:
 * - allStable is true if EVERY nation has stability >= minStability
 * - anyCritical is true if AT LEAST ONE nation has stability < 60
 * 
 * Hint: const allStable = nations.every((n) => n.stability >= minStability);
 *       const anyCritical = nations.some((n) => n.stability < 60);
 *       return { allStable, anyCritical };
 */
export function checkAllianceSecurity(
  nations: NationData[],
  minStability: number
): { allStable: boolean; anyCritical: boolean } {
  // TODO: Use nations.every() and nations.some()
  return { allStable: false, anyCritical: false };
}

/**
 * PART 3G: Array Grouping (Group by Category)
 * Return an object grouping nations by alliance name: { [allianceName]: NationData[] }
 * Example output: { Concord: [Faneria, Caphiria, Kistan], Neutral: [Caracua] }
 * 
 * Hint: const groups: Record<string, NationData[]> = {};
 *       nations.forEach((n) => {
 *         if (!groups[n.alliance]) groups[n.alliance] = [];
 *         groups[n.alliance].push(n);
 *       });
 *       return groups;
 */
export function groupNationsByAlliance(nations: NationData[]): Record<string, NationData[]> {
  // TODO: Group nations array into an object by alliance name
  return {};
}
