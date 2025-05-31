// src/app/countries/_components/charts/CountryStats.tsx
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import { formatNumber } from "~/lib/format";

interface CountryData {
  currentPopulation: number;
  currentGdpPerCapita: number;
  currentTotalGdp: number;
  populationGrowthRate: number;
  adjustedGdpGrowth: number;
  economicTier: string;
}

interface CountryStatsProps {
  country: CountryData;
}

export function CountryStats({ country }: CountryStatsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t">
      {[
        {
          label: "Population",
          value: formatNumber(country.currentPopulation, false, 0, true),
          growth: country.populationGrowthRate
        },
        {
          label: "GDP p.c.",
          value: isNaN(country.currentGdpPerCapita) || !isFinite(country.currentGdpPerCapita) 
            ? '$0' 
            : formatNumber(country.currentGdpPerCapita, true, 0, true),
          growth: country.adjustedGdpGrowth
        },
        {
          label: "Total GDP",
          value: isNaN(country.currentTotalGdp) || !isFinite(country.currentTotalGdp)
            ? '$0'
            : formatNumber(country.currentTotalGdp, true, 1, true),
        },
        {
          label: "Economic Tier", 
          value: country.economicTier, 
          isBadge: true
        },
      ].map(stat => (
        <div key={stat.label} className="text-center sm:text-left">
          <div className="text-xs text-muted-foreground">{stat.label}</div>
          {stat.isBadge ? (
            <Badge variant="secondary" className="mt-1">{stat.value}</Badge>
          ) : (
            <div className="text-lg font-semibold text-foreground">{stat.value}</div>
          )}
          {stat.growth !== undefined && (
            <div className={cn("text-xs", stat.growth >=0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
              {(stat.growth * 100).toFixed(1)}% growth
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
