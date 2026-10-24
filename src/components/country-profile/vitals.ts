import type { ProfileVitals } from "~/app/countries/[slug]/_hooks/useCountryProfileLayer";
import { formatPercent, formatRate } from "~/app/countries/[slug]/_utils/profileLayer";

interface VitalStat {
  key: string;
  label: string;
  value: string;
}

/** Growth, jobs and prices for the Economy tab. */
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
  return stats;
}
