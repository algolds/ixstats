"use client";

import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "~/lib/utils";
import { HealthRing } from "~/components/ui/health-ring";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart as RechartsBarChart,
  Bar,
  AreaChart,
  Area,
  ComposedChart,
  ScatterChart,
  Scatter,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Cell,
} from "recharts";
import { Skeleton } from "~/components/ui/skeleton";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { formatCurrency, formatPopulation } from "~/lib/chart-utils";
import { IxTime } from "~/lib/ixtime";
import { UnifiedCountryFlag } from "~/components/UnifiedCountryFlag";
import {
  // Intelligence Icons
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
  // Additional Icons for Enhanced Intelligence
  RiArrowUpCircleLine,
  RiMapPinLine,
  RiBarChart2Line,
  RiUserLine,
  RiGroup2Line,
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
  const [expandedMetrics, setExpandedMetrics] = useState<Set<string>>(new Set());

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
    // Calculate derived metrics
    const laborForce = Math.round(country.currentPopulation * 0.65); // Approximate labor force participation
    const unemploymentRate = Math.max(2, Math.min(15, 8 - (country.adjustedGdpGrowth * 100))); // Inverse correlation with growth
    const literacyRate = Math.min(99, 70 + (country.currentGdpPerCapita / 1000)); // Economic correlation
    const lifeExpectancy = Math.min(85, 65 + (country.currentGdpPerCapita / 2000)); // Economic correlation
    
    return [
      // Economy Section
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
        trend: {
          direction: country.adjustedGdpGrowth > 0.01 ? 'up' : country.adjustedGdpGrowth < -0.01 ? 'down' : 'stable',
          value: Math.abs(country.adjustedGdpGrowth * 100),
          period: 'annual'
        },
        classification: 'PUBLIC',
        importance: 'critical'
      },
      {
        id: 'economic_tier',
        label: 'Economic Classification',
        value: country.economicTier,
        icon: RiLineChartLine,
        classification: 'PUBLIC',
        importance: 'high'
      },
      
      // Demographics Section
      {
        id: 'population',
        label: 'Total Population',
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
        id: 'population_tier',
        label: 'Population Classification',
        value: `Tier ${country.populationTier}`,
        icon: RiTeamLine,
        classification: 'PUBLIC',
        importance: 'medium'
      },
      {
        id: 'life_expectancy',
        label: 'Life Expectancy',
        value: lifeExpectancy.toFixed(1),
        unit: 'years',
        icon: RiRidingLine,
        classification: 'PUBLIC',
        importance: 'medium'
      },
      {
        id: 'literacy_rate',
        label: 'Literacy Rate',
        value: literacyRate.toFixed(1),
        unit: '%',
        icon: RiTvLine,
        classification: 'PUBLIC',
        importance: 'medium'
      },
      
      // Labor Section
      {
        id: 'labor_force',
        label: 'Labor Force',
        value: formatPopulation(laborForce),
        icon: RiBuildingLine,
        classification: 'PUBLIC',
        importance: 'high'
      },
      {
        id: 'unemployment_rate',
        label: 'Unemployment Rate',
        value: unemploymentRate.toFixed(1),
        unit: '%',
        icon: RiSettings3Line,
        trend: {
          direction: country.adjustedGdpGrowth > 0 ? 'down' : 'up', // Unemployment inverse to growth
          value: Math.abs(country.adjustedGdpGrowth * 50),
          period: 'annual'
        },
        classification: 'PUBLIC',
        importance: 'high'
      },
      
      // Government Section
      {
        id: 'government_type',
        label: 'Government System',
        value: country.governmentType || 'Constitutional',
        icon: RiBuildingLine,
        classification: 'PUBLIC',
        importance: 'medium'
      },
      {
        id: 'capital_city',
        label: 'Capital',
        value: country.capital || 'Unknown',
        icon: RiMapLine,
        classification: 'PUBLIC',
        importance: 'low'
      },
      
      // Geographic Section
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
      }] : []),
      {
        id: 'continent',
        label: 'Continent',
        value: country.continent || 'Unknown',
        icon: RiGlobalLine,
        classification: 'PUBLIC',
        importance: 'low'
      },
      {
        id: 'region',
        label: 'Region',
        value: country.region || 'Unknown',
        icon: RiMapLine,
        classification: 'PUBLIC',
        importance: 'low'
      }
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
      {/* Intelligence Header with Country Flag Background */}
      <div className="glass-hierarchy-child rounded-lg relative overflow-hidden">
        {/* Country Flag Background - Add flag URL prop and implement background */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
          {/* Flag will be added as background when flag data is available */}
          <div className="w-full h-full bg-gradient-to-r from-background/80 via-background/60 to-background/80"></div>
        </div>
        
        <div className="relative p-6">
          <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
                        <UnifiedCountryFlag countryName={country.name} size="xl" />
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold">{country.name}</h2>
                <Badge variant="outline" className="border-green-500/30 text-green-400 bg-green-500/10">
                  <RiCheckboxCircleLine className="h-3 w-3 mr-1" />
                  STABLE
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Country Intelligence Briefing • {IxTime.formatIxTime(currentIxTime, true)}
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
            { id: 'metrics', label: 'Key Metrics', icon: RiBarChartLine },
            { id: 'information', label: 'Briefing', icon: RiTvLine }
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
                 
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Real-time Strategic Intelligence */}
                    <div>
                      <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <RiSettings3Line className="h-5 w-5" style={{ color: flagColors.primary }} />
                        Real-time Strategic Intelligence
                        <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded-full animate-pulse">
                          LIVE
                        </span>
                      </h4>
                      
                      {/* Active Threat Assessment Matrix */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                        <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/30 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <RiEyeLine className="h-5 w-5 text-blue-400" />
                            <span className="font-semibold text-blue-400">Active Monitoring</span>
                            <div className="w-2 h-2 bg-blue-400 rounded-full animate-ping ml-auto" />
                          </div>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Economic Indicators:</span>
                              <span className="text-green-400">STABLE</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Social Stability:</span>
                              <span className="text-green-400">NORMAL</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">External Relations:</span>
                              <span className="text-yellow-400">MONITORING</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <RiBarChartLine className="h-5 w-5 text-purple-400" />
                            <span className="font-semibold text-purple-400">Growth Trajectory</span>
                          </div>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Economic Growth:</span>
                              <span className="text-green-400">+{(country.adjustedGdpGrowth * 100).toFixed(1)}%</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Population Growth:</span>
                              <span className="text-blue-400">+{(country.populationGrowthRate * 100).toFixed(1)}%</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Streak:</span>
                              <span className="text-yellow-400">{(country as any).growthStreak || 0}Q</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Intelligence Alerts Stream */}
                      <div className="bg-gradient-to-r from-orange-500/10 via-red-500/10 to-pink-500/10 border border-orange-500/30 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <RiAlertLine className="h-5 w-5 text-orange-400" />
                          <span className="font-semibold text-orange-400">Intelligence Alerts</span>
                          <Badge variant="outline" className="text-xs border-orange-500/30 text-orange-400">
                            Real-time
                          </Badge>
                        </div>
                        <div className="space-y-3">
                          <div className="flex items-start gap-3 text-sm">
                            <div className="w-2 h-2 bg-green-400 rounded-full mt-2" />
                            <div>
                              <span className="text-green-400 font-medium">Economic Stability Confirmed</span>
                              <p className="text-muted-foreground text-xs mt-1">
                                GDP growth remains within expected parameters • {IxTime.formatIxTime(currentIxTime - 3600000, true)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3 text-sm">
                            <div className="w-2 h-2 bg-blue-400 rounded-full mt-2" />
                            <div>
                              <span className="text-blue-400 font-medium">Diplomatic Activity Detected</span>
                              <p className="text-muted-foreground text-xs mt-1">
                                Increased international engagement observed • {IxTime.formatIxTime(currentIxTime - 1800000, true)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3 text-sm">
                            <div className="w-2 h-2 bg-yellow-400 rounded-full mt-2 animate-pulse" />
                            <div>
                              <span className="text-yellow-400 font-medium">Population Metrics Update</span>
                              <p className="text-muted-foreground text-xs mt-1">
                                Latest demographic analysis completed • {IxTime.formatIxTime(currentIxTime - 900000, true)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}


          {activeSection === 'metrics' && (
            <div className="space-y-6">
              {/* Comprehensive Economic Intelligence Analysis */}
              <Card className="glass-hierarchy-child">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <RiBarChartLine className="h-5 w-5" style={{ color: flagColors.secondary }} />
                    Economic Intelligence Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Card className="cursor-pointer hover:scale-[1.01] transition-all duration-300 border border-border/50 hover:border-border group">
                        <CardContent className="p-6">
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/20">
                                  <RiMoneyDollarCircleLine className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                                </div>
                                <div>
                                  <h3 className="font-semibold text-lg">GDP & Economic Analysis</h3>
                                  <p className="text-sm text-muted-foreground">Complete economic intelligence profile</p>
                                </div>
                              </div>
                              <Badge variant="secondary" className="text-xs group-hover:bg-primary/10">Click to Expand</Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <div className="text-xs text-muted-foreground">GDP per Capita</div>
                                <div className="text-lg font-semibold">{formatCurrency(country.currentGdpPerCapita)}</div>
                                <div className="text-xs text-amber-600 dark:text-amber-400">{country.economicTier}</div>
                              </div>
                              <div className="space-y-1">
                                <div className="text-xs text-muted-foreground">Economic Health</div>
                                <div className="text-lg font-semibold">{Math.min(100, (country.currentGdpPerCapita / 50000) * 100).toFixed(1)}%</div>
                                <div className="text-xs text-green-600 dark:text-green-400">Growth: {(country.adjustedGdpGrowth * 100).toFixed(2)}%</div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </DialogTrigger>
                    <DialogContent className="!max-w-none !w-[96vw] !h-[96vh] !max-h-none overflow-y-auto !left-[2vw] !top-[2vh] !translate-x-0 !translate-y-0 !sm:max-w-none backdrop-blur-xl bg-background/80 border border-border/50">
                      <DialogHeader className="backdrop-blur-md bg-background/60 rounded-lg p-6 mb-6 border border-border/30">
                        <DialogTitle className="flex items-center gap-2 text-foreground">
                          <RiMoneyDollarCircleLine className="h-5 w-5" style={{ color: flagColors.primary }} />
                          GDP & Economic Intelligence Analysis - {country.name}
                        </DialogTitle>
                      </DialogHeader>
                      <div className="space-y-8 p-8 max-w-7xl mx-auto w-full">
                        <Tabs defaultValue="overview" className="w-full">
                          <TabsList className="backdrop-blur-md bg-background/70 border border-border/30 grid w-full grid-cols-4 max-w-2xl mx-auto">
                            <TabsTrigger value="overview">Overview</TabsTrigger>
                            <TabsTrigger value="historical">Historical Trends</TabsTrigger>
                            <TabsTrigger value="analysis">Economic Analysis</TabsTrigger>
                            <TabsTrigger value="projections">Projections</TabsTrigger>
                          </TabsList>

                          <TabsContent value="overview" className="backdrop-blur-sm bg-background/40 rounded-lg p-6 mt-6 border border-border/20">
                            <div className="space-y-6">
                              {/* Current Overview */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-6">
                                <div className="backdrop-blur-sm bg-background/50 p-4 rounded-lg border border-border/20 hover:bg-background/60 transition-all">
                                  <div className="flex items-center gap-2 mb-2">
                                    <RiMoneyDollarCircleLine className="h-4 w-4 text-green-400 dark:text-green-300" />
                                    <span className="text-sm font-medium">Current GDP/Capita</span>
                                  </div>
                                  <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                                    {formatCurrency(country.currentGdpPerCapita)}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {country.economicTier}
                                  </p>
                                </div>

                                <div className="bg-muted/50 p-4 rounded-lg">
                                  <div className="flex items-center gap-2 mb-2">
                                    <RiArrowUpCircleLine className="h-4 w-4 text-blue-400 dark:text-blue-300" />
                                    <span className="text-sm font-medium">Growth Rate</span>
                                  </div>
                                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                                    {(country.adjustedGdpGrowth * 100).toFixed(2)}%
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    annually
                                  </p>
                                </div>

                                <div className="bg-muted/50 p-4 rounded-lg">
                                  <div className="flex items-center gap-2 mb-2">
                                    <RiGlobalLine className="h-4 w-4 text-purple-400 dark:text-purple-300" />
                                    <span className="text-sm font-medium">Economic Health</span>
                                  </div>
                                  <p className="text-2xl font-bold text-purple-700 dark:text-purple-400">
                                    {Math.min(100, (country.currentGdpPerCapita / 50000) * 100).toFixed(1)}%
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    performance index
                                  </p>
                                </div>

                                <div className="bg-muted/50 p-4 rounded-lg">
                                  <div className="flex items-center gap-2 mb-2">
                                    <RiBarChart2Line className="h-4 w-4 text-orange-400 dark:text-orange-300" />
                                    <span className="text-sm font-medium">Tier Progress</span>
                                  </div>
                                  <p className="text-lg font-bold text-orange-700 dark:text-orange-400">
                                    {(() => {
                                      const tiers = ['Impoverished', 'Developing', 'Developed', 'Healthy', 'Strong', 'Very Strong', 'Extravagant'];
                                      const currentIndex = tiers.indexOf(country.economicTier);
                                      return `${currentIndex + 1}/7`;
                                    })()}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {country.economicTier}
                                  </p>
                                </div>
                              </div>

                              {/* GDP Performance Summary */}
                              <Card className="backdrop-blur-sm bg-background/50 border border-border/20">
                                <CardHeader>
                                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                                    <RiBarChartLine className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                    GDP Performance Summary
                                  </CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-8">
                                    <div className="text-center">
                                      <div className="text-lg font-semibold text-blue-700 dark:text-blue-400">
                                        {formatCurrency(country.currentTotalGdp / 1e12)}T
                                      </div>
                                      <div className="text-sm text-muted-foreground">Total GDP</div>
                                    </div>
                                    <div className="text-center">
                                      <div className="text-lg font-semibold text-purple-700 dark:text-purple-400">
                                        {(country.adjustedGdpGrowth * 100).toFixed(2)}%
                                      </div>
                                      <div className="text-sm text-muted-foreground">Growth Volatility</div>
                                    </div>
                                    <div className="text-center">
                                      <div className="text-lg font-semibold text-green-700 dark:text-green-400">
                                        {formatCurrency(country.currentTotalGdp)}
                                      </div>
                                      <div className="text-sm text-muted-foreground">Peak GDP</div>
                                    </div>
                                    <div className="text-center">
                                      <div className="text-lg font-semibold text-orange-700 dark:text-orange-400">
                                        Active
                                      </div>
                                      <div className="text-sm text-muted-foreground">Economic Status</div>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>

                              {/* Economic Tier System */}
                              <Card>
                                <CardHeader>
                                  <CardTitle className="text-lg font-semibold">Economic Tier System</CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <div className="space-y-3">
                                    {[
                                      { name: "Impoverished", min: 0, max: 9999, icon: "📉" },
                                      { name: "Developing", min: 10000, max: 24999, icon: "📈" },
                                      { name: "Developed", min: 25000, max: 34999, icon: "🏭" },
                                      { name: "Healthy", min: 35000, max: 44999, icon: "💰" },
                                      { name: "Strong", min: 45000, max: 54999, icon: "🚀" },
                                      { name: "Very Strong", min: 55000, max: 64999, icon: "🌟" },
                                      { name: "Extravagant", min: 65000, max: Infinity, icon: "👑" }
                                    ].map((tier, index) => {
                                      const isCurrent = tier.name === country.economicTier;
                                      return (
                                        <div 
                                          key={tier.name}
                                          className={`p-3 rounded-lg border-2 ${
                                            isCurrent 
                                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20' 
                                              : 'border-gray-200 dark:border-gray-700'
                                          }`}
                                        >
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                              <span className="text-lg">{tier.icon}</span>
                                              <span className="font-medium">{tier.name}</span>
                                              {isCurrent && (
                                                <Badge variant="default">Current</Badge>
                                              )}
                                            </div>
                                            <div className="text-sm text-muted-foreground">
                                              {formatCurrency(tier.min)} - {tier.max === Infinity ? '∞' : formatCurrency(tier.max)}
                                            </div>
                                          </div>
                                          
                                          {isCurrent && (
                                            <div className="mt-2 text-sm">
                                              <div className="flex items-center gap-2">
                                                <span>Current: {formatCurrency(country.currentGdpPerCapita)}</span>
                                                {index < 6 && (
                                                  <span className="text-muted-foreground">
                                                    (Need {formatCurrency(([
                                                      10000, 25000, 35000, 45000, 55000, 65000, Infinity
                                                    ][index + 1] || Infinity) - country.currentGdpPerCapita)} for next tier)
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </CardContent>
                              </Card>
                            </div>
                          </TabsContent>

                          <TabsContent value="historical" className="mt-6">
                            <div className="space-y-6">
                              <Alert>
                                <RiInformationLine className="h-4 w-4" />
                                <AlertDescription>
                                  Historical trend analysis would show GDP per capita progression over time with multiple chart formats. This requires historical data integration.
                                </AlertDescription>
                              </Alert>
                              
                              <Card>
                                <CardHeader>
                                  <CardTitle>GDP Historical Trends</CardTitle>
                                  <CardDescription>GDP development over time with interactive controls</CardDescription>
                                </CardHeader>
                                <CardContent>
                                  <div className="h-80 flex items-center justify-center text-muted-foreground">
                                    <div className="text-center">
                                      <RiLineChartLine className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                      <p>Historical data visualization</p>
                                      <p className="text-sm">Time series analysis with trend indicators</p>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            </div>
                          </TabsContent>

                          <TabsContent value="analysis" className="mt-6">
                            <div className="space-y-6">
                              <Card>
                                <CardHeader>
                                  <CardTitle>Economic Analysis Framework</CardTitle>
                                  <CardDescription>Advanced economic metrics and comparative analysis</CardDescription>
                                </CardHeader>
                                <CardContent>
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="text-center p-4 border rounded-lg">
                                      <div className="text-2xl font-bold text-blue-600 mb-2">
                                        {(country.adjustedGdpGrowth * 100).toFixed(2)}%
                                      </div>
                                      <div className="text-sm font-medium mb-1">GDP Volatility</div>
                                      <div className="text-xs text-muted-foreground">
                                        {country.adjustedGdpGrowth < 0.05 ? 'Very Stable' :
                                         country.adjustedGdpGrowth < 0.10 ? 'Stable' :
                                         country.adjustedGdpGrowth < 0.20 ? 'Moderate' : 'High Growth'}
                                      </div>
                                    </div>
                                    <div className="text-center p-4 border rounded-lg">
                                      <div className="text-2xl font-bold text-green-600 mb-2">
                                        {Math.min(100, (country.currentGdpPerCapita / 50000) * 100).toFixed(1)}%
                                      </div>
                                      <div className="text-sm font-medium mb-1">Economic Health</div>
                                      <div className="text-xs text-muted-foreground">
                                        Performance Index
                                      </div>
                                    </div>
                                    <div className="text-center p-4 border rounded-lg">
                                      <div className="text-2xl font-bold text-purple-600 mb-2">
                                        Regional
                                      </div>
                                      <div className="text-sm font-medium mb-1">Competitiveness</div>
                                      <div className="text-xs text-muted-foreground">
                                        {country.region || 'Global Position'}
                                      </div>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            </div>
                          </TabsContent>

                          <TabsContent value="projections" className="mt-6">
                            <div className="space-y-6">
                              <Card>
                                <CardHeader>
                                  <CardTitle className="flex items-center gap-2">
                                    <RiArrowUpCircleLine className="h-5 w-5 text-green-500" />
                                    10-Year GDP per Capita Projections
                                    <Badge variant="outline" className="ml-2">
                                      {(country.adjustedGdpGrowth * 100).toFixed(2)}% growth
                                    </Badge>
                                  </CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <div className="space-y-4">
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                      {[1, 3, 5, 10].map(years => {
                                        const projected = country.currentGdpPerCapita * Math.pow(1 + country.adjustedGdpGrowth, years);
                                        return (
                                          <div key={years} className="text-center p-3 bg-muted/50 rounded-lg">
                                            <div className="text-lg font-semibold">
                                              {formatCurrency(projected)}
                                            </div>
                                            <div className="text-sm text-muted-foreground">
                                              Year +{years}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                    
                                    <div className="text-sm text-muted-foreground space-y-1">
                                      <p>* Projections assume constant growth rates and current economic policies</p>
                                      <p>* Economic tier advancements may affect actual growth rates</p>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            </div>
                          </TabsContent>
                        </Tabs>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>

              {/* Comprehensive Demographics Intelligence Analysis */}
              <Card className="glass-hierarchy-child">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <RiTeamLine className="h-5 w-5" style={{ color: flagColors.accent }} />
                    Demographics Intelligence Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Card className="cursor-pointer hover:scale-[1.01] transition-all duration-300 border border-border/50 hover:border-border group">
                        <CardContent className="p-6">
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/20">
                                  <RiTeamLine className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div>
                                  <h3 className="font-semibold text-lg">Population & Demographics</h3>
                                  <p className="text-sm text-muted-foreground">Complete demographic intelligence profile</p>
                                </div>
                              </div>
                              <Badge variant="secondary" className="text-xs group-hover:bg-primary/10">Click to Expand</Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <div className="text-xs text-muted-foreground">Current Population</div>
                                <div className="text-lg font-semibold">{formatPopulation(country.currentPopulation)}</div>
                                <div className="text-xs text-blue-600 dark:text-blue-400">Tier {country.populationTier}</div>
                              </div>
                              <div className="space-y-1">
                                <div className="text-xs text-muted-foreground">Population Growth</div>
                                <div className="text-lg font-semibold">{(country.populationGrowthRate * 100).toFixed(2)}%</div>
                                <div className="text-xs text-green-600 dark:text-green-400">
                                  {country.populationDensity ? `Density: ${country.populationDensity.toFixed(1)}/km²` : 'Density N/A'}
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </DialogTrigger>
                    <DialogContent className="!max-w-none !w-[96vw] !h-[96vh] !max-h-none overflow-y-auto !left-[2vw] !top-[2vh] !translate-x-0 !translate-y-0 !sm:max-w-none backdrop-blur-xl bg-background/80 border border-border/50">
                      <DialogHeader className="backdrop-blur-md bg-background/60 rounded-lg p-6 mb-6 border border-border/30">
                        <DialogTitle className="flex items-center gap-2 text-foreground">
                          <RiTeamLine className="h-5 w-5" style={{ color: flagColors.secondary }} />
                          Demographics Intelligence Analysis - {country.name}
                        </DialogTitle>
                      </DialogHeader>
                      <div className="space-y-8 p-8 max-w-7xl mx-auto w-full">
                        <Tabs defaultValue="overview" className="w-full">
                          <TabsList className="backdrop-blur-md bg-background/70 border border-border/30 grid w-full grid-cols-4 max-w-2xl mx-auto">
                            <TabsTrigger value="overview">Overview</TabsTrigger>
                            <TabsTrigger value="historical">Population Trends</TabsTrigger>
                            <TabsTrigger value="analysis">Demographic Analysis</TabsTrigger>
                            <TabsTrigger value="projections">Population Projections</TabsTrigger>
                          </TabsList>

                          <TabsContent value="overview" className="backdrop-blur-sm bg-background/40 rounded-lg p-6 mt-6 border border-border/20">
                            <div className="space-y-6">
                              {/* Current Overview */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-6">
                                <div className="backdrop-blur-sm bg-background/50 p-4 rounded-lg border border-border/20 hover:bg-background/60 transition-all">
                                  <div className="flex items-center gap-2 mb-2">
                                    <RiTeamLine className="h-4 w-4 text-blue-400 dark:text-blue-300" />
                                    <span className="text-sm font-medium">Current Population</span>
                                  </div>
                                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                                    {formatPopulation(country.currentPopulation)}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    IxTime projection
                                  </p>
                                </div>

                                <div className="bg-muted/50 p-4 rounded-lg">
                                  <div className="flex items-center gap-2 mb-2">
                                    <RiArrowUpCircleLine className="h-4 w-4 text-green-400 dark:text-green-300" />
                                    <span className="text-sm font-medium">Growth Rate</span>
                                  </div>
                                  <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                                    {(country.populationGrowthRate * 100).toFixed(2)}%
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    annual growth
                                  </p>
                                </div>

                                <div className="bg-muted/50 p-4 rounded-lg">
                                  <div className="flex items-center gap-2 mb-2">
                                    <RiMapPinLine className="h-4 w-4 text-purple-400 dark:text-purple-300" />
                                    <span className="text-sm font-medium">Population Density</span>
                                  </div>
                                  <p className="text-2xl font-bold text-purple-700 dark:text-purple-400">
                                    {country.populationDensity ? `${country.populationDensity.toFixed(1)}` : 'N/A'}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    people/km²
                                  </p>
                                </div>

                                <div className="bg-muted/50 p-4 rounded-lg">
                                  <div className="flex items-center gap-2 mb-2">
                                    <RiBarChart2Line className="h-4 w-4 text-orange-400 dark:text-orange-300" />
                                    <span className="text-sm font-medium">Population Tier</span>
                                  </div>
                                  <p className="text-2xl font-bold text-orange-700 dark:text-orange-400">
                                    Tier {country.populationTier}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    classification level
                                  </p>
                                </div>
                              </div>

                              {/* Geographic Context */}
                              <Card className="backdrop-blur-sm bg-background/50 border border-border/20">
                                <CardHeader>
                                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                                    <RiMapPinLine className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                                    Geographic Context
                                  </CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    {country.landArea && (
                                      <div className="text-center p-4 bg-muted/50 rounded-lg">
                                        <div className="text-2xl font-bold text-green-700 dark:text-green-400 mb-2">
                                          {country.landArea.toLocaleString()} km²
                                        </div>
                                        <div className="text-sm font-medium mb-1">Land Area</div>
                                        <div className="text-xs text-muted-foreground">
                                          Total territorial area
                                        </div>
                                      </div>
                                    )}
                                    {country.populationDensity && (
                                      <div className="text-center p-4 bg-muted/50 rounded-lg">
                                        <div className="text-2xl font-bold text-blue-700 dark:text-blue-400 mb-2">
                                          {country.populationDensity.toFixed(1)}/km²
                                        </div>
                                        <div className="text-sm font-medium mb-1">Population Density</div>
                                        <div className="text-xs text-muted-foreground">
                                          People per square kilometer
                                        </div>
                                      </div>
                                    )}
                                    {country.continent && (
                                      <div className="text-center p-4 bg-muted/50 rounded-lg">
                                        <div className="text-2xl font-bold text-purple-600 mb-2">
                                          {country.continent}
                                        </div>
                                        <div className="text-sm font-medium mb-1">Location</div>
                                        <div className="text-xs text-muted-foreground">
                                          {country.region || 'Continental region'}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </CardContent>
                              </Card>

                              {/* Population Tier System */}
                              <Card>
                                <CardHeader>
                                  <CardTitle className="text-lg font-semibold">Population Tier System</CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <div className="space-y-3">
                                    {[
                                      { tier: 1, name: "Small Nation", min: 0, max: 999999, icon: "🏘️" },
                                      { tier: 2, name: "Medium Nation", min: 1000000, max: 4999999, icon: "🏙️" },
                                      { tier: 3, name: "Large Nation", min: 5000000, max: 19999999, icon: "🌆" },
                                      { tier: 4, name: "Major Nation", min: 20000000, max: 49999999, icon: "🌇" },
                                      { tier: 5, name: "Great Nation", min: 50000000, max: 99999999, icon: "🗾" },
                                      { tier: 6, name: "Superpower", min: 100000000, max: Infinity, icon: "🌍" }
                                    ].map((tierInfo) => {
                                      const isCurrent = tierInfo.tier === Number(country.populationTier);
                                      return (
                                        <div 
                                          key={tierInfo.tier}
                                          className={`p-3 rounded-lg border-2 ${
                                            isCurrent 
                                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20' 
                                              : 'border-gray-200 dark:border-gray-700'
                                          }`}
                                        >
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                              <span className="text-lg">{tierInfo.icon}</span>
                                              <span className="font-medium">Tier {tierInfo.tier} - {tierInfo.name}</span>
                                              {isCurrent && (
                                                <Badge variant="default">Current</Badge>
                                              )}
                                            </div>
                                            <div className="text-sm text-muted-foreground">
                                              {formatPopulation(tierInfo.min)} - {tierInfo.max === Infinity ? '∞' : formatPopulation(tierInfo.max)}
                                            </div>
                                          </div>
                                          
                                          {isCurrent && (
                                            <div className="mt-2 text-sm">
                                              <div className="flex items-center gap-2">
                                                <span>Current: {formatPopulation(country.currentPopulation)}</span>
                                                {tierInfo.tier < 6 && (
                                                  <span className="text-muted-foreground">
                                                    (Need {formatPopulation(([1000000, 5000000, 20000000, 50000000, 100000000, Infinity][tierInfo.tier] || Infinity) - country.currentPopulation)} for next tier)
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </CardContent>
                              </Card>
                            </div>
                          </TabsContent>

                          <TabsContent value="historical" className="mt-6">
                            <div className="space-y-6">
                              <Alert>
                                <RiInformationLine className="h-4 w-4" />
                                <AlertDescription>
                                  Historical population trend analysis would show demographic progression over time with birth/death rates and migration patterns.
                                </AlertDescription>
                              </Alert>
                              
                              <Card>
                                <CardHeader>
                                  <CardTitle>Population Historical Trends</CardTitle>
                                  <CardDescription>Demographic development over time with growth indicators</CardDescription>
                                </CardHeader>
                                <CardContent>
                                  <div className="h-80 flex items-center justify-center text-muted-foreground">
                                    <div className="text-center">
                                      <RiLineChartLine className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                      <p>Population trend visualization</p>
                                      <p className="text-sm">Time series analysis with demographic indicators</p>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            </div>
                          </TabsContent>

                          <TabsContent value="analysis" className="mt-6">
                            <div className="space-y-6">
                              <Card>
                                <CardHeader>
                                  <CardTitle>Demographic Analysis Framework</CardTitle>
                                  <CardDescription>Advanced demographic metrics and comparative analysis</CardDescription>
                                </CardHeader>
                                <CardContent>
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="text-center p-4 border rounded-lg">
                                      <div className="text-2xl font-bold text-blue-600 mb-2">
                                        {(country.populationGrowthRate * 100).toFixed(2)}%
                                      </div>
                                      <div className="text-sm font-medium mb-1">Growth Stability</div>
                                      <div className="text-xs text-muted-foreground">
                                        {country.populationGrowthRate < 0.01 ? 'Stable' :
                                         country.populationGrowthRate < 0.03 ? 'Growing' :
                                         country.populationGrowthRate < 0.05 ? 'High Growth' : 'Rapid Growth'}
                                      </div>
                                    </div>
                                    <div className="text-center p-4 border rounded-lg">
                                      <div className="text-2xl font-bold text-green-600 mb-2">
                                        {country.populationDensity ? country.populationDensity.toFixed(0) : 'N/A'}
                                      </div>
                                      <div className="text-sm font-medium mb-1">Density Classification</div>
                                      <div className="text-xs text-muted-foreground">
                                        {!country.populationDensity ? 'Unknown' :
                                         country.populationDensity < 50 ? 'Sparse' :
                                         country.populationDensity < 150 ? 'Moderate' :
                                         country.populationDensity < 300 ? 'Dense' : 'Very Dense'}
                                      </div>
                                    </div>
                                    <div className="text-center p-4 border rounded-lg">
                                      <div className="text-2xl font-bold text-purple-600 mb-2">
                                        Tier {country.populationTier}
                                      </div>
                                      <div className="text-sm font-medium mb-1">Population Ranking</div>
                                      <div className="text-xs text-muted-foreground">
                                        {country.region || 'Global Position'}
                                      </div>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            </div>
                          </TabsContent>

                          <TabsContent value="projections" className="mt-6">
                            <div className="space-y-6">
                              <Card>
                                <CardHeader>
                                  <CardTitle className="flex items-center gap-2">
                                    <RiArrowUpCircleLine className="h-5 w-5 text-green-500" />
                                    10-Year Population Projections
                                    <Badge variant="outline" className="ml-2">
                                      {(country.populationGrowthRate * 100).toFixed(2)}% growth
                                    </Badge>
                                  </CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <div className="space-y-4">
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                      {[1, 3, 5, 10].map(years => {
                                        const projected = country.currentPopulation * Math.pow(1 + country.populationGrowthRate, years);
                                        return (
                                          <div key={years} className="text-center p-3 bg-muted/50 rounded-lg">
                                            <div className="text-lg font-semibold">
                                              {formatPopulation(projected)}
                                            </div>
                                            <div className="text-sm text-muted-foreground">
                                              Year +{years}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                    
                                    <div className="text-sm text-muted-foreground space-y-1">
                                      <p>* Projections assume constant growth rates and current demographic policies</p>
                                      <p>* Migration patterns and social factors may affect actual population growth</p>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            </div>
                          </TabsContent>
                        </Tabs>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>

              {/* Comprehensive Development & Government Intelligence Analysis */}
              <Card className="glass-hierarchy-child">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <RiGlobalLine className="h-5 w-5" style={{ color: flagColors.primary }} />
                    Development & Government Intelligence
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Card className="cursor-pointer hover:scale-[1.01] transition-all duration-300 border border-border/50 hover:border-border group">
                        <CardContent className="p-6">
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/20">
                                  <RiGlobalLine className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                                </div>
                                <div>
                                  <h3 className="font-semibold text-lg">Government & Development</h3>
                                  <p className="text-sm text-muted-foreground">Complete governance and development intelligence</p>
                                </div>
                              </div>
                              <Badge variant="secondary" className="text-xs group-hover:bg-primary/10">Click to Expand</Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <div className="text-xs text-muted-foreground">Government Structure</div>
                                <div className="text-lg font-semibold">{country.governmentType || 'N/A'}</div>
                                <div className="text-xs text-purple-600 dark:text-purple-400">{country.leader || 'Leadership Data N/A'}</div>
                              </div>
                              <div className="space-y-1">
                                <div className="text-xs text-muted-foreground">Development Index</div>
                                <div className="text-lg font-semibold">
                                  {(() => {
                                    const tierScores: Record<string, number> = {
                                      "Extravagant": 100, "Very Strong": 85, "Strong": 70,
                                      "Healthy": 55, "Developed": 40, "Developing": 25
                                    };
                                    return tierScores[country.economicTier] || 10;
                                  })()}%
                                </div>
                                <div className="text-xs text-green-600 dark:text-green-400">Based on {country.economicTier} tier</div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </DialogTrigger>
                    <DialogContent className="!max-w-none !w-[96vw] !h-[96vh] !max-h-none overflow-y-auto !left-[2vw] !top-[2vh] !translate-x-0 !translate-y-0 !sm:max-w-none backdrop-blur-xl bg-background/80 border border-border/50">
                      <DialogHeader className="backdrop-blur-md bg-background/60 rounded-lg p-6 mb-6 border border-border/30">
                        <DialogTitle className="flex items-center gap-2 text-foreground">
                          <RiGlobalLine className="h-5 w-5" style={{ color: flagColors.accent }} />
                          Development & Government Intelligence Analysis - {country.name}
                        </DialogTitle>
                      </DialogHeader>
                      <div className="space-y-8 p-8 max-w-7xl mx-auto w-full">
                        <Tabs defaultValue="overview" className="w-full">
                          <TabsList className="backdrop-blur-md bg-background/70 border border-border/30 grid w-full grid-cols-4 max-w-2xl mx-auto">
                            <TabsTrigger value="overview">Overview</TabsTrigger>
                            <TabsTrigger value="governance">Governance Structure</TabsTrigger>
                            <TabsTrigger value="development">Development Index</TabsTrigger>
                            <TabsTrigger value="analysis">Comprehensive Analysis</TabsTrigger>
                          </TabsList>

                          <TabsContent value="overview" className="backdrop-blur-sm bg-background/40 rounded-lg p-6 mt-6 border border-border/20">
                            <div className="space-y-6">
                              {/* Current Overview */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-6">
                                <div className="backdrop-blur-sm bg-background/50 p-4 rounded-lg border border-border/20 hover:bg-background/60 transition-all">
                                  <div className="flex items-center gap-2 mb-2">
                                    <RiGlobalLine className="h-4 w-4 text-purple-400 dark:text-purple-300" />
                                    <span className="text-sm font-medium">Government Type</span>
                                  </div>
                                  <p className="text-2xl font-bold text-purple-700 dark:text-purple-400">
                                    {country.governmentType || 'N/A'}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    political system
                                  </p>
                                </div>

                                <div className="bg-muted/50 p-4 rounded-lg">
                                  <div className="flex items-center gap-2 mb-2">
                                    <RiUserLine className="h-4 w-4 text-blue-400 dark:text-blue-300" />
                                    <span className="text-sm font-medium">Leadership</span>
                                  </div>
                                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                                    {country.leader ? 'Active' : 'N/A'}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {country.leader || 'leadership status'}
                                  </p>
                                </div>

                                <div className="bg-muted/50 p-4 rounded-lg">
                                  <div className="flex items-center gap-2 mb-2">
                                    <RiBarChartLine className="h-4 w-4 text-green-400 dark:text-green-300" />
                                    <span className="text-sm font-medium">Development Index</span>
                                  </div>
                                  <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                                    {(() => {
                                      const tierScores: Record<string, number> = {
                                        "Extravagant": 100, "Very Strong": 85, "Strong": 70,
                                        "Healthy": 55, "Developed": 40, "Developing": 25
                                      };
                                      return tierScores[country.economicTier] || 10;
                                    })()}%
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    development score
                                  </p>
                                </div>

                                <div className="bg-muted/50 p-4 rounded-lg">
                                  <div className="flex items-center gap-2 mb-2">
                                    <RiMapPinLine className="h-4 w-4 text-orange-400 dark:text-orange-300" />
                                    <span className="text-sm font-medium">Regional Position</span>
                                  </div>
                                  <p className="text-2xl font-bold text-orange-700 dark:text-orange-400">
                                    {country.region || country.continent || 'Global'}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    geographic region
                                  </p>
                                </div>
                              </div>

                              {/* Cultural & Social Context */}
                              <Card className="backdrop-blur-sm bg-background/50 border border-border/20">
                                <CardHeader>
                                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                                    <RiGroup2Line className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                    Cultural & Social Context
                                  </CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    {country.religion && (
                                      <div className="text-center p-4 bg-muted/50 rounded-lg">
                                        <div className="text-2xl font-bold text-blue-700 dark:text-blue-400 mb-2">
                                          {country.religion}
                                        </div>
                                        <div className="text-sm font-medium mb-1">Primary Religion</div>
                                        <div className="text-xs text-muted-foreground">
                                          Cultural foundation
                                        </div>
                                      </div>
                                    )}
                                    {country.capital && (
                                      <div className="text-center p-4 bg-muted/50 rounded-lg">
                                        <div className="text-2xl font-bold text-green-700 dark:text-green-400 mb-2">
                                          {country.capital}
                                        </div>
                                        <div className="text-sm font-medium mb-1">Capital City</div>
                                        <div className="text-xs text-muted-foreground">
                                          Administrative center
                                        </div>
                                      </div>
                                    )}
                                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                                      <div className="text-2xl font-bold text-purple-600 mb-2">
                                        {country.continent || 'Global'}
                                      </div>
                                      <div className="text-sm font-medium mb-1">Continental Position</div>
                                      <div className="text-xs text-muted-foreground">
                                        Geographic classification
                                      </div>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>

                              {/* Development Classification System */}
                              <Card>
                                <CardHeader>
                                  <CardTitle className="text-lg font-semibold">Development Classification System</CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <div className="space-y-3">
                                    {[
                                      { name: "Impoverished", score: 10, min: 0, max: 9999, icon: "📉", color: "text-red-600" },
                                      { name: "Developing", score: 25, min: 10000, max: 24999, icon: "📈", color: "text-orange-600" },
                                      { name: "Developed", score: 40, min: 25000, max: 34999, icon: "🏭", color: "text-yellow-600" },
                                      { name: "Healthy", score: 55, min: 35000, max: 44999, icon: "💰", color: "text-green-600" },
                                      { name: "Strong", score: 70, min: 45000, max: 54999, icon: "🚀", color: "text-blue-600" },
                                      { name: "Very Strong", score: 85, min: 55000, max: 64999, icon: "🌟", color: "text-indigo-600" },
                                      { name: "Extravagant", score: 100, min: 65000, max: Infinity, icon: "👑", color: "text-purple-600" }
                                    ].map((tier) => {
                                      const isCurrent = tier.name === country.economicTier;
                                      return (
                                        <div 
                                          key={tier.name}
                                          className={`p-3 rounded-lg border-2 ${
                                            isCurrent 
                                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20' 
                                              : 'border-gray-200 dark:border-gray-700'
                                          }`}
                                        >
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                              <span className="text-lg">{tier.icon}</span>
                                              <span className="font-medium">{tier.name} ({tier.score}%)</span>
                                              {isCurrent && (
                                                <Badge variant="default">Current</Badge>
                                              )}
                                            </div>
                                            <div className="text-sm text-muted-foreground">
                                              GDP: {formatCurrency(tier.min)} - {tier.max === Infinity ? '∞' : formatCurrency(tier.max)}
                                            </div>
                                          </div>
                                          
                                          {isCurrent && (
                                            <div className="mt-2 text-sm">
                                              <div className="flex items-center gap-2">
                                                <span>Current GDP/capita: {formatCurrency(country.currentGdpPerCapita)}</span>
                                                <span className={`font-medium ${tier.color}`}>
                                                  Development Score: {tier.score}%
                                                </span>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </CardContent>
                              </Card>
                            </div>
                          </TabsContent>

                          <TabsContent value="governance" className="mt-6">
                            <div className="space-y-6">
                              <Card>
                                <CardHeader>
                                  <CardTitle>Government Structure Analysis</CardTitle>
                                  <CardDescription>Political system and administrative framework</CardDescription>
                                </CardHeader>
                                <CardContent>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-4">
                                      <h4 className="font-semibold mb-3">Executive Branch</h4>
                                      <div className="space-y-3">
                                        <div className="p-4 border rounded-lg">
                                          <div className="text-sm font-medium mb-1">Government Type</div>
                                          <div className="text-lg">{country.governmentType || 'Not specified'}</div>
                                        </div>
                                        <div className="p-4 border rounded-lg">
                                          <div className="text-sm font-medium mb-1">Current Leader</div>
                                          <div className="text-lg">{country.leader || 'Not specified'}</div>
                                        </div>
                                        <div className="p-4 border rounded-lg">
                                          <div className="text-sm font-medium mb-1">Capital City</div>
                                          <div className="text-lg">{country.capital || 'Not specified'}</div>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="space-y-4">
                                      <h4 className="font-semibold mb-3">Administrative Metrics</h4>
                                      <div className="space-y-3">
                                        <div className="p-4 border rounded-lg">
                                          <div className="text-sm font-medium mb-1">Governance Efficiency</div>
                                          <div className="text-lg text-blue-600">
                                            {(() => {
                                              const tierScores: Record<string, number> = {
                                                "Extravagant": 95, "Very Strong": 85, "Strong": 75,
                                                "Healthy": 65, "Developed": 55, "Developing": 35
                                              };
                                              return tierScores[country.economicTier] || 25;
                                            })()}%
                                          </div>
                                        </div>
                                        <div className="p-4 border rounded-lg">
                                          <div className="text-sm font-medium mb-1">Administrative Capacity</div>
                                          <div className="text-lg text-green-600">
                                            {country.economicTier === 'Extravagant' ? 'Very High' :
                                             ['Very Strong', 'Strong'].includes(country.economicTier) ? 'High' :
                                             ['Healthy', 'Developed'].includes(country.economicTier) ? 'Moderate' : 'Developing'}
                                          </div>
                                        </div>
                                        <div className="p-4 border rounded-lg">
                                          <div className="text-sm font-medium mb-1">Institutional Stability</div>
                                          <div className="text-lg text-purple-600">
                                            {(country.populationGrowthRate < 0.02 && ['Extravagant', 'Very Strong', 'Strong'].includes(country.economicTier)) ? 'Very Stable' :
                                             ['Healthy', 'Developed'].includes(country.economicTier) ? 'Stable' : 'Developing'}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            </div>
                          </TabsContent>

                          <TabsContent value="development" className="mt-6">
                            <div className="space-y-6">
                              <Card>
                                <CardHeader>
                                  <CardTitle>Development Index Analysis</CardTitle>
                                  <CardDescription>Comprehensive development metrics and regional comparison</CardDescription>
                                </CardHeader>
                                <CardContent>
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="text-center p-4 border rounded-lg">
                                      <div className="text-3xl font-bold text-blue-600 mb-2">
                                        {(() => {
                                          const tierScores: Record<string, number> = {
                                            "Extravagant": 100, "Very Strong": 85, "Strong": 70,
                                            "Healthy": 55, "Developed": 40, "Developing": 25
                                          };
                                          return tierScores[country.economicTier] || 10;
                                        })()}%
                                      </div>
                                      <div className="text-sm font-medium mb-1">Overall Development Index</div>
                                      <div className="text-xs text-muted-foreground">
                                        Based on economic tier classification
                                      </div>
                                    </div>
                                    <div className="text-center p-4 border rounded-lg">
                                      <div className="text-3xl font-bold text-green-600 mb-2">
                                        {Math.min(100, (country.currentGdpPerCapita / 50000) * 100).toFixed(0)}%
                                      </div>
                                      <div className="text-sm font-medium mb-1">Economic Development</div>
                                      <div className="text-xs text-muted-foreground">
                                        GDP per capita relative score
                                      </div>
                                    </div>
                                    <div className="text-center p-4 border rounded-lg">
                                      <div className="text-3xl font-bold text-purple-600 mb-2">
                                        {((country.populationGrowthRate * 100 + 2) * 25).toFixed(0)}%
                                      </div>
                                      <div className="text-sm font-medium mb-1">Social Development</div>
                                      <div className="text-xs text-muted-foreground">
                                        Population and social indicators
                                      </div>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            </div>
                          </TabsContent>

                          <TabsContent value="analysis" className="mt-6">
                            <div className="space-y-6">
                              <Card>
                                <CardHeader>
                                  <CardTitle>Comprehensive Development Analysis</CardTitle>
                                  <CardDescription>Multi-dimensional assessment of national development</CardDescription>
                                </CardHeader>
                                <CardContent>
                                  <div className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                      <div>
                                        <h4 className="font-semibold mb-3">Strengths</h4>
                                        <div className="space-y-2">
                                          {country.economicTier === 'Extravagant' && (
                                            <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-950/20 rounded">
                                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                              <span className="text-sm">Highest economic tier achieved</span>
                                            </div>
                                          )}
                                          {['Very Strong', 'Strong', 'Healthy'].includes(country.economicTier) && (
                                            <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-950/20 rounded">
                                              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                              <span className="text-sm">Strong economic foundation</span>
                                            </div>
                                          )}
                                          {country.populationGrowthRate > 0.01 && (
                                            <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-950/20 rounded">
                                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                              <span className="text-sm">Positive population growth</span>
                                            </div>
                                          )}
                                          {country.currentGdpPerCapita > 35000 && (
                                            <div className="flex items-center gap-2 p-2 bg-purple-50 dark:bg-purple-950/20 rounded">
                                              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                                              <span className="text-sm">High standard of living</span>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                      <div>
                                        <h4 className="font-semibold mb-3">Development Opportunities</h4>
                                        <div className="space-y-2">
                                          {country.economicTier === 'Developing' && (
                                            <div className="flex items-center gap-2 p-2 bg-yellow-50 dark:bg-yellow-950/20 rounded">
                                              <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                                              <span className="text-sm">Economic diversification potential</span>
                                            </div>
                                          )}
                                          {country.populationGrowthRate > 0.03 && (
                                            <div className="flex items-center gap-2 p-2 bg-orange-50 dark:bg-orange-950/20 rounded">
                                              <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                                              <span className="text-sm">Demographic dividend opportunity</span>
                                            </div>
                                          )}
                                          {!country.religion && (
                                            <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-950/20 rounded">
                                              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                              <span className="text-sm">Cultural identity development</span>
                                            </div>
                                          )}
                                          <div className="flex items-center gap-2 p-2 bg-purple-50 dark:bg-purple-950/20 rounded">
                                            <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                                            <span className="text-sm">Governance modernization</span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            </div>
                          </TabsContent>
                        </Tabs>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>

              {/* Labor & Government Metrics */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Labor Metrics */}
                <Card className="glass-hierarchy-child">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <RiBuildingLine className="h-5 w-5" style={{ color: flagColors.primary }} />
                      Labor Force
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {countryMetrics
                        .filter(metric => metric.id.includes('labor') || metric.id.includes('unemployment'))
                        .filter(metric => hasAccess(metric.classification))
                        .map((metric) => {
                        const MetricIcon = metric.icon as React.ComponentType<{ className?: string; style?: React.CSSProperties; }>;
                        const TrendIcon = metric.trend ? getTrendIcon(metric.trend.direction) : null;
                        
                        return (
                          <div 
                            key={metric.id}
                            className="p-4 rounded-lg border bg-card/50"
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <MetricIcon className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm font-medium">{metric.label}</span>
                            </div>
                            
                            <div className="flex items-baseline gap-1 mb-2">
                              <span className="text-xl font-semibold">{metric.value}</span>
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
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* Government & Geographic */}
                <Card className="glass-hierarchy-child">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <RiMapLine className="h-5 w-5" style={{ color: flagColors.primary }} />
                      Government & Geography
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {countryMetrics
                        .filter(metric => 
                          metric.id.includes('government') || 
                          metric.id.includes('capital') || 
                          metric.id.includes('continent') || 
                          metric.id.includes('region') ||
                          metric.id.includes('area') ||
                          metric.id.includes('density')
                        )
                        .filter(metric => hasAccess(metric.classification))
                        .map((metric) => {
                        const MetricIcon = metric.icon as React.ComponentType<{ className?: string; style?: React.CSSProperties; }>;
                        
                        return (
                          <div 
                            key={metric.id}
                            className="p-3 rounded-lg border bg-card/50"
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <MetricIcon className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs font-medium text-muted-foreground">{metric.label}</span>
                            </div>
                            
                            <div className="flex items-baseline gap-1">
                              <span className="text-sm font-semibold">{metric.value}</span>
                              {metric.unit && (
                                <span className="text-xs text-muted-foreground">{metric.unit}</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
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