// PolicySelector Component
// Refactored from GovernmentSpendingSectionEnhanced.tsx
// Handles policy selection interface with filtering and categorization

"use client";

import React from "react";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import {
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Clock,
  Users,
  Zap,
  Shield,
  Info,
  DollarSign,
} from "lucide-react";
import { ComponentType } from "~/components/government/atoms/AtomicGovernmentComponents";
import {
  getApplicablePolicies,
  type SpendingPolicy,
} from "../../data/government-spending-policies";

interface PolicySelectorProps {
  selectedPolicies: Set<string>;
  selectedAtomicComponents: ComponentType[];
  onTogglePolicy: (policyId: string) => void;
  className?: string;
}

/**
 * PolicySelector - Displays and manages policy selection
 * Filters policies based on atomic components and shows impact metrics
 */
export function PolicySelector({
  selectedPolicies,
  selectedAtomicComponents,
  onTogglePolicy,
  className,
}: PolicySelectorProps) {
  const applicablePolicies = getApplicablePolicies(selectedAtomicComponents);

  if (applicablePolicies.length === 0) {
    return (
      <div className={cn("grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3", className)}>
        <div className="border-border bg-muted/30 col-span-full rounded-lg border-2 border-dashed p-8 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="bg-muted rounded-full p-3">
              <Info className="text-muted-foreground h-6 w-6" />
            </div>
            <div>
              <h3 className="text-foreground mb-1 font-semibold">No Applicable Policies</h3>
              <p className="text-muted-foreground text-sm">
                Select atomic components to see recommended policies that align with your government
                structure.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3", className)}>
      {applicablePolicies.map((policy) => {
        const isSelected = selectedPolicies.has(policy.id);
        return (
          <PolicyCard
            key={policy.id}
            policy={policy}
            isSelected={isSelected}
            onClick={() => onTogglePolicy(policy.id)}
          />
        );
      })}
    </div>
  );
}

/**
 * PolicyCard - Individual policy display card using atomic component design
 */
function PolicyCard({
  policy,
  isSelected,
  onClick,
}: {
  policy: SpendingPolicy;
  isSelected: boolean;
  onClick: () => void;
}) {
  const Icon = policy.icon;

  // Calculate total impact for effectiveness display
  const totalImpact = Object.values(policy.impact).reduce((sum, value) => sum + Math.abs(value), 0);
  const effectiveness = Math.min(100, Math.max(0, 50 + totalImpact / 2)); // Convert impact to 0-100 scale

  const getCardClasses = () => {
    if (isSelected) {
      return "border-2 border-blue-500 bg-blue-500/5 dark:bg-blue-500/10 shadow-lg";
    }
    return "border-2 border-border hover:border-blue-500/50 hover:shadow-md";
  };

  const getIconColor = () => {
    if (isSelected) {
      return "text-blue-600";
    }
    return "text-muted-foreground";
  };

  const getEffectivenessBgColor = (eff: number) => {
    if (eff >= 80) return "bg-green-500/10";
    if (eff >= 60) return "bg-yellow-500/10";
    return "bg-red-500/10";
  };

  const getEffectivenessColor = (eff: number) => {
    if (eff >= 80) return "text-green-600";
    if (eff >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div
      className={cn(
        "cursor-pointer rounded-lg p-4 transition-all hover:shadow-md",
        getCardClasses()
      )}
      onClick={onClick}
    >
      {/* Header */}
      <div className="mb-2 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "rounded-lg p-2",
              isSelected
                ? `${getEffectivenessBgColor(effectiveness)} ${getIconColor()}`
                : "bg-muted"
            )}
          >
            {Icon ? <Icon className="h-4 w-4" /> : <Info className="h-4 w-4" />}
          </div>
          <h4 className="text-foreground text-sm font-semibold">{policy.name}</h4>
        </div>

        <div className="flex items-center gap-1">
          <Badge variant="outline" className="text-xs">
            {Math.round(effectiveness)}%
          </Badge>
          {isSelected && <CheckCircle className="h-4 w-4 text-green-500 dark:text-green-400" />}
        </div>
      </div>

      {/* Description */}
      <p className="text-muted-foreground mb-3 line-clamp-2 text-xs">{policy.description}</p>

      {/* Impact Metrics */}
      <div className="space-y-2">
        {Object.entries(policy.impact).map(([key, value]) => (
          <div key={key} className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground capitalize">{key}:</span>
            <Badge variant={value > 0 ? "default" : "destructive"} className="text-xs">
              {value > 0 ? "+" : ""}
              {value}%
            </Badge>
          </div>
        ))}
      </div>

      {/* Policy Metadata */}
      <div className="border-border/50 mt-2 space-y-1 border-t pt-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            Impact:
          </span>
          <span className="font-medium">{Object.keys(policy.impact).length} areas</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground flex items-center gap-1">
            <Zap className="h-3 w-3" />
            Max Effect:
          </span>
          <span className="font-medium">{Math.max(...Object.values(policy.impact))}%</span>
        </div>
      </div>
    </div>
  );
}
