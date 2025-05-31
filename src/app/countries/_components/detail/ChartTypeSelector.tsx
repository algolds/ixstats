// src/app/countries/_components/detail/ChartTypeSelector.tsx
"use client";

import { BarChart3, TrendingUp, Users, Globe } from "lucide-react";

export type ChartType = 'density' | 'efficiency' | 'growth' | 'comparison';

interface AvailableData {
  hasLandArea: boolean;
  hasHistoricalData: boolean;
  hasComparison: boolean;
  hasDensityData: boolean;
}

interface ChartTypeSelectorProps {
  selectedChart: ChartType;
  onChartChange: (chartType: ChartType) => void;
  availableData: AvailableData;
  isCompact?: boolean;
}

export function ChartTypeSelector({
  selectedChart,
  onChartChange,
  availableData,
  isCompact = false
}: ChartTypeSelectorProps) {
  const chartTypes = [
    { 
      key: 'density', 
      label: 'Density', 
      icon: Globe, 
      disabled: !availableData.hasLandArea || !availableData.hasDensityData 
    },
    { 
      key: 'efficiency', 
      label: 'Efficiency', 
      icon: TrendingUp, 
      disabled: !availableData.hasLandArea 
    },
    { 
      key: 'growth', 
      label: 'Growth Trends', 
      icon: BarChart3, 
      disabled: false 
    },
    { 
      key: 'comparison', 
      label: 'Comparison', 
      icon: Users, 
      disabled: !availableData.hasComparison 
    },
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Chart Type
      </h2>
      
      <div className="flex flex-wrap gap-2">
        {chartTypes.map(({ key, label, icon: Icon, disabled }) => (
          <button
            key={key}
            onClick={() => !disabled && onChartChange(key as ChartType)}
            disabled={disabled}
            className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              selectedChart === key
                ? 'bg-indigo-600 text-white'
                : disabled
                  ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            <Icon className="h-4 w-4 mr-1" />
            {label}
          </button>
        ))}
      </div>
      
      {isCompact && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
          Select a chart type to view different analyses
        </p>
      )}
    </div>
  );
}
