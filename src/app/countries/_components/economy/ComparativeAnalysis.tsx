// src/app/countries/_components/economy/ComparativeAnalysis.tsx
"use client";

import { useState, useMemo } from "react";
import {
  BarChart3,
  Globe,
  TrendingUp,
  Users,
  DollarSign,
  Target,
  Filter,
  Download,
  RefreshCw,
  ChevronDown,
  Info,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Checkbox } from "~/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuGroupLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Cell,
  LabelList,
} from 'recharts';
import { formatCurrency, formatPopulation } from "~/lib/chart-utils";

interface CountryComparison {
  id: string;
  name: string;
  region: string;
  tier: string;
  gdp: number;
  gdpPerCapita: number;
  population: number;
  growthRate: number;
  unemployment: number;
  inflation: number;
  taxRevenue: number;
  debtToGdp: number;
  competitivenessIndex: number;
  innovationIndex: number;
  color: string;
}

interface RegionalData {
  region: string;
  countries: CountryComparison[];
  avgGdpPerCapita: number;
  avgGrowthRate: number;
  avgUnemployment: number;
  totalGdp: number;
  totalPopulation: number;
}

interface ComparativeAnalysisProps {
  userCountry: CountryComparison;
  allCountries: CountryComparison[];
  onCountrySelect?: (countryId: string) => void;
}

// Dynamic regions will be built from actual country data

const safeFormat = (formatter: (v: number) => string) => (v: number) => {
  if (!isFinite(v) || isNaN(v)) return 'N/A';
  return formatter(v);
};

const metrics = [
  { key: 'gdpPerCapita', label: 'GDP per Capita', format: (v: number) => isFinite(v) && !isNaN(v) ? formatCurrency(v) : 'N/A' },
  { key: 'growthRate', label: 'Growth Rate', format: safeFormat((v: number) => `${v.toFixed(4)}%`) },
  { key: 'unemployment', label: 'Unemployment', format: safeFormat((v: number) => `${v.toFixed(2)}%`) },
  { key: 'inflation', label: 'Inflation', format: safeFormat((v: number) => `${v.toFixed(2)}%`) },
  { key: 'taxRevenue', label: 'Tax Revenue', format: safeFormat((v: number) => `${v.toFixed(2)}%`) },
  { key: 'debtToGdp', label: 'Debt to GDP', format: safeFormat((v: number) => `${v.toFixed(2)}%`) },
  { key: 'competitivenessIndex', label: 'Competitiveness', format: safeFormat((v: number) => v.toFixed(1)) },
  { key: 'innovationIndex', label: 'Innovation', format: safeFormat((v: number) => v.toFixed(1)) },
];

