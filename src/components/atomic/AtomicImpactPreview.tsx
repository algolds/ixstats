"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Shield,
  Globe,
  Activity,
  AlertCircle,
  CheckCircle,
  Info,
  Settings,
} from "lucide-react";
import { ComponentType } from "@prisma/client";
import { cn } from "~/lib/utils";
import type { AtomicEconomicModifiers } from "~/lib/atomic-builder-state";

interface AtomicImpactPreviewProps {
  selectedComponents: ComponentType[];
  economicImpact: AtomicEconomicModifiers;
  effectivenessScore: number;
  synergyCount: number;
  conflictCount: number;
  className?: string;
}

interface ImpactCardProps {
  title: string;
  icon: React.ReactNode;
  value: string | number;
  change?: string;
  trend?: "up" | "down" | "stable";
  color?: "green" | "red" | "blue" | "orange" | "purple";
  subtitle?: string;
}

function ImpactCard({
  title,
  icon,
  value,
  change,
  trend,
  color = "blue",
  subtitle,
}: ImpactCardProps) {
  const colorClasses = {
    green: "from-green-50 to-emerald-50 border-green-200 text-green-700",
    red: "from-red-50 to-rose-50 border-red-200 text-red-700",
    blue: "from-blue-50 to-cyan-50 border-blue-200 text-blue-700",
    orange: "from-orange-50 to-amber-50 border-orange-200 text-orange-700",
    purple: "from-purple-50 to-violet-50 border-purple-200 text-purple-700",
  };

  const trendIcon = {
    up: <TrendingUp className="h-3 w-3" />,
    down: <TrendingDown className="h-3 w-3" />,
    stable: <Activity className="h-3 w-3" />,
  };

  return (
    <motion.div
      className={cn("rounded-lg border bg-gradient-to-br p-4", colorClasses[color])}
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {icon}
          <h3 className="text-sm font-medium">{title}</h3>
        </div>
        {trend && (
          <div
            className={cn(
              "flex items-center space-x-1 text-xs",
              trend === "up"
                ? "text-green-600"
                : trend === "down"
                  ? "text-red-600"
                  : "text-gray-600"
            )}
          >
            {trendIcon[trend]}
            {change}
          </div>
        )}
      </div>

      <div className="mb-1 text-2xl font-bold">{value}</div>

      {subtitle && <div className="text-xs opacity-70">{subtitle}</div>}
    </motion.div>
  );
}

interface ProgressBarProps {
  value: number;
  max: number;
  color?: "green" | "red" | "blue" | "orange";
  showValue?: boolean;
}

