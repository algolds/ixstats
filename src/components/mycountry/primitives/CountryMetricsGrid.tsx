"use client";

import { Card, CardContent } from "~/components/ui/card";
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
  const gridCols =
    variant === "executive"
      ? "grid-cols-2 md:grid-cols-6"
      : variant === "compact"
        ? "grid-cols-2 md:grid-cols-4"
        : "grid-cols-2 md:grid-cols-4";

  const cardSize = variant === "compact" ? "p-4" : "p-4";
  const textSize =
    variant === "compact" ? "text-xs" : variant === "executive" ? "text-lg" : "text-xl";
  const labelSize = variant === "compact" ? "text-[0.65rem]" : "text-sm";

  return (
    <Card
      className={
        variant === "executive"
          ? "border-blue-200 bg-gradient-to-r from-slate-50 to-blue-50 dark:border-blue-800 dark:from-slate-900 dark:to-blue-950/50"
          : ""
      }
    >
      <CardContent className={variant === "executive" ? "p-6" : "p-4"}>
        <div className={`flex flex-wrap justify-center gap-4`}>
          {metrics.map((metric, index) => (
            <Tooltip key={index}>
              <TooltipTrigger asChild>
                <div
                  className={`text-center ${cardSize} rounded-lg border ${metric.colorClass} flex flex-shrink-0 cursor-pointer flex-col justify-between transition-all duration-300 hover:scale-105`}
                >
                  <div className={`${textSize} flex-grow font-bold whitespace-nowrap`}>
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
      </CardContent>
    </Card>
  );
}
