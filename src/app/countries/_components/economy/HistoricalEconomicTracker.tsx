// src/app/countries/_components/economy/HistoricalEconomicTracker.tsx
"use client";

import React, { useState, useMemo } from "react";
import { 
  Calendar,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Clock,
  Filter,
  Download,
  Plus,
  Edit,
  Trash2,
  Eye,
  BarChart3,
  FileText,
  Zap,
  Pencil,
  HelpCircle,
  Activity,
  LineChart,
  RotateCcw,
  Search,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { 
  LineChart as RechartsLineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer,
  ReferenceLine,
  ScatterChart,
  Scatter,
  ComposedChart,
  Bar,
  Legend,
} from 'recharts';
import { Progress } from "~/components/ui/progress";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Separator } from "~/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { IxTime } from "~/lib/ixtime";
import { formatCurrency, formatPopulation, formatPercentage } from "./utils";

interface EconomicEvent {
  id: string;
  timestamp: number;
  type: 'dm_input' | 'policy_change' | 'economic_shift' | 'external_event';
  category: string;
  title: string;
  description: string;
  impact: {
    gdp?: number;
    population?: number;
    employment?: number;
    sector?: string;
  };
  duration?: number; // in months
  severity: 'minor' | 'moderate' | 'major' | 'critical';
  source: 'dm' | 'system' | 'player';
  isActive: boolean;
}

interface HistoricalDataPoint {
  timestamp: number;
  population: number;
  gdpPerCapita: number;
  totalGdp: number;
  unemploymentRate: number;
  inflationRate: number;
  events: EconomicEvent[];
}

interface HistoricalEconomicTrackerProps {
  countryId: string;
  countryName: string;
  historicalData: HistoricalDataPoint[];
  onAddEvent?: (event: Omit<EconomicEvent, 'id'>) => void;
  onEditEvent?: (id: string, event: Partial<EconomicEvent>) => void;
  onDeleteEvent?: (id: string) => void;
  isEditable?: boolean;
  totalPopulation: number;
}

const eventTypes = [
  { value: 'dm_input', label: 'DM Input', icon: Zap, color: 'purple' },
  { value: 'policy_change', label: 'Policy Change', icon: FileText, color: 'blue' },
  { value: 'economic_shift', label: 'Economic Shift', icon: TrendingUp, color: 'green' },
  { value: 'external_event', label: 'External Event', icon: AlertCircle, color: 'red' },
];

const eventCategories = [
  'Trade Agreement',
  'Natural Disaster',
  'Economic Policy',
  'Population Change',
  'Technology Advancement',
  'Political Change',
  'Infrastructure Development',
  'Resource Discovery',
  'Market Expansion',
  'Financial Crisis',
  'Regulatory Change',
  'Other'
];

