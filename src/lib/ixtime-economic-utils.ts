// src/lib/ixtime-economic-utils.ts
import { IxTime } from "./ixtime";
import type { CoreEconomicIndicatorsData, EconomyData } from "~/types/economics";

/**
 * Calculate economic growth over time using IxTime
 * Growth compounds annually based on the 4x time acceleration
 */
export function calculateEconomicGrowth(
  baseValue: number,
  annualGrowthRate: number, // as decimal (0.03 for 3%)
  startIxTime: number,
  endIxTime: number
): number {
  const yearsElapsed = IxTime.getYearsElapsed(startIxTime, endIxTime);

  // Compound annual growth formula: FV = PV * (1 + r)^t
  return baseValue * Math.pow(1 + annualGrowthRate, yearsElapsed);
}

/**
 * Calculate population growth over time
 */
export function calculatePopulationGrowth(
  basePopulation: number,
  annualGrowthRate: number, // as decimal
  startIxTime: number,
  endIxTime: number
): number {
  const yearsElapsed = IxTime.getYearsElapsed(startIxTime, endIxTime);

  // Population growth with reasonable bounds
  const growth = Math.pow(1 + annualGrowthRate, yearsElapsed);
  const newPopulation = basePopulation * growth;

  // Sanity check - population shouldn't grow/shrink too dramatically
  const maxGrowthFactor = Math.pow(1.05, yearsElapsed); // Max 5% per year
  const minGrowthFactor = Math.pow(0.95, yearsElapsed); // Max 5% decline per year

  return Math.max(
    basePopulation * minGrowthFactor,
    Math.min(basePopulation * maxGrowthFactor, newPopulation)
  );
}

/**
 * Project economic indicators forward in time
 */
export function projectEconomicIndicators(
  baseIndicators: CoreEconomicIndicatorsData,
  populationGrowthRate: number, // as decimal
  targetIxTime: number
): CoreEconomicIndicatorsData {
  const currentIxTime = IxTime.getCurrentIxTime();
  const yearsToProject = IxTime.getYearsElapsed(currentIxTime, targetIxTime);

  // If projecting backwards or no time has passed, return base
  if (yearsToProject <= 0) {
    return { ...baseIndicators };
  }

  // Calculate new population
  const newPopulation = calculatePopulationGrowth(
    baseIndicators.totalPopulation,
    populationGrowthRate,
    currentIxTime,
    targetIxTime
  );

  // Calculate new GDP (total economy grows)
  const newNominalGDP = calculateEconomicGrowth(
    baseIndicators.nominalGDP,
    baseIndicators.realGDPGrowthRate,
    currentIxTime,
    targetIxTime
  );

  // GDP per capita adjusts based on population changes
  const newGDPPerCapita = newNominalGDP / newPopulation;

  // Inflation compounds over time
  const cumulativeInflation = Math.pow(1 + baseIndicators.inflationRate, yearsToProject);

  // Exchange rate may drift based on economic performance
  const gdpGrowthFactor = newNominalGDP / baseIndicators.nominalGDP;
  const exchangeRateDrift =
    gdpGrowthFactor > 1.5
      ? 0.95 // Strong growth = stronger currency
      : gdpGrowthFactor < 0.8
        ? 1.1 // Weak growth = weaker currency
        : 1.0;
  const newExchangeRate = baseIndicators.currencyExchangeRate * exchangeRateDrift;

  return {
    totalPopulation: Math.round(newPopulation),
    nominalGDP: newNominalGDP,
    gdpPerCapita: newGDPPerCapita,
    realGDPGrowthRate: baseIndicators.realGDPGrowthRate, // Growth rate stays constant unless changed
    inflationRate: baseIndicators.inflationRate, // Inflation rate stays constant
    currencyExchangeRate: newExchangeRate,
  };
}

/**
 * Calculate the economic impact of time-based events
 */
export interface EconomicEvent {
  ixTime: number;
  type: "boom" | "recession" | "crisis" | "recovery" | "policy_change";
  gdpImpact: number; // Multiplier (1.1 = +10%, 0.9 = -10%)
  durationYears: number;
  description: string;
}

