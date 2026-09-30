/**
 * Player-facing wording for directive / issue consequences (targetField keys → English).
 * Pure module: safe to import from client components and server code alike.
 */

export const CONSEQUENCE_FIELD_LABELS: Record<string, string> = {
  // Country
  publicApproval: "Public Approval",
  unemploymentRate: "Unemployment",
  inflationRate: "Inflation",
  infrastructureRating: "Infrastructure",
  tradeBalance: "Trade Balance",
  povertyRate: "Poverty Rate",
  incomeInequalityGini: "Income Inequality",
  taxRevenueGDPPercent: "Tax Revenue (% of GDP)",
  budgetDeficitSurplus: "Budget Balance",
  totalDebtGDPRatio: "Debt-to-GDP Ratio",
  economicVitality: "Economic Vitality",
  populationWellbeing: "Population Wellbeing",
  diplomaticStanding: "Diplomatic Standing",
  governmentalEfficiency: "Governmental Efficiency",
  overallNationalHealth: "National Health",
  actualGdpGrowth: "GDP Growth",
  currentTotalGdp: "GDP",
  currentGdpPerCapita: "GDP per Capita",
  currentPopulation: "Population",
  // GovernmentStructure
  politicalStability: "Political Stability",
  democracyIndex: "Democracy Index",
  governmentEffectiveness: "Government Effectiveness",
  ruleOfLaw: "Rule of Law",
  corruptionIndex: "Corruption",
  politicalPolarization: "Political Polarization",
  // InternalStabilityMetrics
  stabilityScore: "Stability",
  crimeRate: "Crime Rate",
  protestFrequency: "Protest Frequency",
  riotRisk: "Riot Risk",
  socialCohesion: "Social Cohesion",
  ethnicTension: "Ethnic Tension",
  trustInGovernment: "Trust in Government",
  trustInPolice: "Trust in Police",
  fearOfCrime: "Fear of Crime",
  civilDisobedience: "Civil Disobedience",
  policingEffectiveness: "Policing Effectiveness",
  justiceSystemEfficiency: "Justice System Efficiency",
};

/** Fields where a decrease is the good outcome. */
const LOWER_IS_BETTER = new Set([
  "unemploymentRate",
  "inflationRate",
  "povertyRate",
  "incomeInequalityGini",
  "totalDebtGDPRatio",
  "corruptionIndex",
  "politicalPolarization",
  "crimeRate",
  "protestFrequency",
  "riotRisk",
  "ethnicTension",
  "fearOfCrime",
  "civilDisobedience",
]);

/** "unemploymentRate" → "Unemployment"; unknown keys become "Sentence case" words. */
export function consequenceFieldLabel(field: string): string {
  const known = CONSEQUENCE_FIELD_LABELS[field];
  if (known) return known;
  const words = field
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export interface ConsequenceLike {
  targetField: string;
  operation: "add" | "subtract" | "multiply" | "set";
  value: number;
}

/**
 * A consequence as a badge: signed amount, English label, and whether it is good for the
 * nation (a falling unemployment rate is good even though the number goes down).
 */
export function describeConsequenceBadge(c: ConsequenceLike): {
  text: string;
  favorable: boolean;
} {
  const label = consequenceFieldLabel(c.targetField);
  if (c.operation === "set") return { text: `${label} set to ${c.value}`, favorable: true };
  if (c.operation === "multiply") {
    const pct = Math.round((c.value - 1) * 1000) / 10;
    const rises = pct >= 0;
    return {
      text: `${label} ${rises ? "+" : ""}${pct}%`,
      favorable: rises !== LOWER_IS_BETTER.has(c.targetField),
    };
  }
  const signed = c.operation === "subtract" ? -c.value : c.value;
  const rises = signed >= 0;
  return {
    text: `${label} ${rises ? "+" : "−"}${Math.abs(signed)}`,
    favorable: rises !== LOWER_IS_BETTER.has(c.targetField),
  };
}
