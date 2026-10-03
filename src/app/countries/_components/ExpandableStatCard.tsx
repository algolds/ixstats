import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Eyebrow } from "~/components/ui/eyebrow";
import { Skeleton } from "~/components/ui/skeleton";
import { NumberFlowDisplay } from "~/components/ui/number-flow";
import { HealthRing } from "~/components/ui/health-ring";

import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "~/components/ui/accordion";
import {
  NavArrowDown as ChevronDown,
  NavArrowUp as ChevronUp,
  Group as Users,
  StatsReport as BarChart3,
  CheckCircle,
} from "iconoir-react";
import { formatCurrency } from "~/lib/utils";
import { Card, CardContent } from "~/components/ui/card";

interface ExpandableStatCardProps {
  icon: React.ReactNode;
  label: string;
  value?: number | string;
  isLoading?: boolean;
  type: "population" | "gdp" | "active";
  topCountries?: Array<{ name: string; currentTotalGdp: number }>;
  extraStats?: { countryCount: number; avgGdpPerCapita: number; avgPopulationDensity: number };
  formattedValue?: string;
}

export function ExpandableStatCard({
  icon,
  label,
  value,
  isLoading = false,
  type,
  topCountries = [],
  extraStats,
  formattedValue,
}: ExpandableStatCardProps) {
  const [expanded, setExpanded] = useState(false);

  // GDP Health calculation (simple: >$1T = 90, >$100B = 70, else 50)
  const gdpHealth =
    type === "gdp" && topCountries.length > 0 && topCountries[0]
      ? Math.min(100, Math.max(30, Math.round(topCountries[0].currentTotalGdp / 1e10)))
      : 70;

  // Default values for extraStats
  const { countryCount = 0, avgGdpPerCapita = 0, avgPopulationDensity = 0 } = extraStats || {};

  return (
    <Card className="rounded-card relative w-full sm:max-w-[220px] sm:min-w-[180px]">
      <CardContent className="flex flex-col items-start gap-2 p-4">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          data-cuelume-press="toggle"
          className="focus-visible:ring-tint rounded-control -m-1 flex w-[calc(100%+0.5rem)] flex-col items-start gap-2 p-1 text-left select-none focus-visible:ring-2 focus-visible:outline-none"
        >
          <span className="flex w-full items-center gap-2">
            {icon}
            <Eyebrow>{label}</Eyebrow>
            <span className="text-label-secondary ml-auto" aria-hidden="true">
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </span>
          </span>
          <span className="text-label text-title-1 block min-h-[32px] tabular-nums">
            {isLoading ? <Skeleton className="h-7 w-20" /> : (formattedValue ?? value)}
          </span>
        </button>
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6, transition: { duration: 0.12 } }}
              transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
              className="mt-2 w-full"
              onClick={(e) => e.stopPropagation()}
            >
              {type === "population" && (
                <div className="text-label-secondary text-body">
                  <div className="mb-2">Real-time population estimate:</div>
                  <div className="text-label text-large-title mb-2 tabular-nums">
                    {typeof value === "number" ? (
                      <NumberFlowDisplay value={value} duration={1500} />
                    ) : (
                      formattedValue
                    )}
                  </div>
                  <div className="text-label-secondary text-footnote">
                    This number updates as new data is imported.
                  </div>
                </div>
              )}
              {type === "gdp" && (
                <div className="space-y-2">
                  <div className="text-label-secondary text-body mb-2">Top 3 countries by GDP:</div>
                  <ol className="mb-2 space-y-1">
                    {topCountries.map((c, i) => (
                      <li key={c.name} className="flex items-center gap-2">
                        <span className="text-label-secondary text-headline tabular-nums">
                          #{i + 1}
                        </span>
                        <span className="text-label font-medium">{c.name}</span>
                        <span className="text-label-secondary text-body ml-auto">
                          {formatCurrency(c.currentTotalGdp)}
                        </span>
                      </li>
                    ))}
                  </ol>
                  <div className="mt-2 flex items-center gap-2">
                    <HealthRing value={gdpHealth} size={48} label="GDP Health" />
                    <span className="text-label-secondary text-footnote">
                      General health based on top GDP
                    </span>
                  </div>
                  <div className="text-label text-title-3 mt-2 tabular-nums">
                    {typeof value === "number" ? (
                      <NumberFlowDisplay
                        value={value}
                        duration={1500}
                        prefix="$"
                        decimalPlaces={0}
                      />
                    ) : (
                      formattedValue
                    )}
                  </div>
                </div>
              )}
              {type === "active" && (
                <div className="w-full">
                  <Accordion type="single" collapsible defaultValue="stats">
                    <AccordionItem value="stats">
                      <AccordionTrigger>More Active Stats</AccordionTrigger>
                      <AccordionContent>
                        <div className="text-body space-y-2">
                          <div className="flex items-center gap-2">
                            <CheckCircle
                              aria-hidden="true"
                              className="text-label-secondary h-4 w-4"
                            />
                            <span>Countries: </span>
                            <span className="ml-auto font-semibold">{countryCount}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <BarChart3
                              aria-hidden="true"
                              className="text-label-secondary h-4 w-4"
                            />
                            <span>Avg GDP/capita: </span>
                            <span className="ml-auto font-semibold">
                              {formatCurrency(avgGdpPerCapita)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Users aria-hidden="true" className="text-label-secondary h-4 w-4" />
                            <span>Avg Pop. Density: </span>
                            <span className="ml-auto font-semibold">
                              {Math.round(avgPopulationDensity)}/km²
                            </span>
                          </div>
                          {/* Add more stats here as desired */}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
