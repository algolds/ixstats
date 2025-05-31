// src/components/charts/SyncedChart.tsx
import React, { useMemo } from "react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Legend,
  ReferenceLine,
  Rectangle,
} from "recharts";
import { useIxStats } from "~/context/ixstats-context";
import { IxTime } from "~/lib/ixtime";
import { ChartDataProcessor } from "~/lib/chart-data-processor";
import type { ChartDataPoint } from "~/lib/chart-data-processor";

export type ChartType = 'line' | 'area' | 'bar' | 'composed';

export interface SyncedChartProps {
  // Chart data
  data: ChartDataPoint[];
  
  // Styling
  height?: number | string;
  width?: number | string;
  className?: string;
  
  // Chart configuration
  chartType?: ChartType;
  chartSubType?: string; // For composed charts, e.g. 'overview', 'population', 'gdp'
  
  // Display options
  showEpochLine?: boolean;
  showPresentLine?: boolean;
  showForecast?: boolean;
  showDensity?: boolean;
  
  // Axis configuration
  xAxisDataKey?: string;
  yAxisDataKey?: string;
  secondaryYAxisDataKey?: string;
  
  // Tooltip customization
  tooltipFormatter?: (value: any, name: string, props: any) => React.ReactNode;
  tooltipLabelFormatter?: (label: any) => React.ReactNode;
  
  // Event handlers
  onPointClick?: (point: ChartDataPoint) => void;
}

/**
 * Custom tooltip component for the chart
 */
const CustomTooltip = ({ active, payload, label, labelFormatter }: any) => {
  const { formatGameYear, chartColors } = useIxStats();
  
  if (active && payload && payload.length) {
    const dataPoint = payload[0]?.payload;
    if (!dataPoint) return null;
    
    const displayLabel = labelFormatter 
      ? labelFormatter(dataPoint) 
      : (dataPoint.period || formatGameYear(dataPoint.timestamp || label));

    return (
      <div className="bg-popover text-popover-foreground border border-border rounded-md p-3 shadow-lg text-sm">
        <p className="font-medium mb-2">{displayLabel}</p>
        {payload.map((entry: any, index: number) => {
          if (!entry || entry.value === undefined || entry.value === null) return null;
          
          const isForecast = entry.dataKey.includes("forecast");
          const displayName = entry.name.replace(" (Forecast)", "");
          
          return (
            <div key={`item-${index}`} className="flex justify-between items-center text-xs mb-1">
              <span 
                className={`mr-2 flex items-center ${isForecast ? "opacity-70" : ""}`}
                style={{ color: entry.color }}
              >
                {isForecast && "⏱ "}{displayName}:
              </span>
              <span className="font-semibold">
                {typeof entry.value === 'number' ? 
                  formatTooltipValue(entry.name, entry.value) : 
                  entry.value}
              </span>
            </div>
          );
        })}
        {dataPoint.isEpoch && (
          <div className="mt-2 text-xs text-amber-500 font-medium">Game Epoch (January 1, 2028)</div>
        )}
        {dataPoint.isPresent && (
          <div className="mt-2 text-xs text-blue-500 font-medium">Current Time</div>
        )}
      </div>
    );
  }
  return null;
};

/**
 * Helper function to format tooltip values based on data type
 */
