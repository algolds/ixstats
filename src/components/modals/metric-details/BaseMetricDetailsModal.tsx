"use client";

import React, { useState, useEffect } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { RefreshCw, BarChart3, TrendingUp, Globe, Info, X } from "lucide-react";
import { cn } from "~/lib/utils";
import { type TimeRange, type ChartType, TIME_RANGE_OPTIONS, CHART_TYPE_OPTIONS } from "./types";

export interface MetricModalTab {
  id: string;
  label: string;
  icon: LucideIcon;
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
  icon: LucideIcon;
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
  countryId,
  countryName,
  title,
  description,
  icon: Icon,
  iconColor = "text-primary",
  tabs = DEFAULT_TABS,
  isLoading = false,
  onRefresh,
  showTimeRange = true,
  showChartType = true,
  children,
}: BaseMetricDetailsModalProps) {
  const [activeTab, setActiveTab] = useState(tabs[0]?.id || "overview");
  const [timeRange, setTimeRange] = useState<TimeRange>("1y");
  const [chartType, setChartType] = useState<ChartType>("line");

  // Enhanced escape functionality and body scroll lock
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          // Glass physics styling
          "bg-background/95 backdrop-blur-xl",
          "border-2 border-white/10 shadow-2xl",
          // Sizing
          "max-h-[90vh] w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)]",
          "sm:w-[calc(100vw-4rem)] sm:max-w-[calc(100vw-4rem)]",
          "lg:max-w-5xl",
          // Scrolling
          "overflow-y-auto"
        )}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className={cn("h-5 w-5", iconColor)} />
            {title}
            {countryName && (
              <span className="text-muted-foreground font-normal">— {countryName}</span>
            )}
          </DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4 w-full">
          {/* Tab List with Controls */}
          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <TabsList className={cn("grid w-full sm:w-auto", `grid-cols-${tabs.length}`)}>
              {tabs.map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="flex items-center gap-1.5 text-xs sm:text-sm"
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
                    <SelectTrigger className="h-8 w-28 text-xs">
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
                    <SelectTrigger className="h-8 w-24 text-xs">
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
      </DialogContent>
    </Dialog>
  );
}

export default BaseMetricDetailsModal;
