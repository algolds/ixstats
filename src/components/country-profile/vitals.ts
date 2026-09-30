import type { StatDelta } from "~/components/ui/stat";
import type { ProfileVitals } from "~/app/countries/[slug]/_hooks/useCountryProfileLayer";
import { formatBig, formatPercent, formatRate } from "~/app/countries/[slug]/_utils/profileLayer";

export interface VitalStat {
  key: string;
  label: string;
  value: string;
  hint?: string;
  delta?: StatDelta;
}

function rateDelta(rate: number | null, label: string): StatDelta | undefined {
  if (rate == null) return undefined;
  const direction = rate > 0 ? "up" : rate < 0 ? "down" : "neutral";
  return { value: formatRate(rate), direction, label };
}

/** Headline vitals (population, GDP, GDP per capita, area). Missing figures are left out. */
export function headlineVitals(v: ProfileVitals): VitalStat[] {
  const stats: VitalStat[] = [];
  if (v.population != null)
    stats.push({
      key: "population",
      label: "Population",
      value: formatBig(v.population),
      hint: v.populationTier ? `Tier ${v.populationTier}` : undefined,
      delta: rateDelta(v.populationGrowth, "Population growth"),
    });
  if (v.gdpTotal != null)
    stats.push({
      key: "gdp",
      label: "GDP",
      value: formatBig(v.gdpTotal, { currency: true }),
      delta: rateDelta(v.gdpGrowth, "GDP growth"),
    });
  if (v.gdpPerCapita != null)
    stats.push({
      key: "gdppc",
      label: "GDP per capita",
      value: formatBig(v.gdpPerCapita, { currency: true }),
      hint: v.economicTier ?? undefined,
    });
  if (v.landArea != null)
    stats.push({
      key: "area",
      label: "Land area",
      value: `${formatBig(v.landArea)} km²`,
      hint:
        v.density != null ? `${Math.round(v.density).toLocaleString("en-US")} per km²` : undefined,
    });
  return stats;
}

/** Society figures for the People chapter. */
export function peopleVitals(v: ProfileVitals): VitalStat[] {
  const stats: VitalStat[] = [];
  if (v.lifeExpectancy != null)
    stats.push({
      key: "life",
      label: "Life expectancy",
      value: `${v.lifeExpectancy.toFixed(1)} yrs`,
    });
  if (v.literacy != null)
    stats.push({ key: "literacy", label: "Literacy", value: formatPercent(v.literacy) });
  if (v.urbanShare != null)
    stats.push({ key: "urban", label: "Urban", value: formatPercent(v.urbanShare) });
  if (v.povertyRate != null)
    stats.push({ key: "poverty", label: "Poverty", value: formatPercent(v.povertyRate) });
  if (v.gini != null)
    stats.push({
      key: "gini",
      label: "Inequality",
      value: `Gini ${(v.gini > 1 ? v.gini / 100 : v.gini).toFixed(2)}`,
    });
  if (v.publicApproval != null)
    stats.push({
      key: "approval",
      label: "Public approval",
      value: formatPercent(v.publicApproval, 0),
    });
  return stats;
}

/** Economy figures for the Economy chapter. */
export function economyVitals(v: ProfileVitals): VitalStat[] {
  const stats: VitalStat[] = [];
  if (v.gdpGrowth != null)
    stats.push({ key: "growth", label: "Real growth", value: formatRate(v.gdpGrowth) });
  if (v.unemployment != null)
    stats.push({
      key: "unemployment",
      label: "Unemployment",
      value: formatPercent(v.unemployment),
    });
  if (v.inflation != null)
    stats.push({
      key: "inflation",
      label: "Inflation",
      value: formatRate(v.inflation, { signed: false }),
    });
  if (v.taxRevenueShare != null)
    stats.push({
      key: "tax",
      label: "Tax revenue",
      value: `${formatPercent(v.taxRevenueShare)} of GDP`,
    });
  if (v.debtToGdp != null)
    stats.push({
      key: "debt",
      label: "Public debt",
      value: `${formatPercent(v.debtToGdp)} of GDP`,
    });
  return stats;
}