export function ComparativeAnalysis({
  userCountry,
  allCountries,
  onCountrySelect,
}: ComparativeAnalysisProps) {
  // Extract unique regions from actual country data
  const regions = useMemo(() => {
    const uniqueRegions = Array.from(new Set(allCountries.map(c => c.region).filter(Boolean)));
    return [...uniqueRegions.sort(), 'Global Average'];
  }, [allCountries]);

  const [selectedRegions, setSelectedRegions] = useState<string[]>(['Global Average']);
  const [selectedMetricX, setSelectedMetricX] = useState('gdpPerCapita');
  const [selectedMetricY, setSelectedMetricY] = useState('growthRate');
  const [selectedCountries, setSelectedCountries] = useState<string[]>([userCountry.id]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'scatter' | 'ranking' | 'radar' | 'trends'>('scatter');

  // Group countries by region
  const regionalData = useMemo(() => {
    const grouped = regions.reduce((acc, region) => {
      if (region === 'Global Average') {
        const validGdpPerCapita = allCountries.filter(c => isFinite(c.gdpPerCapita));
        const validGrowthRate = allCountries.filter(c => isFinite(c.growthRate));
        const validUnemployment = allCountries.filter(c => isFinite(c.unemployment));

        acc[region] = {
          region,
          countries: allCountries,
          avgGdpPerCapita: validGdpPerCapita.length > 0
            ? validGdpPerCapita.reduce((sum, c) => sum + c.gdpPerCapita, 0) / validGdpPerCapita.length
            : 0,
          avgGrowthRate: validGrowthRate.length > 0
            ? validGrowthRate.reduce((sum, c) => sum + c.growthRate, 0) / validGrowthRate.length
            : 0,
          avgUnemployment: validUnemployment.length > 0
            ? validUnemployment.reduce((sum, c) => sum + c.unemployment, 0) / validUnemployment.length
            : 0,
          totalGdp: allCountries.reduce((sum, c) => sum + (isFinite(c.gdp) ? c.gdp : 0), 0),
          totalPopulation: allCountries.reduce((sum, c) => sum + (isFinite(c.population) ? c.population : 0), 0),
        };
      } else {
        const regionCountries = allCountries.filter(c => c.region === region);
        if (regionCountries.length > 0) {
          const validGdpPerCapita = regionCountries.filter(c => isFinite(c.gdpPerCapita));
          const validGrowthRate = regionCountries.filter(c => isFinite(c.growthRate));
          const validUnemployment = regionCountries.filter(c => isFinite(c.unemployment));

          acc[region] = {
            region,
            countries: regionCountries,
            avgGdpPerCapita: validGdpPerCapita.length > 0
              ? validGdpPerCapita.reduce((sum, c) => sum + c.gdpPerCapita, 0) / validGdpPerCapita.length
              : 0,
            avgGrowthRate: validGrowthRate.length > 0
              ? validGrowthRate.reduce((sum, c) => sum + c.growthRate, 0) / validGrowthRate.length
              : 0,
            avgUnemployment: validUnemployment.length > 0
              ? validUnemployment.reduce((sum, c) => sum + c.unemployment, 0) / validUnemployment.length
              : 0,
            totalGdp: regionCountries.reduce((sum, c) => sum + (isFinite(c.gdp) ? c.gdp : 0), 0),
            totalPopulation: regionCountries.reduce((sum, c) => sum + (isFinite(c.population) ? c.population : 0), 0),
          };
        }
      }
      return acc;
    }, {} as Record<string, RegionalData>);

    return Object.values(grouped);
  }, [allCountries]);

  // Filter countries for display
  const filteredCountries = useMemo(() => {
    let countries = allCountries;
    
    if (selectedRegions.length > 0 && !selectedRegions.includes('Global Average')) {
      countries = countries.filter(c => selectedRegions.includes(c.region));
    }
    
    if (searchQuery) {
      countries = countries.filter(c => 
        c.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    return countries;
  }, [allCountries, selectedRegions, searchQuery]);

  // Calculate user country rankings
  const userRankings = useMemo(() => {
    return metrics.map(metric => {
      const sortedCountries = [...allCountries].sort((a, b) => 
        (b as any)[metric.key] - (a as any)[metric.key]
      );
      const rank = sortedCountries.findIndex(c => c.id === userCountry.id) + 1;
      const percentile = ((allCountries.length - rank + 1) / allCountries.length) * 100;
      
      return {
        metric: metric.label,
        value: (userCountry as any)[metric.key],
        rank,
        percentile,
        total: allCountries.length,
        format: metric.format,
      };
    });
  }, [userCountry, allCountries]);

  // Radar chart data for comparison
  const radarData = useMemo(() => {
    const selectedCountryObjects = allCountries.filter(c => 
      selectedCountries.includes(c.id)
    );
    
    return metrics.map(metric => {
      const dataPoint: any = { metric: metric.label };
      
      selectedCountryObjects.forEach(country => {
        // Normalize values to 0-100 scale for radar chart
        const allValues = allCountries.map(c => (c as any)[metric.key]);
        const min = Math.min(...allValues);
        const max = Math.max(...allValues);
        const normalizedValue = ((country as any)[metric.key] - min) / (max - min) * 100;
        dataPoint[country.name] = normalizedValue;
      });
      
      return dataPoint;
    });
  }, [selectedCountries, allCountries, metrics]);

  const handleRegionToggle = (region: string) => {
    setSelectedRegions(prev => 
      prev.includes(region) 
        ? prev.filter(r => r !== region)
        : [...prev, region]
    );
  };

  const handleCountryToggle = (countryId: string) => {
    setSelectedCountries(prev => 
      prev.includes(countryId)
        ? prev.filter(id => id !== countryId)
        : [...prev, countryId].slice(0, 5) // Limit to 5 countries
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Comparative Economic Analysis
          </h3>
          <p className="text-sm text-muted-foreground">
            Compare {userCountry.name} with peer nations and regional averages
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Update Data
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export Analysis
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center p-4 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-2">
          <Label className="text-sm">Regions:</Label>
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border-border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3">
              <Filter className="h-4 w-4 mr-2" />
              {selectedRegions.length} Selected
              <ChevronDown className="h-4 w-4 ml-2" />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="backdrop-blur-md bg-background/90 border-border/50">
              <DropdownMenuGroup>
                <DropdownMenuGroupLabel>Select Regions</DropdownMenuGroupLabel>
                <DropdownMenuSeparator />
              {regions.map(region => {
                const regionCount = region === 'Global Average'
                  ? allCountries.length
                  : allCountries.filter(c => c.region === region).length;
                return (
                  <DropdownMenuItem key={region}>
                    <div className="flex items-center justify-between w-full space-x-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          checked={selectedRegions.includes(region)}
                          onCheckedChange={() => handleRegionToggle(region)}
                        />
                        <Label className="text-sm cursor-pointer">{region}</Label>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {regionCount}
                      </Badge>
                    </div>
                  </DropdownMenuItem>
                );
              })}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex-1 min-w-[200px]">
          <Input
            placeholder="Search countries..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full"
          />
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline">
            {filteredCountries.length} of {allCountries.length} countries
          </Badge>
          {selectedRegions.length > 0 && !selectedRegions.includes('Global Average') && (
            <Badge variant="secondary" className="text-xs">
              Showing: {selectedRegions.join(', ')}
            </Badge>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value: any) => setActiveTab(value)}>
        <TabsList>
          <TabsTrigger value="scatter">Scatter Plot</TabsTrigger>
          <TabsTrigger value="ranking">Rankings</TabsTrigger>
          <TabsTrigger value="radar">Multi-Country</TabsTrigger>
          <TabsTrigger value="trends">Regional Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="scatter" className="space-y-6">
          {/* Metric Selectors */}
          <div className="flex gap-4 items-center">
            <div>
              <Label className="text-sm">X-Axis</Label>
              <Select value={selectedMetricX} onValueChange={setSelectedMetricX}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {metrics.map(metric => (
                    <SelectItem key={metric.key} value={metric.key}>
                      {metric.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm">Y-Axis</Label>
              <Select value={selectedMetricY} onValueChange={setSelectedMetricY}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {metrics.map(metric => (
                    <SelectItem key={metric.key} value={metric.key}>
                      {metric.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Scatter Plot */}
          <Card>
            <CardHeader>
              <CardTitle>
                {metrics.find(m => m.key === selectedMetricY)?.label} vs {metrics.find(m => m.key === selectedMetricX)?.label}
              </CardTitle>
              <CardDescription>
                Economic performance comparison across countries
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid />
                    <XAxis 
                      type="number" 
                      dataKey={selectedMetricX}
                      name={metrics.find(m => m.key === selectedMetricX)?.label}
                    />
                    <YAxis 
                      type="number" 
                      dataKey={selectedMetricY}
                      name={metrics.find(m => m.key === selectedMetricY)?.label}
                    />
                    <Tooltip
                      cursor={{ strokeDasharray: '3 3' }}
                      content={({ active, payload }) => {
                        if (!active || !payload || !payload.length) return null;
                        const data = payload[0].payload;
                        return (
                          <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
                            <p className="font-semibold mb-2">{data.name}</p>
                            <div className="space-y-1 text-sm">
                              <p className="flex justify-between gap-4">
                                <span className="text-muted-foreground">
                                  {metrics.find(m => m.key === selectedMetricX)?.label}:
                                </span>
                                <span className="font-medium">
                                  {metrics.find(m => m.key === selectedMetricX)?.format(data[selectedMetricX])}
                                </span>
                              </p>
                              <p className="flex justify-between gap-4">
                                <span className="text-muted-foreground">
                                  {metrics.find(m => m.key === selectedMetricY)?.label}:
                                </span>
                                <span className="font-medium">
                                  {metrics.find(m => m.key === selectedMetricY)?.format(data[selectedMetricY])}
                                </span>
                              </p>
                              <p className="flex justify-between gap-4">
                                <span className="text-muted-foreground">Region:</span>
                                <span className="font-medium">{data.region}</span>
                              </p>
                              <p className="flex justify-between gap-4">
                                <span className="text-muted-foreground">Tier:</span>
                                <span className="font-medium">{data.tier}</span>
                              </p>
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Scatter
                      data={filteredCountries}
                      fill="#8884d8"
                    >
                      {filteredCountries.map((country, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={country.id === userCountry.id ? "#FF6B6B" : country.color}
                          stroke={country.id === userCountry.id ? "#FF4757" : "none"}
                          strokeWidth={country.id === userCountry.id ? 2 : 0}
                        />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ranking" className="space-y-6">
          {/* User Country Rankings */}
          <Card>
            <CardHeader>
              <CardTitle>
                {userCountry.name} Performance Rankings
              </CardTitle>
              <CardDescription>
                Your position relative to all countries in the analysis
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {userRankings.map((ranking, index) => (
                  <div key={ranking.metric} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl font-bold text-muted-foreground">
                        #{ranking.rank}
                      </div>
                      <div>
                        <div className="font-medium">{ranking.metric}</div>
                        <div className="text-sm text-muted-foreground">
                          {ranking.format(ranking.value)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">
                        {ranking.percentile.toFixed(0)}th percentile
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {ranking.rank} of {ranking.total}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Top Performers */}
          <Card>
            <CardHeader>
              <CardTitle>Top Performers by Category</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {metrics.slice(0, 4).map(metric => {
                  const topCountries = [...allCountries]
                    .sort((a, b) => (b as any)[metric.key] - (a as any)[metric.key])
                    .slice(0, 5);
                  
                  return (
                    <div key={metric.key}>
                      <h5 className="font-medium mb-3">{metric.label}</h5>
                      <div className="space-y-2">
                        {topCountries.map((country, index) => (
                          <div 
                            key={country.id}
                            className={`flex items-center justify-between p-2 rounded ${
                              country.id === userCountry.id 
                                ? 'bg-primary/10 border-border-primary/20' 
                                : 'bg-muted/50'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium w-4">
                                {index + 1}
                              </span>
                              <span className="text-sm">{country.name}</span>
                            </div>
                            <span className="text-sm font-medium">
                              {metric.format((country as any)[metric.key])}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="radar" className="space-y-6">
          {/* Country Selection for Radar */}
          <Card>
            <CardHeader>
              <CardTitle>Multi-Country Comparison</CardTitle>
              <CardDescription>
                Select up to 5 countries to compare across all metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label className="text-sm mb-2 block">Selected Countries ({selectedCountries.length}/5)</Label>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {allCountries.slice(0, 20).map(country => (
                      <div key={country.id} className="flex items-center space-x-2">
                        <Checkbox
                          checked={selectedCountries.includes(country.id)}
                          onCheckedChange={() => handleCountryToggle(country.id)}
                          disabled={!selectedCountries.includes(country.id) && selectedCountries.length >= 5}
                        />
                        <Label className="text-sm">{country.name}</Label>
                        <Badge variant="outline" className="text-xs">
                          {country.tier}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="metric" tick={{ fontSize: 12 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} />
                      {allCountries
                        .filter(c => selectedCountries.includes(c.id))
                        .map((country, index) => (
                          <Radar
                            key={country.id}
                            name={country.name}
                            dataKey={country.name}
                            stroke={country.color}
                            fill={country.color}
                            fillOpacity={0.1}
                            strokeWidth={2}
                          />
                        ))}
                      <Tooltip />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          {/* Regional Averages - Multiple Metrics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Regional GDP per Capita</CardTitle>
                <CardDescription>
                  Average GDP per capita by region
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={regionalData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="region" angle={-45} textAnchor="end" height={100} tick={{ fontSize: 11 }} />
                      <YAxis />
                      <Tooltip
                        formatter={(value: number) => [formatCurrency(value), 'Avg GDP per Capita']}
                      />
                      <Bar dataKey="avgGdpPerCapita" fill="#3B82F6">
                        {regionalData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.region === userCountry.region ? "#FF6B6B" : "#3B82F6"}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Regional Growth Rates</CardTitle>
                <CardDescription>
                  Average economic growth by region
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={regionalData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="region" angle={-45} textAnchor="end" height={100} tick={{ fontSize: 11 }} />
                      <YAxis />
                      <Tooltip
                        formatter={(value: number) => [`${value.toFixed(4)}%`, 'Avg Growth Rate']}
                      />
                      <Bar dataKey="avgGrowthRate" fill="#10B981">
                        {regionalData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.region === userCountry.region ? "#FF6B6B" : "#10B981"}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Regional Unemployment</CardTitle>
                <CardDescription>
                  Average unemployment rates by region
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={regionalData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="region" angle={-45} textAnchor="end" height={100} tick={{ fontSize: 11 }} />
                      <YAxis />
                      <Tooltip
                        formatter={(value: number) => [`${value.toFixed(1)}%`, 'Avg Unemployment']}
                      />
                      <Bar dataKey="avgUnemployment" fill="#F59E0B">
                        {regionalData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.region === userCountry.region ? "#FF6B6B" : "#F59E0B"}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Regional Total GDP</CardTitle>
                <CardDescription>
                  Combined economic output by region
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={regionalData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="region" angle={-45} textAnchor="end" height={100} tick={{ fontSize: 11 }} />
                      <YAxis />
                      <Tooltip
                        formatter={(value: number) => [formatCurrency(value / 1e9) + 'B', 'Total GDP']}
                      />
                      <Bar dataKey="totalGdp" fill="#8B5CF6">
                        {regionalData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.region === userCountry.region ? "#FF6B6B" : "#8B5CF6"}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Regional Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {regionalData.map(region => {
              const isUserRegion = region.region === userCountry.region;
              return (
                <Card
                  key={region.region}
                  className={isUserRegion ? 'ring-2 ring-primary' : ''}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{region.region}</CardTitle>
                      {isUserRegion && (
                        <Badge variant="default" className="text-xs">Your Region</Badge>
                      )}
                    </div>
                    <CardDescription>{region.countries.length} countries</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Avg GDP/capita:</span>
                        <span className="font-medium">{formatCurrency(region.avgGdpPerCapita)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Avg Growth:</span>
                        <span className="font-medium">{region.avgGrowthRate.toFixed(4)}%</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Avg Unemployment:</span>
                        <span className="font-medium">{region.avgUnemployment.toFixed(2)}%</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Total GDP:</span>
                        <span className="font-medium">{formatCurrency(region.totalGdp / 1e9)}B</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Population:</span>
                        <span className="font-medium">{formatPopulation(region.totalPopulation)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}