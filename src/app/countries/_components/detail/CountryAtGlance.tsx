// src/app/countries/_components/detail/CountryAtGlance.tsx
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
  ReferenceLine,
  Label
} from "recharts";
import {
  BarChart3,
  TrendingUp,
  Users,
  Globe,
  Activity,
  Calendar,
  Info,
  DollarSign,
  Target,
  AlertTriangle,
  Zap
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
  populationDensity?: number;
  gdpDensity?: number;
}

interface HistoricalDataPoint {
  ixTimeTimestamp: number;
  population: number;
  gdpPerCapita: number;
  totalGdp: number;
  populationDensity?: number;
  gdpDensity?: number;
}

interface ChartPoint {
  period: string;
  date: string;
  ixTimeTimestamp: number;
  population?: number;
  gdpPerCapita?: number;
  totalGdp?: number;
  populationDensity?: number;
  gdpDensity?: number;
  populationGrowth?: number;
  gdpGrowth?: number;
  isRollingAverage?: boolean;
  isForecast?: boolean;
  // For segmented rendering
  historicalPopulation?: number;
  forecastPopulation?: number;
  historicalGdpPerCapita?: number;
  forecastGdpPerCapita?: number;
  historicalTotalGdp?: number;
  forecastTotalGdp?: number;
  historicalPopulationDensity?: number;
  forecastPopulationDensity?: number;
  historicalGdpDensity?: number;
  forecastGdpDensity?: number;
}


interface CountryAtGlanceProps {
  country: CountryData;
  historicalData?: HistoricalDataPoint[];
  targetTime: number;
  forecastYears: number;
  isLoading?: boolean;
  isLoadingForecast?: boolean;
}

type TimeResolution = 'quarterly' | 'annual';
type ChartView = 'overview' | 'population' | 'gdp' | 'density';
type ViewMode = 'historical' | 'forecast';
type ScenarioType = 'optimistic' | 'baseline' | 'pessimistic';
type ForecastView = 'combined' | 'population' | 'gdp' | 'density' | 'scenarios';

