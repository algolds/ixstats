// src/app/countries/_components/detail/TenYearForecast.tsx
"use client";

import { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  ComposedChart,
  Bar,
  Legend,
  ReferenceLine
} from "recharts";
import {
  TrendingUp,
  Target,
  AlertTriangle,
  Info,
  DollarSign,
  Users,
  BarChart3,
  Zap,
  Activity
} from "lucide-react";
import { useTheme } from "~/context/theme-context";
import { IxTime } from "~/lib/ixtime";

interface CountryData {
  id: string;
  name: string;
  currentPopulation: number;
  currentGdpPerCapita: number;
  currentTotalGdp: number;
  populationGrowthRate: number;
  adjustedGdpGrowth: number;
  economicTier: string;
  populationTier: string;
  landArea?: number;
}

interface ForecastDataPoint {
  year: number;
  population: number;
  gdpPerCapita: number;
  totalGdp: number;
  populationDensity?: number;
  gdpDensity?: number;
}

interface TenYearForecastProps {
  country: CountryData;
  forecastData?: ForecastDataPoint[];
  baseTime: number;
  isLoading?: boolean;
}

type ForecastView = 'combined' | 'population' | 'gdp' | 'density' | 'scenarios';
type ScenarioType = 'optimistic' | 'baseline' | 'pessimistic';