const formatTooltipValue = (name: string, value: number): string => {
  if (!isFinite(value) || isNaN(value)) return 'N/A';
  
  if (name.toLowerCase().includes('gdp') && name.toLowerCase().includes('capita')) {
    return `$${Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  }
  if (name.toLowerCase().includes('gdp') && (name.toLowerCase().includes('billion') || name.toLowerCase().includes('total'))) {
    return `$${Number(value).toFixed(1)}B`;
  }
  if (name.toLowerCase().includes('population') && name.toLowerCase().includes('(m)')) {
    return `${Number(value).toFixed(1)}M`;
  }
  if (name.toLowerCase().includes('density')) {
    return Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 });
  }
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
};

/**
 * Custom reference line dot for epoch and present markers
 */
const CustomReferenceDot = (props: any) => {
  const { cx, cy, payload, fill, stroke } = props;
  
  return (
    <g>
      <rect x={cx - 7} y={cy - 7} width={14} height={14} 
        fill={fill || "rgba(245, 158, 11, 0.6)"} 
        stroke={stroke || "rgba(245, 158, 11, 0.8)"}
        rx={3} ry={3}
        transform={`rotate(45, ${cx}, ${cy})`}
      />
    </g>
  );
};

/**
 * SyncedChart component - the core chart component aligned with IxTime
 */
export const SyncedChart: React.FC<SyncedChartProps> = ({
  data,
  height = 300,
  width = "100%",
  className = "",
  chartType = 'line',
  chartSubType = 'default',
  showEpochLine = true,
  showPresentLine = true,
  showForecast = true,
  showDensity = false,
  xAxisDataKey = "timestamp",
  yAxisDataKey = "population",
  secondaryYAxisDataKey,
  tooltipFormatter,
  tooltipLabelFormatter = undefined,
  onPointClick,
}) => {
  const { timeResolution, chartColors } = useIxStats();

  // Reference timestamps for epoch and present
  const referenceTimestamps = useMemo(() => {
    if (!data.length) return { epoch: null, present: null };
    
    const minTime = Math.min(...data.map(d => d.timestamp));
    const maxTime = Math.max(...data.map(d => d.timestamp));
    
    return ChartDataProcessor.getReferenceTimestamps(minTime, maxTime);
  }, [data]);

  // Format x-axis ticks
  const formatXAxis = (timestamp: number) => {
    return ChartDataProcessor.formatTimestamp(timestamp, timeResolution);
  };

  // Filter data to show or hide forecast
  const visibleData = useMemo(() => {
    if (showForecast) return data;
    return data.filter(d => !d.isForecast);
  }, [data, showForecast]);

  // Common chart props
  const commonChartProps = {
    data: visibleData,
    margin: { top: 5, right: 5, left: 5, bottom: 25 },
  };
  
  // Common axis props
  const xAxisProps = {
    dataKey: xAxisDataKey,
    type: "number" as const,
    domain: ['dataMin', 'dataMax'] as [any, any],
    tickFormatter: formatXAxis,
    tick: { fontSize: 10, fill: chartColors.text },
    stroke: chartColors.axis,
    angle: -30,
    textAnchor: "end" as const,
    height: 40,
    interval: Math.max(0, Math.floor(visibleData.length / 8)) as any, // Show max 8 labels
  };
  
  const yAxisProps = {
    tick: { fontSize: 10, fill: chartColors.text },
    stroke: chartColors.axis,
  };
  
  // Common grid props
  const gridProps = {
    strokeDasharray: "3 3",
    stroke: chartColors.grid,
    opacity: 0.2,
  };
  
  // Common tooltip props
  const tooltipProps = {
    content: <CustomTooltip labelFormatter={tooltipLabelFormatter} />,
    formatter: tooltipFormatter,
  };
  
  // Reference line props
  const epochLineProps = showEpochLine && referenceTimestamps.epoch ? {
    x: referenceTimestamps.epoch,
    stroke: chartColors.referenceLines.epoch,
    strokeDasharray: "3 3",
    label: {
      value: "Game Epoch",
      position: "top",
      fill: chartColors.referenceLines.epoch,
      fontSize: 10,
    },
  } : null;
  
  const presentLineProps = showPresentLine && referenceTimestamps.present ? {
    x: referenceTimestamps.present,
    stroke: chartColors.referenceLines.present,
    strokeDasharray: "3 3",
    label: {
      value: "Present",
      position: "top",
      fill: chartColors.referenceLines.present,
      fontSize: 10,
    },
  } : null;

  // Render the appropriate chart type
  const renderChart = () => {
    switch (chartType) {
      case 'area':
        return (
          <AreaChart {...commonChartProps}>
            <CartesianGrid {...gridProps} />
            <XAxis {...xAxisProps} />
            <YAxis {...yAxisProps} />
            <Tooltip {...tooltipProps} />
            <Legend wrapperStyle={{ fontSize: "12px" }} />
            
            <defs>
              <linearGradient id="colorPop" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={chartColors.population} stopOpacity={0.8}/>
                <stop offset="95%" stopColor={chartColors.population} stopOpacity={0.1}/>
              </linearGradient>
              <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={chartColors.forecast} stopOpacity={0.6}/>
                <stop offset="95%" stopColor={chartColors.forecast} stopOpacity={0.1}/>
              </linearGradient>
            </defs>
            
            <Area 
              type="monotone" 
              dataKey={showDensity ? "populationDensity" : "population"} 
              name={showDensity ? "Population Density" : "Population (M)"} 
              stroke={chartColors.population} 
              fill="url(#colorPop)" 
              dot={false}
              activeDot={{ r: 6, onClick: (_, index) => onPointClick?.(visibleData[index]) }}
            />
            
            {showForecast && (
              <Area 
                type="monotone" 
                dataKey={showDensity ? "forecastPopulationDensity" : "forecastPopulation"} 
                name={showDensity ? "Population Density (Forecast)" : "Population (M) (Forecast)"} 
                stroke={chartColors.forecast} 
                strokeDasharray="3 3" 
                fill="url(#colorForecast)" 
                dot={false}
                activeDot={{ r: 6, onClick: (_, index) => onPointClick?.(visibleData[index]) }}
              />
            )}
            
            {epochLineProps && <ReferenceLine {...epochLineProps} />}
            {presentLineProps && <ReferenceLine {...presentLineProps} />}
          </AreaChart>
        );
        
      case 'bar':
        return (
          <ComposedChart {...commonChartProps}>
            <CartesianGrid {...gridProps} />
            <XAxis {...xAxisProps} />
            <YAxis {...yAxisProps} />
            <Tooltip {...tooltipProps} />
            <Legend wrapperStyle={{ fontSize: "12px" }} />
            
            <Bar 
              dataKey={showDensity ? "populationDensity" : yAxisDataKey} 
              name={showDensity ? "Population Density" : "Population (M)"} 
              fill={chartColors.population} 
              opacity={0.8}
              onClick={(data) => onPointClick?.(data)}
            />
            
            {showForecast && (
              <Bar 
                dataKey={showDensity ? "forecastPopulationDensity" : `forecast${yAxisDataKey.charAt(0).toUpperCase() + yAxisDataKey.slice(1)}`} 
                name={`${showDensity ? "Population Density" : "Population (M)"} (Forecast)`} 
                fill={chartColors.forecast} 
                opacity={0.4}
                onClick={(data) => onPointClick?.(data)}
              />
            )}
            
            {epochLineProps && <ReferenceLine {...epochLineProps} />}
            {presentLineProps && <ReferenceLine {...presentLineProps} />}
          </ComposedChart>
        );
        
      case 'composed':
        if (chartSubType === 'overview') {
          return (
            <ComposedChart {...commonChartProps}>
              <CartesianGrid {...gridProps} />
              <XAxis {...xAxisProps} />
              <YAxis 
                yAxisId="left" 
                orientation="left" 
                {...yAxisProps}
                label={{ 
                  value: 'Population (M)', 
                  angle: -90, 
                  position: 'insideLeft', 
                  fill: chartColors.text, 
                  fontSize: 11, 
                  dy: 40 
                }}
              />
              <YAxis 
                yAxisId="right" 
                orientation="right" 
                {...yAxisProps}
                label={{ 
                  value: 'GDP p.c. ($)', 
                  angle: 90, 
                  position: 'insideRight', 
                  fill: chartColors.text, 
                  fontSize: 11, 
                  dy: -40 
                }} 
                tickFormatter={(val) => isFinite(val) ? `$${(val/1000).toFixed(0)}k` : '$0'} 
              />
              <Tooltip {...tooltipProps} />
              <Legend wrapperStyle={{fontSize: "12px"}} />
              
              <defs>
                <linearGradient id="colorPop" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chartColors.population} stopOpacity={0.8}/>
                  <stop offset="95%" stopColor={chartColors.population} stopOpacity={0.1}/>
                </linearGradient>
                <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chartColors.population} stopOpacity={0.4}/>
                  <stop offset="95%" stopColor={chartColors.population} stopOpacity={0.05}/>
                </linearGradient>
              </defs>
              
              <Area 
                yAxisId="left" 
                type="monotone" 
                dataKey="population" 
                name="Population (M)" 
                stroke={chartColors.population} 
                fill="url(#colorPop)" 
                dot={false}
                activeDot={{ r: 6, onClick: (_, index) => onPointClick?.(visibleData[index]) }}
              />
              
              {showForecast && (
                <Area 
                  yAxisId="left" 
                  type="monotone" 
                  dataKey="forecastPopulation" 
                  name="Population (M) (Forecast)" 
                  stroke={chartColors.population} 
                  strokeDasharray="3 3" 
                  fill="url(#colorForecast)" 
                  dot={false}
                  activeDot={{ r: 6, onClick: (_, index) => onPointClick?.(visibleData[index]) }}
                />
              )}
              
              <Line 
                yAxisId="right" 
                type="monotone" 
                dataKey="gdpPerCapita" 
                name="GDP p.c." 
                stroke={chartColors.gdp} 
                strokeWidth={2} 
                dot={false}
                activeDot={{ r: 6, onClick: (_, index) => onPointClick?.(visibleData[index]) }}
              />
              
              {showForecast && (
                <Line 
                  yAxisId="right" 
                  type="monotone" 
                  dataKey="forecastGdpPerCapita" 
                  name="GDP p.c. (Forecast)" 
                  stroke={chartColors.gdp} 
                  strokeDasharray="3 3" 
                  strokeWidth={2} 
                  dot={false}
                  activeDot={{ r: 6, onClick: (_, index) => onPointClick?.(visibleData[index]) }}
                />
              )}
              
              {epochLineProps && <ReferenceLine {...epochLineProps} />}
              {presentLineProps && <ReferenceLine {...presentLineProps} />}
            </ComposedChart>
          );
        }
        
        if (chartSubType === 'gdp') {
          return (
            <ComposedChart {...commonChartProps}>
              <CartesianGrid {...gridProps} />
              <XAxis {...xAxisProps} />
              <YAxis 
                yAxisId="left" 
                orientation="left" 
                {...yAxisProps}
                label={{ 
                  value: 'GDP per Capita ($)', 
                  angle: -90, 
                  position: 'insideLeft', 
                  fill: chartColors.text, 
                  fontSize: 11, 
                  dy: 40 
                }} 
                tickFormatter={(val) => isFinite(val) ? `$${(val/1000).toFixed(0)}k` : '$0'} 
              />
              <YAxis 
                yAxisId="right" 
                orientation="right" 
                {...yAxisProps}
                label={{ 
                  value: 'Total GDP (B$)', 
                  angle: 90, 
                  position: 'insideRight', 
                  fill: chartColors.text, 
                  fontSize: 11, 
                  dy: -40 
                }} 
              />
              <Tooltip {...tooltipProps} />
              <Legend wrapperStyle={{fontSize: "12px"}}/>
              
              <Line 
                yAxisId="left" 
                type="monotone" 
                dataKey="gdpPerCapita" 
                name="GDP p.c." 
                stroke={chartColors.gdp} 
                strokeWidth={2} 
                dot={false}
                activeDot={{ r: 6, onClick: (_, index) => onPointClick?.(visibleData[index]) }}
              />
              
              {showForecast && (
                <Line 
                  yAxisId="left" 
                  type="monotone" 
                  dataKey="forecastGdpPerCapita" 
                  name="GDP p.c. (Forecast)" 
                  stroke={chartColors.gdp} 
                  strokeDasharray="3 3" 
                  strokeWidth={2} 
                  dot={false}
                  activeDot={{ r: 6, onClick: (_, index) => onPointClick?.(visibleData[index]) }}
                />
              )}
              
              <Bar 
                yAxisId="right" 
                dataKey="totalGdp" 
                name="Total GDP (B$)" 
                fill={chartColors.forecast} 
                opacity={0.7} 
                barSize={timeResolution === 'annual' ? 20 : 10} 
                onClick={(data) => onPointClick?.(data)}
              />
              
              {showForecast && (
                <Bar 
                  yAxisId="right" 
                  dataKey="forecastTotalGdp" 
                  name="Total GDP (B$) (Forecast)" 
                  fill={chartColors.forecast} 
                  opacity={0.4} 
                  barSize={timeResolution === 'annual' ? 20 : 10} 
                  onClick={(data) => onPointClick?.(data)}
                />
              )}
              
              {epochLineProps && <ReferenceLine {...epochLineProps} />}
              {presentLineProps && <ReferenceLine {...presentLineProps} />}
            </ComposedChart>
          );
        }
        
        // Default composed chart
        return (
          <ComposedChart {...commonChartProps}>
            <CartesianGrid {...gridProps} />
            <XAxis {...xAxisProps} />
            <YAxis {...yAxisProps} />
            <Tooltip {...tooltipProps} />
            <Legend wrapperStyle={{fontSize: "12px"}}/>
            
            <Line 
              type="monotone" 
              dataKey={yAxisDataKey} 
              name={yAxisDataKey.charAt(0).toUpperCase() + yAxisDataKey.slice(1)} 
              stroke={chartColors.population} 
              dot={false}
              activeDot={{ r: 6, onClick: (_, index) => onPointClick?.(visibleData[index]) }}
            />
            
            {secondaryYAxisDataKey && (
              <Bar 
                dataKey={secondaryYAxisDataKey} 
                name={secondaryYAxisDataKey.charAt(0).toUpperCase() + secondaryYAxisDataKey.slice(1)} 
                fill={chartColors.gdp} 
                opacity={0.7}
                onClick={(data) => onPointClick?.(data)}
              />
            )}
            
            {epochLineProps && <ReferenceLine {...epochLineProps} />}
            {presentLineProps && <ReferenceLine {...presentLineProps} />}
          </ComposedChart>
        );
        
      case 'line':
      default:
        return (
          <LineChart {...commonChartProps}>
            <CartesianGrid {...gridProps} />
            <XAxis {...xAxisProps} />
            <YAxis {...yAxisProps} />
            <Tooltip {...tooltipProps} />
            <Legend wrapperStyle={{fontSize: "12px"}}/>
            
            <Line 
              type="monotone" 
              dataKey={showDensity ? "populationDensity" : yAxisDataKey} 
              name={showDensity ? "Population Density" : "Population (M)"} 
              stroke={chartColors.population} 
              dot={false}
              activeDot={{ r: 6, onClick: (_, index) => onPointClick?.(visibleData[index]) }}
            />
            
            {showForecast && (
              <Line 
                type="monotone" 
                dataKey={showDensity ? "forecastPopulationDensity" : `forecast${yAxisDataKey.charAt(0).toUpperCase() + yAxisDataKey.slice(1)}`} 
                name={`${showDensity ? "Population Density" : "Population (M)"} (Forecast)`} 
                stroke={chartColors.forecast} 
                strokeDasharray="3 3" 
                dot={false}
                activeDot={{ r: 6, onClick: (_, index) => onPointClick?.(visibleData[index]) }}
              />
            )}
            
            {secondaryYAxisDataKey && (
              <Line 
                type="monotone" 
                dataKey={secondaryYAxisDataKey} 
                name={secondaryYAxisDataKey.charAt(0).toUpperCase() + secondaryYAxisDataKey.slice(1)} 
                stroke={chartColors.gdp} 
                dot={false}
                activeDot={{ r: 6, onClick: (_, index) => onPointClick?.(visibleData[index]) }}
              />
            )}
            
            {epochLineProps && <ReferenceLine {...epochLineProps} />}
            {presentLineProps && <ReferenceLine {...presentLineProps} />}
          </LineChart>
        );
    }
  };

  return (
    <div className={`epoch-aligned-chart ${className}`}>
      <ResponsiveContainer width={width} height={height}>
        {renderChart()}
      </ResponsiveContainer>
    </div>
  );
};