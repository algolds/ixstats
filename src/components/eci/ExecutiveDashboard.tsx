"use client";
import { BentoGridItem } from "~/components/ui/bento-grid";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { NumberTicker } from "~/components/ui/number-ticker";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Progress } from "~/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { useState, useEffect } from "react";
import { ChartContainer } from "~/components/ui/chart";
import { Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ResponsiveContainer, LineChart } from "recharts";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import HealthRing from "~/components/ui/health-ring";
import { GlassCard } from "~/components/ui/enhanced-card";
import { AnimatedNumber } from "~/components/ui/animated-number";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import type { HistoricalData, Projection } from '~/types/ixstats';

interface CountryData {
  id: string;
  name: string;
  currentTotalGdp?: number;
  currentGdpPerCapita?: number;
  currentPopulation?: number;
  economicTier?: string;
  populationTier?: string;
  adjustedGdpGrowth?: number;
  populationGrowthRate?: number;
  actualGdpGrowth?: number;
  historical?: HistoricalData[];
  projections?: Projection[];
  analytics?: {
    riskFlags: string[];
    vulnerabilities: string[];
    volatility: {
      gdpVolatility: number | null;
      popVolatility: number | null;
    };
  };
}

interface ExecutiveDashboardProps {
  countryData: {
    id: string;
    name: string;
    currentTotalGdp?: number;
    currentGdpPerCapita?: number;
    currentPopulation?: number;
    economicTier?: string;
    populationTier?: string;
    adjustedGdpGrowth?: number;
    populationGrowthRate?: number;
    actualGdpGrowth?: number;
    historical?: HistoricalData[];
    projections?: Projection[];
    analytics?: {
      riskFlags: string[];
      vulnerabilities: string[];
      volatility: {
        gdpVolatility: number | null;
        popVolatility: number | null;
      };
    };
  };
  userId: string;
}

interface CabinetForm {
  title: string;
  description: string;
  scheduledDate: string;
  agenda: string[];
  attendees: string[];
}

interface PolicyForm {
  title: string;
  description: string;
  category: 'fiscal' | 'monetary' | 'trade' | 'investment' | 'labor' | 'infrastructure';
  impact: {
    gdpGrowthProjection: string;
    unemploymentImpact: string;
    inflationImpact: string;
    budgetImpact: string;
  };
}

