"use client";

import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ScatterChart,
  Scatter,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Cell,
} from "recharts";
import {
  Users,
  DollarSign,
  TrendingUp,
  Globe,
  BarChart3,
  Target,
  Layers,
  Plus,
  Minus,
  Search,
} from "lucide-react";
import { IxTime } from "~/lib/ixtime";
import { useTheme } from "~/context/theme-context";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "~/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";

// Country data for comparison
interface ComparisonCountry {
  id: string;
  name: string;
  currentPopulation: number;
  currentGdpPerCapita: number;
  currentTotalGdp: number;
  populationGrowthRate: number;
  adjustedGdpGrowth: number;
  economicTier: string;
  populationTier: string;
  populationDensity?: number | null;
  gdpDensity?: number | null;
  landArea?: number | null;
  continent?: string | null;
  color: string; // Assigned color for charts
}

interface ComparisonChartsProps {
  countries: ComparisonCountry[];
  onCountriesChangeAction: (countries: ComparisonCountry[]) => void;
  availableCountries: Array<{
    id: string;
    name: string;
    continent?: string | null;
    economicTier: string;
  }>;
  currentIxTime: number;
  isLoading?: boolean;
}

type ComparisonChartType = 
  | 'population'
  | 'gdp'
  | 'growth'
  | 'scatter'
  | 'radar';

const CHART_COLORS = [
  "#8b5cf6", "#06b6d4", "#84cc16", "#f97316", 
  "#ec4899", "#14b8a6", "#f59e0b", "#ef4444",
  "#8b5cf6", "#06b6d4"
];

