// src/app/countries/_components/economy/HistoricalEconomicTracker.tsx
"use client";

import { useState, useMemo } from "react";
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
  Zap
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
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
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ReferenceLine,
  ScatterChart,
  Scatter
} from 'recharts';
import { IxTime } from "~/lib/ixtime";
import { formatCurrency, formatPopulation, displayGrowthRate } from "~/lib/chart-utils";

export interface EconomicEvent {
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

export interface HistoricalDataPoint {
  timestamp: number;
  population: number;
  gdpPerCapita: number;
  totalGdp: number;
  unemploymentRate: number;
  inflationRate: number;
  events: EconomicEvent[];
}

export interface HistoricalEconomicTrackerProps {
  countryId: string;
  countryName: string;
  historicalData: HistoricalDataPoint[];
  onAddEvent?: (event: Omit<EconomicEvent, 'id'>) => void;
  onEditEvent?: (id: string, event: Partial<EconomicEvent>) => void;
  onDeleteEvent?: (id: string) => void;
  isEditable?: boolean;
}

const eventTypes = [
  { value: 'dm_input', label: 'DM Input', icon: Zap },
  { value: 'policy_change', label: 'Policy Change', icon: FileText },
  { value: 'economic_shift', label: 'Economic Shift', icon: TrendingUp },
  { value: 'external_event', label: 'External Event', icon: AlertCircle },
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

const severityColors = {
  minor: 'bg-blue-100 text-blue-800 border-blue-200',
  moderate: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  major: 'bg-orange-100 text-orange-800 border-orange-200',
  critical: 'bg-red-100 text-red-800 border-red-200',
};

export function HistoricalEconomicTracker({
  countryId,
  countryName,
  historicalData,
  onAddEvent,
  onEditEvent,
  onDeleteEvent,
  isEditable = false
}: HistoricalEconomicTrackerProps) {
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
        return `${value.toFixed(1)}%`;
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

  return (
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
          {isEditable && (
            <Dialog open={isAddingEvent} onOpenChange={setIsAddingEvent}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Event
                </Button>
              </DialogTrigger>
              <DialogContent>
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

      {/* Filters */}
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

        <div className="flex-1 min-w-[200px]">
          <Input
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full"
          />
        </div>
      </div>

      <Tabs defaultValue="timeline" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="timeline">Timeline View</TabsTrigger>
          <TabsTrigger value="events">Events List</TabsTrigger>
          <TabsTrigger value="impact">Impact Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="space-y-4">
          {/* Historical Chart with Events */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                {selectedMetric === 'gdp' ? 'GDP per Capita' : 
                 selectedMetric === 'population' ? 'Population' : 'Unemployment Rate'} Over Time
              </CardTitle>
              <CardDescription>
                Economic trend with event markers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="gameYear"
                      tickFormatter={(value) => `${value}`}
                    />
                    <YAxis 
                      tickFormatter={formatMetricValue}
                    />
                    <Tooltip 
                      labelFormatter={(value) => `Year ${value}`}
                      formatter={(value: number) => [formatMetricValue(value), selectedMetric]}
                    />
                    <Line 
                      type="monotone" 
                      dataKey={selectedMetric === 'gdp' ? 'gdpPerCapita' : 
                               selectedMetric === 'population' ? 'population' : 'unemploymentRate'}
                      stroke={getMetricColor()}
                      strokeWidth={2}
                      dot={{ fill: getMetricColor(), strokeWidth: 2 }}
                    />
                    
                    {/* Event Reference Lines */}
                    {eventMarkers.map((marker, index) => (
                      <ReferenceLine
                        key={index}
                        x={IxTime.getCurrentGameYear(marker.timestamp)}
                        stroke="#ef4444"
                        strokeDasharray="5 5"
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              
              {/* Event Markers Legend */}
              {eventMarkers.length > 0 && (
                <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                  <h6 className="text-sm font-medium mb-2">Events in Timeline:</h6>
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
                  <p className="text-muted-foreground">
                    No economic events match your current filters.
                  </p>
                </CardContent>
              </Card>
            ) : (
              allEvents.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  onEdit={isEditable ? (event) => onEditEvent?.(event.id as string, event) : undefined}
                  onDelete={isEditable ? () => onDeleteEvent?.(event.id as string) : undefined}
                />
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="impact" className="space-y-4">
          {/* Impact Analysis */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Event Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {eventTypes.map(type => {
                    const count = allEvents.filter(e => e.type === type.value).length;
                    const percentage = allEvents.length > 0 ? (count / allEvents.length) * 100 : 0;
                    return (
                      <div key={type.value} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <type.icon className="h-4 w-4" />
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
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.keys(severityColors).map(severity => {
                    const count = allEvents.filter(e => e.severity === severity).length;
                    const percentage = allEvents.length > 0 ? (count / allEvents.length) * 100 : 0;
                    return (
                      <div key={severity} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge 
                            className={`${severityColors[severity as keyof typeof severityColors]} text-xs`}
                          >
                            {severity}
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
          </div>
        </TabsContent>
      </Tabs>
    </div>
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
                <Badge className={severityColors[event.severity]}>
                  {event.severity}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {event.category}
                </Badge>
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
            value={formData.impact.employment || ''}
            onChange={(e) => setFormData(prev => ({ 
              ...prev, 
              impact: { ...prev.impact, employment: parseFloat(e.target.value) || undefined }
            }))}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
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