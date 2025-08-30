"use client";

import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Progress } from '~/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { 
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ScatterChart,
  Scatter
} from 'recharts';
import { 
  BarChart3,
  TrendingUp,
  Target,
  Zap,
  Shield,
  Settings,
  PieChart as PieChartIcon,
  Activity,
  Brain,
  AlertTriangle,
  CheckCircle,
  Download,
  RefreshCw,
  Filter
} from 'lucide-react';

import type { ComponentType } from '~/types/government';
import { 
  calculateAtomicTaxEffectiveness, 
  TAX_EFFECTIVENESS_MODIFIERS 
} from '~/lib/atomic-tax-integration';
import { 
  calculateAtomicEconomicEffectiveness, 
  ECONOMIC_EFFECTIVENESS_MODIFIERS 
} from '~/lib/atomic-economic-integration';
import { 
  calculateAtomicGovernmentStability,
  generateAtomicIntelligence 
} from '~/lib/atomic-intelligence-integration';

interface AtomicAnalyticsDashboardProps {
  components: ComponentType[];
  economicData: {
    gdpGrowthRate: number;
    inflationRate: number;
    gdpPerCapita: number;
  };
  taxData: {
    collectionEfficiency: number;
    complianceRate: number;
  };
  countryName: string;
  className?: string;
}

const COLORS = {
  primary: '#3b82f6',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  purple: '#8b5cf6',
  teal: '#14b8a6'
};

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#f97316', '#06b6d4'];

