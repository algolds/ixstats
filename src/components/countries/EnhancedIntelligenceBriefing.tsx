"use client";

import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "~/lib/utils";
import { HealthRing } from "~/components/ui/health-ring";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { formatCurrency, formatPopulation } from "~/lib/chart-utils";
import { IxTime } from "~/lib/ixtime";
import {
  // Intelligence Icons
  RiShieldLine,
  RiBarChartLine,
  RiEyeLine,
  RiGlobalLine,
  RiSettings3Line,
  RiArrowUpLine,
  RiArrowDownLine,
  RiSubtractLine,
  // Metric Icons
  RiMoneyDollarCircleLine,
  RiTeamLine,
  RiRidingLine,
  RiLineChartLine,
  RiMapLine,
  RiBuildingLine,
  RiTvLine,
  RiFlagLine,
  // Status Icons
  RiCheckboxCircleLine,
  RiAlertLine,
  RiInformationLine
} from "react-icons/ri";

// Types for enhanced briefing
interface VitalityMetric {
  id: string;
  label: string;
  value: number;
  color: string;
  icon: React.ElementType;
  trend: 'up' | 'down' | 'stable';
  status: 'excellent' | 'good' | 'fair' | 'poor';
  classification: 'PUBLIC' | 'RESTRICTED' | 'CONFIDENTIAL';
}

interface CountryMetric {
  id: string;
  label: string;
  value: string | number;
  unit?: string;
  icon: React.ElementType;
  trend?: {
    direction: 'up' | 'down' | 'stable';
    value: number;
    period: string;
  };
  classification: 'PUBLIC' | 'RESTRICTED' | 'CONFIDENTIAL';
  importance: 'critical' | 'high' | 'medium' | 'low';
}

interface IntelligenceAlert {
  id: string;
  type: 'critical' | 'warning' | 'info' | 'success';
  title: string;
  description: string;
  classification: 'PUBLIC' | 'RESTRICTED' | 'CONFIDENTIAL';
  timestamp: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface CountryInformation {
  id: string;
  category: string;
  items: {
    label: string;
    value: string;
    classification: 'PUBLIC' | 'RESTRICTED' | 'CONFIDENTIAL';
  }[];
  icon: React.ElementType;
}

interface EnhancedIntelligenceBriefingProps {
  // Country data
  country: {
    id: string;
    name: string;
    continent?: string;
    region?: string;
    governmentType?: string;
    leader?: string;
    religion?: string;
    capital?: string;
    currentPopulation: number;
    currentGdpPerCapita: number;
    currentTotalGdp: number;
    economicTier: string;
    populationTier: string;
    populationGrowthRate: number;
    adjustedGdpGrowth: number;
    populationDensity?: number;
    landArea?: number;
    lastCalculated: number;
    baselineDate: number;
  };
  
  // Intelligence data
  intelligenceAlerts?: IntelligenceAlert[];
  currentIxTime: number;
  
  // Security context
  viewerClearanceLevel: 'PUBLIC' | 'RESTRICTED' | 'CONFIDENTIAL';
  isOwnCountry?: boolean;
  
