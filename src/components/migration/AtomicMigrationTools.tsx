"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Progress } from '~/components/ui/progress';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { Separator } from '~/components/ui/separator';
import { 
  ArrowRight,
  CheckCircle,
  AlertTriangle,
  Lightbulb,
  RefreshCw,
  Download,
  Upload,
  Settings,
  Target,
  BarChart3,
  TrendingUp,
  Zap,
  Shield,
  Copy,
  Save,
  FileText
} from 'lucide-react';
import { motion } from 'framer-motion';

import type { ComponentType } from '~/types/government';
import { 
  calculateAtomicTaxEffectiveness, 
  getAtomicTaxRecommendations 
} from '~/lib/atomic-tax-integration';
import { 
  calculateAtomicEconomicEffectiveness, 
  getAtomicEconomicRecommendations 
} from '~/lib/atomic-economic-integration';
import { 
  calculateAtomicGovernmentStability 
} from '~/lib/atomic-intelligence-integration';
import { ATOMIC_COMPONENTS, ComponentType as AtomicComponentEnum } from '~/components/government/atoms/AtomicGovernmentComponents';

interface MigrationScenario {
  id: string;
  name: string;
  description: string;
  fromComponents: ComponentType[];
  toComponents: ComponentType[];
  category: 'optimization' | 'stability' | 'efficiency' | 'reform';
  difficulty: 'easy' | 'medium' | 'hard';
  timeframe: 'immediate' | 'short' | 'medium' | 'long';
  risks: string[];
  benefits: string[];
}

interface AtomicMigrationToolsProps {
  currentComponents: ComponentType[];
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
  onMigrationApply?: (newComponents: ComponentType[]) => void;
  className?: string;
}

// Predefined migration scenarios
const MIGRATION_SCENARIOS: MigrationScenario[] = [
  {
    id: 'tech-optimization',
    name: 'Technocratic Optimization',
    description: 'Transition to technocratic governance for maximum efficiency',
    fromComponents: [],
    toComponents: ['TECHNOCRATIC_PROCESS', 'PROFESSIONAL_BUREAUCRACY', 'TECHNOCRATIC_AGENCIES', 'RULE_OF_LAW'],
    category: 'efficiency',
    difficulty: 'medium',
    timeframe: 'medium',
    risks: ['May reduce democratic legitimacy', 'Public resistance to technocratic rule'],
    benefits: ['Maximum policy effectiveness', 'Evidence-based decision making', 'High implementation capacity']
  },
  {
    id: 'democratic-stabilization',
    name: 'Democratic Stabilization',
    description: 'Strengthen democratic institutions and legitimacy',
    fromComponents: [],
    toComponents: ['DEMOCRATIC_PROCESS', 'ELECTORAL_LEGITIMACY', 'INDEPENDENT_JUDICIARY', 'RULE_OF_LAW'],
    category: 'stability',
    difficulty: 'hard',
    timeframe: 'long',
    risks: ['Slower decision making', 'Policy implementation challenges'],
    benefits: ['High legitimacy', 'Sustainable governance', 'Public trust']
  },
  {
    id: 'efficiency-boost',
    name: 'Administrative Efficiency',
    description: 'Enhance bureaucratic capacity while maintaining legitimacy',
    fromComponents: [],
    toComponents: ['PROFESSIONAL_BUREAUCRACY', 'PERFORMANCE_LEGITIMACY', 'TECHNOCRATIC_AGENCIES', 'UNITARY_SYSTEM'],
    category: 'efficiency',
    difficulty: 'easy',
    timeframe: 'short',
    risks: ['Initial implementation costs'],
    benefits: ['Improved service delivery', 'Better policy outcomes', 'Enhanced capacity']
  },
  {
    id: 'stability-focus',
    name: 'Stability Enhancement',
    description: 'Prioritize long-term stability and predictability',
    fromComponents: [],
    toComponents: ['TRADITIONAL_LEGITIMACY', 'RULE_OF_LAW', 'INDEPENDENT_JUDICIARY', 'CONSENSUS_PROCESS'],
    category: 'stability',
    difficulty: 'medium',
    timeframe: 'medium',
    risks: ['Slower adaptation to change'],
    benefits: ['High stability', 'Predictable governance', 'Reduced conflict']
  }
];

