// src/app/dashboard/_components/GlobalAnalytics.tsx
"use client";

import { useState, useMemo } from "react";
import { BarChart3, Target, Filter, X, Users, TrendingUp, Globe, Activity } from "lucide-react";
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
  Tooltip as RechartsTooltip, // Renamed to avoid conflict
  Legend,
  LabelList
} from "recharts";

// Shadcn/ui chart components
import {
  ChartContainer,
  ChartTooltip, // This is shadcn/ui's ChartTooltip
  ChartTooltipContent,
  type ChartConfig,
} from "~/components/ui/chart"; // Ensure this path is correct

// Shadcn/ui general components
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "~/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Button } from "~/components/ui/button";

// Your custom theme hook
import { useChartTheme } from "~/context/theme-context"; // Ensure this path is correct

// Define the structure of the country data processed for these charts
export interface ProcessedCountryData {
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

// Type for the metric filter dropdown
type MetricFilter = 'populationDensity' | 'gdpDensity' | 'currentPopulation' | 'currentGdpPerCapita' | 'currentTotalGdp';

// Props for the modal that shows countries in a selected tier
interface TierDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  tier: string | null;
  countries: ProcessedCountryData[];
}

// Modal component to display countries of a specific economic tier
function TierDetailsModal({ isOpen, onClose, tier, countries }: TierDetailsModalProps) {
  if (!isOpen || !tier) return null;

  const tierCountries = countries.filter(country => country.economicTier === tier);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[625px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {tier} Countries ({tierCountries.length})
          </DialogTitle>
          <DialogDescription>
            List of countries within the {tier} economic tier.
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto flex-grow pr-2 scrollbar-thin"> {/* Added scrollbar-thin for better scroll */}
          <div className="grid grid-cols-1 gap-3">
            {tierCountries.map((country, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                <div>
                  <h3 className="font-medium text-card-foreground">{country.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    Pop: {(country.currentPopulation / 1e6).toFixed(1)}M |
                    GDP p.c.: ${country.currentGdpPerCapita.toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-card-foreground">
                    ${(country.currentTotalGdp / 1e9).toFixed(1)}B
                  </p>
                  <p className="text-xs text-muted-foreground">Total GDP</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Props for the main GlobalAnalytics component
interface GlobalAnalyticsProps {
  countries: ProcessedCountryData[];
}

export function GlobalAnalytics({ countries }: GlobalAnalyticsProps) {
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [showTierModal, setShowTierModal] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<MetricFilter>('populationDensity');

  // useChartTheme provides colors for the bar chart.
  // For the pie chart, we'll use specific tier colors from CSS variables.
  const rechartsTheme = useChartTheme();

  // Filter out countries with invalid or zero data for calculations
  const validCountries = useMemo(() => countries.filter(country =>
    country.currentPopulation > 0 &&
    country.currentGdpPerCapita > 0 &&
    country.currentTotalGdp > 0
  ), [countries]);

  // Memoized calculation for economic tier counts
  const economicTierCounts = useMemo(() => {
    return validCountries.reduce((acc, country) => {
      const tier = country.economicTier || 'Unknown';
      acc[tier] = (acc[tier] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [validCountries]);

  // Memoized data for the pie chart
  const pieChartData = useMemo(() => {
    return Object.entries(economicTierCounts).map(([tierName, count]) => ({
      tierName: tierName, // Key for chartConfig and labels
      value: count,     // Data value for the pie slice
    }));
  }, [economicTierCounts]);

  // Memoized chart configuration for the economic tier pie chart
  const economicTierChartConfig = useMemo(() => {
    const config: ChartConfig = {
      value: { // 'value' is the dataKey for the Pie chart
        label: "Countries",
      },
    };
    // Define colors for known tiers using CSS variables directly
    const tierCssVarColors: Record<string, string> = {
      "Advanced": "var(--color-tier-advanced)",
      "Developed": "var(--color-tier-developed)",
      "Emerging": "var(--color-tier-emerging)",
      "Developing": "var(--color-tier-developing)",
      "Unknown": "var(--muted)", // Assuming --muted is a valid color string or var
    };

    let fallbackColorIndex = 0;
    const uniqueTiers = Object.keys(economicTierCounts);

    for (const tier of uniqueTiers) {
      config[tier] = {
        label: tier,
        color: tierCssVarColors[tier] || rechartsTheme.colors[fallbackColorIndex % rechartsTheme.colors.length]
      };
      if (!tierCssVarColors[tier]) {
        fallbackColorIndex++;
      }
    }
    return config;
  }, [economicTierCounts, rechartsTheme.colors]) satisfies ChartConfig;

  // Memoized data for the top countries bar chart
  const topCountriesData = useMemo(() => {
    let filtered = validCountries;
    if (selectedMetric === 'populationDensity') {
      filtered = validCountries.filter(c => c.populationDensity != null && c.populationDensity > 0);
    } else if (selectedMetric === 'gdpDensity') {
      filtered = validCountries.filter(c => c.gdpDensity != null && c.gdpDensity > 0);
    }

    return filtered
      .map(c => ({
        name: c.name.length > 12 ? c.name.substring(0, 10) + '...' : c.name, // Adjusted for vertical chart
        value: selectedMetric === 'gdpDensity' ? Number(((c.gdpDensity || 0) / 1000000).toFixed(2)) :
               selectedMetric === 'currentPopulation' ? Number((c.currentPopulation / 1000000).toFixed(1)) :
               selectedMetric === 'currentTotalGdp' ? Number((c.currentTotalGdp / 1000000000).toFixed(1)) :
               Number((c[selectedMetric] || 0)),
        fullName: c.name,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [validCountries, selectedMetric]);

  // Handler for pie chart clicks
  const handlePieClick = (data: any) => {
    if (data.tierName) { // data.tierName is from pieChartData structure
        setSelectedTier(data.tierName);
        setShowTierModal(true);
    }
  };

  // Options for the metric selection dropdown
  const metricOptions = [
    { key: 'populationDensity', label: 'Population Density', icon: Users },
    { key: 'gdpDensity', label: 'GDP Density', icon: TrendingUp },
    { key: 'currentPopulation', label: 'Total Population', icon: Users },
    { key: 'currentGdpPerCapita', label: 'GDP per Capita', icon: TrendingUp },
    { key: 'currentTotalGdp', label: 'Total GDP', icon: Globe },
  ] as const;

  // Display loading or no data message if necessary
  if (validCountries.length === 0) {
    return (
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-foreground mb-6">Global Analytics</h2>
        <Card className="text-center py-12">
          <CardHeader>
            <CardTitle className="flex justify-center items-center text-muted-foreground">
              <BarChart3 className="mx-auto h-12 w-12 opacity-50 mr-2" />
              No Data Available
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mt-2 text-sm text-muted-foreground">
              Global analytics will appear here once countries are loaded and have valid data.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <TierDetailsModal
        isOpen={showTierModal}
        onClose={() => setShowTierModal(false)}
        tier={selectedTier}
        countries={countries} // Pass original countries data to modal
      />

      <h2 className="text-2xl font-semibold text-foreground mb-6">Global Analytics</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Economic Tier Distribution Pie Chart */}
        <Card className="flex flex-col">
          <CardHeader className="items-center pb-0">
            <CardTitle className="flex items-center">
              <Activity className="h-5 w-5 mr-2" />
              Economic Tier Distribution
            </CardTitle>
            <CardDescription>Count of countries by economic tier.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 pb-0">
            {pieChartData.length > 0 ? (
              <ChartContainer
                config={economicTierChartConfig}
                className="[&_.recharts-pie-label-text]:fill-primary-foreground mx-auto aspect-square max-h-[300px]"
              >
                <PieChart>
                  <ChartTooltip
                     cursor={true} // Enable cursor for better UX on click
                     content={<ChartTooltipContent hideLabel nameKey="value" />} // Use shadcn's tooltip
                  />
                  <Pie
                    data={pieChartData}
                    dataKey="value"
                    nameKey="tierName"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    strokeWidth={2}
                    onClick={(data) => handlePieClick(data.payload)} // data.payload contains the entry
                  >
                    {pieChartData.map((entry) => (
                        <Cell
                            key={`cell-${entry.tierName}`}
                            fill={economicTierChartConfig[entry.tierName]?.color || rechartsTheme.colors[0]}
                            className="focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                        />
                    ))}
                    <LabelList
                      dataKey="tierName"
                      className="fill-accent-foreground text-xs" // Use Tailwind class for label color
                      stroke="none"
                      fontSize={10}
                      formatter={(value: keyof typeof economicTierChartConfig) =>
                         economicTierChartConfig[value]?.label
                      }
                    />
                  </Pie>
                </PieChart>
              </ChartContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                <Activity className="h-8 w-8 mr-2 opacity-50" />
                No economic tier data
              </div>
            )}
          </CardContent>
          <CardFooter className="flex-col gap-2 text-sm pt-4">
            <div className="text-muted-foreground leading-none text-center">
              Click a slice to view countries in that tier.
            </div>
          </CardFooter>
        </Card>

        {/* Top Countries Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Target className="h-5 w-5 mr-2" />
              Top 10 Countries
            </CardTitle>
             <div className="w-full sm:w-64">
                <Select value={selectedMetric} onValueChange={(value) => setSelectedMetric(value as MetricFilter)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select metric" />
                  </SelectTrigger>
                  <SelectContent>
                    {metricOptions.map((option) => (
                      <SelectItem key={option.key} value={option.key}>
                        <div className="flex items-center">
                          <option.icon className="h-4 w-4 mr-2 text-muted-foreground" />
                          {option.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
            </div>
          </CardHeader>
          <CardContent>
            {topCountriesData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={topCountriesData}
                  margin={{ top: 5, right: 5, left: 5, bottom: 60 }} // Adjusted margins
                  layout="vertical"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={rechartsTheme.gridColor} opacity={0.3} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: rechartsTheme.textColor }} stroke={rechartsTheme.axisColor} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    tick={{ fontSize: 10, fill: rechartsTheme.textColor, width: 70 }} // Adjusted tick width
                    stroke={rechartsTheme.axisColor}
                    width={75} // Adjusted YAxis width
                    interval={0}
                  />
                  <RechartsTooltip // Using RechartsTooltip for the bar chart for now
                    cursor={{ fill: `${rechartsTheme.gridColor}33` }} // Example cursor style
                    contentStyle={{
                       backgroundColor: rechartsTheme.tooltipBg,
                       color: rechartsTheme.textColor,
                       border: `1px solid ${rechartsTheme.gridColor}`,
                       borderRadius: '0.375rem'
                    }}
                    formatter={(value: number, name: string, props: any) => {
                      const metricInfo = metricOptions.find(m => m.label === name);
                      const unit = metricInfo?.key === 'populationDensity' ? ' /km²' :
                                   metricInfo?.key === 'gdpDensity' ? ' M$/km²' :
                                   metricInfo?.key === 'currentPopulation' ? 'M' :
                                   metricInfo?.key === 'currentGdpPerCapita' ? '$' :
                                   metricInfo?.key === 'currentTotalGdp' ? 'B$' : '';
                      return [`${value.toLocaleString()}${unit}`, metricInfo?.label || name];
                    }}
                    labelFormatter={(label, payload) => topCountriesData.find(c => c.name === label)?.fullName || label}
                  />
                  <Bar
                    dataKey="value"
                    name={metricOptions.find(m => m.key === selectedMetric)?.label || "Value"}
                    fill={rechartsTheme.colors[1]} // Using color from your theme context
                    radius={[0, 4, 4, 0]}
                    barSize={15} // Adjusted bar size for vertical chart
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
               <div className="flex items-center justify-center h-64 text-muted-foreground">
                <Target className="h-8 w-8 mr-2 opacity-50" />
                No data for "{metricOptions.find(m => m.key === selectedMetric)?.label || 'selected metric'}"
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}