export function TenYearForecast({
  country,
  forecastData = [],
  baseTime,
  isLoading = false
}: TenYearForecastProps) {
  const { theme } = useTheme();
  const [forecastView, setForecastView] = useState<ForecastView>('combined');
  const [showScenarios, setShowScenarios] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<ScenarioType>('baseline');

  // Generate 10-year forecast data with scenarios
  const generatedForecastData = useMemo(() => {
    const baseData = [];
    const baseYear = new Date(baseTime).getFullYear();
    
    // Scenario multipliers
    const scenarios = {
      optimistic: { population: 1.2, gdp: 1.5 },
      baseline: { population: 1.0, gdp: 1.0 },
      pessimistic: { population: 0.8, gdp: 0.6 }
    };

    for (let year = 0; year <= 10; year++) {
      const yearData: any = {
        year: baseYear + year,
        yearOffset: year,
        date: `${baseYear + year}`,
      };

      // Generate for each scenario
      Object.entries(scenarios).forEach(([scenarioName, multipliers]) => {
        const popGrowthRate = country.populationGrowthRate * multipliers.population;
        const gdpGrowthRate = country.adjustedGdpGrowth * multipliers.gdp;
        
        const populationGrowthFactor = Math.pow(1 + popGrowthRate, year);
        const gdpGrowthFactor = Math.pow(1 + gdpGrowthRate, year);
        
        const projectedPopulation = country.currentPopulation * populationGrowthFactor;
        const projectedGdpPerCapita = country.currentGdpPerCapita * gdpGrowthFactor;
        const projectedTotalGdp = projectedPopulation * projectedGdpPerCapita;
        
        const suffix = scenarioName === 'baseline' ? '' : `_${scenarioName}`;
        
        yearData[`population${suffix}`] = projectedPopulation / 1000000; // Millions
        yearData[`gdpPerCapita${suffix}`] = projectedGdpPerCapita;
        yearData[`totalGdp${suffix}`] = projectedTotalGdp / 1000000000; // Billions
        
        if (country.landArea) {
          yearData[`populationDensity${suffix}`] = projectedPopulation / country.landArea;
          yearData[`gdpDensity${suffix}`] = projectedTotalGdp / country.landArea / 1000000; // Millions per km²
        }
        
        // Growth rates for the year
        yearData[`populationGrowthRate${suffix}`] = popGrowthRate * 100;
        yearData[`gdpGrowthRate${suffix}`] = gdpGrowthRate * 100;
      });

      baseData.push(yearData);
    }

    return baseData;
  }, [country, baseTime]);

  // Analysis metrics
  const forecastAnalysis = useMemo(() => {
    if (generatedForecastData.length < 2) return null;

    const firstYear = generatedForecastData[0];
    const lastYear = generatedForecastData[generatedForecastData.length - 1];
    
    const populationCAGR = Math.pow(lastYear.population / firstYear.population, 1/10) - 1;
    const gdpPerCapitaCAGR = Math.pow(lastYear.gdpPerCapita / firstYear.gdpPerCapita, 1/10) - 1;
    const totalGdpCAGR = Math.pow(lastYear.totalGdp / firstYear.totalGdp, 1/10) - 1;
    
    return {
      populationCAGR: populationCAGR * 100,
      gdpPerCapitaCAGR: gdpPerCapitaCAGR * 100,
      totalGdpCAGR: totalGdpCAGR * 100,
      projectedPopulation10Y: lastYear.population,
      projectedGdpPerCapita10Y: lastYear.gdpPerCapita,
      projectedTotalGdp10Y: lastYear.totalGdp,
      populationChange: ((lastYear.population - firstYear.population) / firstYear.population) * 100,
      gdpPerCapitaChange: ((lastYear.gdpPerCapita - firstYear.gdpPerCapita) / firstYear.gdpPerCapita) * 100,
    };
  }, [generatedForecastData]);

  const formatNumber = (num: number, isCurrency = false, precision = 1): string => {
    if (isCurrency) {
      if (Math.abs(num) >= 1000) return `$${(num / 1000).toFixed(precision)}K`;
      return `$${num.toFixed(precision)}`;
    }
    if (Math.abs(num) >= 1000) return `${(num / 1000).toFixed(precision)}B`;
    return `${num.toFixed(precision)}M`;
  };

  const axisColor = theme === 'dark' ? '#4A5568' : '#CBD5E0';
  const textColor = theme === 'dark' ? '#E2E8F0' : '#2D3748';
  
  const tooltipStyle = {
    backgroundColor: theme === 'dark' ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)',
    color: textColor,
    border: `1px solid ${axisColor}`,
    borderRadius: '8px',
    padding: '12px',
  };

  const renderChart = () => {
    const commonProps = {
      data: generatedForecastData,
      margin: { top: 5, right: 30, left: 20, bottom: 5 }
    };

    switch (forecastView) {
      case 'combined':
        return (
          <ComposedChart {...commonProps}>
            <defs>
              <linearGradient id="forecastPopGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.1}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={axisColor} opacity={0.5} />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 12, fill: textColor }} 
              stroke={axisColor}
            />
            <YAxis 
              yAxisId="population"
              tick={{ fontSize: 12, fill: textColor }} 
              stroke={axisColor}
              label={{ value: 'Population (M)', angle: -90, position: 'insideLeft' }}
            />
            <YAxis 
              yAxisId="gdp"
              orientation="right"
              tick={{ fontSize: 12, fill: textColor }} 
              stroke={axisColor}
              label={{ value: 'GDP per Capita ($)', angle: 90, position: 'insideRight' }}
            />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend />
            <Area
              yAxisId="population"
              type="monotone"
              dataKey="population"
              stroke="#3B82F6"
              fillOpacity={1}
              fill="url(#forecastPopGradient)"
              name="Population (M)"
            />
            <Line
              yAxisId="gdp"
              type="monotone"
              dataKey="gdpPerCapita"
              stroke="#10B981"
              strokeWidth={3}
              name="GDP per Capita ($)"
            />
            <ReferenceLine x={new Date().getFullYear().toString()} stroke="#EF4444" strokeDasharray="5 5" label="Current Year" />
          </ComposedChart>
        );

      case 'scenarios':
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke={axisColor} opacity={0.5} />
            <XAxis dataKey="date" tick={{ fontSize: 12, fill: textColor }} stroke={axisColor} />
            <YAxis tick={{ fontSize: 12, fill: textColor }} stroke={axisColor} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend />
            <Line
              type="monotone"
              dataKey="gdpPerCapita_optimistic"
              stroke="#10B981"
              strokeWidth={2}
              name="Optimistic Scenario"
              strokeDasharray="5 5"
            />
            <Line
              type="monotone"
              dataKey="gdpPerCapita"
              stroke="#3B82F6"
              strokeWidth={3}
              name="Baseline Scenario"
            />
            <Line
              type="monotone"
              dataKey="gdpPerCapita_pessimistic"
              stroke="#EF4444"
              strokeWidth={2}
              name="Pessimistic Scenario"
              strokeDasharray="5 5"
            />
            <ReferenceLine x={new Date().getFullYear().toString()} stroke="#6B7280" strokeDasharray="5 5" />
          </LineChart>
        );

      case 'population':
        return (
          <AreaChart {...commonProps}>
            <defs>
              <linearGradient id="popForecastGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.1}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={axisColor} opacity={0.5} />
            <XAxis dataKey="date" tick={{ fontSize: 12, fill: textColor }} stroke={axisColor} />
            <YAxis tick={{ fontSize: 12, fill: textColor }} stroke={axisColor} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend />
            <Area
              type="monotone"
              dataKey="population"
              stroke="#8B5CF6"
              fillOpacity={1}
              fill="url(#popForecastGradient)"
              name="Population (Millions)"
            />
            <ReferenceLine x={new Date().getFullYear().toString()} stroke="#EF4444" strokeDasharray="5 5" />
          </AreaChart>
        );

      case 'gdp':
        return (
          <ComposedChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke={axisColor} opacity={0.5} />
            <XAxis dataKey="date" tick={{ fontSize: 12, fill: textColor }} stroke={axisColor} />
            <YAxis 
              yAxisId="perCapita"
              tick={{ fontSize: 12, fill: textColor }} 
              stroke={axisColor}
            />
            <YAxis 
              yAxisId="total"
              orientation="right"
              tick={{ fontSize: 12, fill: textColor }} 
              stroke={axisColor}
            />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend />
            <Line
              yAxisId="perCapita"
              type="monotone"
              dataKey="gdpPerCapita"
              stroke="#10B981"
              strokeWidth={3}
              name="GDP per Capita ($)"
            />
            <Bar
              yAxisId="total"
              dataKey="totalGdp"
              fill="#F59E0B"
              opacity={0.6}
              name="Total GDP (B$)"
            />
            <ReferenceLine x={new Date().getFullYear().toString()} stroke="#EF4444" strokeDasharray="5 5" />
          </ComposedChart>
        );

      case 'density':
        if (!country.landArea) {
          return (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <AlertTriangle className="h-12 w-12 text-yellow-500 dark:text-yellow-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600 dark:text-gray-400">Land area data required for density analysis</p>
              </div>
            </div>
          );
        }
        
        return (
          <ComposedChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke={axisColor} opacity={0.5} />
            <XAxis dataKey="date" tick={{ fontSize: 12, fill: textColor }} stroke={axisColor} />
            <YAxis 
              yAxisId="popDensity"
              tick={{ fontSize: 12, fill: textColor }} 
              stroke={axisColor}
            />
            <YAxis 
              yAxisId="gdpDensity"
              orientation="right"
              tick={{ fontSize: 12, fill: textColor }} 
              stroke={axisColor}
            />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend />
            <Bar
              yAxisId="popDensity"
              dataKey="populationDensity"
              fill="#8B5CF6"
              opacity={0.7}
              name="Pop. Density (/km²)"
            />
            <Line
              yAxisId="gdpDensity"
              type="monotone"
              dataKey="gdpDensity"
              stroke="#EF4444"
              strokeWidth={3}
              name="GDP Density (M$/km²)"
            />
            <ReferenceLine x={new Date().getFullYear().toString()} stroke="#6B7280" strokeDasharray="5 5" />
          </ComposedChart>
        );

      default:
        // Return an empty LineChart as fallback to ensure we never return null
        return (
          <LineChart data={[]}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
          </LineChart>
        );
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center mb-4 sm:mb-0">
          <TrendingUp className="h-5 w-5 mr-2" />
          10-Year Economic Forecast
        </h2>
        
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowScenarios(!showScenarios)}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              showScenarios
                ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 border border-yellow-300 dark:border-yellow-700'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Scenarios
          </button>
        </div>
      </div>

      {/* Forecast Metrics Summary */}
      {forecastAnalysis && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {forecastAnalysis.populationCAGR.toFixed(1)}%
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Population CAGR</div>
            <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              {formatNumber(forecastAnalysis.projectedPopulation10Y)} in {new Date(baseTime).getFullYear() + 10}
            </div>
          </div>
          
          <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              {forecastAnalysis.gdpPerCapitaCAGR.toFixed(1)}%
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">GDP per Capita CAGR</div>
            <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              {formatNumber(forecastAnalysis.projectedGdpPerCapita10Y, true)} in {new Date(baseTime).getFullYear() + 10}
            </div>
          </div>
          
          <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {forecastAnalysis.totalGdpCAGR.toFixed(1)}%
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Total GDP CAGR</div>
            <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              {formatNumber(forecastAnalysis.projectedTotalGdp10Y * 1000)} in {new Date(baseTime).getFullYear() + 10}
            </div>
          </div>
        </div>
      )}

      {/* Chart View Selector */}
      <div className="flex flex-wrap gap-2 mb-6">
        {[
          { key: 'combined', label: 'Overview', icon: Activity },
          { key: 'population', label: 'Population', icon: Users },
          { key: 'gdp', label: 'GDP', icon: DollarSign },
          { key: 'density', label: 'Density', icon: BarChart3 },
          ...(showScenarios ? [{ key: 'scenarios', label: 'Scenarios', icon: Target }] : [])
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setForecastView(key as ForecastView)}
            className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              forecastView === key
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            <Icon className="h-4 w-4 mr-1" />
            {label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="h-80 mb-4">
        {isLoading ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 dark:border-indigo-500 mx-auto mb-2"></div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Generating forecast...</p>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
        )}
      </div>

      {/* Forecast Assumptions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center">
            <Zap className="h-4 w-4 mr-2" />
            Growth Assumptions
          </h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Population Growth:</span>
              <span className="text-gray-900 dark:text-white">{(country.populationGrowthRate * 100).toFixed(2)}% annually</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">GDP Growth:</span>
              <span className="text-gray-900 dark:text-white">{(country.adjustedGdpGrowth * 100).toFixed(2)}% annually</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Economic Tier:</span>
              <span className="text-gray-900 dark:text-white">{country.economicTier}</span>
            </div>
          </div>
        </div>
        
        <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Important Notes
          </h3>
          <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
            <p>• Projections based on current growth rates</p>
            <p>• Does not account for economic cycles</p>
            <p>• External factors may significantly alter outcomes</p>
            <p>• For planning purposes only</p>
          </div>
        </div>
      </div>
    </div>
  );
}
