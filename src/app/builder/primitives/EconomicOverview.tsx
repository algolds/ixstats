"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, AlertCircle, Shield } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { IntegratedEconomicAnalysis } from "~/lib/enhanced-economic-calculations";
import { getDefaultEconomicConfig } from "~/lib/config-service";
import type { CountryStats } from "~/types/ixstats";
import type { EconomyData } from "~/types/economics";
import type { EconomicInputs } from "../lib/economy-data-service";

interface EconomicOverviewProps {
  metrics: Array<{
    label: string;
    value: string | React.ReactNode;
  }>;
  inputs?: EconomicInputs;
  countryStats?: CountryStats;
  economyData?: EconomyData;
  showEnhancedAnalysis?: boolean;
}

export function EconomicOverview({
  metrics,
  inputs,
  countryStats,
  economyData,
  showEnhancedAnalysis = true,
}: EconomicOverviewProps) {
  // Enhanced economic analysis
  const enhancedAnalysis = useMemo(() => {
    if (!showEnhancedAnalysis || !countryStats || !economyData) return null;

    try {
      const config = getDefaultEconomicConfig();
      const analyzer = new IntegratedEconomicAnalysis(config);
      return analyzer.analyzeCountry(countryStats, economyData, []);
    } catch (error) {
      console.warn("Enhanced economic analysis failed:", error);
      return null;
    }
  }, [countryStats, economyData, showEnhancedAnalysis]);

  const getRatingColor = (grade: string) => {
    switch (grade) {
      case "A+":
      case "A":
      case "A-":
        return "text-green-600 bg-green-100";
      case "B+":
      case "B":
      case "B-":
        return "text-blue-600 bg-blue-100";
      case "C+":
      case "C":
      case "C-":
        return "text-yellow-600 bg-yellow-100";
      case "D":
      case "F":
        return "text-red-600 bg-red-100";
      default:
        return "text-gray-600 bg-gray-100";
    }
  };

  const getHealthIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case "excellent":
      case "strong":
        return Shield;
      case "good":
      case "fair":
        return TrendingUp;
      case "weak":
      case "critical":
        return AlertCircle;
      default:
        return TrendingDown;
    }
  };

  return (
    <div className="space-y-4">
      {/* Traditional Metrics */}
      <div className="rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-bg-tertiary)] p-4">
        <h3 className="mb-3 text-sm font-medium text-[var(--color-text-secondary)]">
          Country Economic Overview
        </h3>
        <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-5">
          {metrics.map((metric) => (
            <div key={metric.label}>
              <span className="text-[var(--color-text-muted)]">{metric.label}:</span>
              <div className="font-semibold text-[var(--color-text-primary)]">{metric.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Enhanced Economic Analysis */}
      {enhancedAnalysis && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="rounded-lg border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 dark:border-blue-800 dark:from-blue-950/20 dark:to-indigo-950/20"
        >
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
              Advanced Economic Analysis
            </h3>
            <Badge
              className={`text-xs ${getRatingColor(enhancedAnalysis.overallRating.grade)}`}
              variant="secondary"
            >
              Grade {enhancedAnalysis.overallRating.grade}
            </Badge>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            {/* Economic Resilience */}
            <div className="text-center">
              <div className="text-lg font-bold text-emerald-600">
                {enhancedAnalysis.resilience.overallScore}%
              </div>
              <div className="text-xs text-gray-600">Resilience</div>
            </div>

            {/* Productivity */}
            <div className="text-center">
              <div className="text-lg font-bold text-blue-600">
                {enhancedAnalysis.productivity.overallScore}%
              </div>
              <div className="text-xs text-gray-600">Productivity</div>
            </div>

            {/* Wellbeing */}
            <div className="text-center">
              <div className="text-lg font-bold text-purple-600">
                {enhancedAnalysis.wellbeing.overallScore}%
              </div>
              <div className="text-xs text-gray-600">Wellbeing</div>
            </div>

            {/* Complexity */}
            <div className="text-center">
              <div className="text-lg font-bold text-orange-600">
                {enhancedAnalysis.complexity.overallScore}%
              </div>
              <div className="text-xs text-gray-600">Complexity</div>
            </div>
          </div>

          {/* Key Insights */}
          {enhancedAnalysis.keyInsights.length > 0 && (
            <div className="mt-3 border-t border-blue-200 pt-3 dark:border-blue-800">
              <div className="text-xs text-blue-700 dark:text-blue-300">
                <strong>Key Insight:</strong> {enhancedAnalysis.keyInsights[0]}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