export function applyEconomicEvents(
  baseIndicators: CoreEconomicIndicatorsData,
  events: EconomicEvent[],
  currentIxTime: number
): CoreEconomicIndicatorsData {
  const modifiedIndicators = { ...baseIndicators };

  for (const event of events) {
    const eventEndTime = IxTime.addYears(event.ixTime, event.durationYears);

    // Check if we're within the event's timeframe
    if (currentIxTime >= event.ixTime && currentIxTime <= eventEndTime) {
      // Apply GDP impact
      modifiedIndicators.nominalGDP *= event.gdpImpact;
      modifiedIndicators.gdpPerCapita *= event.gdpImpact;

      // Events also affect growth rates
      if (event.type === "boom") {
        modifiedIndicators.realGDPGrowthRate *= 1.5; // Boost growth
        modifiedIndicators.inflationRate *= 1.2; // Slight inflation increase
      } else if (event.type === "recession") {
        modifiedIndicators.realGDPGrowthRate *= 0.3; // Slow growth
        modifiedIndicators.inflationRate *= 0.8; // Deflation risk
      } else if (event.type === "crisis") {
        modifiedIndicators.realGDPGrowthRate = -0.05; // Negative growth
        modifiedIndicators.inflationRate *= 0.5; // Severe deflation risk
      }
    }
  }

  return modifiedIndicators;
}

/**
 * Generate economic history data points for a country
 */
export function generateEconomicHistory(
  baseIndicators: CoreEconomicIndicatorsData,
  populationGrowthRate: number,
  startIxTime: number,
  endIxTime: number,
  intervalYears = 1
): Array<{ ixTime: number; indicators: CoreEconomicIndicatorsData }> {
  const history: Array<{ ixTime: number; indicators: CoreEconomicIndicatorsData }> = [];

  let currentTime = startIxTime;
  while (currentTime <= endIxTime) {
    const projectedIndicators = projectEconomicIndicators(
      baseIndicators,
      populationGrowthRate,
      currentTime
    );

    history.push({
      ixTime: currentTime,
      indicators: projectedIndicators,
    });

    currentTime = IxTime.addYears(currentTime, intervalYears);
  }

  return history;
}

/**
 * Calculate economic metrics for the current IxTime
 */
export function getCurrentEconomicState(
  rosterBaselineData: CoreEconomicIndicatorsData,
  populationGrowthRate = 0.01, // Default 1% annual growth
  economicEvents: EconomicEvent[] = []
): CoreEconomicIndicatorsData {
  const rosterTime = IxTime.getInGameEpoch(); // January 1, 2028
  const currentTime = IxTime.getCurrentIxTime();

  // First, project from roster baseline to current time
  let currentIndicators = projectEconomicIndicators(
    rosterBaselineData,
    populationGrowthRate,
    currentTime
  );

  // Then apply any economic events
  currentIndicators = applyEconomicEvents(currentIndicators, economicEvents, currentTime);

  return currentIndicators;
}

/**
 * Format time-based economic description
 */
export function getEconomicTimeDescription(baseYear = 2028, currentIxTime?: number): string {
  const gameYear = IxTime.getCurrentGameYear(currentIxTime);
  const yearsSinceBase = gameYear - baseYear;

  if (yearsSinceBase < 0) {
    return `${Math.abs(yearsSinceBase)} years before economic baseline`;
  } else if (yearsSinceBase === 0) {
    return `At economic baseline year (${baseYear})`;
  } else if (yearsSinceBase === 1) {
    return `1 year since economic baseline`;
  } else {
    return `${yearsSinceBase} years since economic baseline (now ${gameYear})`;
  }
}

/**
 * Calculate compound annual growth rate (CAGR) between two time periods
 */
export function calculateCAGR(
  startValue: number,
  endValue: number,
  startIxTime: number,
  endIxTime: number
): number {
  const years = IxTime.getYearsElapsed(startIxTime, endIxTime);

  if (years <= 0 || startValue <= 0) {
    return 0;
  }

  // CAGR = (Ending Value / Beginning Value)^(1 / Years) - 1
  return Math.pow(endValue / startValue, 1 / years) - 1;
}

/**
 * Estimate time to reach economic target
 */
export function timeToReachTarget(
  currentValue: number,
  targetValue: number,
  annualGrowthRate: number // as decimal
): { years: number; ixTime: number } | null {
  if (annualGrowthRate <= 0 || currentValue <= 0 || targetValue <= currentValue) {
    return null;
  }

  // Years = ln(Target / Current) / ln(1 + GrowthRate)
  const years = Math.log(targetValue / currentValue) / Math.log(1 + annualGrowthRate);
  const targetIxTime = IxTime.addYears(IxTime.getCurrentIxTime(), years);

  return { years, ixTime: targetIxTime };
}
