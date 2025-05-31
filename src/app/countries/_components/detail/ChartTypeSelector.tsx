// src/app/countries/_components/detail/ChartTypeSelector.tsx
"use client";

import { BarChart3, TrendingUp, Users, Globe, Activity, Maximize, Minimize, type LucideIcon } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { cn } from "~/lib/utils";

export type ChartType = 'overview' | 'population' | 'gdp' | 'density' | 'efficiency' | 'growth' | 'comparison';

interface AvailableData {
  hasLandArea: boolean;
  hasHistoricalData: boolean;
  hasComparison: boolean; // Assuming you might fetch comparison data later
  hasDensityData: boolean;
}

interface ChartTypeConfigItem {
  key: ChartType;
  label: string;
  icon: LucideIcon;
  disabled: boolean;
  description: string;
}

interface ChartTypeSelectorProps {
  selectedChart: ChartType;
  onChartChange: (chartType: ChartType) => void;
  availableData: AvailableData;
  isCompact?: boolean; // For potentially different styling in compact mode
  isExpanded?: boolean; // To show expand/collapse button
  onToggleExpand?: () => void; // Handler for expand/collapse
}

export function ChartTypeSelector({
  selectedChart,
  onChartChange,
  availableData,
  isCompact = false,
  isExpanded,
  onToggleExpand,
}: ChartTypeSelectorProps) {

  const chartTypesConfig: ChartTypeConfigItem[] = [
    {
      key: 'overview',
      label: 'Overview',
      icon: Activity,
      disabled: false, // Overview is generally always available
      description: "Combined population and GDP per capita trends."
    },
    {
      key: 'population',
      label: 'Population',
      icon: Users,
      disabled: false, // Population data is usually available
      description: "Population trends and growth analysis."
    },
    {
      key: 'gdp',
      label: 'GDP',
      icon: TrendingUp,
      disabled: false, // GDP data is usually available
      description: "GDP per capita and total GDP analysis."
    },
    {
      key: 'density',
      label: 'Density',
      icon: Globe,
      disabled: !availableData.hasLandArea || !availableData.hasDensityData,
      description: "Population and GDP density if land area is available."
    },
    // You can add more chart types here if needed
    // {
    //   key: 'efficiency',
    //   label: 'Efficiency',
    //   icon: TrendingUp,
    //   disabled: !availableData.hasLandArea,
    //   description: "Economic efficiency metrics."
    // },
    // {
    //   key: 'growth',
    //   label: 'Growth Trends',
    //   icon: BarChart3,
    //   disabled: !availableData.hasHistoricalData,
    //   description: "Detailed growth rate analysis over time."
    // },
    // {
    //   key: 'comparison',
    //   label: 'Comparison',
    //   icon: Users,
    //   disabled: !availableData.hasComparison,
    //   description: "Compare with other nations or global averages."
    // },
  ];

  if (isCompact) {
    return (
        <ToggleGroup
            type="single"
            value={selectedChart}
            onValueChange={(value) => { if (value) onChartChange(value as ChartType);}}
            aria-label="Chart Type Selector"
            className="flex flex-wrap justify-center gap-1"
        >
            {chartTypesConfig.map(({ key, label, icon: Icon, disabled }: ChartTypeConfigItem) => (
                <ToggleGroupItem
                    key={key}
                    value={key}
                    disabled={disabled}
                    aria-label={label}
                    size="sm"
                    className="h-8 px-2 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                >
                    <Icon className="h-3.5 w-3.5 mr-1.5" />
                    {label}
                </ToggleGroupItem>
            ))}
        </ToggleGroup>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
            <CardTitle className="flex items-center">
                <BarChart3 className="h-5 w-5 mr-2 text-primary" />
                Chart Views
            </CardTitle>
            {onToggleExpand && (
                 <Button variant="ghost" size="icon" onClick={onToggleExpand} className="h-7 w-7">
                    {isExpanded ? <Minimize className="h-4 w-4"/> : <Maximize className="h-4 w-4"/>}
                 </Button>
            )}
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-6">
        <div className="grid grid-cols-2 sm:grid-cols-2 gap-2 sm:gap-3">
          {chartTypesConfig.map(({ key, label, icon: Icon, disabled, description }: ChartTypeConfigItem) => (
            <Button
              key={key}
              variant={selectedChart === key ? "default" : "outline"}
              onClick={() => !disabled && onChartChange(key as ChartType)}
              disabled={disabled}
              className={cn(
                "w-full justify-start text-left h-auto py-2.5 px-3",
                disabled && "opacity-50 cursor-not-allowed"
              )}
              title={disabled ? `${label} (Data unavailable)` : description}
            >
              <Icon className="h-4 w-4 mr-2 flex-shrink-0" />
              <div className="flex flex-col">
                <span className="text-sm font-medium">{label}</span>
                {!isCompact && description && <span className="text-xs text-muted-foreground hidden sm:block">{description}</span>}
              </div>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
