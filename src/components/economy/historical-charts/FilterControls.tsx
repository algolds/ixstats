// src/components/economy/historical-charts/FilterControls.tsx
/**
 * Filter Controls Component
 *
 * Comprehensive filter controls for time range, metric, event type, severity, and search
 */

import React from "react";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Search, RotateCcw } from "lucide-react";
import type { TimeRange, MetricType } from "~/hooks/useHistoricalEconomicData";

interface FilterControlsProps {
  selectedTimeRange: TimeRange;
  setSelectedTimeRange: (range: TimeRange) => void;
  selectedMetric: MetricType;
  setSelectedMetric: (metric: MetricType) => void;
  selectedEventType: string;
  setSelectedEventType: (type: string) => void;
  selectedSeverity: string;
  setSelectedSeverity: (severity: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  clearFilters: () => void;
  hasActiveFilters: boolean;
}

const eventTypes = [
  { value: 'dm_input', label: 'DM Input' },
  { value: 'policy_change', label: 'Policy Change' },
  { value: 'economic_shift', label: 'Economic Shift' },
  { value: 'external_event', label: 'External Event' },
];

export const FilterControls = React.memo(function FilterControls({
  selectedTimeRange,
  setSelectedTimeRange,
  selectedMetric,
  setSelectedMetric,
  selectedEventType,
  setSelectedEventType,
  selectedSeverity,
  setSelectedSeverity,
  searchQuery,
  setSearchQuery,
  clearFilters,
  hasActiveFilters,
}: FilterControlsProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <Label htmlFor="timeRange" className="text-sm">Time Range:</Label>
            <Select value={selectedTimeRange} onValueChange={(value: TimeRange) => setSelectedTimeRange(value)}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1Y">1 Year</SelectItem>
                <SelectItem value="5Y">5 Years</SelectItem>
                <SelectItem value="10Y">10 Years</SelectItem>
                <SelectItem value="ALL">All Time</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Label htmlFor="metric" className="text-sm">Metric:</Label>
            <Select value={selectedMetric} onValueChange={(value: MetricType) => setSelectedMetric(value)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gdp">GDP per Capita</SelectItem>
                <SelectItem value="population">Population</SelectItem>
                <SelectItem value="unemployment">Unemployment</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Label htmlFor="eventType" className="text-sm">Event Type:</Label>
            <Select value={selectedEventType} onValueChange={setSelectedEventType}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {eventTypes.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Label htmlFor="severity" className="text-sm">Severity:</Label>
            <Select value={selectedSeverity} onValueChange={setSelectedSeverity}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="major">Major</SelectItem>
                <SelectItem value="moderate">Moderate</SelectItem>
                <SelectItem value="minor">Minor</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search events..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearFilters}
              className="flex items-center gap-1"
            >
              <RotateCcw className="h-3 w-3" />
              Clear
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
});
