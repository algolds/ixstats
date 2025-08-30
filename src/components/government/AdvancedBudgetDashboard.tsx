"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { Progress } from '~/components/ui/progress';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Slider } from '~/components/ui/slider';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  AlertTriangle, 
  CheckCircle,
  Target,
  PieChart,
  BarChart3,
  Calculator,
  Zap,
  Shield,
  Users,
  Building2,
  Heart,
  GraduationCap,
  Briefcase,
  Gavel,
  Globe,
  Settings,
  ArrowUp,
  ArrowDown,
  Equal,
  Info
} from 'lucide-react';

// Advanced Budget Types
interface BudgetCategory {
  id: string;
  name: string;
  type: 'MANDATORY' | 'DISCRETIONARY' | 'EMERGENCY';
  allocatedAmount: number;
  allocatedPercent: number;
  spentAmount: number;
  encumberedAmount: number;
  availableAmount: number;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  department: string;
  color: string;
  icon: string;
  growthRate?: number;
  efficiency?: number;
  performance?: number;
}

interface BudgetScenario {
  id: string;
  name: string;
  description: string;
  totalBudget: number;
  categories: BudgetCategory[];
  assumptions: string[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  feasibility: number;
}

interface FiscalPolicy {
  id: string;
  name: string;
  type: 'TAX_POLICY' | 'SPENDING_POLICY' | 'DEBT_POLICY';
  impact: number;
  implementation: 'IMMEDIATE' | 'SHORT_TERM' | 'LONG_TERM';
  cost: number;
  benefits: number;
  description: string;
}

interface AdvancedBudgetDashboardProps {
  totalBudget: number;
  currency: string;
  fiscalYear: number;
  budgetCategories: BudgetCategory[];
  scenarios?: BudgetScenario[];
  policies?: FiscalPolicy[];
  onBudgetChange?: (categories: BudgetCategory[]) => void;
  onScenarioApply?: (scenario: BudgetScenario) => void;
  onPolicyApply?: (policy: FiscalPolicy) => void;
  isReadOnly?: boolean;
}

// Sample Data for Advanced Features
const sampleScenarios: BudgetScenario[] = [
  {
    id: 'austere',
    name: 'Fiscal Austerity',
    description: 'Reduced spending across non-essential categories to balance budget',
    totalBudget: 800000000,
    riskLevel: 'HIGH',
    feasibility: 75,
    assumptions: [
      'Economic downturn requires spending cuts',
      'Public services may be reduced',
      'Tax revenue remains stable'
    ],
    categories: []
  },
  {
    id: 'expansion',
    name: 'Economic Expansion',
    description: 'Increased spending to stimulate growth and development',
    totalBudget: 1200000000,
    riskLevel: 'MEDIUM',
    feasibility: 80,
    assumptions: [
      'Economic growth will increase tax revenue',
      'Infrastructure investment will pay dividends',
      'Moderate deficit financing acceptable'
    ],
    categories: []
  },
  {
    id: 'balanced',
    name: 'Balanced Approach',
    description: 'Moderate spending with focus on efficiency and priorities',
    totalBudget: 1000000000,
    riskLevel: 'LOW',
    feasibility: 90,
    assumptions: [
      'Steady economic conditions',
      'Balanced fiscal position maintained',
      'Focus on high-impact spending'
    ],
    categories: []
  }
];

const samplePolicies: FiscalPolicy[] = [
  {
    id: 'tax_reform',
    name: 'Progressive Tax Reform',
    type: 'TAX_POLICY',
    impact: 15,
    implementation: 'LONG_TERM',
    cost: 50000000,
    benefits: 120000000,
    description: 'Reform tax system to be more progressive and efficient'
  },
  {
    id: 'infrastructure_boost',
    name: 'Infrastructure Investment',
    type: 'SPENDING_POLICY',
    impact: 25,
    implementation: 'SHORT_TERM',
    cost: 200000000,
    benefits: 300000000,
    description: 'Major investment in roads, bridges, and digital infrastructure'
  },
  {
    id: 'debt_consolidation',
    name: 'Debt Consolidation',
    type: 'DEBT_POLICY',
    impact: 10,
    implementation: 'IMMEDIATE',
    cost: 30000000,
    benefits: 80000000,
    description: 'Consolidate and refinance existing debt at lower rates'
  }
];

const iconMap: Record<string, any> = {
  Shield, Users, GraduationCap, Heart, Briefcase, Gavel, Building2, Globe, Settings
};

export function AdvancedBudgetDashboard({
  totalBudget,
  currency = 'USD',
  fiscalYear = new Date().getFullYear(),
  budgetCategories,
  scenarios = sampleScenarios,
  policies = samplePolicies,
  onBudgetChange,
  onScenarioApply,
  onPolicyApply,
  isReadOnly = false
}: AdvancedBudgetDashboardProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedScenario, setSelectedScenario] = useState<string>('');
  const [budgetOptimization, setBudgetOptimization] = useState<'EFFICIENCY' | 'GROWTH' | 'STABILITY'>('EFFICIENCY');
  const [showAdvancedMetrics, setShowAdvancedMetrics] = useState(false);