export function ComparisonCharts({
  countries,
  onCountriesChangeAction,
  availableCountries,
  currentIxTime,
  isLoading = false,
}: ComparisonChartsProps) {
  const { theme } = useTheme();
  const [selectedChartType, setSelectedChartType] = useState<ComparisonChartType>('population');
  const [countrySearchOpen, setCountrySearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  // Chart theme
  const chartTheme = useMemo(() => {
    const isDark = theme === 'dark';
    return {
      grid: isDark ? '#374151' : '#e5e7eb',
      text: isDark ? '#9ca3af' : '#6b7280',
      axis: isDark ? '#6b7280' : '#9ca3af',
      tooltip: {
        backgroundColor: isDark ? '#1f2937' : '#ffffff',
        border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
        color: isDark ? '#f9fafb' : '#111827',
      },
    };
  }, [theme]);

  // Filter available countries for search
  const filteredCountries = useMemo(() => {
    const selectedIds = new Set(countries.map(c => c.id));
    return availableCountries
      .filter(country => !selectedIds.has(country.id))
      .filter(country => 
        searchValue === "" || 
        country.name.toLowerCase().includes(searchValue.toLowerCase())
      );
  }, [availableCountries, countries, searchValue]);

  // Add country to comparison
  const addCountry = (countryId: string) => {
    const country = availableCountries.find(c => c.id === countryId);
    if (!country || countries.length >= 8) return;

    // This would need to fetch the full country data
    // For now, we'll create a placeholder
    const newCountry: ComparisonCountry = {
      id: country.id,
      name: country.name,
      currentPopulation: 0, // Would be fetched
      currentGdpPerCapita: 0, // Would be fetched
      currentTotalGdp: 0, // Would be fetched
      populationGrowthRate: 0, // Would be fetched
      adjustedGdpGrowth: 0, // Would be fetched
      economicTier: country.economicTier,
      populationTier: "Medium", // Would be fetched
      continent: country.continent,
      color: CHART_COLORS[countries.length] || "#8b5cf6",
    };

    onCountriesChangeAction([...countries, newCountry]);
    setCountrySearchOpen(false);
    setSearchValue("");
  };

  // Remove country from comparison
  const removeCountry = (countryId: string) => {
    const newCountries = countries
      .filter(c => c.id !== countryId)
      .map((country, index) => ({
        ...country,
        color: CHART_COLORS[index] || "#8b5cf6",
      }));
    onCountriesChangeAction(newCountries);
  };

  // Chart data processing
  const chartData = useMemo(() => {
    switch (selectedChartType) {
      case 'population':
        return countries.map(country => ({
          name: country.name,
          value: country.currentPopulation / 1000000, // Convert to millions
          color: country.color,
        }));
      
      case 'gdp':
        return countries.map(country => ({
          name: country.name,
          gdpPerCapita: country.currentGdpPerCapita / 1000, // Convert to thousands
          totalGdp: country.currentTotalGdp / 1000000000, // Convert to billions
          color: country.color,
        }));

      case 'growth':
        return countries.map(country => ({
          name: country.name,
          populationGrowth: country.populationGrowthRate * 100,
          gdpGrowth: country.adjustedGdpGrowth * 100,
          color: country.color,
        }));

      case 'radar':
        return countries.map(country => ({
          name: country.name,
          population: Math.log10(country.currentPopulation / 1000000) * 20, // Scaled for radar
          gdpPerCapita: Math.min(country.currentGdpPerCapita / 1000, 100), // Capped for radar
          popGrowth: (country.populationGrowthRate + 0.1) * 500, // Scaled and shifted
          gdpGrowth: (country.adjustedGdpGrowth + 0.1) * 500, // Scaled and shifted
          density: country.populationDensity ? Math.min(country.populationDensity / 10, 100) : 0,
          color: country.color,
        }));

      case 'scatter':
        return countries.map(country => ({
          name: country.name,
          x: country.currentGdpPerCapita / 1000,
          y: country.currentPopulation / 1000000,
          z: country.currentTotalGdp / 1000000000,
          color: country.color,
        }));

      default:
        return [];
    }
  }, [countries, selectedChartType]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    return (
      <div 
        className="p-3 rounded-lg border shadow-lg backdrop-blur-sm"
        style={chartTheme.tooltip}
      >
        <div className="space-y-2">
          <div className="font-medium">{label}</div>
          {payload.map((entry: any) => (
            <div key={entry.dataKey} className="flex justify-between items-center gap-4">
              <span style={{ color: entry.color }} className="text-sm">
                {entry.name}:
              </span>
              <span className="font-medium text-sm">
                {typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Chart configurations
  const getChartConfig = (type: ComparisonChartType) => {
    const configs = {
      population: {
        title: "Population Comparison",
        description: "Compare population sizes across countries",
        component: (
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: chartTheme.text }} />
            <YAxis tick={{ fontSize: 12, fill: chartTheme.text }} label={{ value: 'Population (M)', angle: -90 }} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="value">
              {chartData.map((entry: any, index: number) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        )
      },
      gdp: {
        title: "Economic Comparison",
        description: "Compare GDP metrics across countries",
        component: (
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: chartTheme.text }} />
            <YAxis yAxisId="left" orientation="left" tick={{ fontSize: 12, fill: chartTheme.text }} label={{ value: 'GDP per Capita ($K)', angle: -90 }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: chartTheme.text }} label={{ value: 'Total GDP ($B)', angle: 90 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar yAxisId="left" dataKey="gdpPerCapita" name="GDP per Capita" fill="#06b6d4" />
            <Bar yAxisId="right" dataKey="totalGdp" name="Total GDP" fill="#84cc16" />
          </BarChart>
        )
      },
      growth: {
        title: "Growth Rate Comparison",
        description: "Compare population and economic growth rates",
        component: (
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: chartTheme.text }} />
            <YAxis tick={{ fontSize: 12, fill: chartTheme.text }} label={{ value: 'Growth Rate (%)', angle: -90 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar dataKey="populationGrowth" name="Population Growth" fill="#8b5cf6" />
            <Bar dataKey="gdpGrowth" name="GDP Growth" fill="#06b6d4" />
          </BarChart>
        )
      },
      scatter: {
        title: "GDP vs Population",
        description: "Scatter plot of GDP per capita vs population",
        component: (
          <ScatterChart data={chartData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
            <XAxis dataKey="x" tick={{ fontSize: 12, fill: chartTheme.text }} label={{ value: 'GDP per Capita ($K)', position: 'insideBottom', offset: -5 }} />
            <YAxis dataKey="y" tick={{ fontSize: 12, fill: chartTheme.text }} label={{ value: 'Population (M)', angle: -90, position: 'insideLeft' }} />
            <Tooltip content={<CustomTooltip />} />
            <Scatter dataKey="z" fill="#8b5cf6">
              {chartData.map((entry: any, index: number) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Scatter>
          </ScatterChart>
        )
      },
      radar: {
        title: "Multi-Metric Radar",
        description: "Comprehensive comparison across multiple metrics",
        component: (
          <RadarChart data={chartData} margin={{ top: 20, right: 80, bottom: 20, left: 80 }}>
            <PolarGrid />
            <PolarAngleAxis dataKey="name" tick={{ fontSize: 10, fill: chartTheme.text }} />
            <PolarRadiusAxis tick={{ fontSize: 8, fill: chartTheme.text }} />
            <Tooltip content={<CustomTooltip />} />
            {countries.map((country, index) => (
              <Radar
                key={country.id}
                name={country.name}
                dataKey={`value${index}`}
                stroke={country.color}
                fill={country.color}
                fillOpacity={0.1}
              />
            ))}
          </RadarChart>
        )
      },
    };

    return configs[type] || configs.population;
  };

  const currentConfig = getChartConfig(selectedChartType);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="animate-pulse space-y-2">
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-96 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              {currentConfig.title}
            </CardTitle>
            <CardDescription>{currentConfig.description}</CardDescription>
          </div>
        </div>

        {/* Controls */}
        <div className="space-y-4">
          {/* Country Selection */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">Countries:</span>
            
            {countries.map((country) => (
              <Badge
                key={country.id}
                variant="secondary"
                className="flex items-center gap-1"
                style={{ backgroundColor: `${country.color}20`, borderColor: country.color }}
              >
                <div 
                  className="w-2 h-2 rounded-full" 
                  style={{ backgroundColor: country.color }}
                />
                {country.name}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 ml-1"
                  onClick={() => removeCountry(country.id)}
                >
                  <Minus className="h-3 w-3" />
                </Button>
              </Badge>
            ))}

            {countries.length < 8 && (
              <Popover open={countrySearchOpen} onOpenChange={setCountrySearchOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8">
                    <Plus className="h-3 w-3 mr-1" />
                    Add Country
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                  <Command>
                    <CommandInput 
                      placeholder="Search countries..." 
                      value={searchValue}
                      onValueChange={setSearchValue}
                    />
                    <CommandEmpty>No countries found.</CommandEmpty>
                    <CommandGroup className="max-h-60 overflow-y-auto">
                      {filteredCountries.map((country) => (
                        <CommandItem
                          key={country.id}
                          onSelect={() => addCountry(country.id)}
                          className="cursor-pointer"
                        >
                          <div className="flex flex-col">
                            <span>{country.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {country.continent} • {country.economicTier}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            )}
          </div>

          {/* Chart Type Selection */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Chart Type:</span>
            <Select value={selectedChartType} onValueChange={(value) => setSelectedChartType(value as ComparisonChartType)}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="population">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Population
                  </div>
                </SelectItem>
                <SelectItem value="gdp">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Economic
                  </div>
                </SelectItem>
                <SelectItem value="growth">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Growth Rates
                  </div>
                </SelectItem>
                <SelectItem value="scatter">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    GDP vs Population
                  </div>
                </SelectItem>
                <SelectItem value="radar">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Multi-Metric
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {countries.length === 0 ? (
          <div className="h-96 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Layers className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No countries selected</p>
              <p className="text-sm">Add countries to start comparing metrics</p>
            </div>
          </div>
        ) : (
          <div className="h-96 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {currentConfig.component}
            </ResponsiveContainer>
          </div>
        )}

        {/* Summary Statistics */}
        {countries.length > 0 && (
          <div className="mt-6 pt-4 border-t">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-sm text-muted-foreground">Countries</p>
                <p className="text-lg font-semibold">{countries.length}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Population</p>
                <p className="text-lg font-semibold">
                  {(countries.reduce((sum, c) => sum + c.currentPopulation, 0) / 1000000).toFixed(1)}M
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total GDP</p>
                <p className="text-lg font-semibold">
                  ${(countries.reduce((sum, c) => sum + c.currentTotalGdp, 0) / 1000000000).toFixed(1)}B
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg GDP/Capita</p>
                <p className="text-lg font-semibold">
                  ${(countries.reduce((sum, c) => sum + c.currentGdpPerCapita, 0) / countries.length / 1000).toFixed(0)}K
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
