// SpendingValidationPanel Component
// Refactored from GovernmentSpendingSectionEnhanced.tsx
// Displays budget validation status and financial health indicators

"use client";

import React from 'react';
import { Badge } from '~/components/ui/badge';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { cn } from '~/lib/utils';
import { CheckCircle2, AlertCircle, AlertTriangle, TrendingUp, Settings, Zap, Info } from 'lucide-react';

interface SpendingValidationPanelProps {
  totalBudget: number;
  totalAllocated: number;
  totalRevenue: number;
  budgetUtilization: number;
  isValidBudget: boolean;
  isSurplus: boolean;
  selectedPoliciesCount: number;
  isUpdating?: boolean;
  className?: string;
}

/**
 * SpendingValidationPanel - Shows budget status, validation, and key metrics
 * Provides visual feedback on budget health and policy configuration
 */
export function SpendingValidationPanel({
  totalBudget,
  totalAllocated,
  totalRevenue,
  budgetUtilization,
  isValidBudget,
  isSurplus,
  selectedPoliciesCount,
  isUpdating = false,
  className
}: SpendingValidationPanelProps) {
  return (
    <div className={cn("space-y-4", className)}>
      {/* Integration Status Indicator */}
      {isUpdating && (
        <Alert className="border-blue-200 bg-blue-50">
          <Zap className="h-4 w-4 text-blue-600 animate-pulse" />
          <AlertDescription className="text-blue-800">
            Updating government structure from atomic components...
          </AlertDescription>
        </Alert>
      )}

      {/* Budget Status Badges */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Budget Utilization Badge */}
        {totalBudget > 0 && (
          <Badge
            variant={isValidBudget ? "default" : "secondary"}
            className="px-3 py-1"
          >
            {isValidBudget ? (
              <>
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Budget: {budgetUtilization.toFixed(1)}%
              </>
            ) : (
              <>
                <AlertCircle className="h-3 w-3 mr-1" />
                Budget: {budgetUtilization.toFixed(1)}%
              </>
            )}
          </Badge>
        )}

        {/* Surplus/Deficit Badge */}
        {totalRevenue > 0 && (
          <Badge
            variant={isSurplus ? "default" : "destructive"}
            className="px-3 py-1"
          >
            {isSurplus ? (
              <>
                <TrendingUp className="h-3 w-3 mr-1" />
                Surplus
              </>
            ) : (
              <>
                <AlertTriangle className="h-3 w-3 mr-1" />
                Deficit
              </>
            )}
          </Badge>
        )}

        {/* Policy Count Badge */}
        <Badge variant="outline" className="px-3 py-1">
          <Settings className="h-3 w-3 mr-1" />
          {selectedPoliciesCount} Policies
        </Badge>
      </div>

      {/* Budget Health Details */}
      {totalBudget > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <BudgetMetric
            label="Total Budget"
            value={totalBudget.toLocaleString()}
            currency={true}
            status={isValidBudget ? 'success' : 'warning'}
          />
          <BudgetMetric
            label="Allocated"
            value={totalAllocated.toLocaleString()}
            currency={true}
            status={budgetUtilization > 105 ? 'error' : budgetUtilization < 95 ? 'warning' : 'success'}
          />
          <BudgetMetric
            label="Revenue"
            value={totalRevenue.toLocaleString()}
            currency={true}
            status={isSurplus ? 'success' : 'warning'}
          />
        </div>
      )}

      {/* Validation Messages */}
      {!isValidBudget && totalBudget > 0 && (
        <Alert className={cn(
          budgetUtilization > 105
            ? "border-red-200 bg-red-50"
            : "border-yellow-200 bg-yellow-50"
        )}>
          <AlertTriangle className={cn(
            "h-4 w-4",
            budgetUtilization > 105 ? "text-red-600" : "text-yellow-600"
          )} />
          <AlertDescription className={cn(
            budgetUtilization > 105 ? "text-red-800" : "text-yellow-800"
          )}>
            {budgetUtilization > 105 ? (
              <>Budget is over-allocated by {(budgetUtilization - 100).toFixed(1)}%. Reduce spending to balance the budget.</>
            ) : (
              <>Budget utilization is {budgetUtilization.toFixed(1)}%. Consider allocating remaining {(100 - budgetUtilization).toFixed(1)}% to priority areas.</>
            )}
          </AlertDescription>
        </Alert>
      )}

      {!isSurplus && totalRevenue > 0 && totalBudget > 0 && (
        <Alert className="border-yellow-200 bg-yellow-50">
          <Info className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            Budget deficit of {Math.abs(totalRevenue - totalAllocated).toLocaleString()}.
            Consider increasing revenue sources or reducing spending.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

/**
 * BudgetMetric - Individual budget metric display
 */
function BudgetMetric({
  label,
  value,
  currency = false,
  status = 'default'
}: {
  label: string;
  value: string;
  currency?: boolean;
  status?: 'default' | 'success' | 'warning' | 'error';
}) {
  const statusColors = {
    default: 'bg-muted border-border',
    success: 'bg-green-50 border-green-200',
    warning: 'bg-yellow-50 border-yellow-200',
    error: 'bg-red-50 border-red-200'
  };

  const statusTextColors = {
    default: 'text-foreground',
    success: 'text-green-700',
    warning: 'text-yellow-700',
    error: 'text-red-700'
  };

  return (
    <div className={cn(
      "p-3 rounded-lg border",
      statusColors[status]
    )}>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={cn("text-lg font-semibold", statusTextColors[status])}>
        {currency && '$'}{value}
      </p>
    </div>
  );
}