  // Styling
  flagColors?: {
    primary: string;
    secondary: string;
    accent: string;
  };
}

// Classification styling
const CLASSIFICATION_STYLES = {
  'PUBLIC': {
    color: 'text-green-400',
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    label: 'PUBLIC'
  },
  'RESTRICTED': {
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    label: 'RESTRICTED'
  },
  'CONFIDENTIAL': {
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    label: 'CONFIDENTIAL'
  }
} as const;

// Status styling
const STATUS_STYLES = {
  'excellent': { color: 'text-green-400', bg: 'bg-green-500/20' },
  'good': { color: 'text-blue-400', bg: 'bg-blue-500/20' },
  'fair': { color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
  'poor': { color: 'text-red-400', bg: 'bg-red-500/20' }
} as const;

// Importance styling
const IMPORTANCE_STYLES = {
  'critical': { priority: 4, glow: 'shadow-red-500/20' },
  'high': { priority: 3, glow: 'shadow-orange-500/20' },
  'medium': { priority: 2, glow: 'shadow-blue-500/20' },
  'low': { priority: 1, glow: 'shadow-gray-500/20' }
} as const;

// Helper functions
const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
  switch (trend) {
    case 'up': return RiArrowUpLine;
    case 'down': return RiArrowDownLine;
    default: return RiSubtractLine;
  }
};

const getTrendColor = (trend: 'up' | 'down' | 'stable') => {
  switch (trend) {
    case 'up': return 'text-green-400';
    case 'down': return 'text-red-400';
    default: return 'text-gray-400';
  }
};

const getStatusFromValue = (value: number): 'excellent' | 'good' | 'fair' | 'poor' => {
  if (value >= 80) return 'excellent';
  if (value >= 60) return 'good';
  if (value >= 40) return 'fair';
  return 'poor';
};

export const EnhancedIntelligenceBriefing: React.FC<EnhancedIntelligenceBriefingProps> = ({
  country,
  intelligenceAlerts = [],
  currentIxTime,
  viewerClearanceLevel = 'PUBLIC',
  isOwnCountry = false,
  flagColors = { primary: '#3b82f6', secondary: '#6366f1', accent: '#8b5cf6' }
}) => {
  const [activeSection, setActiveSection] = useState<'overview' | 'vitality' | 'metrics' | 'information'>('overview');
  const [showClassified, setShowClassified] = useState(false);

  // Calculate vitality metrics
  const vitalityMetrics: VitalityMetric[] = useMemo(() => {
    const economicHealth = Math.min(100, (country.currentGdpPerCapita / 50000) * 100);
    const populationGrowth = Math.min(100, Math.max(0, (country.populationGrowthRate * 100 + 2) * 25));
    const developmentIndex = (() => {
      const tierScores: Record<string, number> = {
        "Extravagant": 100, "Very Strong": 85, "Strong": 70,
        "Healthy": 55, "Developed": 40, "Developing": 25
      };
      return tierScores[country.economicTier] || 10;
    })();

    return [
      {
        id: 'economic',
        label: 'Economic Health',
        value: economicHealth,
        color: flagColors.primary,
        icon: RiMoneyDollarCircleLine,
        trend: country.adjustedGdpGrowth > 0.02 ? 'up' : country.adjustedGdpGrowth < -0.01 ? 'down' : 'stable',
        status: getStatusFromValue(economicHealth),
        classification: 'PUBLIC'
      },
      {
        id: 'population',
        label: 'Population Vitality',
        value: populationGrowth,
        color: flagColors.secondary,
        icon: RiTeamLine,
        trend: country.populationGrowthRate > 0.01 ? 'up' : country.populationGrowthRate < 0 ? 'down' : 'stable',
        status: getStatusFromValue(populationGrowth),
        classification: 'PUBLIC'
      },
      {
        id: 'development',
        label: 'Development Index',
        value: developmentIndex,
        color: flagColors.accent,
        icon: RiRidingLine,
        trend: 'stable',
        status: getStatusFromValue(developmentIndex),
        classification: viewerClearanceLevel !== 'PUBLIC' ? 'RESTRICTED' : 'PUBLIC'
      }
    ];
  }, [country, flagColors, viewerClearanceLevel]);

  // Calculate country metrics
  const countryMetrics: CountryMetric[] = useMemo(() => {
    return [
      {
        id: 'population',
        label: 'Population',
        value: formatPopulation(country.currentPopulation),
        icon: RiTeamLine,
        trend: {
          direction: country.populationGrowthRate > 0 ? 'up' : 'down',
          value: Math.abs(country.populationGrowthRate * 100),
          period: 'annual'
        },
        classification: 'PUBLIC',
        importance: 'high'
      },
      {
        id: 'total_gdp',
        label: 'Total GDP',
        value: formatCurrency(country.currentTotalGdp),
        icon: RiBarChartLine,
        trend: {
          direction: country.adjustedGdpGrowth > 0 ? 'up' : 'down',
          value: Math.abs(country.adjustedGdpGrowth * 100),
          period: 'annual'
        },
        classification: 'PUBLIC',
        importance: 'critical'
      },
      {
        id: 'gdp_per_capita',
        label: 'GDP per Capita',
        value: formatCurrency(country.currentGdpPerCapita),
        icon: RiMoneyDollarCircleLine,
        classification: 'PUBLIC',
        importance: 'high'
      },
      ...(country.populationDensity ? [{
        id: 'density',
        label: 'Population Density',
        value: country.populationDensity.toFixed(1),
        unit: '/km²',
        icon: RiMapLine,
        classification: 'PUBLIC' as const,
        importance: 'medium' as const
      }] : []),
      ...(country.landArea ? [{
        id: 'land_area',
        label: 'Land Area',
        value: country.landArea.toLocaleString(),
        unit: 'km²',
        icon: RiGlobalLine,
        classification: 'PUBLIC' as const,
        importance: 'medium' as const
      }] : [])
    ];
  }, [country]);

  // Organize country information
  const countryInformation: CountryInformation[] = useMemo(() => {
    const info: CountryInformation[] = [];

    // Geographic information
    if (country.continent || country.region) {
      info.push({
        id: 'geographic',
        category: 'Geographic Intelligence',
        icon: RiMapLine,
        items: [
          ...(country.continent ? [{ label: 'Continent', value: country.continent, classification: 'PUBLIC' as const }] : []),
          ...(country.region ? [{ label: 'Region', value: country.region, classification: 'PUBLIC' as const }] : []),
          ...(country.capital ? [{ label: 'Capital', value: country.capital, classification: 'PUBLIC' as const }] : [])
        ]
      });
    }

    // Government information
    if (country.governmentType || country.leader) {
      info.push({
        id: 'government',
        category: 'Government Intelligence',
        icon: RiBuildingLine,
        items: [
          ...(country.governmentType ? [{ label: 'System', value: country.governmentType, classification: 'PUBLIC' as const }] : []),
          ...(country.leader ? [{ label: 'Leader', value: country.leader, classification: 'PUBLIC' as const }] : [])
        ]
      });
    }

    // Cultural information
    if (country.religion) {
      info.push({
        id: 'cultural',
        category: 'Cultural Intelligence',
        icon: RiGlobalLine,
        items: [
          { label: 'Primary Religion', value: country.religion, classification: 'PUBLIC' }
        ]
      });
    }

    // Classification information
    info.push({
      id: 'classification',
      category: 'Economic Classification',
      icon: RiBarChartLine,
      items: [
        { label: 'Economic Tier', value: country.economicTier, classification: 'PUBLIC' },
        { label: 'Population Tier', value: `Tier ${country.populationTier}`, classification: 'PUBLIC' }
      ]
    });

    return info;
  }, [country]);

  // Filter content based on clearance level
  const hasAccess = (classification: 'PUBLIC' | 'RESTRICTED' | 'CONFIDENTIAL') => {
    const levels = { 'PUBLIC': 1, 'RESTRICTED': 2, 'CONFIDENTIAL': 3 };
    return levels[viewerClearanceLevel] >= levels[classification];
  };

  return (
    <div className="space-y-6">
      {/* Intelligence Header */}
      <div className="glass-hierarchy-child rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="p-2 rounded-lg bg-blue-500/20">
              <RiShieldLine className="h-6 w-6 text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Intelligence Briefing</h2>
              <p className="text-sm text-muted-foreground">
                Comprehensive country intelligence • {IxTime.formatIxTime(currentIxTime, true)}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Badge 
              variant="outline" 
              className={cn(
                "border-2",
                CLASSIFICATION_STYLES[viewerClearanceLevel].color,
                CLASSIFICATION_STYLES[viewerClearanceLevel].border
              )}
            >
              {CLASSIFICATION_STYLES[viewerClearanceLevel].label}
            </Badge>
            {viewerClearanceLevel !== 'PUBLIC' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowClassified(!showClassified)}
                className="border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
              >
                <RiEyeLine className="h-4 w-4 mr-2" />
                {showClassified ? 'Hide' : 'Show'} Classified
              </Button>
            )}
          </div>
        </div>

