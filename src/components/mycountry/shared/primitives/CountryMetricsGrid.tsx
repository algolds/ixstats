"use client";

import { FacetCard, FacetCardContent } from "~/components/ui/facet-container";
import { Tooltip, TooltipTrigger, TooltipContent } from "~/components/ui/tooltip";

interface CountryMetric {
  label: string;
  value: string;
  subtext: string;
  colorClass: string;
  tooltip: {
    title: string;
    details: string[];
  };
}

interface CountryMetricsGridProps {
  metrics: CountryMetric[];
  variant?: "compact" | "standard" | "executive";
}

export function CountryMetricsGrid({ metrics, variant = "standard" }: CountryMetricsGridProps) {
  const cardSize = variant === "compact" ? "p-4" : "p-4";
  const textSize =
    variant === "compact" ? "text-xs" : variant === "executive" ? "text-lg" : "text-xl";
  const labelSize = variant === "compact" ? "text-xs" : "text-sm";

  return (
    <FacetCard depth={1} className="rounded-2xl">
      <FacetCardContent className={variant === "executive" ? "p-6" : "p-4"}>
        <div className={`flex flex-wrap justify-center gap-4`}>
          {metrics.map((metric, index) => (
            <Tooltip key={index}>
              <TooltipTrigger asChild>
                <div
                  className={`text-center ${cardSize} rounded-lg border ${metric.colorClass} flex shrink-0 cursor-pointer flex-col justify-between transition-[background-color,transform] duration-150 active:scale-[0.98]`}
                >
                  <div className={`${textSize} grow font-bold whitespace-nowrap`}>
                    {metric.value}
                  </div>
                  <div className={`${labelSize} text-muted-foreground whitespace-nowrap`}>
                    {metric.label}
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="space-y-1">
                  <div className="font-medium">{metric.tooltip.title}</div>
                  {metric.tooltip.details.map((detail, idx) => (
                    <div key={idx} className="text-muted-foreground text-xs">
                      {detail}
                    </div>
                  ))}
                </div>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </FacetCardContent>
    </FacetCard>
  );
}