function ProgressBar({ value, max, color = "blue", showValue = true }: ProgressBarProps) {
  const percentage = (value / max) * 100;

  const colorClasses = {
    green: "bg-green-500",
    red: "bg-red-500",
    blue: "bg-blue-500",
    orange: "bg-orange-500",
  };

  return (
    <div className="space-y-1">
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
        <motion.div
          className={cn("h-2 rounded-full transition-all", colorClasses[color])}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(percentage, 100)}%` }}
          transition={{ duration: 0.5, delay: 0.2 }}
        />
      </div>
      {showValue && (
        <div className="text-muted-foreground flex justify-between text-xs">
          <span>{value.toFixed(1)}</span>
          <span>{max}</span>
        </div>
      )}
    </div>
  );
}

export function AtomicImpactPreview({
  selectedComponents,
  economicImpact,
  effectivenessScore,
  synergyCount,
  conflictCount,
  className,
}: AtomicImpactPreviewProps) {
  const { gdpImpact, taxEfficiency, stabilityIndex, internationalStanding } = economicImpact;

  // Calculate net synergy score
  const netSynergyScore = synergyCount - conflictCount;

  // Determine overall system health
  const systemHealth =
    effectivenessScore >= 80
      ? "excellent"
      : effectivenessScore >= 60
        ? "good"
        : effectivenessScore >= 40
          ? "fair"
          : "poor";

  return (
    <div className={cn("atomic-impact-preview space-y-6", className)}>
      {/* Header */}
      <div className="text-center">
        <h2 className="text-foreground mb-2 text-xl font-semibold">Live Impact Preview</h2>
        <p className="text-muted-foreground text-sm">
          Real-time analysis of your atomic component selection
        </p>
      </div>

      {/* Overall Effectiveness Score */}
      <div className="rounded-lg bg-gradient-to-r from-slate-50 to-slate-100 p-4 dark:from-slate-800 dark:to-slate-700">
        <div className="mb-3 text-center">
          <div className="text-foreground text-3xl font-bold">{effectivenessScore.toFixed(0)}%</div>
          <div className="text-muted-foreground text-sm">System Effectiveness</div>
        </div>

        <ProgressBar
          value={effectivenessScore}
          max={100}
          color={effectivenessScore >= 80 ? "green" : effectivenessScore >= 60 ? "blue" : "red"}
        />

        <div
          className={cn(
            "mt-2 text-center text-xs font-medium",
            systemHealth === "excellent"
              ? "text-green-600"
              : systemHealth === "good"
                ? "text-blue-600"
                : systemHealth === "fair"
                  ? "text-orange-600"
                  : "text-red-600"
          )}
        >
          {systemHealth === "excellent" && "🎯 Exceptional Configuration"}
          {systemHealth === "good" && "✅ Strong Configuration"}
          {systemHealth === "fair" && "⚠️ Moderate Configuration"}
          {systemHealth === "poor" && "❌ Needs Improvement"}
        </div>
      </div>

      {/* Synergies and Conflicts */}
      <div className="grid grid-cols-2 gap-4">
        <div
          className={cn(
            "rounded-lg border p-3",
            synergyCount > 0 ? "border-green-200 bg-green-50" : "border-gray-200 bg-gray-50"
          )}
        >
          <div className="mb-1 flex items-center space-x-2">
            <CheckCircle
              className={cn("h-4 w-4", synergyCount > 0 ? "text-green-600" : "text-gray-400")}
            />
            <span className="text-sm font-medium">Synergies</span>
          </div>
          <div className="text-lg font-bold text-green-700">+{synergyCount}</div>
        </div>

        <div
          className={cn(
            "rounded-lg border p-3",
            conflictCount > 0 ? "border-red-200 bg-red-50" : "border-gray-200 bg-gray-50"
          )}
        >
          <div className="mb-1 flex items-center space-x-2">
            <AlertCircle
              className={cn("h-4 w-4", conflictCount > 0 ? "text-red-600" : "text-gray-400")}
            />
            <span className="text-sm font-medium">Conflicts</span>
          </div>
          <div className="text-lg font-bold text-red-700">-{conflictCount}</div>
        </div>
      </div>

      {/* Economic Impact Cards */}
      <div className="space-y-3">
        <h3 className="text-foreground text-sm font-semibold">Economic Impact</h3>

        <div className="grid grid-cols-1 gap-3">
          {/* GDP Impact */}
          <ImpactCard
            title="GDP Growth"
            icon={<TrendingUp className="h-4 w-4" />}
            value={`${((gdpImpact.current - 1) * 100).toFixed(1)}%`}
            change={
              gdpImpact.current > 1 ? `+${((gdpImpact.current - 1) * 100).toFixed(1)}%` : "0%"
            }
            trend={gdpImpact.current > 1.05 ? "up" : gdpImpact.current > 0.95 ? "stable" : "down"}
            color="green"
            subtitle={`Confidence: ${gdpImpact.confidence}%`}
          />

          {/* Tax Efficiency */}
          <ImpactCard
            title="Tax Efficiency"
            icon={<DollarSign className="h-4 w-4" />}
            value={`${((taxEfficiency.currentMultiplier - 1) * 100).toFixed(1)}%`}
            change={`${taxEfficiency.complianceRate}% compliance`}
            trend={taxEfficiency.currentMultiplier > 1.1 ? "up" : "stable"}
            color="blue"
            subtitle="Collection efficiency boost"
          />

          {/* Stability Index */}
          <ImpactCard
            title="Stability"
            icon={<Shield className="h-4 w-4" />}
            value={`${stabilityIndex.current.toFixed(0)}/100`}
            change={stabilityIndex.trend}
            trend={
              stabilityIndex.trend === "improving"
                ? "up"
                : stabilityIndex.trend === "declining"
                  ? "down"
                  : "stable"
            }
            color="purple"
            subtitle={`${stabilityIndex.factors.length} factors`}
          />

          {/* International Standing */}
          <ImpactCard
            title="Int'l Standing"
            icon={<Globe className="h-4 w-4" />}
            value={`+${(internationalStanding.tradeBonus * 100).toFixed(1)}%`}
            change={`+${(internationalStanding.diplomaticWeight * 100).toFixed(1)}% influence`}
            trend={internationalStanding.tradeBonus > 0.1 ? "up" : "stable"}
            color="orange"
            subtitle="Trade & diplomacy bonus"
          />
        </div>
      </div>

      {/* Component Count Display */}
      <div className="bg-muted/30 rounded-lg p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Info className="text-muted-foreground h-4 w-4" />
            <span className="text-muted-foreground text-sm">Active Components</span>
          </div>
          <span className="text-sm font-medium">{selectedComponents.length}/25</span>
        </div>

        <div className="mt-2 h-1 w-full rounded-full bg-gray-200">
          <div
            className="bg-primary h-1 rounded-full transition-all"
            style={{ width: `${(selectedComponents.length / 25) * 100}%` }}
          />
        </div>
      </div>

      {/* Projections */}
      <div className="space-y-3">
        <h3 className="text-foreground text-sm font-semibold">Future Projections</h3>

        <div className="space-y-2 text-xs">
          <div className="bg-muted/20 flex items-center justify-between rounded p-2">
            <span>1 Year GDP Impact:</span>
            <span className="font-medium">
              +{((gdpImpact.projected1Year - 1) * 100).toFixed(1)}%
            </span>
          </div>

          <div className="bg-muted/20 flex items-center justify-between rounded p-2">
            <span>3 Year GDP Impact:</span>
            <span className="font-medium">
              +{((gdpImpact.projected3Years - 1) * 100).toFixed(1)}%
            </span>
          </div>

          <div className="bg-muted/20 flex items-center justify-between rounded p-2">
            <span>Tax Revenue Boost:</span>
            <span className="font-medium">
              ${(taxEfficiency.projectedRevenue / 1000).toFixed(0)}k
            </span>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      {selectedComponents.length > 0 && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950">
          <div className="mb-2 flex items-center space-x-2">
            <Info className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
              System Analysis
            </span>
          </div>

          <div className="space-y-1 text-xs text-blue-600 dark:text-blue-400">
            {effectivenessScore >= 85 && (
              <div>✓ Exceptional system effectiveness - ideal configuration</div>
            )}
            {synergyCount > conflictCount && <div>✓ Positive synergies outweigh conflicts</div>}
            {conflictCount > 0 && (
              <div>⚠ Component conflicts detected - consider alternatives</div>
            )}
            {selectedComponents.length < 5 && (
              <div>💡 Add more components for comprehensive governance</div>
            )}
            {gdpImpact.current > 1.2 && <div>🚀 Strong economic growth potential</div>}
          </div>
        </div>
      )}

      {/* Empty State */}
      {selectedComponents.length === 0 && (
        <div className="text-muted-foreground py-8 text-center">
          <div className="bg-muted/30 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
            <Settings className="h-8 w-8" />
          </div>
          <p className="text-sm">Select atomic components to see live impact analysis</p>
        </div>
      )}
    </div>
  );
}