export function ExecutiveDashboard({ countryData, userId }: ExecutiveDashboardProps) {
  const [openModal, setOpenModal] = useState<null | 'cabinet' | 'policy' | 'security' | 'gdp' | 'gdppc' | 'pop' | 'tier'>(null);
  const [cabinetForm, setCabinetForm] = useState<CabinetForm>({
    title: '',
    description: '',
    scheduledDate: '',
    agenda: [''],
    attendees: ['']
  });
  const [policyForm, setPolicyForm] = useState<PolicyForm>({
    title: '',
    description: '',
    category: 'fiscal',
    impact: {
      gdpGrowthProjection: '',
      unemploymentImpact: '',
      inflationImpact: '',
      budgetImpact: ''
    }
  });

  // API hooks
  const { data: realTimeMetrics } = api.eci.getRealTimeMetrics.useQuery(
    { userId: userId || '' },
    { enabled: !!userId }
  );
  const { data: cabinetMeetings, refetch: refetchMeetings } = api.eci.getCabinetMeetings.useQuery(
    { userId: userId || '' },
    { enabled: !!userId }
  );
  const { data: economicPolicies, refetch: refetchPolicies } = api.eci.getEconomicPolicies.useQuery(
    { userId: userId || '' },
    { enabled: !!userId }
  );
  const { data: securityDashboard } = api.eci.getSecurityDashboard.useQuery(
    { userId: userId || '' },
    { enabled: !!userId }
  );
  const createMeetingMutation = api.eci.createCabinetMeeting.useMutation({
    onSuccess: () => {
      toast.success('Cabinet meeting scheduled successfully');
      refetchMeetings();
      setOpenModal(null);
      setCabinetForm({ title: '', description: '', scheduledDate: '', agenda: [''], attendees: [''] });
    },
    onError: (error) => {
      toast.error('Failed to schedule meeting: ' + error.message);
    }
  });
  const createPolicyMutation = api.eci.createEconomicPolicy.useMutation({
    onSuccess: () => {
      toast.success('Economic policy created successfully');
      refetchPolicies();
      setOpenModal(null);
      setPolicyForm({
        title: '',
        description: '',
        category: 'fiscal',
        impact: { gdpGrowthProjection: '', unemploymentImpact: '', inflationImpact: '', budgetImpact: '' }
      });
    },
    onError: (error) => {
      toast.error('Failed to create policy: ' + error.message);
    }
  });

  // Helper for formatted numbers
  const formatWithCommas = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };
  // Helper for population (millions)
  const formatPopulation = (num: number) => {
    if (!num) return '0';
    return `${(num / 1e6).toFixed(1)}M`;
  };
  // Helper for GDP (trillions)
  const formatGDP = (num: number) => {
    if (!num) return '$0T';
    return `$${(num / 1e12).toFixed(2)}T`;
  };
  // Helper for GDP per Capita
  const formatGDPCapita = (num: number) => {
    if (!num) return '$0';
    return `$${formatWithCommas(Math.round(num))}`;
  };

  const getTierColor = (tier: string) => {
    const colors = {
      'Impoverished': 'text-red-400',
      'Developing': 'text-orange-400',
      'Developed': 'text-yellow-400',
      'Healthy': 'text-green-400',
      'Strong': 'text-blue-400',
      'Very Strong': 'text-purple-400',
      'Extravagant': 'text-pink-400'
    };
    return colors[tier as keyof typeof colors] || 'text-gray-400';
  };

  const getTierProgress = (tier: string): number => {
    const tierValues = {
      'Impoverished': 15,
      'Developing': 30,
      'Developed': 50,
      'Healthy': 65,
      'Strong': 80,
      'Very Strong': 90,
      'Extravagant': 100
    };
    return tierValues[tier as keyof typeof tierValues] || 0;
  };

  // State for which ring is expanded
  const [expandedRing, setExpandedRing] = useState<null | 'economic' | 'social' | 'security' | 'political'>(null);

  // Real-time metrics with fallback to default values
  const metrics = [
    {
      key: 'economic',
      label: 'Economic',
      value: Math.round((countryData?.adjustedGdpGrowth || 0) * 100),
      color: '#10b981',
      description: 'Economic Health: Measures the overall stability and growth of the national economy.'
    },
    {
      key: 'social',
      label: 'Social',
      value: realTimeMetrics?.social ?? null,
      color: '#8b5cf6',
      description: 'Social Harmony: Measures the level of social cohesion and conflict resolution.'
    },
    {
      key: 'security',
      label: 'Security',
      value: realTimeMetrics?.security ?? null,
      color: '#6366f1',
      description: 'Security Index: Evaluates the overall security and safety of national infrastructure.'
    },
    {
      key: 'political',
      label: 'Political',
      value: realTimeMetrics?.political ?? null,
      color: '#3b82f6',
      description: 'Political Stability: Indicates the level of political unrest and stability.'
    },
  ];

  // Prepare historical data for charts
  const historical = (countryData?.historical || []).map((point) => ({
    date: (point).year?.toString() || '',
    gdp: (point).gdp ?? 0,
    population: (point).population ?? 0,
    gdpPerCapita: (point as any).gdpPerCapita ?? 0, // If not in HistoricalData, fallback
  }));
  // Prepare projections for future chart
  const projections = (countryData?.projections || []).map((point) => ({
    date: (point).year?.toString() || '',
    gdp: (point).gdp ?? 0,
    population: (point).population ?? 0,
    gdpPerCapita: (point as any).gdpPerCapita ?? 0, // If not in Projection, fallback
  }));
  // Risk analytics
  const riskFlags = Array.isArray(countryData?.analytics?.riskFlags) ? countryData.analytics.riskFlags : [];
  const vulnerabilities = Array.isArray(countryData?.analytics?.vulnerabilities) ? countryData.analytics.vulnerabilities : [];
  const volatility = typeof countryData?.analytics?.volatility === 'object' && countryData.analytics.volatility !== null
    ? {
        gdpVolatility: countryData.analytics.volatility.gdpVolatility ?? null,
        popVolatility: countryData.analytics.volatility.popVolatility ?? null,
      }
    : { gdpVolatility: null, popVolatility: null };

  if (!countryData) {
    return (
      <>
        <BentoGridItem className="md:col-span-2 bg-gradient-to-br from-orange-500/10 to-red-600/10 border-orange-500/20" description={
          <div className="animate-pulse">
            <div className="h-8 bg-orange-500/20 rounded mb-4" />
            <div className="h-4 bg-orange-500/10 rounded mb-2" />
            <div className="h-4 bg-orange-500/10 rounded" />
          </div>
        } />
        <BentoGridItem className="bg-gradient-to-br from-blue-500/10 to-purple-600/10 border-blue-500/20" description={
          <div className="animate-pulse">
            <div className="h-6 bg-blue-500/20 rounded mb-4" />
            <div className="h-8 bg-blue-500/10 rounded" />
          </div>
        } />
      </>
    );
  }

  // Ensure populationTier is properly formatted
  const safePopulationTier = countryData?.populationTier ?? "1";

  // Helper functions for cabinet meeting form
  const addAgendaItem = () => {
    setCabinetForm(prev => ({ ...prev, agenda: [...prev.agenda, ''] }));
  };

  const removeAgendaItem = (index: number) => {
    setCabinetForm(prev => ({ ...prev, agenda: prev.agenda.filter((_, i) => i !== index) }));
  };

  const updateAgendaItem = (index: number, value: string) => {
    setCabinetForm(prev => ({
      ...prev,
      agenda: prev.agenda.map((item, i) => i === index ? value : item)
    }));
  };

  const addAttendee = () => {
    setCabinetForm(prev => ({ ...prev, attendees: [...prev.attendees, ''] }));
  };

  const removeAttendee = (index: number) => {
    setCabinetForm(prev => ({ ...prev, attendees: prev.attendees.filter((_, i) => i !== index) }));
  };

  const updateAttendee = (index: number, value: string) => {
    setCabinetForm(prev => ({
      ...prev,
      attendees: prev.attendees.map((item, i) => i === index ? value : item)
    }));
  };

  const handleSubmitMeeting = () => {
    if (!cabinetForm.title || !cabinetForm.scheduledDate) {
      toast.error('Please fill in required fields (title and date)');
      return;
    }

    if (!userId) {
      toast.error('User not authenticated');
      return;
    }

    createMeetingMutation.mutate({
      userId,
      title: cabinetForm.title,
      description: cabinetForm.description || undefined,
      scheduledDate: new Date(cabinetForm.scheduledDate),
      agenda: cabinetForm.agenda.filter(item => item.trim() !== ''),
      attendees: cabinetForm.attendees.filter(item => item.trim() !== '')
    });
  };

  const handleSubmitPolicy = () => {
    if (!policyForm.title || !policyForm.description) {
      toast.error('Please fill in required fields (title and description)');
      return;
    }

    const impact = {
      gdpGrowthProjection: policyForm.impact.gdpGrowthProjection ? parseFloat(policyForm.impact.gdpGrowthProjection) : undefined,
      unemploymentImpact: policyForm.impact.unemploymentImpact ? parseFloat(policyForm.impact.unemploymentImpact) : undefined,
      inflationImpact: policyForm.impact.inflationImpact ? parseFloat(policyForm.impact.inflationImpact) : undefined,
      budgetImpact: policyForm.impact.budgetImpact ? parseFloat(policyForm.impact.budgetImpact) : undefined
    };

    if (!userId) {
      toast.error('User not authenticated');
      return;
    }

    createPolicyMutation.mutate({
      userId,
      title: policyForm.title,
      description: policyForm.description,
      category: policyForm.category,
      impact: Object.values(impact).some(v => v !== undefined) ? impact : undefined,
      proposedBy: 'Executive'
    });
  };

  return (
    <>
      {/* Main Country Overview */}
      <BentoGridItem 
        className="md:col-span-2 bg-gradient-to-br from-orange-500/10 to-red-600/10 border-orange-500/20"
        title={`${countryData.name} Executive Summary`}
        description={
          <div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="text-center cursor-pointer" onClick={() => setOpenModal('gdp')}>
                <div className="text-2xl font-bold text-orange-300 mb-1">
                  {formatGDP(countryData.currentTotalGdp || 0)}
                </div>
                <div className="text-xs text-orange-400">Total GDP</div>
              </div>
              <div className="text-center cursor-pointer" onClick={() => setOpenModal('gdppc')}>
                <div className="text-2xl font-bold text-red-300 mb-1">
                  {formatGDPCapita(countryData.currentGdpPerCapita || 0)}
                </div>
                <div className="text-xs text-red-400">GDP per Capita</div>
              </div>
              <div className="text-center cursor-pointer" onClick={() => setOpenModal('pop')}>
                <div className="text-2xl font-bold text-yellow-300 mb-1">
                  {formatPopulation(countryData.currentPopulation || 0)}
                </div>
                <div className="text-xs text-yellow-400">Population</div>
              </div>
              <div className="text-center cursor-pointer" onClick={() => setOpenModal('tier')}>
                <div className="text-2xl font-bold text-pink-300 mb-1">
                  Tier {safePopulationTier}
                </div>
                <div className="text-xs text-pink-400">Pop. Tier</div>
              </div>
            </div>
            {/* Navigation to Country Profile */}
            <div className="mt-4 text-center">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => window.open(`/countries/${countryData.id}`, '_blank')}
                className="bg-orange-600/20 text-orange-300 border-orange-500/30 hover:bg-orange-600/30"
              >
                📊 View Full Country Profile
              </Button>
            </div>
          </div>
        }
        header={
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-full flex items-center justify-center text-xl">
              🏛️
            </div>
            <Badge className={`${getTierColor(countryData.economicTier || '')} bg-orange-900/20 border-orange-500/30`}>
              {countryData.economicTier} Economy
            </Badge>
          </div>
        }
      />

      {/* Quick Actions */}
      <BentoGridItem 
        className="bg-gradient-to-br from-blue-500/10 to-purple-600/10 border-blue-500/20"
        title="Executive Actions"
        description={
          <div>
            <div className="space-y-2 mt-4">
              <Button 
                size="sm" 
                className="w-full bg-blue-600/20 text-blue-300 border-blue-500/30 hover:bg-blue-600/30"
                onClick={() => setOpenModal('cabinet')}
              >
                🏛️ Cabinet Meeting
              </Button>
              <Button 
                size="sm" 
                className="w-full bg-purple-600/20 text-purple-300 border-purple-500/30 hover:bg-purple-600/30"
                onClick={() => setOpenModal('policy')}
              >
                📊 Economic Policy
              </Button>
              <Button 
                size="sm" 
                className="w-full bg-red-600/20 text-red-300 border-red-500/30 hover:bg-red-600/30"
                onClick={() => setOpenModal('security')}
              >
                🛡️ National Security
              </Button>
            </div>
          </div>
        }
        header={
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-xl mb-4">
            ⚡
          </div>
        }
      />

      {/* Performance Metrics */}
      <GlassCard variant="economic" glow="hover" className="md:col-span-3 mb-8 overflow-visible px-8 py-10 flex flex-col items-center justify-center">
        <div className="flex items-center justify-between mb-6 w-full">
          <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center text-xl">
            📈
          </div>
          <div className="text-2xl font-bold text-green-300 ml-4">National Performance Metrics</div>
        </div>
        {/* HealthRings Only Grid - Centered and Evenly Spaced */}
        <div className="w-full flex flex-row flex-wrap items-center justify-center gap-12 py-6">
          {metrics.map((metric) => (
            <div key={metric.key} className="flex flex-col items-center justify-center" style={{ minWidth: 0, overflow: 'visible', padding: '0 12px' }}>
              <HealthRing value={typeof metric.value === 'number' ? metric.value : 0} target={100} color={metric.color} label={metric.label} tooltip={metric.description} size={120} />
              <span className="text-sm text-white/80 mt-2">{metric.label} Health</span>
            </div>
          ))}
        </div>
        {/* Expandable Modal for Activity Rings */}
        <Dialog open={!!expandedRing} onOpenChange={v => setExpandedRing(v ? expandedRing : null)}>
          <DialogContent className="p-0 bg-transparent border-none shadow-none max-w-md w-full">
            <GlassCard variant="economic" glow="hover" className="p-8 w-full">
              {expandedRing && (
                <>
                  <DialogHeader>
                    <DialogTitle>{metrics.find(m => m.key === expandedRing)?.label} Health Details</DialogTitle>
                    <DialogDescription>{metrics.find(m => m.key === expandedRing)?.description}</DialogDescription>
                  </DialogHeader>
                  <div className="flex flex-col items-center justify-center py-6">
                    <HealthRing value={metrics.find(m => m.key === expandedRing)?.value || 0} target={100} color={metrics.find(m => m.key === expandedRing)?.color || '#10b981'} label={metrics.find(m => m.key === expandedRing)?.label} />
                    <div className="mt-6 space-y-4">
                      {expandedRing === 'security' && securityDashboard && (
                        <div className="text-center">
                          <div className="text-lg font-semibold text-white mb-2">Security Analysis</div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <div className="text-white/70">Active Threats</div>
                              <div className="text-red-400 font-bold">{securityDashboard.activeThreats}</div>
                            </div>
                            <div>
                              <div className="text-white/70">Threat Level</div>
                              <div className="text-orange-400 font-bold">{securityDashboard.overallThreatLevel}</div>
                            </div>
                          </div>
                        </div>
                      )}
                      {expandedRing === 'political' && (
                        <div className="text-center">
                          <div className="text-lg font-semibold text-white mb-2">Political Stability</div>
                          <div className="text-sm text-white/70">
                            Based on active policies and governance effectiveness
                          </div>
                        </div>
                      )}
                      {expandedRing === 'social' && countryData && (
                        <div className="text-center">
                          <div className="text-lg font-semibold text-white mb-2">Social Development</div>
                          <div className="text-sm text-white/70">
                            Derived from economic tier ({countryData.economicTier}) and social policies
                          </div>
                        </div>
                      )}
                      {!expandedRing && (
                        <div className="text-center text-base text-white/80">
                          <span>Real-time metrics powered by IxTime system</span>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
              <DialogClose asChild>
                <Button variant="outline">Close</Button>
              </DialogClose>
            </GlassCard>
          </DialogContent>
        </Dialog>
      </GlassCard>

      {/* Summary Analytics Section */}
      <div className="w-full max-w-4xl mx-auto mt-8 space-y-8">
        {/* Risk Analytics Panel */}
        <Card className="bg-black/20 border border-orange-500/20">
          <CardHeader>
            <CardTitle className="text-xl text-orange-200">Risk Analytics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-2">
              <span className="font-semibold text-orange-300">Risk Flags:</span>
              {riskFlags.length > 0 ? (
                <ul className="list-disc ml-6 text-orange-200">
                  {riskFlags.map((flag: string, i: number) => <li key={`risk-${flag}-${i}`}>{flag}</li>)}
                </ul>
              ) : <span className="text-gray-400 ml-2">None</span>}
            </div>
            <div className="mb-2">
              <span className="font-semibold text-orange-300">Vulnerabilities:</span>
              {vulnerabilities.length > 0 ? (
                <ul className="list-disc ml-6 text-orange-200">
                  {vulnerabilities.map((v: string, i: number) => <li key={`vuln-${v}-${i}`}>{v}</li>)}
                </ul>
              ) : <span className="text-gray-400 ml-2">None</span>}
            </div>
            <div>
              <span className="font-semibold text-orange-300">Volatility:</span>
              <span className="ml-2 text-orange-200">GDP: {typeof volatility.gdpVolatility === 'number' ? volatility.gdpVolatility : '--'} | Population: {typeof volatility.popVolatility === 'number' ? volatility.popVolatility : '--'}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modals for actions and metrics */}
      <Dialog open={openModal === 'cabinet'} onOpenChange={v => setOpenModal(v ? 'cabinet' : null)}>
        <DialogContent className="p-0 bg-transparent border-none shadow-none max-w-2xl w-full">
          <GlassCard variant="economic" glow="hover" className="p-8 w-full">
            <DialogHeader>
              <DialogTitle>Cabinet Meeting Scheduler</DialogTitle>
              <DialogDescription>Schedule a new cabinet meeting or review upcoming meetings</DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              {/* Existing meetings */}
              {cabinetMeetings && cabinetMeetings.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-white/90 mb-2">Upcoming Meetings</h4>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {cabinetMeetings.slice(0, 3).map((meeting: any) => (
                      <div key={meeting.id} className="p-2 bg-blue-900/20 rounded border border-blue-700/30">
                        <div className="text-sm font-medium text-blue-300">{meeting.title}</div>
                        <div className="text-xs text-blue-400">
                          {new Date(meeting.scheduledDate).toLocaleDateString()} at {new Date(meeting.scheduledDate).toLocaleTimeString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* New meeting form */}
              <div>
                <h4 className="text-sm font-semibold text-white/90 mb-3">Schedule New Meeting</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="meeting-title" className="text-xs text-white/70">Meeting Title *</Label>
                    <Input
                      id="meeting-title"
                      value={cabinetForm.title}
                      onChange={(e) => setCabinetForm(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="e.g., Economic Policy Review"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="meeting-date" className="text-xs text-white/70">Date & Time *</Label>
                    <Input
                      id="meeting-date"
                      type="datetime-local"
                      value={cabinetForm.scheduledDate}
                      onChange={(e) => setCabinetForm(prev => ({ ...prev, scheduledDate: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                </div>
                
                <div className="mt-4">
                  <Label htmlFor="meeting-description" className="text-xs text-white/70">Description</Label>
                  <Textarea
                    id="meeting-description"
                    value={cabinetForm.description}
                    onChange={(e) => setCabinetForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Meeting objectives and context..."
                    className="mt-1"
                    rows={2}
                  />
                </div>

                <div className="mt-4">
                  <div className="flex justify-between items-center mb-2">
                    <Label className="text-xs text-white/70">Agenda Items</Label>
                    <Button type="button" size="sm" variant="outline" onClick={addAgendaItem}>
                      Add Item
                    </Button>
                  </div>
                  {cabinetForm.agenda.map((item, index) => (
                    <div key={index} className="flex gap-2 mb-2">
                      <Input
                        value={item}
                        onChange={(e) => updateAgendaItem(index, e.target.value)}
                        placeholder={`Agenda item ${index + 1}`}
                        className="flex-1"
                      />
                      {cabinetForm.agenda.length > 1 && (
                        <Button type="button" size="sm" variant="ghost" onClick={() => removeAgendaItem(index)}>
                          ×
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-4">
                  <div className="flex justify-between items-center mb-2">
                    <Label className="text-xs text-white/70">Attendees</Label>
                    <Button type="button" size="sm" variant="outline" onClick={addAttendee}>
                      Add Attendee
                    </Button>
                  </div>
                  {cabinetForm.attendees.map((attendee, index) => (
                    <div key={index} className="flex gap-2 mb-2">
                      <Input
                        value={attendee}
                        onChange={(e) => updateAttendee(index, e.target.value)}
                        placeholder={`Minister/Advisor ${index + 1}`}
                        className="flex-1"
                      />
                      {cabinetForm.attendees.length > 1 && (
                        <Button type="button" size="sm" variant="ghost" onClick={() => removeAttendee(index)}>
                          ×
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 mt-6">
                  <Button 
                    onClick={handleSubmitMeeting} 
                    disabled={createMeetingMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {createMeetingMutation.isPending ? 'Scheduling...' : 'Schedule Meeting'}
                  </Button>
                  <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                  </DialogClose>
                </div>
              </div>
            </div>
          </GlassCard>
        </DialogContent>
      </Dialog>
      <Dialog open={openModal === 'policy'} onOpenChange={v => setOpenModal(v ? 'policy' : null)}>
        <DialogContent className="p-0 bg-transparent border-none shadow-none max-w-2xl w-full">
          <GlassCard variant="economic" glow="hover" className="p-8 w-full">
            <DialogHeader>
              <DialogTitle>Economic Policy Management</DialogTitle>
              <DialogDescription>Create new economic policies or review existing ones</DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              {/* Existing policies */}
              {economicPolicies && economicPolicies.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-white/90 mb-2">Current Policies</h4>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {economicPolicies.slice(0, 3).map((policy: any) => (
                      <div key={policy.id} className="p-2 bg-purple-900/20 rounded border border-purple-700/30">
                        <div className="text-sm font-medium text-purple-300">{policy.title}</div>
                        <div className="text-xs text-purple-400 flex gap-2">
                          <span className="capitalize">{policy.category}</span>
                          <span>•</span>
                          <span className="capitalize">{policy.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* New policy form */}
              <div>
                <h4 className="text-sm font-semibold text-white/90 mb-3">Create New Policy</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="policy-title" className="text-xs text-white/70">Policy Title *</Label>
                    <Input
                      id="policy-title"
                      value={policyForm.title}
                      onChange={(e) => setPolicyForm(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="e.g., Infrastructure Investment Act"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="policy-category" className="text-xs text-white/70">Category *</Label>
                    <Select value={policyForm.category} onValueChange={(value: any) => setPolicyForm(prev => ({ ...prev, category: value }))}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fiscal">Fiscal Policy</SelectItem>
                        <SelectItem value="monetary">Monetary Policy</SelectItem>
                        <SelectItem value="trade">Trade Policy</SelectItem>
                        <SelectItem value="investment">Investment Policy</SelectItem>
                        <SelectItem value="labor">Labor Policy</SelectItem>
                        <SelectItem value="infrastructure">Infrastructure Policy</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="mt-4">
                  <Label htmlFor="policy-description" className="text-xs text-white/70">Description *</Label>
                  <Textarea
                    id="policy-description"
                    value={policyForm.description}
                    onChange={(e) => setPolicyForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Detailed policy description, objectives, and implementation plan..."
                    className="mt-1"
                    rows={3}
                  />
                </div>

                {/* Economic Impact Projections */}
                <div className="mt-4">
                  <Label className="text-xs text-white/70 mb-3 block">Economic Impact Projections (Optional)</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="gdp-impact" className="text-xs text-white/60">GDP Growth Impact (%)</Label>
                      <Input
                        id="gdp-impact"
                        type="number"
                        step="0.1"
                        value={policyForm.impact.gdpGrowthProjection}
                        onChange={(e) => setPolicyForm(prev => ({ 
                          ...prev, 
                          impact: { ...prev.impact, gdpGrowthProjection: e.target.value } 
                        }))}
                        placeholder="e.g., 1.5"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="unemployment-impact" className="text-xs text-white/60">Unemployment Impact (%)</Label>
                      <Input
                        id="unemployment-impact"
                        type="number"
                        step="0.1"
                        value={policyForm.impact.unemploymentImpact}
                        onChange={(e) => setPolicyForm(prev => ({ 
                          ...prev, 
                          impact: { ...prev.impact, unemploymentImpact: e.target.value } 
                        }))}
                        placeholder="e.g., -0.5"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="inflation-impact" className="text-xs text-white/60">Inflation Impact (%)</Label>
                      <Input
                        id="inflation-impact"
                        type="number"
                        step="0.1"
                        value={policyForm.impact.inflationImpact}
                        onChange={(e) => setPolicyForm(prev => ({ 
                          ...prev, 
                          impact: { ...prev.impact, inflationImpact: e.target.value } 
                        }))}
                        placeholder="e.g., 0.2"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="budget-impact" className="text-xs text-white/60">Budget Impact (Billions)</Label>
                      <Input
                        id="budget-impact"
                        type="number"
                        step="0.1"
                        value={policyForm.impact.budgetImpact}
                        onChange={(e) => setPolicyForm(prev => ({ 
                          ...prev, 
                          impact: { ...prev.impact, budgetImpact: e.target.value } 
                        }))}
                        placeholder="e.g., -50.0"
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 mt-6">
                  <Button 
                    onClick={handleSubmitPolicy} 
                    disabled={createPolicyMutation.isPending}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    {createPolicyMutation.isPending ? 'Creating...' : 'Create Policy'}
                  </Button>
                  <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                  </DialogClose>
                </div>
              </div>
            </div>
          </GlassCard>
        </DialogContent>
      </Dialog>
      <Dialog open={openModal === 'security'} onOpenChange={v => setOpenModal(v ? 'security' : null)}>
        <DialogContent className="p-0 bg-transparent border-none shadow-none max-w-md w-full">
          <GlassCard variant="economic" glow="hover" className="p-8 w-full">
            <DialogHeader>
              <DialogTitle>National Security Dashboard</DialogTitle>
              <DialogDescription>Real-time security threat assessment and management</DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              {securityDashboard && (
                <>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-400">{securityDashboard.activeThreats}</div>
                      <div className="text-sm text-white/70">Active Threats</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-400">{securityDashboard.criticalThreats}</div>
                      <div className="text-sm text-white/70">Critical Threats</div>
                    </div>
                    <div className="text-center">
                      <div className={`text-2xl font-bold ${
                        securityDashboard.overallThreatLevel === 'critical' ? 'text-red-400' :
                        securityDashboard.overallThreatLevel === 'high' ? 'text-orange-400' :
                        securityDashboard.overallThreatLevel === 'medium' ? 'text-yellow-400' :
                        'text-green-400'
                      }`}>
                        {securityDashboard.overallThreatLevel.toUpperCase()}
                      </div>
                      <div className="text-sm text-white/70">Threat Level</div>
                    </div>
                  </div>
                  
                  {securityDashboard.recentThreats.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-white/90 mb-2">Recent Threats</h4>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {securityDashboard.recentThreats.map((threat: any, index: number) => (
                          <div key={index} className="p-2 bg-red-900/20 rounded border border-red-700/30">
                            <div className="text-sm font-medium text-red-300">{threat.title}</div>
                            <div className="text-xs text-red-400">Severity: {threat.severity} | Status: {threat.status}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            <DialogClose asChild>
              <Button variant="outline">Close</Button>
            </DialogClose>
          </GlassCard>
        </DialogContent>
      </Dialog>
      <Dialog open={openModal === 'gdp'} onOpenChange={v => setOpenModal(v ? 'gdp' : null)}>
        <DialogContent className="p-0 bg-transparent border-none shadow-none max-w-md w-full">
          <GlassCard variant="economic" glow="hover" className="p-8 w-full">
            <DialogHeader>
              <DialogTitle>Total GDP Analysis</DialogTitle>
              <DialogDescription>Historical GDP data and economic projections</DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              {countryData && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-400">
                        ${((countryData.currentTotalGdp || 0) / 1e12).toFixed(2)}T
                      </div>
                      <div className="text-sm text-white/70">Current Total GDP</div>
                    </div>
                    <div className="text-center">
                      <div className={`text-2xl font-bold ${
                        (countryData.adjustedGdpGrowth || 0) > 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {((countryData.adjustedGdpGrowth || 0) * 100).toFixed(1)}%
                      </div>
                      <div className="text-sm text-white/70">Growth Rate</div>
                    </div>
                  </div>
                  
                  <div className="border border-green-700/30 rounded p-4">
                    <h4 className="text-sm font-semibold text-green-300 mb-2">Economic Tier</h4>
                    <div className="text-lg font-bold text-green-400">{countryData.economicTier}</div>
                    <div className="text-sm text-green-300 mt-1">
                      GDP per Capita: ${(countryData.currentGdpPerCapita || 0).toLocaleString()}
                    </div>
                  </div>
                  
                  <div className="text-center text-sm text-white/60">
                    Real-time economic data powered by IxTime system
                  </div>
                </>
              )}
            </div>
            <DialogClose asChild>
              <Button variant="outline">Close</Button>
            </DialogClose>
          </GlassCard>
        </DialogContent>
      </Dialog>
      <Dialog open={openModal === 'gdppc'} onOpenChange={v => setOpenModal(v ? 'gdppc' : null)}>
        <DialogContent className="p-0 bg-transparent border-none shadow-none max-w-md w-full">
          <GlassCard variant="economic" glow="hover" className="p-8 w-full">
            <DialogHeader>
              <DialogTitle>GDP per Capita Analysis</DialogTitle>
              <DialogDescription>Per capita income analysis and global comparison</DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              {countryData && (
                <>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-400">
                      ${(countryData.currentGdpPerCapita || 0).toLocaleString()}
                    </div>
                    <div className="text-sm text-white/70">GDP per Capita</div>
                  </div>
                  
                  <div className="border border-blue-700/30 rounded p-4">
                    <h4 className="text-sm font-semibold text-blue-300 mb-3">Economic Classification</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">Current Tier:</span>
                        <span className="text-sm font-medium text-blue-400">{countryData.economicTier}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Population:</span>
                        <span className="text-sm font-medium text-blue-400">{(countryData.currentPopulation || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Living Standard:</span>
                        <span className="text-sm font-medium text-blue-400">
                          {(countryData.currentGdpPerCapita || 0) >= 65000 ? 'Extravagant' :
                           (countryData.currentGdpPerCapita || 0) >= 55000 ? 'Very Strong' :
                           (countryData.currentGdpPerCapita || 0) >= 45000 ? 'Strong' :
                           (countryData.currentGdpPerCapita || 0) >= 35000 ? 'Healthy' :
                           (countryData.currentGdpPerCapita || 0) >= 25000 ? 'Developed' :
                           (countryData.currentGdpPerCapita || 0) >= 10000 ? 'Developing' : 'Impoverished'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-center text-sm text-white/60">
                    Tier thresholds: $65k+ Extravagant, $55k+ Very Strong, $45k+ Strong, $35k+ Healthy, $25k+ Developed, $10k+ Developing
                  </div>
                </>
              )}
            </div>
            <DialogClose asChild>
              <Button variant="outline">Close</Button>
            </DialogClose>
          </GlassCard>
        </DialogContent>
      </Dialog>
      <Dialog open={openModal === 'pop'} onOpenChange={v => setOpenModal(v ? 'pop' : null)}>
        <DialogContent className="p-0 bg-transparent border-none shadow-none max-w-md w-full">
          <GlassCard variant="economic" glow="hover" className="p-8 w-full">
            <DialogHeader>
              <DialogTitle>Population Analysis</DialogTitle>
              <DialogDescription>Population growth, demographics, and tier analysis</DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              {countryData && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-400">
                        {(countryData.currentPopulation || 0).toLocaleString()}
                      </div>
                      <div className="text-sm text-white/70">Current Population</div>
                    </div>
                    <div className="text-center">
                      <div className={`text-2xl font-bold ${
                        (countryData.populationGrowthRate || 0) > 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {((countryData.populationGrowthRate || 0) * 100).toFixed(1)}%
                      </div>
                      <div className="text-sm text-white/70">Growth Rate</div>
                    </div>
                  </div>
                  
                  <div className="border border-purple-700/30 rounded p-4">
                    <h4 className="text-sm font-semibold text-purple-300 mb-3">Population Tier Analysis</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">Current Tier:</span>
                        <span className="text-sm font-medium text-purple-400">Tier {countryData.populationTier ?? "1"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Classification:</span>
                        <span className="text-sm font-medium text-purple-400">
                          {(countryData.currentPopulation || 0) >= 500000000 ? 'Tier X (500M+)' :
                           (countryData.currentPopulation || 0) >= 350000000 ? 'Tier 7 (350-499M)' :
                           (countryData.currentPopulation || 0) >= 120000000 ? 'Tier 6 (120-349M)' :
                           (countryData.currentPopulation || 0) >= 80000000 ? 'Tier 5 (80-119M)' :
                           (countryData.currentPopulation || 0) >= 50000000 ? 'Tier 4 (50-79M)' :
                           (countryData.currentPopulation || 0) >= 30000000 ? 'Tier 3 (30-49M)' :
                           (countryData.currentPopulation || 0) >= 10000000 ? 'Tier 2 (10-29M)' : 'Tier 1 (0-9M)'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-center text-sm text-white/60">
                    Population tiers affect maximum GDP growth rate caps
                  </div>
                </>
              )}
            </div>
            <DialogClose asChild>
              <Button variant="outline">Close</Button>
            </DialogClose>
          </GlassCard>
        </DialogContent>
      </Dialog>
      <Dialog open={openModal === 'tier'} onOpenChange={v => setOpenModal(v ? 'tier' : null)}>
        <DialogContent className="p-0 bg-transparent border-none shadow-none max-w-md w-full">
          <GlassCard variant="economic" glow="hover" className="p-8 w-full">
            <DialogHeader>
              <DialogTitle>Population Tier System</DialogTitle>
              <DialogDescription>Understanding population tiers and their impact on growth</DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              {countryData && (
                <>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-yellow-400">
                      Tier {countryData.populationTier ?? "1"}
                    </div>
                    <div className="text-sm text-white/70">Current Population Tier</div>
                  </div>
                  
                  <div className="border border-yellow-700/30 rounded p-4">
                    <h4 className="text-sm font-semibold text-yellow-300 mb-3">Tier Benefits & Limits</h4>
                    <div className="space-y-3">
                      <div>
                        <div className="text-sm font-medium text-yellow-400">Growth Rate Impact</div>
                        <div className="text-xs text-yellow-300">
                          Population tier affects maximum sustainable GDP growth rate
                        </div>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-yellow-400">Economic Capacity</div>
                        <div className="text-xs text-yellow-300">
                          Higher tiers support more complex economic structures
                        </div>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-yellow-400">Infrastructure Needs</div>
                        <div className="text-xs text-yellow-300">
                          Larger populations require more infrastructure investment
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-center text-sm text-white/60">
                    Tier progression: 1 (0-9M) → 2 (10-29M) → 3 (30-49M) → 4 (50-79M) → 5 (80-119M) → 6 (120-349M) → 7 (350-499M) → X (500M+)
                  </div>
                </>
              )}
            </div>
            <DialogClose asChild>
              <Button variant="outline">Close</Button>
            </DialogClose>
          </GlassCard>
        </DialogContent>
      </Dialog>
    </>
  );
}