export function AtomicMigrationTools({
  currentComponents,
  economicData,
  taxData,
  countryName,
  onMigrationApply,
  className
}: AtomicMigrationToolsProps) {
  const [selectedScenario, setSelectedScenario] = useState<MigrationScenario | null>(null);
  const [customComponents, setCustomComponents] = useState<ComponentType[]>(currentComponents);
  const [showComparison, setShowComparison] = useState(false);

  // Calculate current metrics
  const currentMetrics = useMemo(() => {
    const tax = calculateAtomicTaxEffectiveness(currentComponents, taxData);
    const economic = calculateAtomicEconomicEffectiveness(currentComponents, economicData);
    const stability = calculateAtomicGovernmentStability(currentComponents);
    
    return { tax, economic, stability };
  }, [currentComponents, economicData, taxData]);

  // Calculate projected metrics for comparison
  const projectedMetrics = useMemo(() => {
    const componentsToAnalyze = selectedScenario ? selectedScenario.toComponents : customComponents;
    
    const tax = calculateAtomicTaxEffectiveness(componentsToAnalyze, taxData);
    const economic = calculateAtomicEconomicEffectiveness(componentsToAnalyze, economicData);
    const stability = calculateAtomicGovernmentStability(componentsToAnalyze);
    
    return { tax, economic, stability };
  }, [selectedScenario, customComponents, economicData, taxData]);

  // Generate migration recommendations
  const migrationRecommendations = useMemo(() => {
    const recommendations: string[] = [];
    
    if (currentMetrics.tax.effectivenessScore < 70) {
      recommendations.push('Consider adding Professional Bureaucracy for improved tax administration');
    }
    
    if (currentMetrics.economic.overallScore < 60) {
      recommendations.push('Technocratic Process could boost economic performance');
    }
    
    if (currentMetrics.stability.overallStability < 60) {
      recommendations.push('Rule of Law and Independent Judiciary would enhance stability');
    }
    
    if (currentComponents.includes('PARTISAN_INSTITUTIONS')) {
      recommendations.push('Consider replacing Partisan Institutions with Professional Bureaucracy');
    }
    
    if (currentComponents.includes('OLIGARCHIC_PROCESS')) {
      recommendations.push('Transition from Oligarchic to Democratic or Technocratic Process');
    }

    return recommendations;
  }, [currentComponents, currentMetrics]);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'text-green-600 bg-green-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'hard': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'optimization': return <Target className="h-4 w-4" />;
      case 'stability': return <Shield className="h-4 w-4" />;
      case 'efficiency': return <Zap className="h-4 w-4" />;
      case 'reform': return <RefreshCw className="h-4 w-4" />;
      default: return <Settings className="h-4 w-4" />;
    }
  };

  const formatComponentName = (component: ComponentType) => {
    return component.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  };

  const getMetricDifference = (current: number, projected: number) => {
    const diff = projected - current;
    return {
      value: diff,
      color: diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-600' : 'text-gray-600',
      icon: diff > 0 ? <TrendingUp className="h-4 w-4" /> : diff < 0 ? <TrendingUp className="h-4 w-4 rotate-180" /> : <ArrowRight className="h-4 w-4" />
    };
  };

  const handleApplyMigration = () => {
    if (selectedScenario && onMigrationApply) {
      onMigrationApply(selectedScenario.toComponents);
    }
  };

  const toggleCustomComponent = (component: ComponentType) => {
    setCustomComponents(prev => 
      prev.includes(component) 
        ? prev.filter(c => c !== component)
        : [...prev, component]
    );
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-blue-600" />
            Atomic Migration Tools - {countryName}
          </CardTitle>
          <p className="text-muted-foreground">
            Analyze and plan transitions between government component configurations
          </p>
        </CardHeader>
      </Card>

      <Tabs defaultValue="scenarios" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="scenarios">Migration Scenarios</TabsTrigger>
          <TabsTrigger value="custom">Custom Migration</TabsTrigger>
          <TabsTrigger value="analysis">Impact Analysis</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
        </TabsList>

        {/* Migration Scenarios Tab */}
        <TabsContent value="scenarios" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {MIGRATION_SCENARIOS.map((scenario) => (
              <Card 
                key={scenario.id} 
                className={`cursor-pointer transition-colors ${
                  selectedScenario?.id === scenario.id ? 'ring-2 ring-blue-500 bg-blue-50/50' : 'hover:bg-gray-50'
                }`}
                onClick={() => {
                  setSelectedScenario(scenario);
                  setShowComparison(true);
                }}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {getCategoryIcon(scenario.category)}
                      <CardTitle className="text-lg">{scenario.name}</CardTitle>
                    </div>
                    <Badge className={getDifficultyColor(scenario.difficulty)}>
                      {scenario.difficulty}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{scenario.description}</p>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium mb-2">Target Components:</h4>
                    <div className="flex flex-wrap gap-1">
                      {scenario.toComponents.map(component => (
                        <Badge key={component} variant="outline" className="text-xs">
                          {formatComponentName(component)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <h5 className="font-medium text-green-600 mb-1">Benefits:</h5>
                      <ul className="text-xs space-y-1">
                        {scenario.benefits.slice(0, 2).map((benefit, i) => (
                          <li key={i} className="flex items-start gap-1">
                            <CheckCircle className="h-3 w-3 text-green-600 mt-0.5 flex-shrink-0" />
                            {benefit}
                          </li>
                        ))}
                      </ul>
                    </div>
                    
                    <div>
                      <h5 className="font-medium text-yellow-600 mb-1">Risks:</h5>
                      <ul className="text-xs space-y-1">
                        {scenario.risks.slice(0, 2).map((risk, i) => (
                          <li key={i} className="flex items-start gap-1">
                            <AlertTriangle className="h-3 w-3 text-yellow-600 mt-0.5 flex-shrink-0" />
                            {risk}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center pt-2 border-t">
                    <Badge variant="secondary" className="text-xs">
                      {scenario.timeframe}-term
                    </Badge>
                    {selectedScenario?.id === scenario.id && (
                      <Button size="sm" onClick={handleApplyMigration}>
                        Apply Migration
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Custom Migration Tab */}
        <TabsContent value="custom" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Custom Component Selection</CardTitle>
              <p className="text-muted-foreground">
                Design your own government component configuration
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Component Categories */}
                {Object.entries({
                  'Power Distribution': ['CENTRALIZED_POWER', 'FEDERAL_SYSTEM', 'CONFEDERATE_SYSTEM', 'UNITARY_SYSTEM'],
                  'Decision Process': ['DEMOCRATIC_PROCESS', 'AUTOCRATIC_PROCESS', 'TECHNOCRATIC_PROCESS', 'CONSENSUS_PROCESS', 'OLIGARCHIC_PROCESS'],
                  'Legitimacy Sources': ['ELECTORAL_LEGITIMACY', 'TRADITIONAL_LEGITIMACY', 'PERFORMANCE_LEGITIMACY', 'CHARISMATIC_LEGITIMACY', 'RELIGIOUS_LEGITIMACY'],
                  'Institution Types': ['PROFESSIONAL_BUREAUCRACY', 'MILITARY_ADMINISTRATION', 'INDEPENDENT_JUDICIARY', 'PARTISAN_INSTITUTIONS', 'TECHNOCRATIC_AGENCIES'],
                  'Control Mechanisms': ['RULE_OF_LAW', 'SURVEILLANCE_SYSTEM']
                }).map(([category, components]) => (
                  <div key={category}>
                    <h3 className="text-lg font-medium mb-3">{category}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {components.map(component => (
                        <Button
                          key={component}
                          variant={customComponents.includes(component as ComponentType) ? "default" : "outline"}
                          size="sm"
                          onClick={() => toggleCustomComponent(component as ComponentType)}
                          className="justify-start text-left"
                        >
                          <div className="flex items-center gap-2">
                            {customComponents.includes(component as ComponentType) && 
                              <CheckCircle className="h-4 w-4" />
                            }
                            {formatComponentName(component as ComponentType)}
                          </div>
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Impact Analysis Tab */}
        <TabsContent value="analysis" className="space-y-6">
          {showComparison && (selectedScenario || customComponents.length > 0) && (
            <Card>
              <CardHeader>
                <CardTitle>Migration Impact Analysis</CardTitle>
                <p className="text-muted-foreground">
                  Compare current vs. projected performance metrics
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Tax Effectiveness */}
                  <div className="space-y-3">
                    <h3 className="text-lg font-medium flex items-center gap-2">
                      <Target className="h-5 w-5 text-blue-600" />
                      Tax Effectiveness
                    </h3>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Current:</span>
                        <span className="font-medium">{currentMetrics.tax.effectivenessScore}%</span>
                      </div>
                      <Progress value={currentMetrics.tax.effectivenessScore} className="h-2" />
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Projected:</span>
                        <span className="font-medium">{projectedMetrics.tax.effectivenessScore}%</span>
                      </div>
                      <Progress value={projectedMetrics.tax.effectivenessScore} className="h-2" />
                    </div>
                    
                    <div className="flex items-center justify-between pt-2 border-t">
                      <span className="text-sm font-medium">Change:</span>
                      <div className={`flex items-center gap-1 ${getMetricDifference(currentMetrics.tax.effectivenessScore, projectedMetrics.tax.effectivenessScore).color}`}>
                        {getMetricDifference(currentMetrics.tax.effectivenessScore, projectedMetrics.tax.effectivenessScore).icon}
                        <span className="font-medium">
                          {getMetricDifference(currentMetrics.tax.effectivenessScore, projectedMetrics.tax.effectivenessScore).value > 0 ? '+' : ''}
                          {getMetricDifference(currentMetrics.tax.effectivenessScore, projectedMetrics.tax.effectivenessScore).value.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Economic Performance */}
                  <div className="space-y-3">
                    <h3 className="text-lg font-medium flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-green-600" />
                      Economic Performance
                    </h3>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Current:</span>
                        <span className="font-medium">{currentMetrics.economic.overallScore}%</span>
                      </div>
                      <Progress value={currentMetrics.economic.overallScore} className="h-2" />
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Projected:</span>
                        <span className="font-medium">{projectedMetrics.economic.overallScore}%</span>
                      </div>
                      <Progress value={projectedMetrics.economic.overallScore} className="h-2" />
                    </div>
                    
                    <div className="flex items-center justify-between pt-2 border-t">
                      <span className="text-sm font-medium">Change:</span>
                      <div className={`flex items-center gap-1 ${getMetricDifference(currentMetrics.economic.overallScore, projectedMetrics.economic.overallScore).color}`}>
                        {getMetricDifference(currentMetrics.economic.overallScore, projectedMetrics.economic.overallScore).icon}
                        <span className="font-medium">
                          {getMetricDifference(currentMetrics.economic.overallScore, projectedMetrics.economic.overallScore).value > 0 ? '+' : ''}
                          {getMetricDifference(currentMetrics.economic.overallScore, projectedMetrics.economic.overallScore).value.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Government Stability */}
                  <div className="space-y-3">
                    <h3 className="text-lg font-medium flex items-center gap-2">
                      <Shield className="h-5 w-5 text-purple-600" />
                      Government Stability
                    </h3>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Current:</span>
                        <span className="font-medium">{currentMetrics.stability.overallStability}%</span>
                      </div>
                      <Progress value={currentMetrics.stability.overallStability} className="h-2" />
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Projected:</span>
                        <span className="font-medium">{projectedMetrics.stability.overallStability}%</span>
                      </div>
                      <Progress value={projectedMetrics.stability.overallStability} className="h-2" />
                    </div>
                    
                    <div className="flex items-center justify-between pt-2 border-t">
                      <span className="text-sm font-medium">Change:</span>
                      <div className={`flex items-center gap-1 ${getMetricDifference(currentMetrics.stability.overallStability, projectedMetrics.stability.overallStability).color}`}>
                        {getMetricDifference(currentMetrics.stability.overallStability, projectedMetrics.stability.overallStability).icon}
                        <span className="font-medium">
                          {getMetricDifference(currentMetrics.stability.overallStability, projectedMetrics.stability.overallStability).value > 0 ? '+' : ''}
                          {getMetricDifference(currentMetrics.stability.overallStability, projectedMetrics.stability.overallStability).value.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          
          {!showComparison && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Select a migration scenario or configure custom components to see impact analysis.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        {/* Recommendations Tab */}
        <TabsContent value="recommendations" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-orange-600" />
                Migration Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              {migrationRecommendations.length > 0 ? (
                <div className="space-y-4">
                  {migrationRecommendations.map((recommendation, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex items-start gap-3 p-4 rounded-lg bg-blue-50 border border-blue-200"
                    >
                      <Lightbulb className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-grow">
                        <p className="text-sm text-blue-800">{recommendation}</p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        #{index + 1}
                      </Badge>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                  <h3 className="text-lg font-medium mb-2">System Optimally Configured</h3>
                  <p className="text-sm">Your current government configuration appears to be performing well across all metrics.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Current System Analysis */}
          <Card>
            <CardHeader>
              <CardTitle>Current System Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-medium text-green-600 mb-2">Strengths:</h4>
                  {currentMetrics.stability.strengths.length > 0 ? (
                    <div className="space-y-1">
                      {currentMetrics.stability.strengths.map((strength, i) => (
                        <div key={i} className="text-sm text-green-700 bg-green-50 p-2 rounded">
                          • {strength}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No specific strengths identified</p>
                  )}
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-red-600 mb-2">Areas for Improvement:</h4>
                  {currentMetrics.stability.riskFactors.length > 0 ? (
                    <div className="space-y-1">
                      {currentMetrics.stability.riskFactors.map((risk, i) => (
                        <div key={i} className="text-sm text-red-700 bg-red-50 p-2 rounded">
                          ⚠ {risk}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No major issues identified</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}