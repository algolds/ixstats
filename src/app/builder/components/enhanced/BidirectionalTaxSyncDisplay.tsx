"use client";

import React from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Progress } from "~/components/ui/progress";
import { Button } from "~/components/ui/button";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Target,
  AlertTriangle,
  CheckCircle,
  Info,
  RefreshCw,
  Building2,
  Users,
  BarChart3,
  PieChart,
  Clock,
  Shield,
  Zap,
  ArrowUpDown,
  Lightbulb,
  AlertCircle,
} from "lucide-react";

import type {
  BidirectionalTaxSyncState,
  TaxRecommendation,
  EconomicImpactOfTax,
} from "../../services/BidirectionalTaxSyncService";

interface BidirectionalTaxSyncDisplayProps {
  syncState?: BidirectionalTaxSyncState;
  onSync?: () => void;
  className?: string;
}

const DEFAULT_SYNC_STATE: BidirectionalTaxSyncState = {
  economyBuilder: null,
  taxSystem: null,
  taxRecommendations: [],
  economicImpacts: [],
  isSyncing: false,
  lastSync: 0,
  syncHistory: [],
  errors: [],
};

export function BidirectionalTaxSyncDisplay({
  syncState = DEFAULT_SYNC_STATE,
  onSync = () => {},
  className = "",
}: BidirectionalTaxSyncDisplayProps) {
  const { taxRecommendations, economicImpacts, isSyncing, lastSync, syncHistory, errors } =
    syncState || DEFAULT_SYNC_STATE;

  const getPriorityColor = (priority: "high" | "medium" | "low") => {
    switch (priority) {
      case "high":
        return "text-red-600 dark:text-red-400";
      case "medium":
        return "text-yellow-600 dark:text-yellow-400";
      case "low":
        return "text-green-600 dark:text-green-400";
    }
  };

  const getPriorityBadgeVariant = (priority: "high" | "medium" | "low") => {
    switch (priority) {
      case "high":
        return "destructive" as const;
      case "medium":
        return "secondary" as const;
      case "low":
        return "default" as const;
    }
  };

  const getImpactIcon = (impact: number) => {
    if (impact > 0) return TrendingUp;
    if (impact < 0) return TrendingDown;
    return Target;
  };

  const getImpactColor = (impact: number) => {
    if (impact > 0) return "text-green-600 dark:text-green-400";
    if (impact < 0) return "text-red-600 dark:text-red-400";
    return "text-gray-600 dark:text-gray-400";
  };

  const getTimeToEffectColor = (timeToEffect: string) => {
    switch (timeToEffect) {
      case "immediate":
        return "text-red-600 dark:text-red-400";
      case "short_term":
        return "text-orange-600 dark:text-orange-400";
      case "medium_term":
        return "text-yellow-600 dark:text-yellow-400";
      case "long_term":
        return "text-green-600 dark:text-green-400";
      default:
        return "text-gray-600 dark:text-gray-400";
    }
  };

  const formatTimeToEffect = (timeToEffect: string) => {
    switch (timeToEffect) {
      case "immediate":
        return "Immediate";
      case "short_term":
        return "1-3 months";
      case "medium_term":
        return "3-12 months";
      case "long_term":
        return "1+ years";
      default:
        return "Unknown";
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header with Sync Controls */}
      <Card className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="rounded-lg bg-green-100 p-2 dark:bg-green-900/20">
                <ArrowUpDown className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <CardTitle className="text-xl font-semibold">Bidirectional Tax Sync</CardTitle>
                <p className="text-muted-foreground text-sm">
                  Real-time synchronization between economy and tax systems
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="text-right">
                <div className="text-muted-foreground text-sm">
                  Last sync: {lastSync ? new Date(lastSync).toLocaleTimeString() : "Never"}
                </div>
                <div className="text-muted-foreground text-xs">
                  {syncHistory.length} sync events
                </div>
              </div>

              <Button onClick={onSync} disabled={isSyncing} variant="outline" size="sm">
                {isSyncing ? (
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-green-600"></div>
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                {isSyncing ? "Syncing..." : "Sync Now"}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Errors */}
      {errors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-red-600 dark:text-red-400">
              <AlertTriangle className="h-5 w-5" />
              <span>Sync Errors</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {errors.map((error, index) => (
                <Alert key={index} variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tax Recommendations */}
      {taxRecommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              <span>Tax Recommendations ({taxRecommendations.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {taxRecommendations.map((recommendation) => (
                <motion.div
                  key={recommendation.taxType}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20"
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex items-center space-x-2">
                      <DollarSign className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <span className="font-medium text-blue-900 capitalize dark:text-blue-100">
                        {recommendation.taxType.replace("_", " ")} Tax
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge
                        variant={getPriorityBadgeVariant(recommendation.implementationPriority)}
                      >
                        {recommendation.implementationPriority} priority
                      </Badge>
                      <Badge variant="outline">
                        {recommendation.currentRate}% → {recommendation.recommendedRate}%
                      </Badge>
                    </div>
                  </div>

                  <p className="mb-3 text-sm text-blue-800 dark:text-blue-200">
                    {recommendation.rationale}
                  </p>

                  {/* Economic Impact Metrics */}
                  <div className="mb-3 grid grid-cols-2 gap-4 md:grid-cols-4">
                    <div className="text-center">
                      <div className="flex items-center justify-center space-x-1">
                        <BarChart3 className="h-3 w-3" />
                        <span className="text-xs text-gray-600 dark:text-gray-400">GDP Impact</span>
                      </div>
                      <div
                        className={`text-sm font-medium ${getImpactColor(recommendation.economicImpact.gdpImpact)}`}
                      >
                        {recommendation.economicImpact.gdpImpact > 0 ? "+" : ""}
                        {recommendation.economicImpact.gdpImpact.toFixed(1)}%
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center space-x-1">
                        <Users className="h-3 w-3" />
                        <span className="text-xs text-gray-600 dark:text-gray-400">Employment</span>
                      </div>
                      <div
                        className={`text-sm font-medium ${getImpactColor(recommendation.economicImpact.employmentImpact)}`}
                      >
                        {recommendation.economicImpact.employmentImpact > 0 ? "+" : ""}
                        {recommendation.economicImpact.employmentImpact.toFixed(1)}%
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center space-x-1">
                        <Building2 className="h-3 w-3" />
                        <span className="text-xs text-gray-600 dark:text-gray-400">Investment</span>
                      </div>
                      <div
                        className={`text-sm font-medium ${getImpactColor(recommendation.economicImpact.investmentImpact)}`}
                      >
                        {recommendation.economicImpact.investmentImpact > 0 ? "+" : ""}
                        {recommendation.economicImpact.investmentImpact.toFixed(1)}%
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center space-x-1">
                        <Target className="h-3 w-3" />
                        <span className="text-xs text-gray-600 dark:text-gray-400">
                          Competitiveness
                        </span>
                      </div>
                      <div className="text-sm font-medium">
                        {recommendation.economicImpact.competitivenessImpact.toFixed(0)}
                      </div>
                    </div>
                  </div>

                  {/* Revenue Impact */}
                  <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                    <span>Estimated Revenue Change:</span>
                    <span
                      className={`font-medium ${getImpactColor(recommendation.estimatedRevenueChange)}`}
                    >
                      {recommendation.estimatedRevenueChange > 0 ? "+" : ""}
                      {recommendation.estimatedRevenueChange.toFixed(1)}%
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Economic Impacts */}
      {economicImpacts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              <span>Economic Impacts ({economicImpacts.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {economicImpacts.map((impact, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-lg border border-orange-200 bg-orange-50 p-4 dark:border-orange-800 dark:bg-orange-900/20"
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex items-center space-x-2">
                      <DollarSign className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                      <span className="font-medium text-orange-900 capitalize dark:text-orange-100">
                        {impact.taxChange.taxType.replace("_", " ")} Tax Impact
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">{impact.taxChange.effectiveRate}% rate</Badge>
                      <Badge
                        variant="outline"
                        className={getTimeToEffectColor(impact.timeToEffect)}
                      >
                        <Clock className="mr-1 h-3 w-3" />
                        {formatTimeToEffect(impact.timeToEffect)}
                      </Badge>
                      <Badge variant="outline">{impact.confidence}% confidence</Badge>
                    </div>
                  </div>

                  {/* Economic Impact Metrics */}
                  <div className="mb-3 grid grid-cols-2 gap-4 md:grid-cols-5">
                    <div className="text-center">
                      <div className="flex items-center justify-center space-x-1">
                        <BarChart3 className="h-3 w-3" />
                        <span className="text-xs text-gray-600 dark:text-gray-400">GDP Growth</span>
                      </div>
                      <div
                        className={`text-sm font-medium ${getImpactColor(impact.economicImpact.gdpGrowthImpact)}`}
                      >
                        {impact.economicImpact.gdpGrowthImpact > 0 ? "+" : ""}
                        {impact.economicImpact.gdpGrowthImpact.toFixed(1)}%
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center space-x-1">
                        <Users className="h-3 w-3" />
                        <span className="text-xs text-gray-600 dark:text-gray-400">Employment</span>
                      </div>
                      <div
                        className={`text-sm font-medium ${getImpactColor(impact.economicImpact.employmentImpact)}`}
                      >
                        {impact.economicImpact.employmentImpact > 0 ? "+" : ""}
                        {impact.economicImpact.employmentImpact.toFixed(1)}%
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center space-x-1">
                        <Building2 className="h-3 w-3" />
                        <span className="text-xs text-gray-600 dark:text-gray-400">Investment</span>
                      </div>
                      <div
                        className={`text-sm font-medium ${getImpactColor(impact.economicImpact.investmentImpact)}`}
                      >
                        {impact.economicImpact.investmentImpact > 0 ? "+" : ""}
                        {impact.economicImpact.investmentImpact.toFixed(1)}%
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center space-x-1">
                        <TrendingUp className="h-3 w-3" />
                        <span className="text-xs text-gray-600 dark:text-gray-400">
                          Consumption
                        </span>
                      </div>
                      <div
                        className={`text-sm font-medium ${getImpactColor(impact.economicImpact.consumptionImpact)}`}
                      >
                        {impact.economicImpact.consumptionImpact > 0 ? "+" : ""}
                        {impact.economicImpact.consumptionImpact.toFixed(1)}%
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center space-x-1">
                        <TrendingUp className="h-3 w-3" />
                        <span className="text-xs text-gray-600 dark:text-gray-400">Inflation</span>
                      </div>
                      <div
                        className={`text-sm font-medium ${getImpactColor(impact.economicImpact.inflationImpact)}`}
                      >
                        {impact.economicImpact.inflationImpact > 0 ? "+" : ""}
                        {impact.economicImpact.inflationImpact.toFixed(1)}%
                      </div>
                    </div>
                  </div>

                  {/* Sector Impacts */}
                  {Object.keys(impact.sectorImpacts).length > 0 && (
                    <div>
                      <div className="mb-2 text-xs font-medium text-gray-600 dark:text-gray-400">
                        Sector Impacts:
                      </div>
                      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                        {Object.entries(impact.sectorImpacts).map(([sector, sectorImpact]) => (
                          <div key={sector} className="flex items-center justify-between text-xs">
                            <span className="capitalize">{sector.replace("_", " ")}</span>
                            <span className={`font-medium ${getImpactColor(sectorImpact)}`}>
                              {sectorImpact > 0 ? "+" : ""}
                              {sectorImpact.toFixed(1)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sync Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Zap className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            <span>Sync Status</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {taxRecommendations.length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Tax Recommendations</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {economicImpacts.length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Economic Impacts</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {syncHistory.length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Sync Events</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
