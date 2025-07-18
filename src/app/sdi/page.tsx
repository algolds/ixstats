"use client";
import { AuroraBackground } from '../../components/ui/aurora-background';
import IntelligenceFeed from '../../components/sdi/IntelligenceFeed';
import SecureComms from '../../components/sdi/SecureComms';
import FloatingDock from '../../components/sdi/FloatingDock';
import React, { useState } from 'react';
import { Sidebar, SidebarBody, SidebarLink } from '../../components/ui/sidebar';
import { IconMenu2, IconX } from '@tabler/icons-react';
import { FaGlobe, FaSatellite, FaLock, FaExclamationTriangle, FaChartLine, FaHandshake } from 'react-icons/fa';
import { ExecutiveSummary } from '../dashboard/_components/GlobalStatsSection';
import { GlassCard } from '../../components/ui/enhanced-card';
import { Badge } from '../../components/ui/badge';
import { BentoGrid } from '../../components/ui/bento-grid';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import GlobalOverview from '../../components/sdi/GlobalOverview';
import { api } from '~/trpc/react';

function CrisisManagement() {
  // Live tRPC queries for real-time data
  const { data: activeCrises = [], isLoading: loadingCrises, error: errorCrises } = api.sdi.getActiveCrises.useQuery(undefined, { refetchInterval: 5000 });
  const { data: responseTeams = [], isLoading: loadingTeams, error: errorTeams } = api.sdi.getResponseTeams.useQuery(undefined, { refetchInterval: 5000 });

  const getSeverityColor = (severity: string) => {
    const colors = {
      low: 'bg-yellow-500',
      medium: 'bg-orange-500',
      high: 'bg-red-500',
      critical: 'bg-red-700'
    };
    return colors[severity as keyof typeof colors] || 'bg-gray-500';
  };

  const getStatusColor = (status: string) => {
    const colors = {
      coordinating: 'bg-blue-500',
      monitoring: 'bg-yellow-500',
      deployed: 'bg-green-500',
      standby: 'bg-gray-500',
      resolved: 'bg-gray-400'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-500';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1
    }).format(amount);
  };

  return (
    <div className="max-w-7xl mx-auto w-full animate-fade-in">
      <GlassCard variant="diplomatic" blur="prominent" glow="hover" className="p-8 mb-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-3xl font-bold mb-2 text-blue-100 diplomatic-header">
              Crisis Management Center
            </h2>
            <p className="text-lg text-blue-200"> 
              Real-time monitoring of global crises and response coordination
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-400">{activeCrises.length}</div>
              <div className="text-sm text-blue-300">Active Crises</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">{responseTeams.length}</div>
              <div className="text-sm text-blue-300">Response Teams</div>
            </div>
          </div>
        </div>

        {/* Loading/Error States */}
        {loadingCrises && <div className="text-blue-300 text-center py-8">Loading crises...</div>}
        {errorCrises && <div className="text-red-400 text-center py-8">Error loading crises: {errorCrises.message}</div>}

        {/* Crisis Alert Banner */}
        {activeCrises.some((crisis: any) => crisis.severity === 'critical') && (
          <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-red-200 font-semibold">CRITICAL ALERT: Active crisis requiring immediate attention</span>
            </div>
          </div>
        )}

        {/* Active Crises Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {activeCrises.map((crisis: any) => (
            <Card key={crisis.id} className="bg-blue-900/20 border-blue-700/30">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Badge className={`${getSeverityColor(crisis.severity)} text-white`}>
                      {crisis.severity?.toUpperCase()}
                    </Badge>
                    <Badge className={`${getStatusColor(crisis.responseStatus)} text-white`}>
                      {crisis.responseStatus}
                    </Badge>
                  </div>
                  <span className="text-xs text-blue-300">
                    {crisis.timestamp ? new Date(crisis.timestamp).toLocaleTimeString() : ''}
                  </span>
                </div>
                <CardTitle className="text-blue-100 text-xl">{crisis.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-blue-200 mb-4">{crisis.description}</p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-blue-300">Affected Countries:</span>
                    <div className="text-blue-200 font-medium">
                      {(crisis.affectedCountries || []).join(', ')}
                    </div>
                  </div>
                  <div>
                    <span className="text-blue-300">Economic Impact:</span>
                    <div className="text-blue-200 font-medium">
                      {formatCurrency(crisis.economicImpact)}
                    </div>
                  </div>
                  {crisis.casualties > 0 && (
                    <div>
                      <span className="text-blue-300">Casualties:</span>
                      <div className="text-red-200 font-medium">{crisis.casualties?.toLocaleString()}</div>
                    </div>
                  )}
                </div>
                <div className="mt-4 flex gap-2">
                  <Button size="sm" variant="outline" className="border-blue-600 text-blue-200">
                    View Details
                  </Button>
                  <Button size="sm" className="bg-blue-600 text-white">
                    Coordinate Response
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Response Teams */}
        <div className="mb-6">
          <h3 className="text-xl font-semibold text-blue-100 mb-4">Response Teams</h3>
          {loadingTeams && <div className="text-blue-300 text-center py-4">Loading teams...</div>}
          {errorTeams && <div className="text-red-400 text-center py-4">Error loading teams: {errorTeams.message}</div>}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {responseTeams.map((team: any) => (
              <Card key={team.id} className="bg-blue-900/20 border-blue-700/30">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-blue-100 font-medium">{team.name}</h4>
                    <Badge className={`${getStatusColor(team.status)} text-white`}>
                      {team.status}
                    </Badge>
                  </div>
                  <p className="text-blue-300 text-sm mb-3">Location: {team.location}</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="border-blue-600 text-blue-200">
                      Deploy
                    </Button>
                    <Button size="sm" variant="outline" className="border-blue-600 text-blue-200">
                      Status
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Predictive Analysis */}
        <div>
          <h3 className="text-xl font-semibold text-blue-100 mb-4">Predictive Analysis</h3>
          <Card className="bg-blue-900/20 border-blue-700/30">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-400 mb-2">3</div>
                  <div className="text-blue-300 text-sm">Potential Crises</div>
                  <div className="text-blue-400 text-xs mt-1">Next 48 hours</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400 mb-2">85%</div>
                  <div className="text-blue-300 text-sm">Response Readiness</div>
                  <div className="text-blue-400 text-xs mt-1">Global average</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-400 mb-2">12</div>
                  <div className="text-blue-300 text-sm">Available Teams</div>
                  <div className="text-blue-400 text-xs mt-1">On standby</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
    </GlassCard>
    </div>
  );
}

function EconomicIntelligence() {
  // Live tRPC queries for real-time data
  const { data: marketData, isLoading: loadingMarket, error: errorMarket } = api.sdi.getEconomicIndicators.useQuery(undefined, { refetchInterval: 5000 });
  const { data: commodityPrices = [], isLoading: loadingCommodities, error: errorCommodities } = api.sdi.getCommodityPrices.useQuery(undefined, { refetchInterval: 5000 });
  const { data: economicAlerts = [], isLoading: loadingAlerts, error: errorAlerts } = api.sdi.getEconomicAlerts.useQuery(undefined, { refetchInterval: 5000 });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1
    }).format(amount);
  };

  const getTrendColor = (trend: string) => {
    return trend === 'up' ? 'text-green-400' : 'text-red-400';
  };

  const getSeverityColor = (severity: string) => {
    const colors = {
      low: 'bg-yellow-500',
      medium: 'bg-orange-500',
      high: 'bg-red-500',
      critical: 'bg-red-700'
    };
    return colors[severity as keyof typeof colors] || 'bg-gray-500';
  };

  return (
    <div className="max-w-7xl mx-auto w-full animate-fade-in">
      <GlassCard variant="diplomatic" blur="prominent" glow="hover" className="p-8 mb-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-3xl font-bold mb-2 text-blue-100 diplomatic-header">
              Economic Intelligence Hub
            </h2>
            <p className="text-lg text-blue-200">
              Strategic economic intelligence and global financial analysis
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">{marketData?.globalGrowth ?? '--'}%</div>
              <div className="text-sm text-blue-300">Global Growth</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400">{marketData?.inflationRate ?? '--'}%</div>
              <div className="text-sm text-blue-300">Inflation Rate</div>
            </div>
          </div>
        </div>

        {/* Loading/Error States */}
        {loadingMarket && <div className="text-blue-300 text-center py-8">Loading economic indicators...</div>}
        {errorMarket && <div className="text-red-400 text-center py-8">Error loading indicators: {errorMarket.message}</div>}

        {/* Key Economic Indicators */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="bg-blue-900/20 border-blue-700/30">
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-100 mb-1">
                  {marketData ? formatCurrency(marketData.globalGDP) : '--'}
                </div>
                <div className="text-sm text-blue-300">Global GDP</div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-blue-900/20 border-blue-700/30">
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-400 mb-1">
                  {marketData?.globalGrowth ?? '--'}%
                </div>
                <div className="text-sm text-blue-300">Growth Rate</div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-blue-900/20 border-blue-700/30">
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-400 mb-1">
                  {marketData?.inflationRate ?? '--'}%
                </div>
                <div className="text-sm text-blue-300">Inflation</div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-blue-900/20 border-blue-700/30">
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-400 mb-1">
                  {marketData?.unemploymentRate ?? '--'}%
                </div>
                <div className="text-sm text-blue-300">Unemployment</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Commodity Prices */}
        <div className="mb-8">
          <h3 className="text-xl font-semibold text-blue-100 mb-4">Commodity Markets</h3>
          {loadingCommodities && <div className="text-blue-300 text-center py-4">Loading commodities...</div>}
          {errorCommodities && <div className="text-red-400 text-center py-4">Error loading commodities: {errorCommodities.message}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {commodityPrices.map((commodity: any) => (
              <Card key={commodity.name} className="bg-blue-900/20 border-blue-700/30">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-blue-100 font-medium">{commodity.name}</h4>
                    <span className={`text-sm font-medium ${getTrendColor(commodity.trend)}`}>
                      {commodity.change > 0 ? '+' : ''}{commodity.change}%
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-blue-200">
                    ${commodity.price}
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <span className={`text-xs ${getTrendColor(commodity.trend)}`}>
                      {commodity.trend === 'up' ? '↗' : '↘'}
                    </span>
                    <span className="text-xs text-blue-300">
                      {commodity.trend === 'up' ? 'Rising' : 'Falling'}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Economic Alerts */}
        <div className="mb-6">
          <h3 className="text-xl font-semibold text-blue-100 mb-4">Economic Alerts</h3>
          {loadingAlerts && <div className="text-blue-300 text-center py-4">Loading alerts...</div>}
          {errorAlerts && <div className="text-red-400 text-center py-4">Error loading alerts: {errorAlerts.message}</div>}
          <div className="space-y-4">
            {economicAlerts.map((alert: any) => (
              <Card key={alert.id} className="bg-blue-900/20 border-blue-700/30">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Badge className={`${getSeverityColor(alert.severity)} text-white`}>
                        {alert.severity}
                      </Badge>
                      <div>
                        <h4 className="text-blue-100 font-medium">{alert.title}</h4>
                        <p className="text-blue-200 text-sm mt-1">{alert.description}</p>
                      </div>
                    </div>
                    <span className="text-xs text-blue-300">
                      {alert.timestamp ? new Date(alert.timestamp).toLocaleTimeString() : ''}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Market Analysis */}
        <div>
          <h3 className="text-xl font-semibold text-blue-100 mb-4">Market Analysis</h3>
          <Card className="bg-blue-900/20 border-blue-700/30">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400 mb-2">Bullish</div>
                  <div className="text-blue-300 text-sm">Market Sentiment</div>
                  <div className="text-blue-400 text-xs mt-1">Based on 24h data</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-400 mb-2">{marketData?.currencyVolatility ?? '--'}%</div>
                  <div className="text-blue-300 text-sm">Currency Volatility</div>
                  <div className="text-blue-400 text-xs mt-1">Above average</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-400 mb-2">{marketData ? formatCurrency(marketData.tradeVolume) : '--'}</div>
                  <div className="text-sm text-blue-300">Trade Volume</div>
                  <div className="text-blue-400 text-xs mt-1">Monthly total</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
    </GlassCard>
    </div>
  );
}

function DiplomaticMatrix() {
  // Live tRPC queries for real-time data
  const { data: diplomaticRelations = [], isLoading: loadingRelations, error: errorRelations } = api.sdi.getDiplomaticRelations.useQuery(undefined, { refetchInterval: 5000 });
  const { data: activeTreaties = [], isLoading: loadingTreaties, error: errorTreaties } = api.sdi.getActiveTreaties.useQuery(undefined, { refetchInterval: 5000 });
  const { data: diplomaticEvents = [], isLoading: loadingEvents, error: errorEvents } = api.sdi.getDiplomaticEvents.useQuery(undefined, { refetchInterval: 5000 });

  const getRelationshipColor = (relationship: string) => {
    const colors = {
      alliance: 'text-green-400',
      neutral: 'text-yellow-400',
      tension: 'text-red-400',
      conflict: 'text-red-600'
    };
    return colors[relationship as keyof typeof colors] || 'text-gray-400';
  };

  const getStatusColor = (status: string) => {
    const colors = {
      active: 'bg-green-500',
      monitoring: 'bg-yellow-500',
      preparing: 'bg-blue-500',
      scheduled: 'bg-purple-500'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-500';
  };

  const getTreatyTypeColor = (type: string) => {
    const colors = {
      economic: 'text-green-400',
      military: 'text-red-400',
      cultural: 'text-blue-400',
      environmental: 'text-emerald-400'
    };
    return colors[type as keyof typeof colors] || 'text-gray-400';
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="max-w-7xl mx-auto w-full animate-fade-in">
      <GlassCard variant="diplomatic" blur="prominent" glow="hover" className="p-8 mb-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-3xl font-bold mb-2 text-blue-100 diplomatic-header">
              Diplomatic Relations Matrix
            </h2>
            <p className="text-lg text-blue-200">
              Comprehensive diplomatic relationship tracking and analysis
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400">{diplomaticRelations.length}</div>
              <div className="text-sm text-blue-300">Active Relations</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">{activeTreaties.length}</div>
              <div className="text-sm text-blue-300">Active Treaties</div>
            </div>
          </div>
        </div>

        {/* Loading/Error States */}
        {loadingRelations && <div className="text-blue-300 text-center py-8">Loading relations...</div>}
        {errorRelations && <div className="text-red-400 text-center py-8">Error loading relations: {errorRelations.message}</div>}

        {/* Diplomatic Relations Network */}
        <div className="mb-8">
          <h3 className="text-xl font-semibold text-blue-100 mb-4">Bilateral Relations</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {diplomaticRelations.map((relation: any) => (
              <Card key={relation.id} className="bg-blue-900/20 border-blue-700/30">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge className={`${getStatusColor(relation.status)} text-white`}>
                        {relation.status}
                      </Badge>
                      <span className={`font-medium ${getRelationshipColor(relation.relationship)}`}>
                        {relation.relationship?.toUpperCase()}
                      </span>
                    </div>
                    <span className="text-xs text-blue-300">
                      {relation.lastContact ? new Date(relation.lastContact).toLocaleTimeString() : ''}
                    </span>
                  </div>
                  <CardTitle className="text-blue-100 text-lg">
                    {relation.country1} ↔ {relation.country2}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-blue-300 text-sm">Relationship Strength</span>
                      <span className="text-blue-200 font-medium">{relation.strength}%</span>
                    </div>
                    <div className="w-full bg-blue-800/30 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${relation.strength}%` }}
                      ></div>
                    </div>
                  </div>
                  <div className="mb-4">
                    <span className="text-blue-300 text-sm">Active Treaties:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(relation.treaties || []).map((treaty: string, index: number) => (
                        <Badge key={index} variant="outline" className="text-blue-200 border-blue-600">
                          {treaty}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="border-blue-600 text-blue-200">
                      View Details
                    </Button>
                    <Button size="sm" className="bg-blue-600 text-white">
                      Initiate Contact
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Active Treaties */}
        <div className="mb-8">
          <h3 className="text-xl font-semibold text-blue-100 mb-4">Active Treaties</h3>
          {loadingTreaties && <div className="text-blue-300 text-center py-4">Loading treaties...</div>}
          {errorTreaties && <div className="text-red-400 text-center py-4">Error loading treaties: {errorTreaties.message}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeTreaties.map((treaty: any) => (
              <Card key={treaty.id} className="bg-blue-900/20 border-blue-700/30">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="text-blue-100 font-medium">{treaty.name}</h4>
                      <span className={`text-sm ${getTreatyTypeColor(treaty.type)}`}>
                        {treaty.type?.charAt(0).toUpperCase() + treaty.type?.slice(1)}
                      </span>
                    </div>
                    <Badge className={`${getStatusColor(treaty.status)} text-white`}>
                      {treaty.status}
                    </Badge>
                  </div>
                  <div className="mb-3">
                    <span className="text-blue-300 text-sm">Parties:</span>
                    <div className="text-blue-200 text-sm mt-1">
                      {(treaty.parties || []).join(', ')}
                    </div>
                  </div>
                  <div className="flex justify-between text-xs text-blue-300">
                    <span>Signed: {treaty.signedDate ? formatDate(treaty.signedDate) : ''}</span>
                    <span>Expires: {treaty.expiryDate ? formatDate(treaty.expiryDate) : ''}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Upcoming Diplomatic Events */}
        <div>
          <h3 className="text-xl font-semibold text-blue-100 mb-4">Upcoming Events</h3>
          {loadingEvents && <div className="text-blue-300 text-center py-4">Loading events...</div>}
          {errorEvents && <div className="text-red-400 text-center py-4">Error loading events: {errorEvents.message}</div>}
          <div className="space-y-4">
            {diplomaticEvents.map((event: any) => (
              <Card key={event.id} className="bg-blue-900/20 border-blue-700/30">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Badge className={`${getStatusColor(event.status)} text-white`}>
                        {event.status}
                      </Badge>
                      <div>
                        <h4 className="text-blue-100 font-medium">{event.title}</h4>
                        <p className="text-blue-200 text-sm mt-1">
                          Participants: {(event.participants || []).join(', ')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-blue-300 text-sm">{event.date ? formatDate(event.date) : ''}</div>
                      <div className="text-blue-400 text-xs capitalize">{event.type}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
    </GlassCard>
    </div>
  );
}

const MODULES = [
  { key: 'summary', label: 'Global Overview' },
  { key: 'intelligence', label: 'Intelligence Feed' },
  { key: 'comms', label: 'Secure Comms' },
  { key: 'crisis', label: 'Crisis Management' },
  { key: 'economic', label: 'Economic Intelligence' },
  { key: 'diplomatic', label: 'Diplomatic Matrix' },
];

export default function SDIPage() {
  const [selected, setSelected] = useState('summary');
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-950 to-slate-900 text-white">
      <div className="flex flex-row h-screen w-full overflow-hidden">
        {/* Sidebar Navigation */}
        <div className="h-full w-64 sdi-sidebar flex flex-col py-8 px-4">
          <div className="mb-8 text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center text-3xl shadow-lg mx-auto mb-4 medallion-glow">
              🌐
            </div>
            <h1 className="text-2xl font-bold text-blue-100 diplomatic-header">SDI</h1>
            <p className="text-sm text-blue-200">Sovereign Digital Interface</p>
          </div>
          <nav className="flex flex-col gap-2">
            {MODULES.map((mod) => (
              <button
                key={mod.key}
                className={`w-full text-left px-4 py-2 rounded-lg transition-all font-medium text-blue-100 hover:bg-indigo-700/20 focus:bg-indigo-700/30 ${selected === mod.key ? 'bg-indigo-700/30 font-bold shadow-lg' : ''}`}
                onClick={() => setSelected(mod.key)}
              >
                {mod.label}
              </button>
            ))}
          </nav>
        </div>
        {/* Main Content */}
        <main className="flex-1 flex flex-col h-full overflow-y-auto px-6 py-10 bg-transparent">
          {selected === 'summary' && <GlobalOverview />}
          {selected === 'intelligence' && <IntelligenceFeed />}
          {selected === 'comms' && <SecureComms />}
          {selected === 'crisis' && <CrisisManagement />}
          {selected === 'economic' && <EconomicIntelligence />}
          {selected === 'diplomatic' && <DiplomaticMatrix />}
        </main>
      </div>
    </div>
  );
} 