export function CountryAtGlance({
  country,
  historicalData = [],
  targetTime,
  forecastYears,
  isLoading = false,
  isLoadingForecast = false
}: CountryAtGlanceProps) {
  const { theme } = useTheme();
  
  const [timeResolution, setTimeResolution] = useState<TimeResolution>('annual');
  const [viewMode, setViewMode] = useState<ViewMode>('historical');
  const [chartView, setChartView] = useState<ChartView>('overview');
  const [showForecastInHistorical, setShowForecastInHistorical] = useState(true);
  const [forecastView, setForecastView] = useState<ForecastView>('combined');
  const [showScenarios, setShowScenarios] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<ScenarioType>('baseline');

  const historicalSegmentData = useMemo(() => {
    if (!historicalData.length) return [];
  
    const targetDate = new Date(targetTime);
    let windowStartTimeMs: number;
  
    if (timeResolution === 'quarterly') {
      const windowStartDate = new Date(targetDate);
      windowStartDate.setMonth(targetDate.getMonth() - 3);
      windowStartTimeMs = windowStartDate.getTime();
    } else { // annual
      const windowStartDate = new Date(targetDate);
      windowStartDate.setFullYear(targetDate.getFullYear() - 1);
      windowStartTimeMs = windowStartDate.getTime();
    }
  
    const filteredRawData = historicalData.filter(
      point => point.ixTimeTimestamp >= windowStartTimeMs && point.ixTimeTimestamp <= targetTime
    ).sort((a, b) => a.ixTimeTimestamp - b.ixTimeTimestamp);
  
    if (!filteredRawData.length) return [];

    const timestampGroups: Record<string, HistoricalDataPoint[]> = {};
    filteredRawData.forEach(point => {
      const date = new Date(point.ixTimeTimestamp);
      let periodKey: string;
      if (timeResolution === 'quarterly') {
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        periodKey = `${date.getFullYear()}-Q${quarter}`;
      } else {
        periodKey = date.getFullYear().toString();
      }
      if (!timestampGroups[periodKey]) {
        timestampGroups[periodKey] = [];
      }
      timestampGroups[periodKey]?.push(point);
    });
  
    const periodAverages = Object.entries(timestampGroups).map(([period, points]) => {
      const avgPoint = points.reduce((sum, point) => ({
        ixTimeTimestamp: sum.ixTimeTimestamp + point.ixTimeTimestamp / points.length,
        population: sum.population + point.population / points.length,
        gdpPerCapita: sum.gdpPerCapita + point.gdpPerCapita / points.length,
        totalGdp: sum.totalGdp + point.totalGdp / points.length,
        populationDensity: (sum.populationDensity ?? 0) + (point.populationDensity ?? 0) / points.length,
        gdpDensity: (sum.gdpDensity ?? 0) + (point.gdpDensity ?? 0) / points.length,
      }), { ixTimeTimestamp: 0, population: 0, gdpPerCapita: 0, totalGdp: 0, populationDensity: 0, gdpDensity: 0 });
      return { period, ...avgPoint };
    }).sort((a, b) => a.ixTimeTimestamp - b.ixTimeTimestamp);
  
    const windowSize = timeResolution === 'quarterly' ? 4 : 12;
    const rollingData: ChartPoint[] = [];
  
    if (periodAverages.length > 0) {
      for (let i = 0; i < periodAverages.length; i++) {
        const startIdx = Math.max(0, i - windowSize + 1);
        const windowSlice = periodAverages.slice(startIdx, i + 1);
        
        const currentPeriod = periodAverages[i]!;
        
        const sum = windowSlice.reduce((acc, p) => ({
          population: acc.population + p.population,
          gdpPerCapita: acc.gdpPerCapita + p.gdpPerCapita,
          totalGdp: acc.totalGdp + p.totalGdp,
          populationDensity: acc.populationDensity + (p.populationDensity ?? 0),
          gdpDensity: acc.gdpDensity + (p.gdpDensity ?? 0),
        }), { population: 0, gdpPerCapita: 0, totalGdp: 0, populationDensity: 0, gdpDensity: 0 });

        const avg = {
          population: sum.population / windowSlice.length,
          gdpPerCapita: sum.gdpPerCapita / windowSlice.length,
          totalGdp: sum.totalGdp / windowSlice.length,
          populationDensity: sum.populationDensity / windowSlice.length,
          gdpDensity: sum.gdpDensity / windowSlice.length,
        };
        
        let populationGrowth = 0, gdpGrowth = 0;
        if (i > 0) {
          const prevPeriod = periodAverages[i-1]!;
          populationGrowth = prevPeriod.population ? ((currentPeriod.population - prevPeriod.population) / prevPeriod.population) * 100 : 0;
          gdpGrowth = prevPeriod.gdpPerCapita ? ((currentPeriod.gdpPerCapita - prevPeriod.gdpPerCapita) / prevPeriod.gdpPerCapita) * 100 : 0;
        }
  
        rollingData.push({
          period: currentPeriod.period,
          date: currentPeriod.period,
          ixTimeTimestamp: currentPeriod.ixTimeTimestamp,
          population: avg.population / 1000000,
          gdpPerCapita: avg.gdpPerCapita,
          totalGdp: avg.totalGdp / 1000000000,
          populationDensity: avg.populationDensity,
          gdpDensity: avg.gdpDensity / 1000000,
          populationGrowth,
          gdpGrowth,
          isRollingAverage: true,
          isForecast: false,
        });
      }
    }
    return rollingData;
  }, [historicalData, targetTime, timeResolution]);
  
  const forecastSegmentData = useMemo(() => {
    if (!showForecastInHistorical || forecastYears === 0) return [];
  
    const basePointForForecast = historicalSegmentData.length > 0
      ? historicalSegmentData[historicalSegmentData.length - 1]
      : { // Fallback to current country stats if no historical window data
          date: IxTime.getCurrentGameYear(targetTime).toString(),
          population: country.currentPopulation / 1000000,
          gdpPerCapita: country.currentGdpPerCapita,
          totalGdp: country.currentTotalGdp / 1000000000,
          populationDensity: country.populationDensity ?? 0,
          gdpDensity: (country.gdpDensity ?? 0) / 1000000,
          ixTimeTimestamp: targetTime,
          period: IxTime.getCurrentGameYear(targetTime).toString(),
        };
    
    if (!basePointForForecast) return [];

    const forecastPoints: ChartPoint[] = [];
    const forecastStartTime = basePointForForecast.ixTimeTimestamp;
  
    for (let i = 1; i <= forecastYears * (timeResolution === 'quarterly' ? 4 : 1); i++) {
      const yearOffset = timeResolution === 'quarterly' ? i / 4 : i;
      const currentForecastTime = IxTime.addYears(forecastStartTime, yearOffset);
      const date = new Date(currentForecastTime);
      let periodKey: string;
      if (timeResolution === 'quarterly') {
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        periodKey = `${date.getFullYear()}-Q${quarter}`;
      } else {
        periodKey = date.getFullYear().toString();
      }

      const populationGrowthFactor = Math.pow(1 + country.populationGrowthRate, yearOffset);
      const gdpGrowthFactor = Math.pow(1 + country.adjustedGdpGrowth, yearOffset);
  
      const projectedPopulation = (basePointForForecast.population ?? 0) * populationGrowthFactor;
      const projectedGdpPerCapita = (basePointForForecast.gdpPerCapita ?? 0) * gdpGrowthFactor;
  
      forecastPoints.push({
        period: periodKey,
        date: periodKey,
        ixTimeTimestamp: currentForecastTime,
        population: projectedPopulation,
        gdpPerCapita: projectedGdpPerCapita,
        totalGdp: projectedPopulation * projectedGdpPerCapita / 1000, // B
        populationDensity: (basePointForForecast.populationDensity ?? 0) * populationGrowthFactor,
        gdpDensity: (basePointForForecast.gdpDensity ?? 0) * gdpGrowthFactor,
        populationGrowth: country.populationGrowthRate * 100,
        gdpGrowth: country.adjustedGdpGrowth * 100,
        isForecast: true,
      });
    }
    // Add the last historical point to the beginning of the forecast to connect lines
    if (historicalSegmentData.length > 0 && forecastPoints.length > 0) {
        const lastHistoricalPoint = historicalSegmentData[historicalSegmentData.length - 1]!;
         return [{...lastHistoricalPoint, isForecast: true }, ...forecastPoints];
    }
    return forecastPoints;
  }, [country, historicalSegmentData, forecastYears, showForecastInHistorical, timeResolution, targetTime]);

  const chartDataForDisplay = useMemo(() => {
    return [...historicalSegmentData, ...forecastSegmentData.slice(1)].map(point => ({
        ...point,
        historicalPopulation: !point.isForecast ? point.population : undefined,
        forecastPopulation: point.isForecast ? point.population : undefined,
        historicalGdpPerCapita: !point.isForecast ? point.gdpPerCapita : undefined,
        forecastGdpPerCapita: point.isForecast ? point.gdpPerCapita : undefined,
        historicalTotalGdp: !point.isForecast ? point.totalGdp : undefined,
        forecastTotalGdp: point.isForecast ? point.totalGdp : undefined,
        historicalPopulationDensity: !point.isForecast ? point.populationDensity : undefined,
        forecastPopulationDensity: point.isForecast ? point.populationDensity : undefined,
        historicalGdpDensity: !point.isForecast ? point.gdpDensity : undefined,
        forecastGdpDensity: point.isForecast ? point.gdpDensity : undefined,
    }));
  }, [historicalSegmentData, forecastSegmentData]);

  const fullForecastData = useMemo(() => { // For the 10-year dedicated forecast view
    const baseData = [];
    const baseYear = IxTime.getCurrentGameYear(targetTime); // Use targetTime's game year as base
    
    const scenarios = {
      optimistic: { population: 1.2, gdp: 1.5 },
      baseline: { population: 1.0, gdp: 1.0 },
      pessimistic: { population: 0.8, gdp: 0.6 }
    };

    const yearsToForecast = Math.max(10, forecastYears);

    for (let year = 0; year <= yearsToForecast; year++) {
      const yearData: any = {
        year: baseYear + year,
        yearOffset: year,
        date: `${baseYear + year}`,
      };

      Object.entries(scenarios).forEach(([scenarioName, multipliers]) => {
        const popGrowthRate = country.populationGrowthRate * multipliers.population;
        const gdpGrowthRate = country.adjustedGdpGrowth * multipliers.gdp;
        
        const populationGrowthFactor = Math.pow(1 + popGrowthRate, year);
        const gdpGrowthFactor = Math.pow(1 + gdpGrowthRate, year);
        
        const projectedPopulation = country.currentPopulation * populationGrowthFactor;
        const projectedGdpPerCapita = country.currentGdpPerCapita * gdpGrowthFactor;
        const projectedTotalGdp = projectedPopulation * projectedGdpPerCapita;
        
        const suffix = scenarioName === 'baseline' ? '' : `_${scenarioName}`;
        
        yearData[`population${suffix}`] = projectedPopulation / 1000000;
        yearData[`gdpPerCapita${suffix}`] = projectedGdpPerCapita;
        yearData[`totalGdp${suffix}`] = projectedTotalGdp / 1000000000;
        
        if (country.landArea) {
          yearData[`populationDensity${suffix}`] = projectedPopulation / country.landArea;
          yearData[`gdpDensity${suffix}`] = projectedTotalGdp / country.landArea / 1000000;
        }
        yearData[`populationGrowthRate${suffix}`] = popGrowthRate * 100;
        yearData[`gdpGrowthRate${suffix}`] = gdpGrowthRate * 100;
      });
      baseData.push(yearData);
    }
    return baseData;
  }, [country, targetTime, forecastYears]);

  const forecastAnalysis = useMemo(() => {
    if (fullForecastData.length < 2) return null;
    const firstYear = fullForecastData[0]!;
    const lastYear = fullForecastData[Math.min(10, fullForecastData.length -1)]!; // 10-year or available
    
    const populationCAGR = Math.pow(lastYear.population / firstYear.population, 1/Math.min(10, fullForecastData.length -1)) - 1;
    const gdpPerCapitaCAGR = Math.pow(lastYear.gdpPerCapita / firstYear.gdpPerCapita, 1/Math.min(10, fullForecastData.length -1)) - 1;
    const totalGdpCAGR = Math.pow(lastYear.totalGdp / firstYear.totalGdp, 1/Math.min(10, fullForecastData.length -1)) - 1;
    
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
  }, [fullForecastData]);


  const formatTooltipNumber = (num: number, isCurrency = false, precision = 1): string => {
    if (isCurrency) {
      if (Math.abs(num) >= 1e3) return `$${(num / 1e3).toFixed(precision)}K`;
      return `$${num.toLocaleString(undefined, {minimumFractionDigits: precision, maximumFractionDigits: precision })}`;
    }
    if (Math.abs(num) >= 1000) return `${(num / 1000).toFixed(precision)}B`;
    if (Math.abs(num) >= 1) return `${num.toFixed(precision)}M`;
    return `${(num * 1000).toFixed(0)}K`; // Assuming numbers < 1M are populations in millions
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

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload;
      return (
        <div className="p-3 bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 rounded-lg">
          <p className="font-medium text-gray-900 dark:text-white mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={`item-${index}`} className="flex justify-between items-center mb-1">
              <span className="text-sm mr-4" style={{ color: entry.color }}>
                {entry.name}:
              </span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {entry.name.toLowerCase().includes('gdp') && entry.name.toLowerCase().includes('capita') 
                  ? `$${entry.value.toLocaleString()}`
                  : entry.name.toLowerCase().includes('gdp') && (entry.name.toLowerCase().includes('billion') || entry.name.toLowerCase().includes('total'))
                    ? `$${entry.value.toFixed(1)}B`
                    : entry.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
            </div>
          ))}
          {dataPoint.isForecast && (
            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 text-xs text-blue-600 dark:text-blue-400">
              Forecast data
            </div>
          )}
          {dataPoint.isRollingAverage && (
            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
              Rolling average ({timeResolution === 'quarterly' ? 'Quarterly' : 'Annual'})
            </div>
          )}
        </div>
      );
    }
    return null;
  };
  
  const renderHistoricalChart = () => {
    const commonProps = {
      data: chartDataForDisplay, // Use the segmented data
      margin: { top: 5, right: 30, left: 20, bottom: 60 } // Increased bottom margin for angled labels
    };
    const xAxisCommon = {
        dataKey:"date", 
        tick:{ fontSize: 10, fill: textColor }, 
        stroke:axisColor,
        angle:-45, // Angle labels
        textAnchor:"end" as const, // Anchor for angled labels
        height:50 // Ensure enough height for angled labels
    };

    switch (chartView) {
      case 'overview':
        return (
          <ComposedChart {...commonProps}>
            <defs>
              <linearGradient id="populationGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.1}/>
              </linearGradient>
              <linearGradient id="forecastPopulationGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4}/>
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.05}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={axisColor} opacity={0.5} />
            <XAxis {...xAxisCommon} />
            <YAxis yAxisId="population" tick={{ fontSize: 10, fill: textColor }} stroke={axisColor} label={{ value: 'Population (M)', angle: -90, position: 'insideLeft', fill: textColor, fontSize: 12 }}/>
            <YAxis yAxisId="gdp" orientation="right" tick={{ fontSize: 10, fill: textColor }} stroke={axisColor} label={{ value: 'GDP per Capita ($)', angle: 90, position: 'insideRight', fill: textColor, fontSize: 12 }}/>
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Area yAxisId="population" type="monotone" dataKey="historicalPopulation" stroke="#3B82F6" fillOpacity={1} fill="url(#populationGradient)" name="Population (M)" />
            <Area yAxisId="population" type="monotone" dataKey="forecastPopulation" stroke="#3B82F6" strokeDasharray="5 5" fillOpacity={1} fill="url(#forecastPopulationGradient)" name="Forecast Pop. (M)" />
            <Line yAxisId="gdp" type="monotone" dataKey="historicalGdpPerCapita" stroke="#10B981" strokeWidth={2} name="GDP per Capita ($)" dot={false}/>
            <Line yAxisId="gdp" type="monotone" dataKey="forecastGdpPerCapita" stroke="#10B981" strokeDasharray="5 5" strokeWidth={2} name="Forecast GDP p.c. ($)" dot={false}/>
            {targetTime !== IxTime.getCurrentIxTime() && (
              <ReferenceLine x={IxTime.formatIxTime(IxTime.getCurrentIxTime(), false).split(',')[1]?.trim()} stroke="#EF4444" strokeDasharray="5 5" yAxisId="population">
                <Label value="Present" position="top" fill="#EF4444" fontSize={11}/>
              </ReferenceLine>
            )}
          </ComposedChart>
        );
      case 'population':
        return (
          <AreaChart {...commonProps}>
             <defs>
              <linearGradient id="popGradientHist" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.1}/>
              </linearGradient>
              <linearGradient id="popGradientForecast" x1="0" y1="0" x2="0" y2="1">
                 <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4}/>
                 <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.05}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={axisColor} opacity={0.5} />
            <XAxis {...xAxisCommon} />
            <YAxis tick={{ fontSize: 10, fill: textColor }} stroke={axisColor} label={{ value: 'Population (M)', angle: -90, position: 'insideLeft', fill: textColor, fontSize: 12 }}/>
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Area type="monotone" dataKey="historicalPopulation" stroke="#3B82F6" fillOpacity={1} fill="url(#popGradientHist)" name="Population (Millions)" />
            <Area type="monotone" dataKey="forecastPopulation" stroke="#3B82F6" strokeDasharray="5 5" fillOpacity={1} fill="url(#popGradientForecast)" name="Forecast Pop. (M)" />
          </AreaChart>
        );
      case 'gdp':
        return (
          <ComposedChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke={axisColor} opacity={0.5} />
            <XAxis {...xAxisCommon} />
            <YAxis yAxisId="per-capita" tick={{ fontSize: 10, fill: textColor }} stroke={axisColor} label={{ value: 'Per Capita ($)', angle: -90, position: 'insideLeft', fill: textColor, fontSize: 12 }}/>
            <YAxis yAxisId="total" orientation="right" tick={{ fontSize: 10, fill: textColor }} stroke={axisColor} label={{ value: 'Total (B$)', angle: 90, position: 'insideRight', fill: textColor, fontSize: 12 }}/>
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Line yAxisId="per-capita" type="monotone" dataKey="historicalGdpPerCapita" stroke="#10B981" strokeWidth={2} name="GDP p.c. ($)" dot={false}/>
            <Line yAxisId="per-capita" type="monotone" dataKey="forecastGdpPerCapita" stroke="#10B981" strokeDasharray="5 5" strokeWidth={2} name="Forecast GDP p.c. ($)" dot={false}/>
            <Bar yAxisId="total" dataKey="historicalTotalGdp" fill="#F59E0B" name="Total GDP (B$)" barSize={20} />
             {/* Forecast Total GDP as a line for distinction or another bar with different style */}
            <Line yAxisId="total" type="monotone" dataKey="forecastTotalGdp" stroke="#F59E0B" strokeDasharray="5 5" strokeWidth={2} name="Forecast Total GDP (B$)" dot={false}/>
          </ComposedChart>
        );
      case 'density':
        return (
          <ComposedChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke={axisColor} opacity={0.5} />
            <XAxis {...xAxisCommon} />
            <YAxis yAxisId="popDensity" tick={{ fontSize: 10, fill: textColor }} stroke={axisColor} label={{ value: 'Pop. (/km²)', angle: -90, position: 'insideLeft', fill: textColor, fontSize: 12 }}/>
            <YAxis yAxisId="gdpDensity" orientation="right" tick={{ fontSize: 10, fill: textColor }} stroke={axisColor} label={{ value: 'GDP (M$/km²)', angle: 90, position: 'insideRight', fill: textColor, fontSize: 12 }}/>
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar yAxisId="popDensity" dataKey="historicalPopulationDensity" fill="#8B5CF6" name="Pop. Density (/km²)" barSize={20} />
            <Line yAxisId="gdpDensity" type="monotone" dataKey="historicalGdpDensity" stroke="#EF4444" strokeWidth={2} name="GDP Density (M$/km²)" dot={false}/>
            {/* Forecast segments */}
            <Bar yAxisId="popDensity" dataKey="forecastPopulationDensity" fill="#8B5CF6"  name="Forecast Pop. Density" barSize={20} opacity={0.6} />
            <Line yAxisId="gdpDensity" type="monotone" dataKey="forecastGdpDensity" stroke="#EF4444" strokeDasharray="5 5" strokeWidth={2} name="Forecast GDP Density" dot={false}/>
          </ComposedChart>
        );
      default: return <LineChart data={[]}><XAxis dataKey="date" /><YAxis /><Tooltip /></LineChart>;
    }
  };
    // Render forecast chart (similar structure, using fullForecastData)
    const renderForecastChart = () => {
        const commonProps = {
            data: fullForecastData, // Use dedicated forecast data structure
            margin: { top: 5, right: 30, left: 20, bottom: 60 }
        };
         const xAxisCommon = {
            dataKey:"date", 
            tick:{ fontSize: 10, fill: textColor }, 
            stroke:axisColor,
            angle:-45,
            textAnchor:"end" as const,
            height:50
        };

        switch (forecastView) {
            case 'combined':
                return (
                    <ComposedChart {...commonProps}>
                        <defs><linearGradient id="fcPopGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/><stop offset="95%" stopColor="#3B82F6" stopOpacity={0.1}/></linearGradient></defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={axisColor} opacity={0.5} />
                        <XAxis {...xAxisCommon} />
                        <YAxis yAxisId="population" tick={{ fontSize: 10, fill: textColor }} stroke={axisColor} label={{ value: 'Population (M)', angle: -90, position: 'insideLeft', fill: textColor, fontSize: 12 }}/>
                        <YAxis yAxisId="gdp" orientation="right" tick={{ fontSize: 10, fill: textColor }} stroke={axisColor} label={{ value: 'GDP p.c. ($)', angle: 90, position: 'insideRight', fill: textColor, fontSize: 12 }}/>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Area yAxisId="population" type="monotone" dataKey="population" stroke="#3B82F6" fillOpacity={1} fill="url(#fcPopGrad)" name="Population (M)" />
                        <Line yAxisId="gdp" type="monotone" dataKey="gdpPerCapita" stroke="#10B981" strokeWidth={3} name="GDP p.c. ($)" dot={false}/>
                        <ReferenceLine yAxisId="population" x={new Date(targetTime).getFullYear().toString()} stroke="#EF4444" strokeDasharray="3 3" label={{ value: "Base Year", position: "top", fill: "#EF4444", fontSize: 11 }}/>
                    </ComposedChart>
                );
            case 'scenarios':
                 return (
                    <LineChart {...commonProps}>
                        <CartesianGrid strokeDasharray="3 3" stroke={axisColor} opacity={0.5} />
                        <XAxis {...xAxisCommon} />
                        <YAxis yAxisId="gdpPerCapita" tick={{ fontSize: 10, fill: textColor }} stroke={axisColor} label={{ value: 'GDP p.c. ($)', angle: -90, position: 'insideLeft', fill: textColor, fontSize: 12 }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Line yAxisId="gdpPerCapita" type="monotone" dataKey="gdpPerCapita_optimistic" stroke="#10B981" strokeWidth={2} name="Optimistic" strokeDasharray="5 5" dot={false}/>
                        <Line yAxisId="gdpPerCapita" type="monotone" dataKey="gdpPerCapita" stroke="#3B82F6" strokeWidth={3} name="Baseline" dot={false}/>
                        <Line yAxisId="gdpPerCapita" type="monotone" dataKey="gdpPerCapita_pessimistic" stroke="#EF4444" strokeWidth={2} name="Pessimistic" strokeDasharray="5 5" dot={false}/>
                         <ReferenceLine yAxisId="gdpPerCapita" x={new Date(targetTime).getFullYear().toString()} stroke="#6B7280" strokeDasharray="3 3" label={{ value: "Base Year", position: "top", fill: "#6B7280", fontSize: 11 }}/>
                    </LineChart>
                );
             case 'population':
                return (
                    <AreaChart {...commonProps}>
                        <defs><linearGradient id="fcPopAreaGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.8}/><stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.1}/></linearGradient></defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={axisColor} opacity={0.5} />
                        <XAxis {...xAxisCommon} />
                        <YAxis yAxisId="population" tick={{ fontSize: 10, fill: textColor }} stroke={axisColor} label={{ value: 'Population (M)', angle: -90, position: 'insideLeft', fill: textColor, fontSize: 12 }}/>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Area yAxisId="population" type="monotone" dataKey="population" stroke="#8B5CF6" fillOpacity={1} fill="url(#fcPopAreaGrad)" name="Population (M)" />
                         <ReferenceLine yAxisId="population" x={new Date(targetTime).getFullYear().toString()} stroke="#EF4444" strokeDasharray="3 3" label={{ value: "Base Year", position: "top", fill: "#EF4444", fontSize: 11 }}/>
                    </AreaChart>
                );
            case 'gdp':
                return (
                    <ComposedChart {...commonProps}>
                        <CartesianGrid strokeDasharray="3 3" stroke={axisColor} opacity={0.5} />
                        <XAxis {...xAxisCommon} />
                        <YAxis yAxisId="perCapita" tick={{ fontSize: 10, fill: textColor }} stroke={axisColor} label={{ value: 'GDP p.c. ($)', angle: -90, position: 'insideLeft', fill: textColor, fontSize: 12 }}/>
                        <YAxis yAxisId="total" orientation="right" tick={{ fontSize: 10, fill: textColor }} stroke={axisColor} label={{ value: 'Total GDP (B$)', angle: 90, position: 'insideRight', fill: textColor, fontSize: 12 }}/>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Line yAxisId="perCapita" type="monotone" dataKey="gdpPerCapita" stroke="#10B981" strokeWidth={3} name="GDP per Capita ($)" dot={false}/>
                        <Bar yAxisId="total" dataKey="totalGdp" fill="#F59E0B" name="Total GDP (B$)" barSize={20}/>
                        <ReferenceLine yAxisId="perCapita" x={new Date(targetTime).getFullYear().toString()} stroke="#EF4444" strokeDasharray="3 3" label={{ value: "Base Year", position: "top", fill: "#EF4444", fontSize: 11 }}/>
                    </ComposedChart>
                );
             case 'density':
                if (!country.landArea) return <div className="h-full flex items-center justify-center"><AlertTriangle className="h-8 w-8 text-yellow-500 mr-2" /> Land area data needed.</div>;
                return (
                    <ComposedChart {...commonProps}>
                        <CartesianGrid strokeDasharray="3 3" stroke={axisColor} opacity={0.5} />
                        <XAxis {...xAxisCommon} />
                        <YAxis yAxisId="popDensity" tick={{ fontSize: 10, fill: textColor }} stroke={axisColor} label={{ value: 'Pop. /km²', angle: -90, position: 'insideLeft', fill: textColor, fontSize: 12 }}/>
                        <YAxis yAxisId="gdpDensity" orientation="right" tick={{ fontSize: 10, fill: textColor }} stroke={axisColor} label={{ value: 'GDP M$/km²', angle: 90, position: 'insideRight', fill: textColor, fontSize: 12 }}/>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Bar yAxisId="popDensity" dataKey="populationDensity" fill="#8B5CF6" name="Pop. Density" barSize={20}/>
                        <Line yAxisId="gdpDensity" type="monotone" dataKey="gdpDensity" stroke="#EF4444" strokeWidth={3} name="GDP Density (M$/km²)" dot={false}/>
                        <ReferenceLine yAxisId="popDensity" x={new Date(targetTime).getFullYear().toString()} stroke="#6B7280" strokeDasharray="3 3" label={{ value: "Base Year", position: "top", fill: "#6B7280", fontSize: 11 }}/>
                    </ComposedChart>
                );
            default: return <LineChart data={[]}><XAxis dataKey="date" /><YAxis /><Tooltip /></LineChart>;
        }
    };


  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center mb-4 sm:mb-0">
          <BarChart3 className="h-5 w-5 mr-2" />
          {country.name} {viewMode === 'historical' ? 'At a Glance (Last Year)' : 'Economic Forecast (10 Years)'}
        </h2>
        <div className="flex flex-wrap gap-2">
          <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <button onClick={() => setViewMode('historical')} className={`px-3 py-1 rounded text-sm font-medium ${viewMode === 'historical' ? 'bg-indigo-600 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>Historical</button>
            <button onClick={() => setViewMode('forecast')} className={`px-3 py-1 rounded text-sm font-medium ${viewMode === 'forecast' ? 'bg-indigo-600 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>Forecast</button>
          </div>
          {viewMode === 'historical' && (
            <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              {(['quarterly', 'annual'] as TimeResolution[]).map((res) => (
                <button key={res} onClick={() => setTimeResolution(res)} className={`px-3 py-1 rounded text-sm font-medium ${timeResolution === res ? 'bg-indigo-600 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>{res === 'quarterly' ? 'Quarterly' : 'Annual'}</button>
              ))}
            </div>
          )}
           {viewMode === 'historical' && (
             <button onClick={() => setShowForecastInHistorical(!showForecastInHistorical)} className={`px-3 py-1 rounded text-sm font-medium ${showForecastInHistorical ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>Show Forecast ({forecastYears}yr)</button>
           )}
           {viewMode === 'forecast' && (
            <button onClick={() => setShowScenarios(!showScenarios)} className={`px-3 py-1 rounded text-sm font-medium ${showScenarios ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>Scenarios</button>
           )}
        </div>
      </div>

      {viewMode === 'historical' && (
        <>
          <div className="flex flex-wrap gap-2 mb-6">
            {[{ key: 'overview', label: 'Overview', icon: Activity }, { key: 'population', label: 'Population', icon: Users }, { key: 'gdp', label: 'GDP', icon: TrendingUp }, { key: 'density', label: 'Density', icon: Globe }].map(({ key, label, icon: Icon }) => (
              <button key={key} onClick={() => setChartView(key as ChartView)} className={`flex items-center px-3 py-2 rounded-md text-sm font-medium ${chartView === key ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}><Icon className="h-4 w-4 mr-1" />{label}</button>
            ))}
          </div>
          <div className="h-80 mb-4">
            {isLoading ? (<div className="h-full flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 dark:border-indigo-500"></div></div>)
             : chartDataForDisplay.length > 0 ? (<ResponsiveContainer width="100%" height="100%">{renderHistoricalChart()}</ResponsiveContainer>)
             : (<div className="h-full flex items-center justify-center"><BarChart3 className="h-12 w-12 text-gray-400 opacity-50" /><p className="ml-2 text-gray-500">No data for selected period.</p></div>)}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            {[
                {label: "Population", value: formatTooltipNumber(country.currentPopulation / 1000000, false) + "M", growth: country.populationGrowthRate},
                {label: "GDP p.c.", value: formatTooltipNumber(country.currentGdpPerCapita, true), growth: country.adjustedGdpGrowth},
                {label: "Economic Tier", value: country.economicTier},
                {label: "Population Tier", value: country.populationTier}
            ].map(stat => (
                <div key={stat.label} className="text-center">
                    <div className="text-lg font-semibold text-gray-900 dark:text-white">{stat.value}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{stat.label}</div>
                    {stat.growth !== undefined && <div className={`text-xs ${stat.growth >=0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{(stat.growth * 100).toFixed(1)}% growth</div>}
                </div>
            ))}
          </div>
        </>
      )}

      {viewMode === 'forecast' && (
        <>
         {forecastAnalysis && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 text-center"><div className="text-2xl font-bold text-green-600 dark:text-green-400">{forecastAnalysis.populationCAGR.toFixed(1)}%</div><div className="text-sm text-gray-600 dark:text-gray-400">Pop. CAGR</div><div className="text-xs text-gray-500 dark:text-gray-500 mt-1">{formatTooltipNumber(forecastAnalysis.projectedPopulation10Y, false)}M in {new Date(targetTime).getFullYear() + 10}</div></div>
              <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 text-center"><div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{forecastAnalysis.gdpPerCapitaCAGR.toFixed(1)}%</div><div className="text-sm text-gray-600 dark:text-gray-400">GDP p.c. CAGR</div><div className="text-xs text-gray-500 dark:text-gray-500 mt-1">{formatTooltipNumber(forecastAnalysis.projectedGdpPerCapita10Y, true)} in {new Date(targetTime).getFullYear() + 10}</div></div>
              <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 text-center"><div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{forecastAnalysis.totalGdpCAGR.toFixed(1)}%</div><div className="text-sm text-gray-600 dark:text-gray-400">Total GDP CAGR</div><div className="text-xs text-gray-500 dark:text-gray-500 mt-1">{formatTooltipNumber(forecastAnalysis.projectedTotalGdp10Y * 1000, true)} in {new Date(targetTime).getFullYear() + 10}</div></div>
            </div>
          )}
          <div className="flex flex-wrap gap-2 mb-6">
            {[{ key: 'combined', label: 'Overview', icon: Activity }, { key: 'population', label: 'Population', icon: Users }, { key: 'gdp', label: 'GDP', icon: DollarSign }, { key: 'density', label: 'Density', icon: BarChart3 }, ...(showScenarios ? [{ key: 'scenarios', label: 'Scenarios', icon: Target }] : [])].map(({ key, label, icon: Icon }) => (
              <button key={key} onClick={() => setForecastView(key as ForecastView)} className={`flex items-center px-3 py-2 rounded-md text-sm font-medium ${forecastView === key ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}><Icon className="h-4 w-4 mr-1" />{label}</button>
            ))}
          </div>
          <div className="h-80 mb-4">
            {isLoadingForecast ? (<div className="h-full flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 dark:border-indigo-500"></div><p className="ml-2 text-gray-500">Generating forecast...</p></div>)
             : (<ResponsiveContainer width="100%" height="100%">{renderForecastChart()}</ResponsiveContainer>)}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4"><h3 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center"><Zap className="h-4 w-4 mr-2" />Growth Assumptions</h3><div className="space-y-1 text-sm"><div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Pop. Growth:</span><span className="text-gray-900 dark:text-white">{(country.populationGrowthRate * 100).toFixed(2)}%</span></div><div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">GDP Growth:</span><span className="text-gray-900 dark:text-white">{(country.adjustedGdpGrowth * 100).toFixed(2)}%</span></div></div></div>
            <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4"><h3 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center"><AlertTriangle className="h-4 w-4 mr-2" />Notes</h3><div className="text-sm text-gray-600 dark:text-gray-400 space-y-1"><p>• Projections based on current rates.</p><p>• Does not account for cycles or external factors.</p></div></div>
          </div>
        </>
      )}

      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
        <div className="flex items-start">
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 mr-2 flex-shrink-0" />
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {viewMode === 'historical' ? (
              <>Chart shows {timeResolution} rolling average for the last {timeResolution === 'quarterly' ? '3 months' : '12 months'} ending at selected IxTime. {showForecastInHistorical && forecastYears > 0 && `Forecast extends ${forecastYears} years.`}</>
            ) : (
              <>10-year forecast from {IxTime.getCurrentGameYear(targetTime)}. {showScenarios && "Scenarios explore different growth outcomes."}</>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}