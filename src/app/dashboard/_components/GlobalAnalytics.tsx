// src/app/dashboard/_components/GlobalAnalytics.tsx
"use client";

import React, { useState, useMemo } from "react";
import { BarChart3, Target, Users, TrendingUp, Globe, Activity } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  LabelList,
} from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "~/components/ui/chart";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "~/components/ui/card";
import { Popover, PopoverContent } from "~/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Button } from "~/components/ui/button";
import { useChartTheme } from "~/context/theme-context";
import { formatPopulation, formatCurrency, formatDensity } from "~/lib/chart-utils";
import { Skeleton } from "~/components/ui/skeleton";

interface ProcessedCountryData {
  id: string;
  name: string;
  currentPopulation: number;
  currentGdpPerCapita: number;
  currentTotalGdp: number;
  economicTier: string;
  populationTier: string;
  landArea: number | null;
  populationDensity: number | null;
  gdpDensity: number | null;
}

type MetricFilter =
  | "populationDensity"
  | "gdpDensity"
  | "currentPopulation"
  | "currentGdpPerCapita"
  | "currentTotalGdp";

interface TierDetailsPopoverProps {
  open: boolean;
  anchorEl: HTMLElement | null;
  onClose: () => void;
  tier: string | null;
  countries: ProcessedCountryData[];
}

