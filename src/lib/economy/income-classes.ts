/**
 * Wealth figures derived at read time from `IncomeDistribution.economicClasses`, the only income
 * column the builder writes (`top10PercentWealth` and `middleClassPercent` have no writer).
 * Each class carries its share of the population and of the wealth, both in percent.
 */

interface IncomeClass {
  name: string;
  populationPercent: number;
  wealthPercent: number;
}

export interface IncomeShares {
  /** Share of wealth held by the richest 10% of people, in percent; null without classes. */
  top10WealthShare: number | null;
  /** Share of people in a class named "middle" (upper, lower or plain middle), in percent. */
  middleClassShare: number | null;
}

function parseClasses(raw: unknown): IncomeClass[] {
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((item: unknown) => {
    if (!item || typeof item !== "object") return [];
    const { name, populationPercent, wealthPercent } = item as Record<string, unknown>;
    return typeof name === "string" &&
      typeof populationPercent === "number" &&
      typeof wealthPercent === "number" &&
      populationPercent > 0 &&
      wealthPercent >= 0
      ? [{ name, populationPercent, wealthPercent }]
      : [];
  });
}

/** Richest first (wealth per head), taking people until 10% of the population is counted. */
function top10WealthShare(classes: IncomeClass[]): number | null {
  const population = classes.reduce((sum, c) => sum + c.populationPercent, 0);
  const wealth = classes.reduce((sum, c) => sum + c.wealthPercent, 0);
  if (population <= 0 || wealth <= 0) return null;
  const richestFirst = [...classes].sort(
    (a, b) => b.wealthPercent / b.populationPercent - a.wealthPercent / a.populationPercent
  );
  let peopleLeft = population * 0.1;
  let held = 0;
  for (const c of richestFirst) {
    if (peopleLeft <= 0) break;
    const taken = Math.min(peopleLeft, c.populationPercent);
    held += c.wealthPercent * (taken / c.populationPercent);
    peopleLeft -= taken;
  }
  return (held / wealth) * 100;
}

function middleClassShare(classes: IncomeClass[]): number | null {
  const population = classes.reduce((sum, c) => sum + c.populationPercent, 0);
  const middle = classes.filter((c) => /middle/i.test(c.name));
  if (population <= 0 || middle.length === 0) return null;
  return (middle.reduce((sum, c) => sum + c.populationPercent, 0) / population) * 100;
}

export function incomeSharesOf(economicClasses: unknown): IncomeShares {
  const classes = parseClasses(economicClasses);
  return {
    top10WealthShare: top10WealthShare(classes),
    middleClassShare: middleClassShare(classes),
  };
}
