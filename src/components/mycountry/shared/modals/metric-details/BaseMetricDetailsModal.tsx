"use client";

import React, { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { Button } from "~/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Refresh as RefreshCw,
  StatsReport as BarChart3,
  StatUp as TrendingUp,
  Globe,
  InfoCircle as Info,
} from "iconoir-react";
import { cn } from "~/lib/utils/cn";
import { type TimeRange, type ChartType, TIME_RANGE_OPTIONS, CHART_TYPE_OPTIONS } from "./types";
import { type MetricThemeVariant, getThemeClasses } from "./MetricModalLayout";

export interface MetricModalTab {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export interface BaseMetricDetailsModalProps {
  /** Modal open state */
  isOpen: boolean;
  /** Close handler */
  onClose: () => void;
  /** Country ID for data fetching */
  countryId: string;
  /** Country name for display */
  countryName?: string;
  /** Modal title */
  title: string;
  /** Modal description */
  description?: string;
  /** Title icon */
  icon: React.ComponentType<{ className?: string }>;
  /** Icon color class */
  iconColor?: string;
  /** Tab configuration */
  tabs?: MetricModalTab[];
  /** Whether data is loading */
  isLoading?: boolean;
  /** Refresh callback */
  onRefresh?: () => void;
  /** Show time range selector */
  showTimeRange?: boolean;
  /** Show chart type selector */
  showChartType?: boolean;
  /** Render function for tab content */
  children: (activeTab: string, timeRange: TimeRange, chartType: ChartType) => React.ReactNode;
  /** Theme variation for Facet UI color styling */
  variant?: MetricThemeVariant;
  /** Default time range (default: 5y per Dashboard fix) */
  defaultTimeRange?: TimeRange;
  /** Default chart type */
  defaultChartType?: ChartType;
  /** localStorage key for persisting tab/time/chart across refresh */
  persistKey?: string;
}

/**
 * Default tabs for metric modals
 */
const DEFAULT_TABS: MetricModalTab[] = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "trends", label: "Trends", icon: TrendingUp },
  { id: "comparison", label: "Comparison", icon: Globe },
  { id: "details", label: "Details", icon: Info },
];

/**
 * BaseMetricDetailsModal - Reusable base component for metric detail modals
 *
 * Provides:
 * - Glass physics styling
 * - 4-tab system (Overview, Trends, Comparison, Details)
 * - Time range selector
 * - Chart type selector
 * - Responsive sizing
 * - Keyboard escape handling
 * - Body scroll lock
 *
 * @example
 * ```tsx
 * <BaseMetricDetailsModal
 *   isOpen={isOpen}
 *   onClose={onClose}
 *   countryId={countryId}
 *   countryName="United States"
 *   title="Labor Force Analysis"
 *   icon={Users}
 *   iconColor="text-blue-500"
 * >
 *   {(activeTab, timeRange, chartType) => (
 *     <>
 *       {activeTab === 'overview' && <OverviewContent />}
 *       {activeTab === 'trends' && <TrendsChart timeRange={timeRange} />}
 *       // ...
 *     </>
 *   )}
 * </BaseMetricDetailsModal>
 * ```
 */
export function BaseMetricDetailsModal({
  isOpen,
  onClose,
  // oxlint-disable-next-line eslint/no-unused-vars
  countryId,
  countryName,
  title,
  description,
  icon: Icon,
  iconColor,
  tabs = DEFAULT_TABS,
  isLoading = false,
  onRefresh,
  showTimeRange = true,
  showChartType = true,
  variant = "default",
  defaultTimeRange = "5y",
  defaultChartType = "line",
  persistKey,
  children,
}: BaseMetricDetailsModalProps) {
  const [activeTab, setActiveTab] = useState(tabs[0]?.id || "overview");
  const [timeRange, setTimeRange] = useState<TimeRange>(defaultTimeRange);
  const [chartType, setChartType] = useState<ChartType>(defaultChartType);
  const theme = getThemeClasses(variant);

  // Persist/restore tab/time/chart when persistKey set. Default 5y survives refresh/leave-return.
  useEffect(() => {
    if (!persistKey || typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(persistKey);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          activeTab?: string;
          timeRange?: TimeRange;
          chartType?: ChartType;
        };
        // oxlint-disable-next-line
        if (parsed.activeTab && tabs.some((t) => t.id === parsed.activeTab))
          setActiveTab(parsed.activeTab);
        if (parsed.timeRange) setTimeRange(parsed.timeRange);
        if (parsed.chartType) setChartType(parsed.chartType);
      }
    } catch {
      /* ignore */
    }
  }, [persistKey, tabs]);

  useEffect(() => {
    if (!persistKey || typeof window === "undefined") return;
    try {
      localStorage.setItem(persistKey, JSON.stringify({ activeTab, timeRange, chartType }));
    } catch {
      /* ignore */
    }
  }, [persistKey, activeTab, timeRange, chartType]);

  // Keep valid tab if tabs change (e.g. Details removed)
  useEffect(() => {
    // oxlint-disable-next-line
    if (!tabs.some((t) => t.id === activeTab)) setActiveTab(tabs[0]?.id || "overview");
  }, [tabs, activeTab]);

  // Escape and scroll locking come from the Sheet primitive (Radix Dialog).
  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent size="wide" className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Icon className={cn("h-5 w-5", iconColor || theme.textHighlight)} />
            {title}
            {countryName && (
              <span className="text-label-secondary font-normal">— {countryName}</span>
            )}
          </SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="mt-4 flex w-full flex-1 flex-col"
        >
          {/* Tab List with Controls */}
          <div className="border-separator mb-4 flex flex-col gap-4 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
            <TabsList className="bg-fill-3 rounded-row flex w-full gap-1 p-1 sm:w-auto">
              {tabs.map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className={cn(
                    "rounded-control text-footnote sm:text-body flex min-h-9 flex-1 items-center justify-center gap-2 px-3 py-2 sm:flex-none"
                  )}
                >
                  <tab.icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Controls for Trends tab */}
            {activeTab === "trends" && (
              <div className="flex items-center gap-2">
                {showTimeRange && (
                  <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
                    <SelectTrigger className="text-footnote h-8 w-28">
                      <SelectValue placeholder="Time range" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_RANGE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {showChartType && (
                  <Select value={chartType} onValueChange={(v) => setChartType(v as ChartType)}>
                    <SelectTrigger className="text-footnote h-8 w-24">
                      <SelectValue placeholder="Chart type" />
                    </SelectTrigger>
                    <SelectContent>
                      {CHART_TYPE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {onRefresh && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onRefresh}
                    disabled={isLoading}
                    className="h-8"
                    aria-label="Refresh data"
                  >
                    <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Tab Content */}
          {tabs.map((tab) => (
            <TabsContent key={tab.id} value={tab.id} className="mt-0">
              {children(tab.id, timeRange, chartType)}
            </TabsContent>
          ))}
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

export default BaseMetricDetailsModal;