  // Budget Analytics
  const budgetAnalytics = useMemo(() => {
    const totalAllocated = budgetCategories.reduce((sum, cat) => sum + cat.allocatedAmount, 0);
    const totalSpent = budgetCategories.reduce((sum, cat) => sum + cat.spentAmount, 0);
    const totalAvailable = budgetCategories.reduce((sum, cat) => sum + cat.availableAmount, 0);
    const totalEncumbered = budgetCategories.reduce((sum, cat) => sum + cat.encumberedAmount, 0);
    
    const budgetUtilization = totalAllocated > 0 ? (totalSpent / totalAllocated) * 100 : 0;
    const budgetBalance = totalBudget - totalAllocated;
    const efficiencyScore = budgetCategories.reduce((sum, cat) => sum + (cat.efficiency || 0), 0) / budgetCategories.length;
    const performanceScore = budgetCategories.reduce((sum, cat) => sum + (cat.performance || 0), 0) / budgetCategories.length;
    
    return {
      totalAllocated,
      totalSpent,
      totalAvailable,
      totalEncumbered,
      budgetUtilization,
      budgetBalance,
      efficiencyScore,
      performanceScore,
      allocationRate: (totalAllocated / totalBudget) * 100
    };
  }, [budgetCategories, totalBudget]);

