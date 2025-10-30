"use client";

import React, { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Separator } from "~/components/ui/separator";
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
  ExternalLink,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import type { ComponentType } from "~/types/government";
import {
  ComponentType as PrismaComponentType,
  EconomicComponentType,
  TaxComponentType,
} from "@prisma/client";
import {
  generateAtomicIntelligence,
  calculateAtomicGovernmentStability,
  type AtomicIntelligenceItem,
} from "~/lib/atomic-intelligence-integration";

interface AtomicIntelligenceFeedProps {
  components: PrismaComponentType[];
  economicComponents?: EconomicComponentType[];
  taxComponents?: TaxComponentType[];
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
  synergies?: {
    governmentSynergies?: Array<{ name: string; description: string }>;
    crossBuilderSynergies?: Array<{ id: string; description: string; effectivenessBonus: number }>;
  };
  effectiveness?: {
    governmentEffectiveness?: number;
    economicEffectiveness?: number;
    taxEffectiveness?: number;
    combinedScore?: number;
  };
}

export function AtomicIntelligenceFeed({
  components,
  economicComponents = [],
  taxComponents = [],
  economicData,
  taxData,
  countryName,
  showDetailedAnalysis = false,
  maxItems = 10,
  className,
  synergies,
  effectiveness,
}: AtomicIntelligenceFeedProps) {
  const [intelligence, setIntelligence] = useState<AtomicIntelligenceItem[]>([]);

  useEffect(() => {
    const generateIntelligence = async () => {
      // Combine all components for comprehensive analysis
      const allComponents = [...components, ...economicComponents, ...taxComponents];
      const intelligenceData = await generateAtomicIntelligence(
        allComponents as any,
        economicData,
        taxData
      );
      setIntelligence(intelligenceData.slice(0, maxItems));
    };
    generateIntelligence();
  }, [components, economicComponents, taxComponents, economicData, taxData, maxItems]);

  const stability = useMemo(() => {
    // Calculate stability based on all component types
    const allComponents = [...components, ...economicComponents, ...taxComponents];
    return calculateAtomicGovernmentStability(allComponents as any);
  }, [components, economicComponents, taxComponents]);

  const getTypeIcon = (type: AtomicIntelligenceItem["type"]) => {
    switch (type) {
      case "alert":
        return <AlertTriangle className="h-4 w-4" />;
      case "opportunity":
        return <Lightbulb className="h-4 w-4" />;
      case "trend":
        return <TrendingUp className="h-4 w-4" />;
      case "prediction":
        return <Brain className="h-4 w-4" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  const getSeverityColor = (severity: AtomicIntelligenceItem["severity"]) => {
    switch (severity) {
      case "critical":
        return "text-red-600 bg-red-50 border-red-200";
      case "high":
        return "text-orange-600 bg-orange-50 border-orange-200";
      case "medium":
        return "text-yellow-600 bg-yellow-50 border-yellow-200";
      case "low":
        return "text-blue-600 bg-blue-50 border-blue-200";
      case "info":
        return "text-green-600 bg-green-50 border-green-200";
      default:
        return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  const getCategoryIcon = (category: AtomicIntelligenceItem["category"]) => {
    switch (category) {
      case "governance":
        return <Shield className="h-4 w-4" />;
      case "economic":
        return <BarChart3 className="h-4 w-4" />;
      case "stability":
        return <Activity className="h-4 w-4" />;
      case "policy":
        return <Target className="h-4 w-4" />;
      case "institutional":
        return <Zap className="h-4 w-4" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  const getStabilityColor = (level: string) => {
    switch (level) {
      case "critical":
        return "text-red-600";
      case "high":
        return "text-orange-600";
      case "medium":
        return "text-yellow-600";
      case "low":
        return "text-green-600";
      default:
        return "text-gray-600";
    }
  };

  const formatComponentName = (
    component: PrismaComponentType | EconomicComponentType | TaxComponentType
  ) => {
    return component
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (l) => l.toUpperCase());
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
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="text-center">
              <div className={`text-2xl font-bold ${getStabilityColor(stability.riskLevel)}`}>
                {stability.overallStability}%
              </div>
              <div className="text-muted-foreground text-sm">Overall Stability</div>
            </div>

            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {stability.institutionalCapacity}%
              </div>
              <div className="text-muted-foreground text-sm">Institutional Capacity</div>
            </div>

            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {stability.legitimacyStrength}%
              </div>
              <div className="text-muted-foreground text-sm">Legitimacy Strength</div>
            </div>

            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stability.policyCoherence}%</div>
              <div className="text-muted-foreground text-sm">Policy Coherence</div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Badge
              variant={
                stability.riskLevel === "critical"
                  ? "destructive"
                  : stability.riskLevel === "high"
                    ? "secondary"
                    : "default"
              }
            >
              Risk Level: {stability.riskLevel.toUpperCase()}
            </Badge>

            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              {stability.stabilityTrend === "improving" && (
                <TrendingUp className="h-4 w-4 text-green-600" />
              )}
              {stability.stabilityTrend === "declining" && (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )}
              {stability.stabilityTrend === "stable" && (
                <Activity className="h-4 w-4 text-yellow-600" />
              )}
              Trend: {stability.stabilityTrend}
            </div>
          </div>

          {/* Effectiveness Metrics */}
          {effectiveness && (
            <div className="mt-6">
              <h4 className="mb-3 text-sm font-medium text-gray-700">System Effectiveness</h4>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                {effectiveness.governmentEffectiveness !== undefined && (
                  <div className="rounded-lg bg-blue-50 p-3 text-center dark:bg-blue-950/20">
                    <div className="text-lg font-semibold text-blue-600">
                      {effectiveness.governmentEffectiveness.toFixed(1)}%
                    </div>
                    <div className="text-muted-foreground text-xs">Government</div>
                  </div>
                )}
                {effectiveness.economicEffectiveness !== undefined && (
                  <div className="rounded-lg bg-green-50 p-3 text-center dark:bg-green-950/20">
                    <div className="text-lg font-semibold text-green-600">
                      {effectiveness.economicEffectiveness.toFixed(1)}%
                    </div>
                    <div className="text-muted-foreground text-xs">Economic</div>
                  </div>
                )}
                {effectiveness.taxEffectiveness !== undefined && (
                  <div className="rounded-lg bg-purple-50 p-3 text-center dark:bg-purple-950/20">
                    <div className="text-lg font-semibold text-purple-600">
                      {effectiveness.taxEffectiveness.toFixed(1)}%
                    </div>
                    <div className="text-muted-foreground text-xs">Tax</div>
                  </div>
                )}
                {effectiveness.combinedScore !== undefined && (
                  <div className="rounded-lg bg-orange-50 p-3 text-center dark:bg-orange-950/20">
                    <div className="text-lg font-semibold text-orange-600">
                      {effectiveness.combinedScore.toFixed(1)}%
                    </div>
                    <div className="text-muted-foreground text-xs">Combined</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Synergies Display */}
          {synergies &&
            ((synergies.governmentSynergies?.length ?? 0) > 0 ||
              (synergies.crossBuilderSynergies?.length ?? 0) > 0) && (
              <div className="mt-6">
                <h4 className="mb-3 flex items-center gap-2 text-sm font-medium text-emerald-600">
                  <Zap className="h-4 w-4" />
                  Active Synergies
                </h4>
                <div className="space-y-2">
                  {synergies.governmentSynergies?.slice(0, 2).map((synergy, index) => (
                    <div
                      key={index}
                      className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:bg-emerald-950/20"
                    >
                      <div className="text-sm font-medium text-emerald-800">{synergy.name}</div>
                      <div className="text-xs text-emerald-700">{synergy.description}</div>
                    </div>
                  ))}
                  {synergies.crossBuilderSynergies?.slice(0, 2).map((synergy) => (
                    <div
                      key={synergy.id}
                      className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:bg-emerald-950/20"
                    >
                      <div className="text-sm font-medium text-emerald-800">
                        Cross-System Synergy
                      </div>
                      <div className="text-xs text-emerald-700">{synergy.description}</div>
                      <div className="mt-1 text-xs text-emerald-600">
                        Bonus: +{synergy.effectivenessBonus}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
            {intelligence.length === 0 && <Badge variant="outline">No Issues Detected</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AnimatePresence>
            {intelligence.length === 0 ? (
              <div className="text-muted-foreground py-8 text-center">
                <CheckCircle className="mx-auto mb-4 h-12 w-12 text-green-500" />
                <h3 className="mb-2 text-lg font-medium">All Systems Operating Optimally</h3>
                <p className="text-sm">
                  No critical intelligence items detected. Government composition appears stable.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {intelligence.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={`rounded-lg border p-4 ${getSeverityColor(item.severity)}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex-shrink-0">{getTypeIcon(item.type)}</div>

                      <div className="min-w-0 flex-grow">
                        <div className="mb-2 flex items-center gap-2">
                          <h4 className="text-sm font-medium">{item.title}</h4>
                          <Badge variant="outline" className="text-xs">
                            {item.category}
                          </Badge>
                          {getCategoryIcon(item.category)}
                        </div>

                        <p className="text-muted-foreground mb-3 text-sm">{item.description}</p>

                        {item.relatedComponents.length > 0 && (
                          <div className="mb-3">
                            <div className="mb-1 text-xs font-medium">Related Components:</div>
                            <div className="flex flex-wrap gap-1">
                              {item.relatedComponents.map((component) => (
                                <Badge key={component} variant="secondary" className="text-xs">
                                  {formatComponentName(component)}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {item.metrics && (
                          <div className="mb-3 grid grid-cols-2 gap-4 text-xs md:grid-cols-3">
                            {item.metrics.effectivenessScore && (
                              <div>
                                <span className="text-muted-foreground">Effectiveness:</span>
                                <span className="ml-1 font-medium">
                                  {item.metrics.effectivenessScore}%
                                </span>
                              </div>
                            )}
                            {item.metrics.confidence && (
                              <div>
                                <span className="text-muted-foreground">Confidence:</span>
                                <span className="ml-1 font-medium">{item.metrics.confidence}%</span>
                              </div>
                            )}
                            {item.metrics.trendDirection && (
                              <div className="flex items-center gap-1">
                                <span className="text-muted-foreground">Trend:</span>
                                {item.metrics.trendDirection === "up" && (
                                  <TrendingUp className="h-3 w-3 text-green-600" />
                                )}
                                {item.metrics.trendDirection === "down" && (
                                  <TrendingDown className="h-3 w-3 text-red-600" />
                                )}
                                {item.metrics.trendDirection === "stable" && (
                                  <Activity className="h-3 w-3 text-yellow-600" />
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {item.recommendations && item.recommendations.length > 0 && (
                          <div className="space-y-2">
                            <div className="text-xs font-medium">Recommendations:</div>
                            <ul className="space-y-1 text-xs">
                              {item.recommendations.map((rec, idx) => (
                                <li key={idx} className="flex items-start gap-2">
                                  <ArrowRight className="mt-0.5 h-3 w-3 flex-shrink-0" />
                                  <span>{rec}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div className="mt-3 flex items-center justify-between">
                          <div className="text-muted-foreground text-xs">
                            {new Date(item.timestamp).toLocaleTimeString()}
                          </div>

                          {item.actionable && (
                            <Badge variant="outline" className="text-xs">
                              <Clock className="mr-1 h-3 w-3" />
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
                <h4 className="mb-2 flex items-center gap-2 text-sm font-medium text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  Government Strengths
                </h4>
                <ul className="space-y-1">
                  {stability.strengths.map((strength, index) => (
                    <li key={index} className="rounded bg-green-50 p-2 text-sm text-green-700">
                      • {strength}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {stability.riskFactors.length > 0 && (
              <div>
                <h4 className="mb-2 flex items-center gap-2 text-sm font-medium text-red-600">
                  <AlertTriangle className="h-4 w-4" />
                  Risk Factors
                </h4>
                <ul className="space-y-1">
                  {stability.riskFactors.map((risk, index) => (
                    <li key={index} className="rounded bg-red-50 p-2 text-sm text-red-700">
                      ⚠ {risk}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Separator />

            <div className="text-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open("/mycountry/editor#government", "_blank")}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
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
            No atomic government components configured. Intelligence analysis requires government
            structure definition.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
