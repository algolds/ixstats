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
  const statsToDisplay = [
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
      // No growth rate shown for Total GDP in the original structure
    },
    {
      label: "Economic Tier",
      value: country.economicTier,
      isBadge: true
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t">
      {statsToDisplay.map(stat => {
        const growthValue = stat.growth;
        let growthDisplay = "N/A";
        let growthColorClass = 'text-muted-foreground'; // Default color

        if (growthValue !== undefined) {
          if (isFinite(growthValue)) {
            const percentageGrowth = growthValue * 100;
            if (Math.abs(percentageGrowth) > 100000) { // Cap display for very extreme rates
              growthDisplay = `${percentageGrowth > 0 ? '>' : '<'}100,000% growth`;
            } else {
              growthDisplay = `${percentageGrowth.toFixed(1)}% growth`;
            }
            growthColorClass = percentageGrowth >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
          } else if (growthValue === Infinity) {
            growthDisplay = ">100,000% growth";
            growthColorClass = 'text-green-600 dark:text-green-400';
          } else if (growthValue === -Infinity) {
            growthDisplay = "<100,000% growth"; // Or some other indicator for extreme negative
            growthColorClass = 'text-red-600 dark:text-red-400';
          }
        }

        return (
          <div key={stat.label} className="text-center sm:text-left">
            <div className="text-xs text-muted-foreground">{stat.label}</div>
            {stat.isBadge ? (
              <Badge variant="secondary" className="mt-1">{stat.value}</Badge>
            ) : (
              <div className="text-lg font-semibold text-foreground">{stat.value}</div>
            )}
            {stat.growth !== undefined && growthDisplay !== "N/A" && (
              <div className={cn("text-xs", growthColorClass)}>
                {growthDisplay}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}