        {/* Section Navigation */}
        <div className="flex flex-wrap gap-2 mb-6">
          {[
            { id: 'overview', label: 'Overview', icon: RiInformationLine },
            { id: 'vitality', label: 'Vitality Status', icon: RiSettings3Line },
            { id: 'metrics', label: 'Key Metrics', icon: RiBarChartLine },
            { id: 'information', label: 'Intelligence Dossier', icon: RiTvLine }
          ].map((section) => {
            const SectionIcon = section.icon;
            return (
              <Button
                key={section.id}
                variant={activeSection === section.id ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveSection(section.id as any)}
                className="flex items-center gap-2"
              >
                <SectionIcon className="h-4 w-4" />
                {section.label}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Section Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeSection}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          {activeSection === 'overview' && (
            <div className="space-y-6">
              {/* Intelligence Alerts */}
              {intelligenceAlerts.length > 0 && (
                <Card className="glass-hierarchy-child">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <RiAlertLine className="h-5 w-5 text-orange-400" />
                      Active Intelligence Alerts
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {intelligenceAlerts
                        .filter(alert => hasAccess(alert.classification))
                        .map((alert) => (
                        <div
                          key={alert.id}
                          className={cn(
                            "p-4 rounded-lg border-l-4",
                            alert.type === 'critical' && "border-red-500 bg-red-500/10",
                            alert.type === 'warning' && "border-yellow-500 bg-yellow-500/10",
                            alert.type === 'info' && "border-blue-500 bg-blue-500/10",
                            alert.type === 'success' && "border-green-500 bg-green-500/10"
                          )}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="font-medium">{alert.title}</h4>
                              <p className="text-sm text-muted-foreground mt-1">{alert.description}</p>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge 
                                  variant="outline" 
                                  className={cn(
                                    "text-xs",
                                    CLASSIFICATION_STYLES[alert.classification].color
                                  )}
                                >
                                  {alert.classification}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {IxTime.formatIxTime(alert.timestamp, true)}
                                </span>
                              </div>
                            </div>
                            {alert.action && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={alert.action.onClick}
                                className="ml-4"
                              >
                                {alert.action.label}
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Country Status Summary */}
              <Card className="glass-hierarchy-child">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <RiFlagLine className="h-5 w-5" style={{ color: flagColors.primary }} />
                    Strategic Assessment: {country.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                      <RiCheckboxCircleLine className="h-8 w-8 text-green-400 mx-auto mb-2" />
                      <div className="text-lg font-semibold text-green-400">Stable</div>
                      <div className="text-sm text-muted-foreground">Overall Status</div>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
                      <RiLineChartLine className="h-8 w-8 text-blue-400 mx-auto mb-2" />
                      <div className="text-lg font-semibold text-blue-400">{country.economicTier}</div>
                      <div className="text-sm text-muted-foreground">Economic Classification</div>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-purple-500/10 border border-purple-500/30">
                      <RiTeamLine className="h-8 w-8 text-purple-400 mx-auto mb-2" />
                      <div className="text-lg font-semibold text-purple-400">Tier {country.populationTier}</div>
                      <div className="text-sm text-muted-foreground">Population Classification</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeSection === 'vitality' && (
            <Card className="glass-hierarchy-child">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RiSettings3Line className="h-5 w-5" style={{ color: flagColors.primary }} />
                  National Vitality Intelligence
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {vitalityMetrics
                    .filter(metric => hasAccess(metric.classification) || (!showClassified && metric.classification === 'PUBLIC'))
                    .map((metric) => {
                    const TrendIcon = getTrendIcon(metric.trend);
                    const MetricIcon = metric.icon as React.ComponentType<{ className?: string; style?: React.CSSProperties; }>;
                    return (
                      <div 
                        key={metric.id} 
                        className={cn(
                          "relative p-6 rounded-lg border",
                          STATUS_STYLES[metric.status].bg,
                          hasAccess(metric.classification) ? "opacity-100" : "opacity-50"
                        )}
                      >
                        {/* Classification indicator */}
                        <div className="absolute top-2 right-2">
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "text-xs border",
                              CLASSIFICATION_STYLES[metric.classification].color,
                              CLASSIFICATION_STYLES[metric.classification].border
                            )}
                          >
                            {metric.classification}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center gap-4 mb-4">
                          <HealthRing
                            value={metric.value}
                            size={80}
                            color={metric.color}
                            className="flex-shrink-0"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <MetricIcon className="h-4 w-4" style={{ color: metric.color }} />
                              <span className="font-medium">{metric.label}</span>
                            </div>
                            <div className="text-sm text-muted-foreground mb-2">
                              {metric.value.toFixed(1)}% performance
                            </div>
                            <div className="flex items-center gap-1">
                              <TrendIcon className={cn("h-3 w-3", getTrendColor(metric.trend))} />
                              <span className={cn("text-xs", getTrendColor(metric.trend))}>
                                {metric.trend === 'stable' ? 'Stable' : 
                                 metric.trend === 'up' ? 'Improving' : 'Declining'}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <div className={cn(
                          "text-xs font-medium uppercase tracking-wide",
                          STATUS_STYLES[metric.status].color
                        )}>
                          {metric.status}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {activeSection === 'metrics' && (
            <Card className="glass-hierarchy-child">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RiBarChartLine className="h-5 w-5" style={{ color: flagColors.secondary }} />
                  Strategic Performance Metrics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {countryMetrics
                    .sort((a, b) => IMPORTANCE_STYLES[b.importance].priority - IMPORTANCE_STYLES[a.importance].priority)
                    .filter(metric => hasAccess(metric.classification))
                    .map((metric) => {
                    const MetricIcon = metric.icon as React.ComponentType<{ className?: string; style?: React.CSSProperties; }>;
                    const TrendIcon = metric.trend ? getTrendIcon(metric.trend.direction) : null;
                    
                    return (
                      <div 
                        key={metric.id}
                        className={cn(
                          "p-4 rounded-lg border bg-card/50 shadow-lg",
                          IMPORTANCE_STYLES[metric.importance].glow
                        )}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <MetricIcon className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">{metric.label}</span>
                          </div>
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "text-xs",
                              CLASSIFICATION_STYLES[metric.classification].color
                            )}
                          >
                            {metric.classification}
                          </Badge>
                        </div>
                        
                        <div className="flex items-baseline gap-1 mb-2">
                          <span className="text-lg font-semibold">{metric.value}</span>
                          {metric.unit && (
                            <span className="text-sm text-muted-foreground">{metric.unit}</span>
                          )}
                        </div>
                        
                        {metric.trend && (
                          <div className="flex items-center gap-1">
                            {TrendIcon && (
                              <TrendIcon className={cn("h-3 w-3", getTrendColor(metric.trend.direction))} />
                            )}
                            <span className={cn("text-xs", getTrendColor(metric.trend.direction))}>
                              {metric.trend.value.toFixed(2)}% {metric.trend.period}
                            </span>
                          </div>
                        )}
                        
                        <div className="mt-2">
                          <Badge 
                            variant="secondary"
                            className={cn(
                              "text-xs",
                              metric.importance === 'critical' && "bg-red-500/20 text-red-400",
                              metric.importance === 'high' && "bg-orange-500/20 text-orange-400",
                              metric.importance === 'medium' && "bg-blue-500/20 text-blue-400",
                              metric.importance === 'low' && "bg-gray-500/20 text-gray-400"
                            )}
                          >
                            {metric.importance.toUpperCase()}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {activeSection === 'information' && (
            <div className="space-y-4">
              {countryInformation.map((section) => {
                const SectionIcon = section.icon as React.ComponentType<{ className?: string; style?: React.CSSProperties; }>;
                const accessibleItems = section.items.filter(item => hasAccess(item.classification));
                
                if (accessibleItems.length === 0) return null;
                
                return (
                  <Card key={section.id} className="glass-hierarchy-child">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <SectionIcon className="h-5 w-5" style={{ color: flagColors.accent }} />
                        {section.category}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {accessibleItems.map((item, index) => (
                          <div key={index} className="flex items-center justify-between py-2">
                            <span className="text-sm text-muted-foreground">{item.label}:</span>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{item.value}</span>
                              <Badge 
                                variant="outline" 
                                className={cn(
                                  "text-xs",
                                  CLASSIFICATION_STYLES[item.classification].color
                                )}
                              >
                                {item.classification}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Footer Actions */}
      <div className="glass-hierarchy-child rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Last updated: {IxTime.formatIxTime(country.lastCalculated, true)} • 
            Data classification: {viewerClearanceLevel}
          </div>
          {isOwnCountry && (
            <Button variant="outline" size="sm">
              <RiSettings3Line className="h-4 w-4 mr-2" />
              Manage Intelligence Settings
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default EnhancedIntelligenceBriefing;