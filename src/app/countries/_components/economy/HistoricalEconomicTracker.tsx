// src/app/countries/_components/economy/HistoricalEconomicTracker.tsx
"use client";

import React from "react";
import { Calendar, Plus, Download, Eye, Pencil, Activity } from "lucide-react";
import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { TooltipProvider } from "~/components/ui/tooltip";
import { useHistoricalEconomicData } from "~/hooks/useHistoricalEconomicData";
import type {
  EconomicEvent,
  HistoricalDataPoint,
} from "~/lib/historical-economic-data-transformers";
import {
  TimeSeriesChart,
  EconomicHealthCard,
  EventStatsCards,
  FilterControls,
  EventCard,
  EventDistributionCard,
  SeverityDistributionCard,
  ImpactSummaryCard,
  AddEventForm,
} from "~/components/economy/historical-charts";

interface HistoricalEconomicTrackerProps {
  countryId: string;
  countryName: string;
  historicalData: HistoricalDataPoint[];
  onAddEvent?: (event: Omit<EconomicEvent, "id">) => void;
  onEditEvent?: (id: string, event: Partial<EconomicEvent>) => void;
  onDeleteEvent?: (id: string) => void;
  isEditable?: boolean;
  totalPopulation: number;
}

export function HistoricalEconomicTracker({
  countryId,
  countryName,
  historicalData,
  onAddEvent,
  onEditEvent,
  onDeleteEvent,
  isEditable = false,
  totalPopulation,
}: HistoricalEconomicTrackerProps) {
  const {
    // View state
    view,
    setView,
    editMode,
    setEditMode,

    // Filter state
    selectedTimeRange,
    setSelectedTimeRange,
    selectedEventType,
    setSelectedEventType,
    selectedSeverity,
    setSelectedSeverity,
    searchQuery,
    setSearchQuery,
    selectedMetric,
    setSelectedMetric,

    // Modal state
    isAddingEvent,
    setIsAddingEvent,

    // Computed data
    filteredData,
    allEvents,
    chartData,
    eventMarkers,
    economicHealthTrend,
    volatilityMetrics,

    // Utility functions
    formatMetricValue,
    getMetricColor,
    clearFilters,
    hasActiveFilters,

    // Export
    handleExport,
  } = useHistoricalEconomicData({
    countryId,
    countryName,
    historicalData,
    totalPopulation,
    isEditable,
  });

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header and Controls */}
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-semibold">
              <Calendar className="text-primary h-5 w-5" />
              Economic History & Events
            </h3>
            <p className="text-muted-foreground text-sm">
              Track economic changes and events over time for {countryName}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {!isEditable && (
              <Button
                variant={editMode ? "default" : "outline"}
                size="sm"
                onClick={() => setEditMode(!editMode)}
              >
                {editMode ? <Eye className="mr-1 h-4 w-4" /> : <Pencil className="mr-1 h-4 w-4" />}
                {editMode ? "View" : "Edit"}
              </Button>
            )}

            {(isEditable || editMode) && (
              <Dialog open={isAddingEvent} onOpenChange={setIsAddingEvent}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Event
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Add Economic Event</DialogTitle>
                    <DialogDescription>
                      Record a significant economic event or change
                    </DialogDescription>
                  </DialogHeader>
                  <AddEventForm
                    onSubmit={(event) => {
                      onAddEvent?.(event);
                      setIsAddingEvent(false);
                    }}
                    onCancel={() => setIsAddingEvent(false)}
                  />
                </DialogContent>
              </Dialog>
            )}

            <Button variant="outline" size="sm" onClick={() => handleExport("csv")}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </div>

        {/* Economic Health Overview */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <EconomicHealthCard economicHealthTrend={economicHealthTrend} />
          <EventStatsCards allEvents={allEvents} selectedTimeRange={selectedTimeRange} />
        </div>

        {/* Filters */}
        <FilterControls
          selectedTimeRange={selectedTimeRange}
          setSelectedTimeRange={setSelectedTimeRange}
          selectedMetric={selectedMetric}
          setSelectedMetric={setSelectedMetric}
          selectedEventType={selectedEventType}
          setSelectedEventType={setSelectedEventType}
          selectedSeverity={selectedSeverity}
          setSelectedSeverity={setSelectedSeverity}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          clearFilters={clearFilters}
          hasActiveFilters={hasActiveFilters}
        />

        {/* Tabs */}
        <Tabs value={view} onValueChange={(v) => setView(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="timeline">Timeline View</TabsTrigger>
            <TabsTrigger value="events">Events List</TabsTrigger>
            <TabsTrigger value="analysis">Impact Analysis</TabsTrigger>
          </TabsList>

          <TabsContent value="timeline" className="space-y-4">
            <TimeSeriesChart
              chartData={chartData}
              eventMarkers={eventMarkers}
              selectedMetric={selectedMetric}
              formatMetricValue={formatMetricValue}
              getMetricColor={getMetricColor}
            />
          </TabsContent>

          <TabsContent value="events" className="space-y-4">
            <div className="space-y-3">
              {allEvents.length === 0 ? (
                <Card>
                  <div className="px-4 py-8 text-center">
                    <Calendar className="mx-auto mb-4 h-12 w-12 opacity-50" />
                    <h3 className="mb-2 text-lg font-medium">No Events Found</h3>
                    <p className="text-muted-foreground mb-4">
                      No economic events match your current filters.
                    </p>
                    {hasActiveFilters && (
                      <Button variant="outline" onClick={clearFilters}>
                        Clear Filters
                      </Button>
                    )}
                  </div>
                </Card>
              ) : (
                allEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    onEdit={
                      isEditable || editMode
                        ? (event) => onEditEvent?.(event.id!, event)
                        : undefined
                    }
                    onDelete={isEditable || editMode ? () => onDeleteEvent?.(event.id) : undefined}
                  />
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="analysis" className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <EventDistributionCard allEvents={allEvents} />
              <SeverityDistributionCard allEvents={allEvents} />
              <ImpactSummaryCard allEvents={allEvents} />
            </div>
          </TabsContent>
        </Tabs>

        {/* Summary Alert */}
        <Alert>
          <Activity className="h-4 w-4" />
          <AlertDescription>
            <div className="font-medium">Historical Overview</div>
            <p className="mt-1 text-sm">
              {allEvents.length} events tracked over{" "}
              {selectedTimeRange === "ALL"
                ? "all time"
                : `the last ${selectedTimeRange.replace("Y", " year(s)")}`}
              . Economic trend is {economicHealthTrend.trend} with{" "}
              {Math.abs(economicHealthTrend.value).toFixed(1)}% change.
              {allEvents.filter((e) => e.severity === "critical").length > 0 &&
                ` ${allEvents.filter((e) => e.severity === "critical").length} critical event(s) require attention.`}
            </p>
          </AlertDescription>
        </Alert>
      </div>
    </TooltipProvider>
  );
}
