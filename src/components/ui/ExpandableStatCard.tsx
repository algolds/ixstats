import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Card, CardContent } from './card';
import { Skeleton } from './skeleton';
import { AnimatedNumber } from './animated-number';
import { HealthRing } from './health-ring';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from './dropdown-menu';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from './accordion';
import { ChevronDown, ChevronUp, Users, BarChart3, CheckCircle } from 'lucide-react';
import { formatPopulation, formatCurrency } from '~/lib/chart-utils';

interface ExpandableStatCardProps {
  icon: React.ReactNode;
  label: string;
  value?: number | string;
  isLoading?: boolean;
  type: 'population' | 'gdp' | 'active';
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
  const gdpHealth = type === 'gdp' && topCountries.length > 0 && topCountries[0]
    ? Math.min(100, Math.max(30, Math.round(topCountries[0].currentTotalGdp / 1e10)))
    : 70;

  // Default values for extraStats
  const { countryCount = 0, avgGdpPerCapita = 0, avgPopulationDensity = 0 } = extraStats || {};

  return (
    <Card className="relative min-w-[180px] max-w-[220px] cursor-pointer select-none overflow-visible" onClick={() => setExpanded((v) => !v)}>
      <CardContent className="flex flex-col items-start gap-2 p-4">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-xs text-muted-foreground font-medium">{label}</span>
          <span className="ml-auto">{expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</span>
        </div>
        <div className="text-2xl font-bold text-foreground min-h-[32px]">
          {isLoading ? <Skeleton className="h-7 w-20" /> :
            formattedValue ?? value}
        </div>
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.25 }}
              className="w-full mt-2"
              onClick={e => e.stopPropagation()}
            >
              {type === 'population' && (
                <div className="text-sm text-muted-foreground">
                  <div className="mb-2">Real-time population estimate:</div>
                  <div className="text-3xl font-bold text-blue-600 mb-2">
                    {typeof value === 'number' ? <AnimatedNumber value={value} duration={1500} /> : formattedValue}
                  </div>
                  <div className="text-xs text-muted-foreground">This number updates as new data is imported.</div>
                </div>
              )}
              {type === 'gdp' && (
                <div className="space-y-2">
                  <div className="mb-2 text-sm text-muted-foreground">Top 3 countries by GDP:</div>
                  <ol className="mb-2 space-y-1">
                    {topCountries.map((c, i) => (
                      <li key={c.name} className="flex items-center gap-2">
                        <span className="font-bold text-lg text-green-700">#{i + 1}</span>
                        <span className="font-medium text-foreground">{c.name}</span>
                        <span className="ml-auto text-sm text-muted-foreground">{formatCurrency(c.currentTotalGdp)}</span>
                      </li>
                    ))}
                  </ol>
                  <div className="flex items-center gap-2 mt-2">
                    <HealthRing value={gdpHealth} size={48} color="#22d3ee" label="GDP Health" />
                    <span className="text-xs text-muted-foreground">General health based on top GDP</span>
                  </div>
                  <div className="mt-2 text-lg font-bold text-green-700">
                    {typeof value === 'number' ? <AnimatedNumber value={value} duration={1500} prefix="$" decimals={0} /> : formattedValue}
                  </div>
                </div>
              )}
              {type === 'active' && (
                <div className="w-full">
                  <Accordion type="single" collapsible defaultValue="stats">
                    <AccordionItem value="stats">
                      <AccordionTrigger>More Active Stats</AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <span>Countries: </span>
                            <span className="ml-auto font-semibold">{countryCount}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <BarChart3 className="h-4 w-4 text-blue-500" />
                            <span>Avg GDP/capita: </span>
                            <span className="ml-auto font-semibold">{formatCurrency(avgGdpPerCapita)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-purple-500" />
                            <span>Avg Pop. Density: </span>
                            <span className="ml-auto font-semibold">{avgPopulationDensity.toFixed(1)}/km²</span>
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