  // Risk Assessment
  const riskAssessment = useMemo(() => {
    const overBudgetCategories = budgetCategories.filter(cat => cat.spentAmount > cat.allocatedAmount);
    const criticalCategories = budgetCategories.filter(cat => cat.priority === 'CRITICAL' && cat.availableAmount < cat.allocatedAmount * 0.1);
    const underperformingCategories = budgetCategories.filter(cat => (cat.performance || 0) < 70);
    
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    if (overBudgetCategories.length > budgetCategories.length * 0.3 || criticalCategories.length > 0) {
      riskLevel = 'HIGH';
    } else if (overBudgetCategories.length > budgetCategories.length * 0.1) {
      riskLevel = 'MEDIUM';
    }
    
    return {
      riskLevel,
      overBudgetCategories,
      criticalCategories,
      underperformingCategories,
      recommendations: [
        ...(overBudgetCategories.length > 0 ? ['Review over-budget categories for cost control measures'] : []),
        ...(criticalCategories.length > 0 ? ['Immediate attention needed for critical underfunded areas'] : []),
        ...(budgetAnalytics.budgetBalance < 0 ? ['Budget exceeds available funds - reallocation required'] : []),
        ...(budgetAnalytics.efficiencyScore < 70 ? ['Focus on efficiency improvements across departments'] : [])
      ]
    };
  }, [budgetCategories, budgetAnalytics]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      notation: 'compact',
      maximumFractionDigits: 1
    }).format(amount);
  };

  const handleCategoryUpdate = (categoryId: string, updates: Partial<BudgetCategory>) => {
    if (isReadOnly || !onBudgetChange) return;
    
    const updatedCategories = budgetCategories.map(cat => 
      cat.id === categoryId ? { ...cat, ...updates } : cat
    );
    onBudgetChange(updatedCategories);
  };

  const handleScenarioApply = (scenarioId: string) => {
    const scenario = scenarios.find(s => s.id === scenarioId);
    if (scenario && onScenarioApply) {
      onScenarioApply(scenario);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Dashboard Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Advanced Budget Dashboard</h2>
          <p className="text-muted-foreground">
            Fiscal Year {fiscalYear} • Total Budget: {formatCurrency(totalBudget)}
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <Select value={budgetOptimization} onValueChange={(value) => setBudgetOptimization(value as any)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="EFFICIENCY">Efficiency Focus</SelectItem>
              <SelectItem value="GROWTH">Growth Focus</SelectItem>
              <SelectItem value="STABILITY">Stability Focus</SelectItem>
            </SelectContent>
          </Select>
          
          <Button
            variant="outline"
            onClick={() => setShowAdvancedMetrics(!showAdvancedMetrics)}
          >
            {showAdvancedMetrics ? 'Basic View' : 'Advanced Metrics'}
          </Button>
        </div>
      </div>

      {/* Key Performance Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Budget Utilization</p>
                <p className="text-2xl font-bold">{budgetAnalytics.budgetUtilization.toFixed(1)}%</p>
              </div>
              <div className={`p-2 rounded-lg ${
                budgetAnalytics.budgetUtilization > 90 ? 'bg-red-100' :
                budgetAnalytics.budgetUtilization > 75 ? 'bg-yellow-100' : 'bg-green-100'
              }`}>
                <Calculator className={`h-5 w-5 ${
                  budgetAnalytics.budgetUtilization > 90 ? 'text-red-600' :
                  budgetAnalytics.budgetUtilization > 75 ? 'text-yellow-600' : 'text-green-600'
                }`} />
              </div>
            </div>
            <Progress 
              value={budgetAnalytics.budgetUtilization} 
              className="mt-2"
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Budget Balance</p>
                <p className={`text-2xl font-bold ${budgetAnalytics.budgetBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(budgetAnalytics.budgetBalance)}
                </p>
              </div>
              <div className={`p-2 rounded-lg ${budgetAnalytics.budgetBalance >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                {budgetAnalytics.budgetBalance >= 0 ? 
                  <TrendingUp className="h-5 w-5 text-green-600" /> :
                  <TrendingDown className="h-5 w-5 text-red-600" />
                }
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Efficiency Score</p>
                <p className="text-2xl font-bold">{budgetAnalytics.efficiencyScore.toFixed(0)}%</p>
              </div>
              <div className={`p-2 rounded-lg ${
                budgetAnalytics.efficiencyScore >= 80 ? 'bg-green-100' :
                budgetAnalytics.efficiencyScore >= 60 ? 'bg-yellow-100' : 'bg-red-100'
              }`}>
                <Zap className={`h-5 w-5 ${
                  budgetAnalytics.efficiencyScore >= 80 ? 'text-green-600' :
                  budgetAnalytics.efficiencyScore >= 60 ? 'text-yellow-600' : 'text-red-600'
                }`} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Risk Level</p>
                <p className={`text-xl font-bold ${
                  riskAssessment.riskLevel === 'LOW' ? 'text-green-600' :
                  riskAssessment.riskLevel === 'MEDIUM' ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {riskAssessment.riskLevel}
                </p>
              </div>
              <div className={`p-2 rounded-lg ${
                riskAssessment.riskLevel === 'LOW' ? 'bg-green-100' :
                riskAssessment.riskLevel === 'MEDIUM' ? 'bg-yellow-100' : 'bg-red-100'
              }`}>
                <Shield className={`h-5 w-5 ${
                  riskAssessment.riskLevel === 'LOW' ? 'text-green-600' :
                  riskAssessment.riskLevel === 'MEDIUM' ? 'text-yellow-600' : 'text-red-600'
                }`} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Risk Assessment Alert */}
      {riskAssessment.recommendations.length > 0 && (
        <Alert className={`${
          riskAssessment.riskLevel === 'HIGH' ? 'border-red-500 bg-red-50' :
          riskAssessment.riskLevel === 'MEDIUM' ? 'border-yellow-500 bg-yellow-50' : 'border-blue-500 bg-blue-50'
        }`}>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-medium">Budget Analysis Recommendations:</p>
              <ul className="text-sm space-y-1">
                {riskAssessment.recommendations.map((rec, index) => (
                  <li key={index}>• {rec}</li>
                ))}
              </ul>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Main Dashboard Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="scenarios">Scenarios</TabsTrigger>
          <TabsTrigger value="policies">Policies</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Budget Allocation Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5" />
                  Budget Allocation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {budgetCategories.slice(0, 6).map(category => {
                    const IconComponent = iconMap[category.icon] || Building2;
                    return (
                      <div key={category.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div 
                            className="p-2 rounded-lg"
                            style={{ backgroundColor: category.color + '20', color: category.color }}
                          >
                            <IconComponent className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{category.name}</p>
                            <p className="text-xs text-muted-foreground">{category.department}</p>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <p className="font-medium text-sm">{formatCurrency(category.allocatedAmount)}</p>
                          <p className="text-xs text-muted-foreground">{category.allocatedPercent.toFixed(1)}%</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Spending Progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {budgetCategories.slice(0, 6).map(category => {
                    const spendingRate = category.allocatedAmount > 0 ? 
                      (category.spentAmount / category.allocatedAmount) * 100 : 0;
                    
                    return (
                      <div key={category.id} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{category.name}</span>
                          <span className="text-sm text-muted-foreground">
                            {spendingRate.toFixed(1)}%
                          </span>
                        </div>
                        <Progress 
                          value={spendingRate} 
                          className="h-2"
                        />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button 
                  variant="outline" 
                  className="justify-start"
                  onClick={() => setActiveTab('scenarios')}
                >
                  <Target className="h-4 w-4 mr-2" />
                  Apply Budget Scenario
                </Button>
                <Button 
                  variant="outline" 
                  className="justify-start"
                  onClick={() => setActiveTab('policies')}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Review Fiscal Policies
                </Button>
                <Button 
                  variant="outline" 
                  className="justify-start"
                  onClick={() => setActiveTab('analytics')}
                >
                  <TrendingUp className="h-4 w-4 mr-2" />
                  View Analytics
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="space-y-6">
          {/* Category Management */}
          <div className="space-y-4">
            {budgetCategories.map(category => {
              const spendingRate = category.allocatedAmount > 0 ? 
                (category.spentAmount / category.allocatedAmount) * 100 : 0;
              const IconComponent = iconMap[category.icon] || Building2;
              
              return (
                <Card key={category.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div 
                          className="p-2 rounded-lg"
                          style={{ backgroundColor: category.color + '20', color: category.color }}
                        >
                          <IconComponent className="h-5 w-5" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{category.name}</CardTitle>
                          <p className="text-sm text-muted-foreground">{category.department}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <Badge variant={
                          category.priority === 'CRITICAL' ? 'destructive' :
                          category.priority === 'HIGH' ? 'default' : 'secondary'
                        }>
                          {category.priority}
                        </Badge>
                        
                        <Badge variant="outline">
                          {category.type}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Budget Allocation */}
                      <div className="space-y-4">
                        <h4 className="font-medium">Budget Allocation</h4>
                        
                        <div className="space-y-3">
                          <div className="flex justify-between text-sm">
                            <span>Allocated:</span>
                            <span className="font-medium">{formatCurrency(category.allocatedAmount)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Spent:</span>
                            <span className="font-medium">{formatCurrency(category.spentAmount)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Available:</span>
                            <span className="font-medium text-green-600">{formatCurrency(category.availableAmount)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Encumbered:</span>
                            <span className="font-medium text-yellow-600">{formatCurrency(category.encumberedAmount)}</span>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Spending Rate:</span>
                            <span className={`font-medium ${
                              spendingRate > 100 ? 'text-red-600' :
                              spendingRate > 85 ? 'text-yellow-600' : 'text-green-600'
                            }`}>
                              {spendingRate.toFixed(1)}%
                            </span>
                          </div>
                          <Progress value={Math.min(spendingRate, 100)} />
                        </div>
                      </div>
                      
                      {/* Performance Metrics */}
                      {showAdvancedMetrics && (
                        <div className="space-y-4">
                          <h4 className="font-medium">Performance Metrics</h4>
                          
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm">Efficiency Score:</span>
                              <div className="flex items-center gap-2">
                                <Progress value={category.efficiency || 0} className="w-16" />
                                <span className="text-sm font-medium">{category.efficiency || 0}%</span>
                              </div>
                            </div>
                            
                            <div className="flex items-center justify-between">
                              <span className="text-sm">Performance Score:</span>
                              <div className="flex items-center gap-2">
                                <Progress value={category.performance || 0} className="w-16" />
                                <span className="text-sm font-medium">{category.performance || 0}%</span>
                              </div>
                            </div>
                            
                            {category.growthRate && (
                              <div className="flex items-center justify-between">
                                <span className="text-sm">Growth Rate:</span>
                                <div className="flex items-center gap-1">
                                  {category.growthRate > 0 ? 
                                    <ArrowUp className="h-3 w-3 text-green-600" /> :
                                    category.growthRate < 0 ?
                                    <ArrowDown className="h-3 w-3 text-red-600" /> :
                                    <Equal className="h-3 w-3 text-gray-600" />
                                  }
                                  <span className={`text-sm font-medium ${
                                    category.growthRate > 0 ? 'text-green-600' :
                                    category.growthRate < 0 ? 'text-red-600' : 'text-gray-600'
                                  }`}>
                                    {category.growthRate > 0 ? '+' : ''}{category.growthRate.toFixed(1)}%
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="scenarios" className="space-y-6">
          {/* Budget Scenarios */}
          <Card>
            <CardHeader>
              <CardTitle>Budget Scenarios</CardTitle>
              <p className="text-sm text-muted-foreground">
                Apply different budget scenarios to see their impact
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {scenarios.map(scenario => (
                  <Card key={scenario.id} className="cursor-pointer hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{scenario.name}</CardTitle>
                        <Badge variant={
                          scenario.riskLevel === 'LOW' ? 'default' :
                          scenario.riskLevel === 'MEDIUM' ? 'secondary' : 'destructive'
                        }>
                          {scenario.riskLevel} Risk
                        </Badge>
                      </div>
                    </CardHeader>
                    
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-4">
                        {scenario.description}
                      </p>
                      
                      <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span>Total Budget:</span>
                          <span className="font-medium">{formatCurrency(scenario.totalBudget)}</span>
                        </div>
                        
                        <div className="flex justify-between text-sm">
                          <span>Feasibility:</span>
                          <span className="font-medium">{scenario.feasibility}%</span>
                        </div>
                        
                        <Progress value={scenario.feasibility} className="h-2" />
                        
                        <div className="pt-2">
                          <p className="text-xs font-medium mb-2">Key Assumptions:</p>
                          <ul className="text-xs text-muted-foreground space-y-1">
                            {scenario.assumptions.slice(0, 2).map((assumption, index) => (
                              <li key={index}>• {assumption}</li>
                            ))}
                          </ul>
                        </div>
                        
                        <Button 
                          className="w-full mt-4"
                          onClick={() => handleScenarioApply(scenario.id)}
                          disabled={isReadOnly}
                        >
                          Apply Scenario
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="policies" className="space-y-6">
          {/* Fiscal Policies */}
          <Card>
            <CardHeader>
              <CardTitle>Fiscal Policy Options</CardTitle>
              <p className="text-sm text-muted-foreground">
                Review and apply fiscal policies to improve budget performance
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {policies.map(policy => (
                  <Card key={policy.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-medium">{policy.name}</h4>
                          <p className="text-sm text-muted-foreground">{policy.description}</p>
                        </div>
                        
                        <Badge variant="outline">
                          {policy.type.replace('_', ' ')}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Impact</p>
                          <p className="font-medium">+{policy.impact}%</p>
                        </div>
                        
                        <div>
                          <p className="text-xs text-muted-foreground">Cost</p>
                          <p className="font-medium text-red-600">{formatCurrency(policy.cost)}</p>
                        </div>
                        
                        <div>
                          <p className="text-xs text-muted-foreground">Benefits</p>
                          <p className="font-medium text-green-600">{formatCurrency(policy.benefits)}</p>
                        </div>
                        
                        <div>
                          <p className="text-xs text-muted-foreground">Timeline</p>
                          <p className="font-medium">{policy.implementation.replace('_', ' ')}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between mt-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">ROI:</span>
                          <span className={`font-medium ${
                            policy.benefits > policy.cost ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {((policy.benefits - policy.cost) / policy.cost * 100).toFixed(1)}%
                          </span>
                        </div>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onPolicyApply?.(policy)}
                          disabled={isReadOnly}
                        >
                          Apply Policy
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          {/* Advanced Analytics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Budget Efficiency Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <span className="font-medium">Overall Efficiency Score</span>
                    <span className="text-2xl font-bold text-blue-600">
                      {budgetAnalytics.efficiencyScore.toFixed(0)}%
                    </span>
                  </div>
                  
                  <div className="space-y-3">
                    {budgetCategories.slice(0, 5).map(category => (
                      <div key={category.id} className="flex items-center justify-between">
                        <span className="text-sm">{category.name}</span>
                        <div className="flex items-center gap-2">
                          <Progress value={category.efficiency || 0} className="w-20" />
                          <span className="text-sm font-medium w-12">
                            {category.efficiency || 0}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <span className="font-medium">Overall Performance Score</span>
                    <span className="text-2xl font-bold text-green-600">
                      {budgetAnalytics.performanceScore.toFixed(0)}%
                    </span>
                  </div>
                  
                  <div className="space-y-3">
                    {budgetCategories.slice(0, 5).map(category => (
                      <div key={category.id} className="flex items-center justify-between">
                        <span className="text-sm">{category.name}</span>
                        <div className="flex items-center gap-2">
                          <Progress value={category.performance || 0} className="w-20" />
                          <span className="text-sm font-medium w-12">
                            {category.performance || 0}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Budget Optimization Recommendations */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Optimization Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-medium">Budget Optimization Strategy: {budgetOptimization}</p>
                    <ul className="text-sm space-y-1">
                      {budgetOptimization === 'EFFICIENCY' && (
                        <>
                          <li>• Focus on departments with efficiency scores below 70%</li>
                          <li>• Implement process improvements in underperforming areas</li>
                          <li>• Consider consolidating overlapping functions</li>
                        </>
                      )}
                      {budgetOptimization === 'GROWTH' && (
                        <>
                          <li>• Prioritize investment in high-performing categories</li>
                          <li>• Increase funding for infrastructure and development</li>
                          <li>• Consider deficit financing for strategic initiatives</li>
                        </>
                      )}
                      {budgetOptimization === 'STABILITY' && (
                        <>
                          <li>• Maintain balanced allocations across critical functions</li>
                          <li>• Build emergency reserves for unexpected needs</li>
                          <li>• Focus on sustainable long-term fiscal health</li>
                        </>
                      )}
                    </ul>
                  </div>
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}