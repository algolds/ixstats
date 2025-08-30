"use client";

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { Separator } from '~/components/ui/separator';
import { 
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Lightbulb,
  Target,
  Clock,
  CheckCircle,
  ArrowRight,
  Zap,
  Shield,
  BarChart3,
  Activity,
  Brain,
  Info,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import type { ComponentType } from '~/types/government';
import { 
  generateAtomicIntelligence, 
  calculateAtomicGovernmentStability,
  type AtomicIntelligenceItem 
} from '~/lib/atomic-intelligence-integration';

interface AtomicIntelligenceFeedProps {
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
  showDetailedAnalysis?: boolean;
  maxItems?: number;
  className?: string;
}

export function AtomicIntelligenceFeed({
  components,
  economicData,
  taxData,
  countryName,
  showDetailedAnalysis = false,
  maxItems = 10,
  className
}: AtomicIntelligenceFeedProps) {
  
  const intelligence = useMemo(() => {
    return generateAtomicIntelligence(components, economicData, taxData).slice(0, maxItems);
  }, [components, economicData, taxData, maxItems]);

  const stability = useMemo(() => {
    return calculateAtomicGovernmentStability(components);
  }, [components]);

  const getTypeIcon = (type: AtomicIntelligenceItem['type']) => {
    switch (type) {
      case 'alert': return <AlertTriangle className="h-4 w-4" />;
      case 'opportunity': return <Lightbulb className="h-4 w-4" />;
      case 'trend': return <TrendingUp className="h-4 w-4" />;
      case 'prediction': return <Brain className="h-4 w-4" />;
      default: return <Info className="h-4 w-4" />;
    }
  };

  const getSeverityColor = (severity: AtomicIntelligenceItem['severity']) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'info': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getCategoryIcon = (category: AtomicIntelligenceItem['category']) => {
    switch (category) {
      case 'governance': return <Shield className="h-4 w-4" />;
      case 'economic': return <BarChart3 className="h-4 w-4" />;
      case 'stability': return <Activity className="h-4 w-4" />;
      case 'policy': return <Target className="h-4 w-4" />;
      case 'institutional': return <Zap className="h-4 w-4" />;
      default: return <Info className="h-4 w-4" />;
    }
  };

  const getStabilityColor = (level: string) => {
    switch (level) {
      case 'critical': return 'text-red-600';
      case 'high': return 'text-orange-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  const formatComponentName = (component: ComponentType) => {
    return component.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Intelligence Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-blue-600" />
            Atomic Intelligence Analysis - {countryName}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center">
              <div className={`text-2xl font-bold ${getStabilityColor(stability.riskLevel)}`}>
                {stability.overallStability}%
              </div>
              <div className="text-sm text-muted-foreground">Overall Stability</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {stability.institutionalCapacity}%
              </div>
              <div className="text-sm text-muted-foreground">Institutional Capacity</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {stability.legitimacyStrength}%
              </div>
              <div className="text-sm text-muted-foreground">Legitimacy Strength</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {stability.policyCoherence}%
              </div>
              <div className="text-sm text-muted-foreground">Policy Coherence</div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Badge variant={stability.riskLevel === 'critical' ? 'destructive' : stability.riskLevel === 'high' ? 'secondary' : 'default'}>
              Risk Level: {stability.riskLevel.toUpperCase()}
            </Badge>
            
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {stability.stabilityTrend === 'improving' && <TrendingUp className="h-4 w-4 text-green-600" />}
              {stability.stabilityTrend === 'declining' && <TrendingDown className="h-4 w-4 text-red-600" />}
              {stability.stabilityTrend === 'stable' && <Activity className="h-4 w-4 text-yellow-600" />}
              Trend: {stability.stabilityTrend}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Intelligence Feed */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              Active Intelligence Items ({intelligence.length})
            </div>
            {intelligence.length === 0 && (
              <Badge variant="outline">No Issues Detected</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AnimatePresence>
            {intelligence.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                <h3 className="text-lg font-medium mb-2">All Systems Operating Optimally</h3>
                <p className="text-sm">No critical intelligence items detected. Government composition appears stable.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {intelligence.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={`p-4 rounded-lg border ${getSeverityColor(item.severity)}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-0.5">
                        {getTypeIcon(item.type)}
                      </div>
                      
                      <div className="flex-grow min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-medium text-sm">{item.title}</h4>
                          <Badge variant="outline" className="text-xs">
                            {item.category}
                          </Badge>
                          {getCategoryIcon(item.category)}
                        </div>
                        
                        <p className="text-sm text-muted-foreground mb-3">
                          {item.description}
                        </p>

                        {item.relatedComponents.length > 0 && (
                          <div className="mb-3">
                            <div className="text-xs font-medium mb-1">Related Components:</div>
                            <div className="flex flex-wrap gap-1">
                              {item.relatedComponents.map(component => (
                                <Badge key={component} variant="secondary" className="text-xs">
                                  {formatComponentName(component)}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {item.metrics && (
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-3 text-xs">
                            {item.metrics.effectivenessScore && (
                              <div>
                                <span className="text-muted-foreground">Effectiveness:</span>
                                <span className="font-medium ml-1">{item.metrics.effectivenessScore}%</span>
                              </div>
                            )}
                            {item.metrics.confidence && (
                              <div>
                                <span className="text-muted-foreground">Confidence:</span>
                                <span className="font-medium ml-1">{item.metrics.confidence}%</span>
                              </div>
                            )}
                            {item.metrics.trendDirection && (
                              <div className="flex items-center gap-1">
                                <span className="text-muted-foreground">Trend:</span>
                                {item.metrics.trendDirection === 'up' && <TrendingUp className="h-3 w-3 text-green-600" />}
                                {item.metrics.trendDirection === 'down' && <TrendingDown className="h-3 w-3 text-red-600" />}
                                {item.metrics.trendDirection === 'stable' && <Activity className="h-3 w-3 text-yellow-600" />}
                              </div>
                            )}
                          </div>
                        )}

                        {item.recommendations && item.recommendations.length > 0 && (
                          <div className="space-y-2">
                            <div className="text-xs font-medium">Recommendations:</div>
                            <ul className="text-xs space-y-1">
                              {item.recommendations.map((rec, idx) => (
                                <li key={idx} className="flex items-start gap-2">
                                  <ArrowRight className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                  <span>{rec}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div className="flex items-center justify-between mt-3">
                          <div className="text-xs text-muted-foreground">
                            {new Date(item.timestamp).toLocaleTimeString()}
                          </div>
                          
                          {item.actionable && (
                            <Badge variant="outline" className="text-xs">
                              <Clock className="h-3 w-3 mr-1" />
                              Action Required
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* Detailed Analysis */}
      {showDetailedAnalysis && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Detailed Stability Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {stability.strengths.length > 0 && (
              <div>
                <h4 className="flex items-center gap-2 text-sm font-medium text-green-600 mb-2">
                  <CheckCircle className="h-4 w-4" />
                  Government Strengths
                </h4>
                <ul className="space-y-1">
                  {stability.strengths.map((strength, index) => (
                    <li key={index} className="text-sm text-green-700 bg-green-50 p-2 rounded">
                      • {strength}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {stability.riskFactors.length > 0 && (
              <div>
                <h4 className="flex items-center gap-2 text-sm font-medium text-red-600 mb-2">
                  <AlertTriangle className="h-4 w-4" />
                  Risk Factors
                </h4>
                <ul className="space-y-1">
                  {stability.riskFactors.map((risk, index) => (
                    <li key={index} className="text-sm text-red-700 bg-red-50 p-2 rounded">
                      ⚠ {risk}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Separator />

            <div className="text-center">
              <Button variant="outline" size="sm" onClick={() => window.open('/mycountry/editor#government', '_blank')}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Modify Government Structure
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Components Warning */}
      {components.length === 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            No atomic government components configured. Intelligence analysis requires government structure definition.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}