const severityConfig = {
  minor: { color: 'bg-blue-100 text-blue-800 border-blue-200', label: 'Minor' },
  moderate: { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', label: 'Moderate' },
  major: { color: 'bg-orange-100 text-orange-800 border-orange-200', label: 'Major' },
  critical: { color: 'bg-red-100 text-red-800 border-red-200', label: 'Critical' },
};

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
  const [view, setView] = useState<"timeline" | "events" | "analysis">("timeline");
  const [editMode, setEditMode] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState<'1Y' | '5Y' | '10Y' | 'ALL'>('5Y');
  const [selectedEventType, setSelectedEventType] = useState<string>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<'gdp' | 'population' | 'unemployment'>('gdp');

  // Filter historical data based on time range
  const filteredData = useMemo(() => {
    const now = IxTime.getCurrentIxTime();
    let startTime = now;
    
    switch (selectedTimeRange) {
      case '1Y':
        startTime = IxTime.addYears(now, -1);
        break;
      case '5Y':
        startTime = IxTime.addYears(now, -5);
        break;
      case '10Y':
        startTime = IxTime.addYears(now, -10);
        break;
      case 'ALL':
        startTime = 0;
        break;
    }
    
    return historicalData.filter(point => point.timestamp >= startTime);
  }, [historicalData, selectedTimeRange]);

  // Get all events from filtered data
  const allEvents = useMemo(() => {
    const events: EconomicEvent[] = [];
    filteredData.forEach(point => {
      events.push(...point.events);
    });
    
    return events
      .filter(event => {
        if (selectedEventType !== 'all' && event.type !== selectedEventType) return false;
        if (selectedSeverity !== 'all' && event.severity !== selectedSeverity) return false;
        if (searchQuery && !event.title.toLowerCase().includes(searchQuery.toLowerCase()) && 
            !event.description.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
      })
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [filteredData, selectedEventType, selectedSeverity, searchQuery]);

  // Prepare chart data
  const chartData = useMemo(() => {
    return filteredData.map(point => ({
      timestamp: point.timestamp,
      date: IxTime.formatIxTime(point.timestamp),
      gameYear: IxTime.getCurrentGameYear(point.timestamp),
      population: point.population,
      gdpPerCapita: point.gdpPerCapita,
      totalGdp: point.totalGdp,
      unemploymentRate: point.unemploymentRate,
      inflationRate: point.inflationRate,
      eventsCount: point.events.length,
      hasEvent: point.events.length > 0,
    }));
  }, [filteredData]);

  // Event markers for the chart
  const eventMarkers = useMemo(() => {
    const markers: Array<{
      timestamp: number;
      value: number;
      event: EconomicEvent;
    }> = [];
    
    filteredData.forEach(point => {
      point.events.forEach(event => {
        let value = 0;
        switch (selectedMetric) {
          case 'gdp':
            value = point.gdpPerCapita;
            break;
          case 'population':
            value = point.population;
            break;
          case 'unemployment':
            value = point.unemploymentRate;
            break;
        }
        markers.push({
          timestamp: event.timestamp,
          value,
          event
        });
      });
    });
    
    return markers;
  }, [filteredData, selectedMetric]);

  const getMetricValue = (point: any) => {
    switch (selectedMetric) {
      case 'gdp':
        return point.gdpPerCapita;
      case 'population':
        return point.population;
      case 'unemployment':
        return point.unemploymentRate;
    }
  };

  const formatMetricValue = (value: number) => {
    switch (selectedMetric) {
      case 'gdp':
        return formatCurrency(value);
      case 'population':
        return formatPopulation(value);
      case 'unemployment':
        return formatPercentage(value);
    }
  };

  const getMetricColor = () => {
    switch (selectedMetric) {
      case 'gdp':
        return '#10b981';
      case 'population':
        return '#3b82f6';
      case 'unemployment':
        return '#ef4444';
    }
  };

  const clearFilters = () => {
    setSelectedEventType('all');
    setSelectedSeverity('all');
    setSearchQuery('');
    setSelectedTimeRange('5Y');
  };

  const hasActiveFilters = selectedEventType !== 'all' || selectedSeverity !== 'all' || searchQuery !== '';

  // Calculate economic health trends
  const economicHealthTrend = useMemo(() => {
    if (chartData.length < 2) return { trend: 'stable', value: 0 };
    
    const recent = chartData.slice(-3);
    const older = chartData.slice(-6, -3);
    
    if (recent.length === 0 || older.length === 0) return { trend: 'stable', value: 0 };
    
    const recentAvg = recent.reduce((sum, point) => sum + point.gdpPerCapita, 0) / recent.length;
    const olderAvg = older.reduce((sum, point) => sum + point.gdpPerCapita, 0) / older.length;
    
    const change = ((recentAvg - olderAvg) / olderAvg) * 100;
    
    if (Math.abs(change) < 1) return { trend: 'stable', value: change };
    return { trend: change > 0 ? 'improving' : 'declining', value: change };
  }, [chartData]);

  return (
    <TooltipProvider>
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Economic History & Events
          </h3>
          <p className="text-sm text-muted-foreground">
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
                {editMode ? <Eye className="h-4 w-4 mr-1" /> : <Pencil className="h-4 w-4 mr-1" />}
                {editMode ? "View" : "Edit"}
              </Button>
            )}
            
            {(isEditable || editMode) && (
            <Dialog open={isAddingEvent} onOpenChange={setIsAddingEvent}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
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
          
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

        {/* Economic Health Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Economic Trend</span>
                </div>
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="h-3 w-3 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Recent economic performance trend</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="space-y-1">
                <div className={`text-2xl font-bold ${
                  economicHealthTrend.trend === 'improving' ? 'text-green-600' :
                  economicHealthTrend.trend === 'declining' ? 'text-red-600' : 'text-blue-600'
                }`}>
                  {economicHealthTrend.trend === 'improving' ? '↗' : 
                   economicHealthTrend.trend === 'declining' ? '↘' : '→'}
                </div>
                <div className="text-xs text-muted-foreground capitalize">
                  {economicHealthTrend.trend}
                </div>
                <div className="text-xs text-muted-foreground">
                  {Math.abs(economicHealthTrend.value).toFixed(1)}% change
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Total Events</span>
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold">{allEvents.length}</div>
                <div className="text-xs text-muted-foreground">
                  {selectedTimeRange === 'ALL' ? 'All time' : `Last ${selectedTimeRange.replace('Y', ' year(s)')}`}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Critical Events</span>
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold text-red-600">
                  {allEvents.filter(e => e.severity === 'critical').length}
                </div>
                <div className="text-xs text-muted-foreground">
                  Requiring attention
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Active Policies</span>
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold text-blue-600">
                  {allEvents.filter(e => e.isActive && e.type === 'policy_change').length}
                </div>
                <div className="text-xs text-muted-foreground">
                  Currently in effect
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

      {/* Filters */}
        <Card>
          <CardContent className="p-4">
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <Label htmlFor="timeRange" className="text-sm">Time Range:</Label>
          <Select value={selectedTimeRange} onValueChange={(value: any) => setSelectedTimeRange(value)}>
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
          <Select value={selectedMetric} onValueChange={(value: any) => setSelectedMetric(value)}>
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

        <Tabs value={view} onValueChange={(v) => setView(v as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="timeline">Timeline View</TabsTrigger>
          <TabsTrigger value="events">Events List</TabsTrigger>
            <TabsTrigger value="analysis">Impact Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="space-y-4">
          {/* Historical Chart with Events */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                  <LineChart className="h-5 w-5" />
                {selectedMetric === 'gdp' ? 'GDP per Capita' : 
                 selectedMetric === 'population' ? 'Population' : 'Unemployment Rate'} Over Time
              </CardTitle>
              <CardDescription>
                  Economic trend with event markers • {chartData.length} data points
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="gameYear"
                      tickFormatter={(value) => `${value}`}
                    />
                    <YAxis 
                      tickFormatter={formatMetricValue}
                    />
                      <RechartsTooltip 
                      labelFormatter={(value) => `Year ${value}`}
                        formatter={(value: number, name: string) => [
                          formatMetricValue(value), 
                          selectedMetric === 'gdp' ? 'GDP per Capita' : 
                          selectedMetric === 'population' ? 'Population' : 'Unemployment Rate'
                        ]}
                    />
                    <Line 
                      type="monotone" 
                      dataKey={selectedMetric === 'gdp' ? 'gdpPerCapita' : 
                               selectedMetric === 'population' ? 'population' : 'unemploymentRate'}
                      stroke={getMetricColor()}
                      strokeWidth={2}
                      dot={{ fill: getMetricColor(), strokeWidth: 2 }}
                    />
                      <Bar 
                        dataKey="eventsCount" 
                        fill="rgba(239, 68, 68, 0.3)"
                        yAxisId="right"
                      />
                    
                    {/* Event Reference Lines */}
                      {eventMarkers.slice(0, 10).map((marker, index) => (
                      <ReferenceLine
                        key={index}
                        x={IxTime.getCurrentGameYear(marker.timestamp)}
                        stroke="#ef4444"
                        strokeDasharray="5 5"
                          strokeOpacity={0.7}
                      />
                    ))}
                    </ComposedChart>
                </ResponsiveContainer>
              </div>
              
              {/* Event Markers Legend */}
              {eventMarkers.length > 0 && (
                <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                    <h6 className="text-sm font-medium mb-2">Recent Events in Timeline:</h6>
                  <div className="flex flex-wrap gap-2">
                    {eventMarkers.slice(0, 6).map((marker, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {IxTime.getCurrentGameYear(marker.timestamp)}: {marker.event.title}
                      </Badge>
                    ))}
                    {eventMarkers.length > 6 && (
                      <Badge variant="outline" className="text-xs">
                        +{eventMarkers.length - 6} more
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events" className="space-y-4">
          {/* Events List */}
          <div className="space-y-3">
            {allEvents.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">No Events Found</h3>
                    <p className="text-muted-foreground mb-4">
                    No economic events match your current filters.
                  </p>
                    {hasActiveFilters && (
                      <Button variant="outline" onClick={clearFilters}>
                        Clear Filters
                      </Button>
                    )}
                </CardContent>
              </Card>
            ) : (
              allEvents.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                    onEdit={isEditable || editMode ? (event) => onEditEvent?.(event.id as string, event) : undefined}
                    onDelete={isEditable || editMode ? () => onDeleteEvent?.(event.id as string) : undefined}
                />
              ))
            )}
          </div>
        </TabsContent>

          <TabsContent value="analysis" className="space-y-4">
          {/* Impact Analysis */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Event Distribution</CardTitle>
                  <CardDescription>Breakdown by type and frequency</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {eventTypes.map(type => {
                    const count = allEvents.filter(e => e.type === type.value).length;
                    const percentage = allEvents.length > 0 ? (count / allEvents.length) * 100 : 0;
                      const TypeIcon = type.icon;
                      
                    return (
                      <div key={type.value} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <TypeIcon className="h-4 w-4" />
                          <span className="text-sm">{type.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium w-8">{count}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Severity Distribution</CardTitle>
                  <CardDescription>Impact assessment breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                    {Object.entries(severityConfig).map(([severity, config]) => {
                    const count = allEvents.filter(e => e.severity === severity).length;
                    const percentage = allEvents.length > 0 ? (count / allEvents.length) * 100 : 0;
                      
                    return (
                      <div key={severity} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Badge className={`${config.color} text-xs`}>
                              {config.label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium w-8">{count}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Economic Impact Summary</CardTitle>
                  <CardDescription>Aggregate effects of tracked events</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">
                        {allEvents.filter(e => e.impact.gdp && e.impact.gdp > 0).length}
                      </div>
                      <div className="text-sm text-muted-foreground">Positive GDP Events</div>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <div className="text-2xl font-bold text-red-600">
                        {allEvents.filter(e => e.impact.gdp && e.impact.gdp < 0).length}
                      </div>
                      <div className="text-sm text-muted-foreground">Negative GDP Events</div>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">
                        {allEvents.filter(e => e.isActive).length}
                      </div>
                      <div className="text-sm text-muted-foreground">Active Events</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
          </div>
        </TabsContent>
      </Tabs>

        {/* Summary Alert */}
        <Alert>
          <Activity className="h-4 w-4" />
          <AlertDescription>
            <div className="font-medium">Historical Overview</div>
            <p className="text-sm mt-1">
              {allEvents.length} events tracked over {selectedTimeRange === 'ALL' ? 'all time' : `the last ${selectedTimeRange.replace('Y', ' year(s)')}`}.
              Economic trend is {economicHealthTrend.trend} with {Math.abs(economicHealthTrend.value).toFixed(1)}% change.
              {allEvents.filter(e => e.severity === 'critical').length > 0 && 
                ` ${allEvents.filter(e => e.severity === 'critical').length} critical event(s) require attention.`}
            </p>
          </AlertDescription>
        </Alert>
    </div>
    </TooltipProvider>
  );
}

function EventCard({ 
  event, 
  onEdit, 
  onDelete 
}: { 
  event: EconomicEvent; 
  onEdit?: (event: Partial<EconomicEvent>) => void;
  onDelete?: () => void;
}) {
  const eventTypeInfo = eventTypes.find(t => t.value === event.type);
  const Icon = eventTypeInfo?.icon || AlertCircle;
  const severityConfig = {
    minor: { color: 'bg-blue-100 text-blue-800 border-blue-200', label: 'Minor' },
    moderate: { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', label: 'Moderate' },
    major: { color: 'bg-orange-100 text-orange-800 border-orange-200', label: 'Major' },
    critical: { color: 'bg-red-100 text-red-800 border-red-200', label: 'Critical' },
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1">
            <div className="p-2 bg-muted rounded-lg">
              <Icon className="h-4 w-4" />
            </div>
            
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-medium">{event.title}</h4>
                <Badge className={severityConfig[event.severity].color}>
                  {severityConfig[event.severity].label}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {event.category}
                </Badge>
                {event.isActive && (
                  <Badge className="bg-green-100 text-green-800 text-xs">
                    Active
                  </Badge>
                )}
              </div>
              
              <p className="text-sm text-muted-foreground">
                {event.description}
              </p>
              
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {IxTime.formatIxTime(event.timestamp)}
                </div>
                {event.duration && (
                  <div>
                    Duration: {event.duration} months
                  </div>
                )}
                <div>
                  Source: {event.source}
                </div>
              </div>
              
              {/* Impact Display */}
              {(event.impact.gdp || event.impact.population || event.impact.employment) && (
                <div className="mt-2 p-2 bg-muted/50 rounded text-xs">
                  <span className="font-medium">Impact: </span>
                  {event.impact.gdp && `GDP ${event.impact.gdp > 0 ? '+' : ''}${(event.impact.gdp * 100).toFixed(1)}% `}
                  {event.impact.population && `Population ${event.impact.population > 0 ? '+' : ''}${(event.impact.population * 100).toFixed(1)}% `}
                  {event.impact.employment && `Employment ${event.impact.employment > 0 ? '+' : ''}${(event.impact.employment * 100).toFixed(1)}%`}
                </div>
              )}
            </div>
          </div>
          
          {(onEdit || onDelete) && (
            <div className="flex items-center gap-1">
              {onEdit && (
                <Button variant="ghost" size="sm">
                  <Edit className="h-3 w-3" />
                </Button>
              )}
              {onDelete && (
                <Button variant="ghost" size="sm" onClick={onDelete}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function AddEventForm({ 
  onSubmit, 
  onCancel 
}: { 
  onSubmit: (event: Omit<EconomicEvent, 'id'>) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState<Omit<EconomicEvent, 'id'>>({
    timestamp: IxTime.getCurrentIxTime(),
    type: 'dm_input',
    category: 'Economic Policy',
    title: '',
    description: '',
    impact: {},
    severity: 'moderate',
    source: 'dm',
    isActive: true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="title">Event Title</Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            placeholder="Enter event title"
            required
          />
        </div>
        <div>
          <Label htmlFor="type">Event Type</Label>
          <Select value={formData.type} onValueChange={(value) => setFormData(prev => ({ ...prev, type: value as any }))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {eventTypes.map(type => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="category">Category</Label>
          <Select value={formData.category} onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {eventCategories.map(category => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="severity">Severity</Label>
          <Select value={formData.severity} onValueChange={(value) => setFormData(prev => ({ ...prev, severity: value as any }))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="minor">Minor</SelectItem>
              <SelectItem value="moderate">Moderate</SelectItem>
              <SelectItem value="major">Major</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Describe the event and its context"
          rows={3}
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label htmlFor="gdpImpact">GDP Impact (%)</Label>
          <Input
            id="gdpImpact"
            type="number"
            step="0.1"
            placeholder="e.g., 2.5"
            value={formData.impact.gdp || ''}
            onChange={(e) => setFormData(prev => ({ 
              ...prev, 
              impact: { ...prev.impact, gdp: parseFloat(e.target.value) || undefined }
            }))}
          />
        </div>
        <div>
          <Label htmlFor="populationImpact">Population Impact (%)</Label>
          <Input
            id="populationImpact"
            type="number"
            step="0.1"
            placeholder="e.g., 1.2"
            value={formData.impact.population || ''}
            onChange={(e) => setFormData(prev => ({ 
              ...prev, 
              impact: { ...prev.impact, population: parseFloat(e.target.value) || undefined }
            }))}
          />
        </div>
        <div>
          <Label htmlFor="employmentImpact">Employment Impact (%)</Label>
          <Input
            id="employmentImpact"
            type="number"
            step="0.1"
            placeholder="e.g., -0.5"
            value={formData.impact.employment || ''}
            onChange={(e) => setFormData(prev => ({ 
              ...prev, 
              impact: { ...prev.impact, employment: parseFloat(e.target.value) || undefined }
            }))}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="duration">Duration (months)</Label>
          <Input
            id="duration"
            type="number"
            min="1"
            placeholder="e.g., 12"
            value={formData.duration || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, duration: parseInt(e.target.value) || undefined }))}
          />
        </div>
        <div className="flex items-center space-x-2 pt-6">
          <input
            type="checkbox"
            id="isActive"
            checked={formData.isActive}
            onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
            className="rounded"
          />
          <Label htmlFor="isActive" className="text-sm">Event is currently active</Label>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          Add Event
        </Button>
      </div>
    </form>
  );
}