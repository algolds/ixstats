/**
 * Analytics Header Component
 *
 * Contains date range selector, section tabs, and export functionality.
 *
 * @module AnalyticsHeader
 */

import React from "react";
import { BarChart3, Calendar, FileDown } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import type { DateRange } from "~/hooks/useAnalyticsDashboard";

interface AnalyticsHeaderProps {
  dateRange: DateRange;
  showDataTable: boolean;
  onDateRangeChange: (value: string) => void;
  onShowDataTableToggle: () => void;
  onExportAll: () => void;
}

export const AnalyticsHeader = React.memo<AnalyticsHeaderProps>(
  ({ dateRange, showDataTable, onDateRangeChange, onShowDataTableToggle, onExportAll }) => {
    return (
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold text-gray-900 dark:text-white">
            <BarChart3 className="h-8 w-8 text-purple-600" />
            Analytics Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Advanced analytics, trends, and predictive models
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={dateRange} onValueChange={onDateRangeChange}>
            <SelectTrigger className="w-[140px]">
              <Calendar className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="6months">6 Months</SelectItem>
              <SelectItem value="1year">1 Year</SelectItem>
              <SelectItem value="2years">2 Years</SelectItem>
              <SelectItem value="5years">5 Years</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={onShowDataTableToggle}>
            {showDataTable ? "Chart View" : "Table View"}
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={onExportAll}
            className="bg-purple-600 hover:bg-purple-700"
          >
            <FileDown className="mr-2 h-4 w-4" />
            Export All
          </Button>
        </div>
      </div>
    );
  }
);

AnalyticsHeader.displayName = "AnalyticsHeader";
