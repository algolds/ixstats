import type { ProfileVitals } from "~/app/countries/[slug]/_hooks/useCountryProfileLayer";
import { formatPercent, formatRate } from "~/app/countries/[slug]/_utils/profileLayer";

interface VitalStat {
  key: string;
  label: string;
  value: string;
}

/** A reading's label, saying so when the figure is the estimate from the economy. */
const labelled = (label: string, estimated: boolean) =>
  estimated ? `${label} (estimated)` : label;

/** Growth, jobs and prices for the Economy tab. */
export function economyVitals(v: ProfileVitals): VitalStat[] {
  const stats: VitalStat[] = [];
  if (v.gdpGrowth != null)
    stats.push({ key: "growth", label: "Real growth", value: formatRate(v.gdpGrowth) });
  if (v.unemployment != null)
    stats.push({
      key: "unemployment",
      label: labelled("Unemployment", v.unemploymentEstimated),
      value: formatPercent(v.unemployment),
    });
  if (v.inflation != null)
    stats.push({
      key: "inflation",
      label: labelled("Inflation", v.inflationEstimated),
      value: formatRate(v.inflation, { signed: false }),
    });
  return stats;
}
