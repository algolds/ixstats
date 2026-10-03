"use client";
import { Tooltip, TooltipTrigger, TooltipContent } from "~/components/ui/tooltip";
import { Card, CardContent } from "~/components/ui/card";

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
    variant === "compact"
      ? "text-footnote"
      : variant === "executive"
        ? "text-title-3"
        : "text-title-2";
  const labelSize = variant === "compact" ? "text-footnote" : "text-body";

  return (
    <Card className="rounded-card">
      <CardContent className={variant === "executive" ? "p-6" : "p-4"}>
        <div className={`flex flex-wrap justify-center gap-4`}>
          {metrics.map((metric, index) => (
            <Tooltip key={index}>
              <TooltipTrigger asChild>
                <div
                  className={`text-center ${cardSize} rounded-control border ${metric.colorClass} flex shrink-0 cursor-pointer flex-col justify-between transition-[background-color,transform] duration-150 active:scale-[0.98]`}
                >
                  <div className={`${textSize} grow font-semibold whitespace-nowrap`}>
                    {metric.value}
                  </div>
                  <div className={`${labelSize} text-label-secondary whitespace-nowrap`}>
                    {metric.label}
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="space-y-1">
                  <div className="font-medium">{metric.tooltip.title}</div>
                  {metric.tooltip.details.map((detail, idx) => (
                    <div key={idx} className="text-label-secondary text-footnote">
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