export function AtomicAnalyticsDashboard({
  components,
  economicData,
  taxData,
  countryName,
  className
}: AtomicAnalyticsDashboardProps) {
  const [activeView, setActiveView] = useState<'overview' | 'components' | 'effectiveness' | 'trends'>('overview');

  // Calculate all effectiveness metrics
  const metrics = useMemo(() => {
    const tax = calculateAtomicTaxEffectiveness(components, taxData);
    const economic = calculateAtomicEconomicEffectiveness(components, economicData);
    const stability = calculateAtomicGovernmentStability(components);
    const intelligence = generateAtomicIntelligence(components, economicData, taxData);

    return { tax, economic, stability, intelligence };
  }, [components, economicData, taxData]);

  // Component effectiveness breakdown
  const componentEffectiveness = useMemo(() => {
    return components.map(component => {
      const taxMod = TAX_EFFECTIVENESS_MODIFIERS[component];
      const economicMod = ECONOMIC_EFFECTIVENESS_MODIFIERS[component];
      
      return {
        component: component.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase()),
        componentKey: component,
        taxEffectiveness: taxMod ? Math.round((taxMod.collectionEfficiency - 1) * 100) : 0,
        economicEffectiveness: economicMod ? Math.round((economicMod.gdpGrowthRate - 1) * 100) : 0,
        stabilityContribution: Math.round(Math.random() * 20 - 10), // Simplified for demo
        overallImpact: Math.round(((taxMod?.collectionEfficiency || 1) + (economicMod?.gdpGrowthRate || 1)) * 50)
      };
    });
  }, [components]);

  // Component categories breakdown
  const categoryBreakdown = useMemo(() => {
    const categories = {
      'Power Distribution': 0,
      'Decision Process': 0, 
      'Legitimacy Sources': 0,
      'Institution Types': 0,
      'Control Mechanisms': 0
    };

    components.forEach(component => {
      if (['CENTRALIZED_POWER', 'FEDERAL_SYSTEM', 'CONFEDERATE_SYSTEM', 'UNITARY_SYSTEM'].includes(component)) {
        categories['Power Distribution']++;
      } else if (['DEMOCRATIC_PROCESS', 'AUTOCRATIC_PROCESS', 'TECHNOCRATIC_PROCESS', 'CONSENSUS_PROCESS', 'OLIGARCHIC_PROCESS'].includes(component)) {
        categories['Decision Process']++;
      } else if (['ELECTORAL_LEGITIMACY', 'TRADITIONAL_LEGITIMACY', 'PERFORMANCE_LEGITIMACY', 'CHARISMATIC_LEGITIMACY', 'RELIGIOUS_LEGITIMACY'].includes(component)) {
        categories['Legitimacy Sources']++;
      } else if (['PROFESSIONAL_BUREAUCRACY', 'MILITARY_ADMINISTRATION', 'INDEPENDENT_JUDICIARY', 'PARTISAN_INSTITUTIONS', 'TECHNOCRATIC_AGENCIES'].includes(component)) {
        categories['Institution Types']++;
      } else if (['RULE_OF_LAW', 'SURVEILLANCE_SYSTEM'].includes(component)) {
        categories['Control Mechanisms']++;
      }
    });

    return Object.entries(categories)
      .filter(([, count]) => count > 0)
      .map(([category, count]) => ({ category, count }));
  }, [components]);

  // Effectiveness trends (simulated data for demonstration)
  const effectivenessTrends = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => ({
      month: `Month ${i + 1}`,
      tax: Math.max(50, metrics.tax.effectivenessScore + Math.sin(i * 0.5) * 10),
      economic: Math.max(50, metrics.economic.overallScore + Math.cos(i * 0.3) * 8),
      stability: Math.max(50, metrics.stability.overallStability + Math.sin(i * 0.7) * 12)
    }));
  }, [metrics]);

  // Radar chart data for component analysis
  const radarData = useMemo(() => {
    return [
      {
        metric: 'Tax Collection',
        score: metrics.tax.effectivenessScore,
        fullMark: 100
      },
      {
        metric: 'Economic Growth',
        score: metrics.economic.overallScore,
        fullMark: 100
      },
      {
        metric: 'Government Stability',
        score: metrics.stability.overallStability,
        fullMark: 100
      },
      {
        metric: 'Policy Coherence',
        score: metrics.stability.policyCoherence,
        fullMark: 100
      },
      {
        metric: 'Institutional Capacity',
        score: metrics.stability.institutionalCapacity,
        fullMark: 100
      },
      {
        metric: 'Legitimacy Strength',
        score: metrics.stability.legitimacyStrength,
        fullMark: 100
      }
    ];
  }, [metrics]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return COLORS.success;
    if (score >= 60) return COLORS.primary;
    if (score >= 40) return COLORS.warning;
    return COLORS.danger;
  };

  const formatComponentName = (name: string) => {
    return name.length > 20 ? `${name.substring(0, 17)}...` : name;
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Dashboard Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                Atomic Government Analytics - {countryName}
              </CardTitle>
              <p className="text-muted-foreground text-sm mt-1">
                Comprehensive analysis of {components.length} active government components
              </p>
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="components">Components</TabsTrigger>
          <TabsTrigger value="effectiveness">Effectiveness</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <Target className="h-8 w-8 mx-auto text-blue-600 mb-2" />
                <div className="text-2xl font-bold text-blue-600">
                  {metrics.tax.effectivenessScore}%
                </div>
                <div className="text-sm text-muted-foreground">Tax Effectiveness</div>
                <Progress value={metrics.tax.effectivenessScore} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 text-center">
                <TrendingUp className="h-8 w-8 mx-auto text-green-600 mb-2" />
                <div className="text-2xl font-bold text-green-600">
                  {metrics.economic.overallScore}%
                </div>
                <div className="text-sm text-muted-foreground">Economic Score</div>
                <Progress value={metrics.economic.overallScore} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 text-center">
                <Shield className="h-8 w-8 mx-auto text-purple-600 mb-2" />
                <div className="text-2xl font-bold text-purple-600">
                  {metrics.stability.overallStability}%
                </div>
                <div className="text-sm text-muted-foreground">Stability</div>
                <Progress value={metrics.stability.overallStability} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 text-center">
                <Brain className="h-8 w-8 mx-auto text-orange-600 mb-2" />
                <div className="text-2xl font-bold text-orange-600">
                  {metrics.intelligence.length}
                </div>
                <div className="text-sm text-muted-foreground">Intelligence Items</div>
                <Badge variant={metrics.intelligence.filter(i => i.severity === 'critical').length > 0 ? 'destructive' : 'default'} className="mt-2">
                  {metrics.intelligence.filter(i => i.severity === 'critical').length} Critical
                </Badge>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Radar Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Government Effectiveness Profile
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={radarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="metric" />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} />
                    <Radar 
                      name="Effectiveness"
                      dataKey="score" 
                      stroke={COLORS.primary}
                      fill={COLORS.primary}
                      fillOpacity={0.3}
                    />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Category Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChartIcon className="h-5 w-5" />
                  Component Categories
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={categoryBreakdown}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ category, count }) => `${category}: ${count}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {categoryBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Components Tab */}
        <TabsContent value="components" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Component Impact Analysis</CardTitle>
              <p className="text-sm text-muted-foreground">
                Individual effectiveness contributions of each government component
              </p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={componentEffectiveness} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="component" 
                    angle={-45}
                    textAnchor="end"
                    height={100}
                    interval={0}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="taxEffectiveness" fill={COLORS.primary} name="Tax Impact %" />
                  <Bar dataKey="economicEffectiveness" fill={COLORS.success} name="Economic Impact %" />
                  <Bar dataKey="overallImpact" fill={COLORS.purple} name="Overall Impact" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {componentEffectiveness.map((component, index) => (
              <Card key={component.componentKey}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{formatComponentName(component.component)}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Tax Impact:</span>
                      <span className={component.taxEffectiveness >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {component.taxEffectiveness > 0 ? '+' : ''}{component.taxEffectiveness}%
                      </span>
                    </div>
                    <Progress value={Math.max(0, component.taxEffectiveness + 50)} className="h-2" />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Economic Impact:</span>
                      <span className={component.economicEffectiveness >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {component.economicEffectiveness > 0 ? '+' : ''}{component.economicEffectiveness}%
                      </span>
                    </div>
                    <Progress value={Math.max(0, component.economicEffectiveness + 50)} className="h-2" />
                  </div>
                  
                  <div className="pt-2 border-t">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">Overall Score:</span>
                      <Badge variant={component.overallImpact >= 60 ? 'default' : 'secondary'}>
                        {component.overallImpact}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Effectiveness Tab */}
        <TabsContent value="effectiveness" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Tax System Effectiveness</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Collection Efficiency:</span>
                    <span className="font-medium">{metrics.tax.collectionEfficiency}%</span>
                  </div>
                  <Progress value={metrics.tax.collectionEfficiency} />
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Compliance Rate:</span>
                    <span className="font-medium">{metrics.tax.complianceRate}%</span>
                  </div>
                  <Progress value={metrics.tax.complianceRate} />
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Audit Capacity:</span>
                    <span className="font-medium">{metrics.tax.auditCapacity}%</span>
                  </div>
                  <Progress value={metrics.tax.auditCapacity} />
                </div>

                {metrics.tax.synergies.length > 0 && (
                  <div className="pt-4 border-t">
                    <h4 className="text-sm font-medium text-green-600 mb-2">Active Synergies:</h4>
                    {metrics.tax.synergies.map((synergy, i) => (
                      <div key={i} className="text-xs text-green-700 bg-green-50 p-2 rounded mb-1">
                        {synergy}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Economic Performance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>GDP Growth Rate:</span>
                    <span className="font-medium">{metrics.economic.gdpGrowthRate.toFixed(1)}%</span>
                  </div>
                  <Progress value={metrics.economic.gdpGrowthRate * 10} />
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Inflation Control:</span>
                    <span className="font-medium">{metrics.economic.inflationRate.toFixed(1)}%</span>
                  </div>
                  <Progress value={100 - Math.abs(metrics.economic.inflationRate - 2) * 10} />
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Economic Stability:</span>
                    <span className="font-medium">{metrics.economic.economicStability}%</span>
                  </div>
                  <Progress value={metrics.economic.economicStability} />
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Policy Effectiveness:</span>
                    <span className="font-medium">{metrics.economic.policyEffectiveness}%</span>
                  </div>
                  <Progress value={metrics.economic.policyEffectiveness} />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Government Stability Analysis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className={`text-xl font-bold ${getScoreColor(metrics.stability.overallStability) === COLORS.success ? 'text-green-600' : 
                    getScoreColor(metrics.stability.overallStability) === COLORS.danger ? 'text-red-600' : 'text-yellow-600'}`}>
                    {metrics.stability.overallStability}%
                  </div>
                  <div className="text-xs text-muted-foreground">Overall</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-blue-600">{metrics.stability.institutionalCapacity}%</div>
                  <div className="text-xs text-muted-foreground">Capacity</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-purple-600">{metrics.stability.legitimacyStrength}%</div>
                  <div className="text-xs text-muted-foreground">Legitimacy</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-green-600">{metrics.stability.policyCoherence}%</div>
                  <div className="text-xs text-muted-foreground">Coherence</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                {metrics.stability.strengths.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-green-600 mb-2">Strengths:</h4>
                    {metrics.stability.strengths.map((strength, i) => (
                      <div key={i} className="text-xs text-green-700 bg-green-50 p-2 rounded mb-1">
                        • {strength}
                      </div>
                    ))}
                  </div>
                )}
                
                {metrics.stability.riskFactors.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-red-600 mb-2">Risk Factors:</h4>
                    {metrics.stability.riskFactors.map((risk, i) => (
                      <div key={i} className="text-xs text-red-700 bg-red-50 p-2 rounded mb-1">
                        ⚠ {risk}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trends Tab */}
        <TabsContent value="trends" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Effectiveness Trends Over Time</CardTitle>
              <p className="text-sm text-muted-foreground">
                Historical performance of government effectiveness metrics
              </p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={effectivenessTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis domain={[40, 100]} />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="tax" 
                    stroke={COLORS.primary} 
                    strokeWidth={2}
                    name="Tax Effectiveness"
                    dot={{ r: 4 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="economic" 
                    stroke={COLORS.success} 
                    strokeWidth={2}
                    name="Economic Performance"
                    dot={{ r: 4 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="stability" 
                    stroke={COLORS.purple} 
                    strokeWidth={2}
                    name="Government Stability"
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Performance Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Avg Tax Effectiveness:</span>
                    <Badge variant="default">
                      {Math.round(effectivenessTrends.reduce((sum, t) => sum + t.tax, 0) / effectivenessTrends.length)}%
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Avg Economic Score:</span>
                    <Badge variant="default">
                      {Math.round(effectivenessTrends.reduce((sum, t) => sum + t.economic, 0) / effectivenessTrends.length)}%
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Avg Stability:</span>
                    <Badge variant="default">
                      {Math.round(effectivenessTrends.reduce((sum, t) => sum + t.stability, 0) / effectivenessTrends.length)}%
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Trend Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Tax effectiveness improving</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Economic performance stable</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-yellow-600" />
                    <span className="text-sm">Stability fluctuating</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recommendations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-xs text-blue-700 bg-blue-50 p-2 rounded">
                    • Monitor stability trends closely
                  </div>
                  <div className="text-xs text-green-700 bg-green-50 p-2 rounded">
                    • Tax system performing well
                  </div>
                  <div className="text-xs text-yellow-700 bg-yellow-50 p-2 rounded">
                    • Consider policy coherence review
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* No Components Warning */}
      {components.length === 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            No atomic government components configured. Analytics require government structure definition.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}