function TierDetailsPopover({ open, anchorEl, onClose, tier, countries }: TierDetailsPopoverProps) {
  if (!open || !anchorEl || !tier) return null;
  const tierCountries = countries.filter((c) => c.economicTier === tier);
  return (
    <Popover open={open} onOpenChange={onClose}>
      <PopoverContent className="flex max-h-[80vh] flex-col sm:max-w-[625px]">
        <div className="mb-4">
          <div className="text-lg font-bold">
            {tier} Countries ({tierCountries.length})
          </div>
          <div className="text-muted-foreground text-sm">
            Countries in the {tier} economic tier.
          </div>
        </div>
        <div className="scrollbar-thin flex-grow overflow-y-auto pr-2">
          <div className="grid gap-3">
            {tierCountries.map((c, i) => (
              <div
                key={i}
                className="bg-muted/50 hover:bg-muted flex items-center justify-between rounded-lg p-3 transition-colors"
              >
                <div>
                  <h3 className="text-card-foreground font-medium">{c.name}</h3>
                  <p className="text-muted-foreground text-sm">
                    Pop: {formatPopulation(c.currentPopulation)} • GDP p.c.:{" "}
                    {formatCurrency(c.currentGdpPerCapita)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-card-foreground text-lg font-semibold">
                    {formatCurrency(c.currentTotalGdp)}
                  </p>
                  <p className="text-muted-foreground text-xs">Total GDP</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface GlobalAnalyticsProps {
  countries: ProcessedCountryData[];
  isLoading?: boolean;
}

class AnalyticsErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-card text-card-foreground rounded-lg border p-6 text-center shadow-sm">
          An error occurred in Analytics.
        </div>
      );
    }
    return this.props.children;
  }
}

export function GlobalAnalytics({ countries, isLoading = false }: GlobalAnalyticsProps) {
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [showTierPopover, setShowTierPopover] = useState(false);
  const [tierPopoverAnchor, setTierPopoverAnchor] = useState<HTMLElement | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<MetricFilter>("populationDensity");

  const theme = useChartTheme();

  // 1) Filter out any invalid entries
  const validCountries = useMemo(
    () =>
      countries.filter(
        (c) => c.currentPopulation > 0 && c.currentGdpPerCapita > 0 && c.currentTotalGdp > 0
      ),
    [countries]
  );

  // 2) Count per economic tier
  const economicTierCounts = useMemo(() => {
    return validCountries.reduce(
      (acc, c) => {
        acc[c.economicTier] = (acc[c.economicTier] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
  }, [validCountries]);

  // 3) Build pie data
  const pieChartData = useMemo(
    () =>
      Object.entries(economicTierCounts).map(([tier, count]) => ({
        tierName: tier,
        value: count,
      })),
    [economicTierCounts]
  );

  // 4) Pie chart config
  const economicTierChartConfig = useMemo(() => {
    const cfg: ChartConfig = { value: { label: "Countries" } };
    const tierColors: Record<string, string> = {
      Advanced: "var(--color-tier-advanced)",
      Developed: "var(--color-tier-developed)",
      Emerging: "var(--color-tier-emerging)",
      Developing: "var(--color-tier-developing)",
    };
    let fallback = 0;
    for (const tier of Object.keys(economicTierCounts)) {
      cfg[tier] = {
        label: tier,
        color: tierColors[tier] ?? theme.colors[fallback++ % theme.colors.length],
      };
    }
    return cfg;
  }, [economicTierCounts, theme.colors]);

  // 5) Prepare bar data with both display & raw values
  const topCountriesData = useMemo(() => {
    return validCountries
      .map((c) => {
        let raw = 0;
        let disp = 0;
        switch (selectedMetric) {
          case "populationDensity":
            raw = c.populationDensity ?? 0;
            disp = raw;
            break;
          case "gdpDensity":
            raw = c.gdpDensity ?? 0;
            disp = raw;
            break;
          case "currentPopulation":
            raw = c.currentPopulation;
            disp = raw / 1_000_000; // plot in millions
            break;
          case "currentGdpPerCapita":
            raw = c.currentGdpPerCapita;
            disp = raw;
            break;
          case "currentTotalGdp":
            raw = c.currentTotalGdp;
            disp = raw / 1_000_000_000; // plot in billions
            break;
        }
        const name = c.name.length > 12 ? c.name.slice(0, 10) + "…" : c.name;
        return { name, fullName: c.name, value: disp, rawValue: raw };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [validCountries, selectedMetric]);

  // 6) Pie slice click
  const handlePieClick = (data: any, event: React.MouseEvent<HTMLElement>) => {
    setSelectedTier(data.tierName);
    setTierPopoverAnchor(event.currentTarget as HTMLElement);
    setShowTierPopover(true);
  };

  const metricOptions = [
    {
      key: "populationDensity",
      label: "Population Density",
      icon: Users,
    },
    {
      key: "gdpDensity",
      label: "GDP Density",
      icon: TrendingUp,
    },
    {
      key: "currentPopulation",
      label: "Total Population",
      icon: Users,
    },
    {
      key: "currentGdpPerCapita",
      label: "GDP per Capita",
      icon: TrendingUp,
    },
    { key: "currentTotalGdp", label: "Total GDP", icon: Globe },
  ] as const;

  // 7) No data guard
  if (validCountries.length === 0) {
    return (
      <div className="mb-8">
        <h2 className="text-foreground mb-6 text-2xl font-semibold">Global Analytics</h2>
        <Card className="py-12 text-center">
          <CardHeader>
            <CardTitle className="text-muted-foreground flex items-center justify-center">
              <BarChart3 className="mr-2 h-12 w-12 opacity-50" />
              No Data
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mt-2 text-sm">Load some countries first.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mb-8">
        <h2 className="text-foreground mb-6 text-2xl font-semibold">Global Analytics</h2>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i} className="flex flex-col">
              <CardHeader>
                <Skeleton className="mb-2 h-6 w-24" />
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-40 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <TierDetailsPopover
        open={showTierPopover}
        anchorEl={tierPopoverAnchor}
        onClose={() => setShowTierPopover(false)}
        tier={selectedTier}
        countries={countries}
      />

      <h2 className="text-foreground mb-6 text-2xl font-semibold">Global Analytics</h2>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Pie */}
        <Card className="flex flex-col">
          <CardHeader className="pb-0">
            <CardTitle className="flex items-center">
              <Activity className="mr-2 h-5 w-5" />
              Economic Tier Distribution
            </CardTitle>
            <CardDescription>Click a slice to view countries</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 pb-0">
            <ChartContainer
              config={economicTierChartConfig}
              className="mx-auto aspect-square max-h-[300px]"
            >
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                <Pie
                  data={pieChartData}
                  dataKey="value"
                  nameKey="tierName"
                  cx="50%"
                  cy="50%"
                  outerRadius={96}
                  onClick={(e) => handlePieClick(e.payload, e.event)}
                >
                  {pieChartData.map((entry) => (
                    <Cell
                      key={entry.tierName}
                      fill={economicTierChartConfig[entry.tierName]?.color || theme.colors[0]}
                    />
                  ))}
                  <LabelList
                    dataKey="tierName"
                    className="fill-primary-foreground text-xs"
                    stroke="none"
                    fontSize={10}
                  />
                </Pie>
              </PieChart>
            </ChartContainer>
          </CardContent>
          <CardFooter className="text-muted-foreground pt-4 text-xs">
            Tap a slice to drill in
          </CardFooter>
        </Card>

        {/* Bar */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle className="flex items-center">
              <Target className="mr-2 h-5 w-5" />
              Top 10 by {metricOptions.find((o) => o.key === selectedMetric)?.label}
            </CardTitle>
            <Select
              value={selectedMetric}
              onValueChange={(v) => setSelectedMetric(v as MetricFilter)}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Choose metric" />
              </SelectTrigger>
              <SelectContent>
                {metricOptions.map((o) => (
                  <SelectItem key={o.key} value={o.key}>
                    <o.icon className="mr-2 h-4 w-4" />
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={topCountriesData}
                layout="vertical"
                margin={{ top: 8, right: 8, bottom: 48, left: 64 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={theme.gridColor} opacity={0.3} />
                <XAxis type="number" tick={{ fill: theme.textColor }} stroke={theme.axisColor} />
                <YAxis
                  dataKey="name"
                  type="category"
                  tick={{ fill: theme.textColor }}
                  stroke={theme.axisColor}
                  width={80}
                  interval={0}
                />
                <RechartsTooltip
                  cursor={{ fill: `${theme.gridColor}33` }}
                  formatter={(val, name, props) => {
                    const raw = props.payload.rawValue;
                    switch (selectedMetric) {
                      case "populationDensity":
                        return [formatDensity(raw, "/km²"), "Pop Density"];
                      case "gdpDensity":
                        return [formatDensity(raw, "/km² GDP"), "GDP Density"];
                      case "currentPopulation":
                        return [formatPopulation(raw), "Population"];
                      case "currentGdpPerCapita":
                        return [formatCurrency(raw), "GDP p.c."];
                      case "currentTotalGdp":
                        return [formatCurrency(raw), "Total GDP"];
                      default:
                        return [String(raw), name];
                    }
                  }}
                  labelFormatter={(label) =>
                    topCountriesData.find((d) => d.name === label)?.fullName || label
                  }
                  contentStyle={{
                    backgroundColor: theme.tooltipBg,
                    border: `1px solid ${theme.gridColor}`,
                    color: theme.textColor,
                  }}
                />
                <Bar
                  dataKey="value"
                  name={metricOptions.find((o) => o.key === selectedMetric)?.label}
                  fill={theme.colors[1]}
                  radius={[0, 4, 4, 0]}
                  barSize={14}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Wrap export in error boundary
export default function GlobalAnalyticsWithBoundary(props: GlobalAnalyticsProps) {
  return (
    <AnalyticsErrorBoundary>
      <GlobalAnalytics {...props} />
    </AnalyticsErrorBoundary>
  );
}
